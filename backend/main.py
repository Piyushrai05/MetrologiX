"""
MetrologiX Core API  —  FastAPI application
==========================================
Key changes in this revision
  - /api/oiml/config   : expose OIML rule config to frontend (removes getMPELimit from frontend)
  - /api/oiml/mpe      : compute MPE for given params
  - AI analysis does NOT set overall_status — only advisory anomaly flags
  - overall_status derived deterministically from TestRecord.is_compliant + required modules
  - rule_version stored on every TestSession and TestReport
  - Pydantic validation errors returned as structured field-level JSON (422)
  - Environment temperature warning stored on session (not rejection)
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlmodel import Session, select

from ai_engine import (
    compute_thermal_drift,
    detect_anomalies,
    fit_creep_model,
    generate_recommendations,
)
from database import (
    Instrument,
    TestRecord,
    TestReport,
    TestSession,
    create_db_and_tables,
    get_session,
)
from models import (
    AIAnalysisInput,
    CreepTestInput,
    DiscriminationTestInput,
    EccentricityTestInput,
    InstrumentCreate,
    RepeatabilityTestInput,
    TareTestInput,
    TemperatureEffectTestInput,
    ThermalTestInput,
    WeighingTestInput,
    ZeroSettingTestInput,
    TestSessionCreate,
)
from oiml_engine import (
    CFG,
    RULE_VERSION,
    calculate_mpe,
    check_environment_warnings,
    compute_session_status,
    evaluate_creep_test,
    evaluate_discrimination_test,
    evaluate_eccentricity_test,
    evaluate_repeatability_test,
    evaluate_tare_test,
    evaluate_temperature_effect_test,
    evaluate_weighing_test,
    evaluate_zero_setting_test,
    get_accuracy_class_limits,
    get_mpe_tiers,
    get_rule_version,
    validate_instrument_params,
)
from report_generator import compute_sha256, generate_pdf_report, generate_report_number
from demo_data import seed_demo_data

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="MetrologiX Core API",
    version="2.0.0",
    description="OIML R-76 NAWI Test Reporting System | SIH 2026 PS26035",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    create_db_and_tables()


# ---------------------------------------------------------------------------
# Validation error handler  →  structured field-level JSON
# ---------------------------------------------------------------------------

@app.exception_handler(ValidationError)
async def pydantic_error_handler(_req: Any, exc: ValidationError) -> JSONResponse:
    fields: Dict[str, str] = {}
    for err in exc.errors():
        loc = ".".join(str(x) for x in err["loc"])
        fields[loc] = err["msg"]
    return JSONResponse(
        status_code=422,
        content={"detail": "Validation error", "fields": fields},
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _session_module_map(session_id: str, db: Session) -> Dict[str, List[bool]]:
    """Build {module_name: [is_compliant, ...]} from DB records."""
    records = db.exec(
        select(TestRecord).where(TestRecord.session_id == session_id)
    ).all()
    module_map: Dict[str, List[bool]] = {}
    for r in records:
        module_map.setdefault(r.test_module, []).append(r.is_compliant)
    return module_map


def _refresh_session_status(sess: TestSession, db: Session) -> str:
    """Recompute and persist overall_status; return new status."""
    module_map = _session_module_map(sess.id, db)
    status = compute_session_status(sess.test_type, module_map)
    if sess.overall_status != status:
        sess.overall_status = status
        db.add(sess)
        db.commit()
    return status


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health() -> Dict:
    return {
        "status": "ok",
        "version": "2.0.0",
        "oiml_rule_version": RULE_VERSION,
        "standard": "OIML R-76-1:2006/AMD1:2018",
        "system": "MetrologiX Core",
        "timestamp": datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# OIML config endpoints  (frontend uses these, NOT hard-coded JS values)
# ---------------------------------------------------------------------------

@app.get("/api/oiml/config")
def oiml_config() -> Dict:
    """Return full OIML config (for frontend caching of MPE tables)."""
    return {
        "rule_version": RULE_VERSION,
        "mpe_tables": CFG["mpe_tables"]["initial_verification"],
        "in_service_factor": CFG["in_service_factor"]["value"],
        "accuracy_classes": CFG["accuracy_classes"]["accepted_values"],
        "repeatability_limit_factor": CFG["repeatability"]["max_span_multiples_of_e"],
        "creep_limit_factor": CFG["creep"]["max_drift_multiples_of_e"],
        "thermal_limit_factor": CFG["thermal"]["max_error_change_per_5c_multiples_of_e"],
        "environment": {
            "temp_warning_min_c": CFG["environment"]["temp_warning_min_c"],
            "temp_warning_max_c": CFG["environment"]["temp_warning_max_c"],
        },
        "required_test_modules": CFG["required_test_modules"],
        "verified_flags": {
            "mpe_tables": CFG["mpe_tables"]["verified"],
            "class_limits": CFG["class_limits"]["verified"],
            "in_service_factor": CFG["in_service_factor"]["verified"],
        },
    }


@app.get("/api/oiml/mpe")
def compute_mpe_api(
    load: float = Query(..., ge=0, description="Test load"),
    e: float = Query(..., gt=0, description="Scale interval e"),
    accuracy_class: str = Query(..., description="Accuracy class: I/II/III/IIII"),
    in_service: bool = Query(False),
) -> Dict:
    """Compute MPE for given parameters."""
    mpe = calculate_mpe(load, e, accuracy_class, in_service)
    return {
        "load": load,
        "e": e,
        "accuracy_class": accuracy_class,
        "in_service": in_service,
        "mpe": mpe,
        "mpe_tiers": get_mpe_tiers(accuracy_class),
        "rule_version": RULE_VERSION,
    }


# ---------------------------------------------------------------------------
# Instruments
# ---------------------------------------------------------------------------

@app.get("/api/instruments")
def list_instruments(db: Session = Depends(get_session)) -> List[Dict]:
    instruments = db.exec(select(Instrument)).all()
    result = []
    for inst in instruments:
        sessions = db.exec(
            select(TestSession).where(TestSession.instrument_id == inst.id)
        ).all()
        result.append({
            "id": inst.id,
            "model_number": inst.model_number,
            "manufacturer": inst.manufacturer,
            "serial_number": inst.serial_number,
            "accuracy_class": inst.accuracy_class,
            "max_capacity": inst.max_capacity,
            "min_capacity": inst.min_capacity,
            "scale_interval_e": inst.scale_interval_e,
            "scale_interval_d": inst.scale_interval_d,
            "n_max": inst.n_max,
            "unit": inst.unit,
            "created_at": inst.created_at,
            "test_count": len(sessions),
        })
    return result


@app.post("/api/instruments", status_code=201)
def create_instrument(data: InstrumentCreate, db: Session = Depends(get_session)) -> Dict:
    # Additional engine-level validation (d<=e, class limits)
    engine_errors = validate_instrument_params(
        data.accuracy_class,
        data.max_capacity,
        data.min_capacity,
        data.scale_interval_e,
        data.scale_interval_d,
    )
    if engine_errors:
        raise HTTPException(
            status_code=422,
            detail={"detail": "Validation error", "fields": {"_instrument": "; ".join(engine_errors)}},
        )

    n_max = round(data.max_capacity / data.scale_interval_e, 2)
    inst = Instrument(
        **data.model_dump(),
        n_max=n_max,
    )
    db.add(inst)
    db.commit()
    db.refresh(inst)
    return {**inst.model_dump(), "rule_version": RULE_VERSION}


@app.get("/api/instruments/{inst_id}")
def get_instrument(inst_id: str, db: Session = Depends(get_session)) -> Dict:
    inst = db.get(Instrument, inst_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")
    sessions = db.exec(
        select(TestSession).where(TestSession.instrument_id == inst_id)
    ).all()
    session_list = []
    for sess in sessions:
        report = db.exec(
            select(TestReport).where(TestReport.session_id == sess.id)
        ).first()
        session_list.append({
            "id": sess.id,
            "test_type": sess.test_type,
            "inspector_name": sess.inspector_name,
            "lab_location": sess.lab_location,
            "overall_status": sess.overall_status,
            "created_at": sess.created_at,
            "has_report": report is not None,
            "report_number": report.report_number if report else None,
        })
    return {
        "instrument": inst.model_dump(),
        "sessions": session_list,
        "class_limits": get_accuracy_class_limits(inst.accuracy_class),
    }


# ---------------------------------------------------------------------------
# Test sessions
# ---------------------------------------------------------------------------

@app.post("/api/sessions", status_code=201)
def create_session(data: TestSessionCreate, db: Session = Depends(get_session)) -> Dict:
    inst = db.get(Instrument, data.instrument_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")

    # Environment warnings (not rejection)
    warnings = check_environment_warnings(data.ambient_temp_c)

    sess = TestSession(
        **data.model_dump(),
        rule_version=RULE_VERSION,
        env_warnings=json.dumps(warnings),
    )
    db.add(sess)
    db.commit()
    db.refresh(sess)
    return {
        **{k: v for k, v in sess.model_dump().items()},
        "env_warnings": warnings,
    }


@app.get("/api/sessions")
def list_sessions(
    instrument_id: Optional[str] = None,
    db: Session = Depends(get_session),
) -> List[Dict]:
    q = select(TestSession)
    if instrument_id:
        q = q.where(TestSession.instrument_id == instrument_id)
    sessions = db.exec(q).all()
    result = []
    for sess in sessions:
        inst = db.get(Instrument, sess.instrument_id)
        result.append({
            **sess.model_dump(),
            "instrument_model": inst.model_number if inst else "N/A",
            "instrument_manufacturer": inst.manufacturer if inst else "N/A",
        })
    return result


@app.get("/api/sessions/{session_id}")
def get_session_detail(session_id: str, db: Session = Depends(get_session)) -> Dict:
    sess = db.get(TestSession, session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    inst = db.get(Instrument, sess.instrument_id)
    records = db.exec(
        select(TestRecord).where(TestRecord.session_id == session_id)
    ).all()
    report = db.exec(
        select(TestReport).where(TestReport.session_id == session_id)
    ).first()

    modules: Dict[str, List] = {}
    for r in records:
        modules.setdefault(r.test_module, []).append({
            "id": r.id, "test_module": r.test_module,
            "load_applied": r.load_applied, "indication_raw": r.indication_raw,
            "delta_load": r.delta_load, "calculated_error": r.calculated_error,
            "corrected_error": r.corrected_error, "mpe_limit": r.mpe_limit,
            "is_compliant": r.is_compliant, "sequence_order": r.sequence_order,
            "direction": r.direction, "position": r.position,
            "temperature_c": r.temperature_c, "time_minutes": r.time_minutes,
        })

    return {
        "session": sess.model_dump(),
        "instrument": inst.model_dump() if inst else None,
        "modules": modules,
        "report": report.model_dump() if report else None,
        "env_warnings": json.loads(sess.env_warnings or "[]"),
    }


# ---------------------------------------------------------------------------
# Test evaluations
# ---------------------------------------------------------------------------

@app.post("/api/tests/weighing")
def run_weighing_test(data: WeighingTestInput, db: Session = Depends(get_session)) -> Dict:
    sess = db.get(TestSession, data.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    inst = db.get(Instrument, sess.instrument_id)

    points_dicts = [p.model_dump() for p in data.points]
    result = evaluate_weighing_test(points_dicts, inst.scale_interval_e, inst.accuracy_class)

    # Replace existing records for this module
    for rec in db.exec(
        select(TestRecord).where(
            TestRecord.session_id == data.session_id,
            TestRecord.test_module == "weighing",
        )
    ).all():
        db.delete(rec)

    for i, (pt, res) in enumerate(zip(points_dicts, result["points"])):
        db.add(TestRecord(
            session_id=data.session_id, test_module="weighing",
            load_applied=pt["load"], indication_raw=pt["indication"],
            delta_load=pt.get("delta_load", 0),
            calculated_error=res["E"], mpe_limit=res["mpe"],
            corrected_error=res["Ec"], is_compliant=res["is_compliant"],
            sequence_order=i, direction=pt.get("direction", "increasing"),
        ))
    db.commit()

    # Recompute overall status deterministically
    _refresh_session_status(sess, db)
    return {**result, "session_status": sess.overall_status}


@app.post("/api/tests/eccentricity")
def run_eccentricity_test(data: EccentricityTestInput, db: Session = Depends(get_session)) -> Dict:
    sess = db.get(TestSession, data.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    inst = db.get(Instrument, sess.instrument_id)

    points_dicts = [p.model_dump() for p in data.points]
    result = evaluate_eccentricity_test(
        points_dicts, inst.scale_interval_e, inst.accuracy_class, data.center_indication
    )

    for rec in db.exec(
        select(TestRecord).where(
            TestRecord.session_id == data.session_id,
            TestRecord.test_module == "eccentricity",
        )
    ).all():
        db.delete(rec)

    for i, res in enumerate(result["points"]):
        db.add(TestRecord(
            session_id=data.session_id, test_module="eccentricity",
            load_applied=res["load"], indication_raw=res["indication"],
            calculated_error=res["diff"], mpe_limit=res["mpe"],
            is_compliant=res["is_compliant"], sequence_order=i,
            position=res["position"],
        ))
    db.commit()
    _refresh_session_status(sess, db)
    return {**result, "session_status": sess.overall_status}


@app.post("/api/tests/repeatability")
def run_repeatability_test(data: RepeatabilityTestInput, db: Session = Depends(get_session)) -> Dict:
    sess = db.get(TestSession, data.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    inst = db.get(Instrument, sess.instrument_id)

    r1 = evaluate_repeatability_test(data.series_half_max, inst.scale_interval_e)
    r2 = evaluate_repeatability_test(data.series_max, inst.scale_interval_e)

    for rec in db.exec(
        select(TestRecord).where(
            TestRecord.session_id == data.session_id,
            TestRecord.test_module == "repeatability",
        )
    ).all():
        db.delete(rec)

    for series_label, series, result_obj in [
        ("half_max", data.series_half_max, r1),
        ("max", data.series_max, r2),
    ]:
        for i, val in enumerate(series):
            db.add(TestRecord(
                session_id=data.session_id, test_module="repeatability",
                load_applied=inst.max_capacity * (0.5 if series_label == "half_max" else 1.0),
                indication_raw=val,
                calculated_error=val - (inst.max_capacity * (0.5 if series_label == "half_max" else 1.0)),
                mpe_limit=result_obj["mpe_limit_span"],
                is_compliant=result_obj["is_compliant"],
                sequence_order=i,
                extra_data=json.dumps({"series": series_label}),
            ))
    db.commit()
    _refresh_session_status(sess, db)
    return {
        "half_max_series": r1,
        "max_series": r2,
        "overall_pass": r1["is_compliant"] and r2["is_compliant"],
        "session_status": sess.overall_status,
    }


@app.post("/api/tests/discrimination")
def run_discrimination_test(data: DiscriminationTestInput, db: Session = Depends(get_session)) -> Dict:
    sess = db.get(TestSession, data.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    inst = db.get(Instrument, sess.instrument_id)

    result = evaluate_discrimination_test(
        data.base_load, data.base_indication,
        data.extra_weight, data.new_indication,
        inst.scale_interval_d,
    )

    for rec in db.exec(
        select(TestRecord).where(
            TestRecord.session_id == data.session_id,
            TestRecord.test_module == "discrimination",
        )
    ).all():
        db.delete(rec)

    db.add(TestRecord(
        session_id=data.session_id, test_module="discrimination",
        load_applied=data.base_load, indication_raw=data.new_indication,
        calculated_error=result["indication_change"],
        mpe_limit=result["required_change"],
        is_compliant=result["is_compliant"],
    ))
    db.commit()
    _refresh_session_status(sess, db)
    return {**result, "session_status": sess.overall_status}


@app.post("/api/tests/creep")
def run_creep_test(data: CreepTestInput, db: Session = Depends(get_session)) -> Dict:
    sess = db.get(TestSession, data.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    inst = db.get(Instrument, sess.instrument_id)

    result = evaluate_creep_test(data.time_series, inst.scale_interval_e)

    for rec in db.exec(
        select(TestRecord).where(
            TestRecord.session_id == data.session_id,
            TestRecord.test_module == "creep",
        )
    ).all():
        db.delete(rec)

    for i, pt in enumerate(data.time_series):
        drift = abs(pt["indication"] - data.time_series[0]["indication"])
        db.add(TestRecord(
            session_id=data.session_id, test_module="creep",
            load_applied=inst.max_capacity,
            indication_raw=pt["indication"],
            calculated_error=drift,
            mpe_limit=result["limit"],
            is_compliant=drift <= result["limit"],
            sequence_order=i,
            time_minutes=pt.get("time_min", 0),
        ))
    db.commit()
    _refresh_session_status(sess, db)
    return {**result, "session_status": sess.overall_status}


@app.post("/api/tests/tare")
def run_tare_test(data: TareTestInput, db: Session = Depends(get_session)) -> Dict:
    sess = db.get(TestSession, data.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    inst = db.get(Instrument, sess.instrument_id)

    result = evaluate_tare_test(
        data.tare_load, data.test_load,
        data.gross_indication, data.net_indication,
        inst.scale_interval_e, inst.accuracy_class,
    )

    for rec in db.exec(
        select(TestRecord).where(
            TestRecord.session_id == data.session_id,
            TestRecord.test_module == "tare",
        )
    ).all():
        db.delete(rec)

    db.add(TestRecord(
        session_id=data.session_id, test_module="tare",
        load_applied=data.test_load,
        indication_raw=data.net_indication,
        calculated_error=result["error"],
        mpe_limit=result["mpe"],
        is_compliant=result["is_compliant"],
        extra_data=json.dumps({"tare_load": data.tare_load, "gross_indication": data.gross_indication}),
    ))
    db.commit()
    _refresh_session_status(sess, db)
    return {**result, "session_status": sess.overall_status}


@app.post("/api/tests/zero-setting")
def run_zero_setting_test(data: ZeroSettingTestInput, db: Session = Depends(get_session)) -> Dict:
    sess = db.get(TestSession, data.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    inst = db.get(Instrument, sess.instrument_id)

    result = evaluate_zero_setting_test(
        data.initial_indication, data.after_zero_indication, inst.scale_interval_e
    )

    for rec in db.exec(
        select(TestRecord).where(
            TestRecord.session_id == data.session_id,
            TestRecord.test_module == "zero_setting",
        )
    ).all():
        db.delete(rec)

    db.add(TestRecord(
        session_id=data.session_id, test_module="zero_setting",
        load_applied=0.0,
        indication_raw=data.after_zero_indication,
        calculated_error=result["drift"],
        mpe_limit=result["limit"],
        is_compliant=result["is_compliant"],
    ))
    db.commit()
    _refresh_session_status(sess, db)
    return {**result, "session_status": sess.overall_status}


@app.post("/api/tests/temperature-effect")
def run_temperature_effect_test(
    data: TemperatureEffectTestInput, db: Session = Depends(get_session)
) -> Dict:
    sess = db.get(TestSession, data.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    inst = db.get(Instrument, sess.instrument_id)

    result = evaluate_temperature_effect_test(
        data.temp_low_c, data.error_at_low,
        data.temp_high_c, data.error_at_high,
        inst.scale_interval_e,
    )

    for rec in db.exec(
        select(TestRecord).where(
            TestRecord.session_id == data.session_id,
            TestRecord.test_module == "temperature_effect",
        )
    ).all():
        db.delete(rec)

    for i, (temp, err) in enumerate([
        (data.temp_low_c, data.error_at_low),
        (data.temp_high_c, data.error_at_high),
    ]):
        db.add(TestRecord(
            session_id=data.session_id, test_module="temperature_effect",
            load_applied=inst.max_capacity,
            indication_raw=err,
            calculated_error=err,
            mpe_limit=result["limit_per_5c"],
            is_compliant=result["is_compliant"],
            sequence_order=i,
            temperature_c=temp,
        ))
    db.commit()
    _refresh_session_status(sess, db)
    return {**result, "session_status": sess.overall_status}


# ---------------------------------------------------------------------------
# AI Analysis  (advisory only — does NOT set overall_status)
# ---------------------------------------------------------------------------

@app.post("/api/sessions/{session_id}/ai-analysis")
def run_ai_analysis(
    session_id: str,
    data: AIAnalysisInput,
    db: Session = Depends(get_session),
) -> Dict:
    sess = db.get(TestSession, session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    inst = db.get(Instrument, sess.instrument_id)
    e = inst.scale_interval_e

    # Build feature matrix from weighing records
    records = db.exec(
        select(TestRecord).where(
            TestRecord.session_id == session_id,
            TestRecord.test_module == "weighing",
        )
    ).all()
    features = [
        [r.load_applied, r.indication_raw, r.calculated_error, r.mpe_limit]
        for r in records
    ]
    anomaly_result = detect_anomalies(features)

    creep_data = data.time_series or [
        {"time_min": 0, "indication": 0},
        {"time_min": 5, "indication": 0.001},
        {"time_min": 15, "indication": 0.002},
        {"time_min": 30, "indication": 0.0025},
    ]
    times = [d["time_min"] for d in creep_data]
    errors = [d["indication"] - creep_data[0]["indication"] for d in creep_data]
    creep_result = fit_creep_model(times, errors)

    temp_data = data.temp_data or [18.0, 20.0, 22.0, 24.0, 26.0]
    temp_errors = data.temp_error_data or [0.001, 0.0012, 0.0013, 0.0015, 0.0016]
    thermal_result = compute_thermal_drift(temp_data, temp_errors, e)

    ecc_records = db.exec(
        select(TestRecord).where(
            TestRecord.session_id == session_id,
            TestRecord.test_module == "eccentricity",
        )
    ).all()
    rep_records = db.exec(
        select(TestRecord).where(
            TestRecord.session_id == session_id,
            TestRecord.test_module == "repeatability",
        )
    ).all()

    test_summary = {
        "weighing_pass": all(r.is_compliant for r in records) if records else True,
        "eccentricity_pass": all(r.is_compliant for r in ecc_records) if ecc_records else True,
        "repeatability_pass": all(r.is_compliant for r in rep_records) if rep_records else True,
    }

    ai_results = {"anomaly": anomaly_result, "creep": creep_result, "thermal": thermal_result}
    recommendations = generate_recommendations(test_summary, ai_results, e)

    # ⚠ AI does NOT write overall_status — get the deterministic value
    deterministic_status = _refresh_session_status(sess, db)

    return {
        "session_id": session_id,
        "ai_results": ai_results,
        "test_summary": test_summary,
        "recommendations": recommendations,
        # overall_verdict reflects deterministic test compliance, not AI score
        "overall_verdict": deterministic_status.upper(),
        "ai_advisory": {
            "anomaly_score": anomaly_result.get("anomaly_score", 0),
            "anomalies_found": anomaly_result.get("anomalies_found", False),
            "note": "AI analysis is advisory only. overall_verdict is derived from deterministic OIML R-76 test results.",
        },
    }


from fastapi.responses import JSONResponse, FileResponse
from report_generator import (
    generate_pdf_report,
    generate_docx_report,
    generate_report_number,
    compute_sha256_bytes,
)


def _build_full_report_data(report: TestReport, db: Session) -> Dict[str, Any]:
    """Constructs the unified ReportModel dictionary used across on-screen view, PDF, and DOCX."""
    sess = db.get(TestSession, report.session_id)
    inst = db.get(Instrument, sess.instrument_id) if sess else None

    records = db.exec(
        select(TestRecord).where(TestRecord.session_id == report.session_id)
    ).all()

    weighing_pts = [
        r.model_dump() for r in records if r.test_module == "weighing"
    ]
    ecc_pts = [
        r.model_dump() for r in records if r.test_module == "eccentricity"
    ]
    rep_pts = [
        r.model_dump() for r in records if r.test_module == "repeatability"
    ]

    return {
        "report_number": report.report_number,
        "issued_at": report.issued_at,
        "rule_version": report.rule_version or RULE_VERSION,
        "overall_verdict": report.overall_verdict,
        "sha256_hash": report.sha256_hash,
        "ai_anomaly_score": report.ai_anomaly_score,
        "ai_diagnosis": report.ai_diagnosis,
        "inspector_sign_name": report.inspector_sign_name or (sess.inspector_name if sess else ""),
        "inspector_sign_designation": report.inspector_sign_designation or "Legal Metrology Officer",
        "inspector_sign_date": report.inspector_sign_date or report.issued_at[:10],
        "instrument": inst.model_dump() if inst else {},
        "session": sess.model_dump() if sess else {},
        "weighing_points": weighing_pts,
        "eccentricity_points": ecc_pts,
        "repeatability_series": rep_pts,
    }


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

@app.post("/api/sessions/{session_id}/generate-report")
def generate_report(session_id: str, db: Session = Depends(get_session)) -> Dict:
    sess = db.get(TestSession, session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    inst = db.get(Instrument, sess.instrument_id)

    prev = db.exec(
        select(TestReport).where(TestReport.session_id == session_id)
    ).first()
    if prev:
        # If already exists, ensure PDF and docx are on disk
        rep_data = _build_full_report_data(prev, db)
        if not prev.pdf_file_path or not os.path.exists(prev.pdf_file_path):
            pdf_path, _, sha256_bytes = generate_pdf_report(rep_data)
            prev.pdf_file_path = pdf_path
            prev.sha256_hash = sha256_bytes
        if not prev.docx_file_path or not os.path.exists(prev.docx_file_path):
            docx_path = generate_docx_report(rep_data)
            prev.docx_file_path = docx_path
        db.add(prev)
        db.commit()
        db.refresh(prev)
        return {**prev.model_dump(), "already_exists": True}

    records = db.exec(
        select(TestRecord).where(TestRecord.session_id == session_id)
    ).all()
    modules: Dict[str, List[bool]] = {}
    for r in records:
        modules.setdefault(r.test_module, []).append(r.is_compliant)

    # Deterministic status derivation
    status = compute_session_status(sess.test_type, modules)
    overall_verdict = status.upper()

    report_number = generate_report_number()
    issued_at_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    temp_report = TestReport(
        session_id=session_id,
        report_number=report_number,
        sha256_hash="PENDING_GENERATION",
        ai_anomaly_score=0.0,
        ai_diagnosis="Evaluated per OIML R-76 deterministic criteria.",
        overall_verdict=status,
        rule_version=RULE_VERSION,
        inspector_sign_name=sess.inspector_name,
        inspector_sign_designation="Legal Metrology Officer",
        inspector_sign_date=datetime.utcnow().strftime("%Y-%m-%d"),
        issued_at=issued_at_str,
    )

    db.add(temp_report)
    sess.overall_status = status
    sess.completed_at = datetime.utcnow().isoformat()
    db.add(sess)
    db.commit()
    db.refresh(temp_report)

    # Build full unified ReportModel
    rep_data = _build_full_report_data(temp_report, db)

    # Generate real PDF & real DOCX
    pdf_path, pdf_bytes, sha256_pdf = generate_pdf_report(rep_data)
    docx_path = generate_docx_report(rep_data)

    temp_report.sha256_hash = sha256_pdf
    temp_report.pdf_file_path = pdf_path
    temp_report.docx_file_path = docx_path
    db.add(temp_report)
    db.commit()
    db.refresh(temp_report)

    return {**temp_report.model_dump(), "already_exists": False}


@app.get("/api/reports/{report_number}/data")
def get_report_data(report_number: str, db: Session = Depends(get_session)) -> Dict:
    """Returns the single shared ReportModel used for the on-screen view, PDF, and DOCX."""
    report = db.exec(
        select(TestReport).where(TestReport.report_number == report_number)
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return _build_full_report_data(report, db)


@app.get("/api/reports/{report_number}/pdf")
def download_pdf(report_number: str, db: Session = Depends(get_session)):
    """Downloads the generated printable PDF report."""
    report = db.exec(
        select(TestReport).where(TestReport.report_number == report_number)
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    rep_data = _build_full_report_data(report, db)
    if not report.pdf_file_path or not os.path.exists(report.pdf_file_path):
        pdf_path, _, sha256_pdf = generate_pdf_report(rep_data)
        report.pdf_file_path = pdf_path
        report.sha256_hash = sha256_pdf
        db.add(report)
        db.commit()

    return FileResponse(
        report.pdf_file_path,
        media_type="application/pdf",
        filename=f"{report.report_number}.pdf",
    )


@app.get("/api/reports/{report_number}/docx")
def download_docx(report_number: str, db: Session = Depends(get_session)):
    """Downloads the editable Word (.docx) report."""
    report = db.exec(
        select(TestReport).where(TestReport.report_number == report_number)
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    rep_data = _build_full_report_data(report, db)
    if not report.docx_file_path or not os.path.exists(report.docx_file_path):
        docx_path = generate_docx_report(rep_data)
        report.docx_file_path = docx_path
        db.add(report)
        db.commit()

    return FileResponse(
        report.docx_file_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=f"{report.report_number}.docx",
    )


@app.get("/api/reports/{report_number}/verify")
def verify_report(report_number: str, db: Session = Depends(get_session)) -> Dict:
    report = db.exec(
        select(TestReport).where(TestReport.report_number == report_number)
    ).first()
    if not report:
        return {"valid": False, "message": "Report not found in registry"}

    sess = db.get(TestSession, report.session_id)
    inst = db.get(Instrument, sess.instrument_id) if sess else None

    return {
        "valid": True,
        "report_number": report.report_number,
        "sha256_hash": report.sha256_hash,
        "overall_verdict": report.overall_verdict,
        "rule_version": report.rule_version,
        "issued_at": report.issued_at,
        "instrument": inst.model_number if inst else "N/A",
        "manufacturer": inst.manufacturer if inst else "N/A",
        "inspector": sess.inspector_name if sess else "N/A",
        "lab_location": sess.lab_location if sess else "N/A",
        "has_pdf": bool(report.pdf_file_path and os.path.exists(report.pdf_file_path)),
        "has_docx": bool(report.docx_file_path and os.path.exists(report.docx_file_path)),
    }


@app.get("/api/reports")
def list_reports(
    verdict: Optional[str] = None,
    instrument_id: Optional[str] = None,
    db: Session = Depends(get_session),
) -> List[Dict]:
    reports = db.exec(select(TestReport)).all()
    result = []
    for r in reports:
        sess = db.get(TestSession, r.session_id)
        inst = db.get(Instrument, sess.instrument_id) if sess else None
        if verdict and r.overall_verdict != verdict:
            continue
        if instrument_id and (sess is None or sess.instrument_id != instrument_id):
            continue
        result.append({
            "id": r.id,
            "report_number": r.report_number,
            "sha256_hash": r.sha256_hash,
            "overall_verdict": r.overall_verdict,
            "rule_version": r.rule_version,
            "ai_anomaly_score": r.ai_anomaly_score,
            "issued_at": r.issued_at,
            "instrument": inst.model_number if inst else "N/A",
            "manufacturer": inst.manufacturer if inst else "N/A",
            "inspector": sess.inspector_name if sess else "N/A",
        })
    return result



# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@app.get("/api/dashboard/stats")
def dashboard_stats(db: Session = Depends(get_session)) -> Dict:
    instruments = db.exec(select(Instrument)).all()
    sessions = db.exec(select(TestSession)).all()
    reports = db.exec(select(TestReport)).all()

    pass_count = sum(1 for s in sessions if s.overall_status == "pass")
    fail_count = sum(1 for s in sessions if s.overall_status == "fail")
    pending_count = sum(1 for s in sessions if s.overall_status == "pending")

    recent = sorted(sessions, key=lambda x: x.created_at, reverse=True)[:5]
    recent_data = []
    for sess in recent:
        inst = db.get(Instrument, sess.instrument_id)
        recent_data.append({
            "id": sess.id,
            "instrument": inst.model_number if inst else "N/A",
            "manufacturer": inst.manufacturer if inst else "N/A",
            "inspector": sess.inspector_name,
            "status": sess.overall_status,
            "test_type": sess.test_type,
            "created_at": sess.created_at,
        })

    return {
        "total_instruments": len(instruments),
        "total_sessions": len(sessions),
        "total_reports": len(reports),
        "pass_count": pass_count,
        "fail_count": fail_count,
        "pending_count": pending_count,
        "pass_rate": round(pass_count / len(sessions) * 100, 1) if sessions else 0,
        "recent_sessions": recent_data,
        "rule_version": RULE_VERSION,
    }


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

@app.post("/api/demo/seed")
def seed_demo(db: Session = Depends(get_session)) -> Dict:
    result = seed_demo_data()
    return {"message": "Demo data seeded successfully", **result}
