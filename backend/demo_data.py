"""
Realistic Demo Data Seeder for MetrologiX.
Seeds 6 instruments across OIML Classes (I, II, III, IIII)
and 12 evaluation sessions (9 PASS, 2 FAIL, 1 AI ANOMALY) with reports.
"""
from sqlmodel import Session, select
from database import engine, Instrument, TestSession, TestRecord, TestReport
from oiml_engine import calculate_mpe, RULE_VERSION
from report_generator import compute_sha256
import uuid
import json
from datetime import datetime, timedelta

def seed_demo_data():
    with Session(engine) as session:
        # Clear existing data in dependency order
        for table in [TestReport, TestRecord, TestSession, Instrument]:
            records = session.exec(select(table)).all()
            for r in records:
                session.delete(r)
        session.commit()

        # ── 6 INSTRUMENTS ACROSS CLASSES (I, II, III, IIII) ───────────────────
        instruments_data = [
            {
                "model_number": "SARTORIUS-MICRO-I",
                "manufacturer": "Sartorius Precision Metrology",
                "serial_number": "SM-2024-001",
                "accuracy_class": "I",
                "max_capacity": 0.200,
                "min_capacity": 0.001,
                "scale_interval_e": 0.0001,
                "scale_interval_d": 0.00001,
                "unit": "kg",
            },
            {
                "model_number": "METTLER-PREC-II",
                "manufacturer": "Mettler Toledo Metrology Ltd.",
                "serial_number": "MT-2024-108",
                "accuracy_class": "II",
                "max_capacity": 5.0,
                "min_capacity": 0.02,
                "scale_interval_e": 0.001,
                "scale_interval_d": 0.0005,
                "unit": "kg",
            },
            {
                "model_number": "ACCULAB-PRO-30K",
                "manufacturer": "AccuWeigh India Pvt. Ltd.",
                "serial_number": "AW-2024-001",
                "accuracy_class": "III",
                "max_capacity": 30.0,
                "min_capacity": 0.1,
                "scale_interval_e": 0.01,
                "scale_interval_d": 0.01,
                "unit": "kg",
            },
            {
                "model_number": "TRADEMAX-15K",
                "manufacturer": "TradeMax Scales Corp.",
                "serial_number": "TM-2023-099",
                "accuracy_class": "III",
                "max_capacity": 15.0,
                "min_capacity": 0.1,
                "scale_interval_e": 0.005,
                "scale_interval_d": 0.005,
                "unit": "kg",
            },
            {
                "model_number": "AVERY-PLATFORM-150",
                "manufacturer": "Avery Weigh-Tronix India",
                "serial_number": "AV-2024-550",
                "accuracy_class": "III",
                "max_capacity": 150.0,
                "min_capacity": 1.0,
                "scale_interval_e": 0.05,
                "scale_interval_d": 0.05,
                "unit": "kg",
            },
            {
                "model_number": "HEAVY-CRANE-IIII",
                "manufacturer": "Bharat Metrology Systems",
                "serial_number": "BMS-2024-889",
                "accuracy_class": "IIII",
                "max_capacity": 1000.0,
                "min_capacity": 20.0,
                "scale_interval_e": 1.0,
                "scale_interval_d": 1.0,
                "unit": "kg",
            },
        ]

        inst_map = {}
        for d in instruments_data:
            inst = Instrument(
                id=str(uuid.uuid4()),
                n_max=round(d["max_capacity"] / d["scale_interval_e"], 2),
                **d
            )
            session.add(inst)
            inst_map[d["model_number"]] = inst
        session.commit()

        # Helper to generate dates in past 30 days
        base_time = datetime.utcnow() - timedelta(days=25)

        # ── 12 SESSIONS (9 PASS, 2 FAIL, 1 ANOMALY) ───────────────────────────
        sessions_plan = [
            # 1. Sartorius Class I (PASS)
            ("SARTORIUS-MICRO-I", "type_evaluation", "Dr. Ramesh Kumar (RRSL-Delhi)", "RRSL New Delhi", 20.2, 48.0, 1014.0, "pass", 0.01, "All tests comply with Class I MPE requirements."),
            # 2. Sartorius Class I Verification (PASS)
            ("SARTORIUS-MICRO-I", "verification", "Er. Priya Nair (RRSL-Mumbai)", "RRSL Mumbai", 21.0, 50.0, 1013.0, "pass", 0.02, "Standard verification pass."),
            # 3. Mettler Class II (PASS)
            ("METTLER-PREC-II", "type_evaluation", "Dr. A. K. Sen (RRSL-Kolkata)", "RRSL Kolkata", 20.0, 52.0, 1012.0, "pass", 0.03, "High-precision laboratory grade compliance verified."),
            # 4. Mettler Class II Periodic (PASS)
            ("METTLER-PREC-II", "verification", "Er. S. Meena (RRSL-Ahmedabad)", "RRSL Ahmedabad", 22.0, 45.0, 1015.0, "pass", 0.02, "Routine field verification passed."),
            # 5. Acculab Class III (PASS)
            ("ACCULAB-PRO-30K", "type_evaluation", "Dr. Ramesh Kumar (RRSL-Delhi)", "RRSL New Delhi", 22.5, 48.0, 1015.0, "pass", 0.04, "Data integrity normal. Full pattern approval recommended."),
            # 6. Acculab Class III In-Service (PASS)
            ("ACCULAB-PRO-30K", "verification", "Er. Priya Nair (RRSL-Mumbai)", "RRSL Mumbai", 23.0, 55.0, 1011.0, "pass", 0.03, "In-service tolerance verification compliant."),
            # 7. Avery 150kg Class III (PASS)
            ("AVERY-PLATFORM-150", "type_evaluation", "Dr. A. K. Sen (RRSL-Kolkata)", "RRSL Kolkata", 21.5, 53.0, 1012.5, "pass", 0.05, "Platform corner load and weighing within tolerance."),
            # 8. Crane 1000kg Class IIII (PASS)
            ("HEAVY-CRANE-IIII", "type_evaluation", "Dr. Ramesh Kumar (RRSL-Delhi)", "RRSL New Delhi", 24.0, 60.0, 1008.0, "pass", 0.06, "Heavy capacity Class IIII within industrial tolerance."),
            # 9. Crane 1000kg Class IIII Verification (PASS)
            ("HEAVY-CRANE-IIII", "verification", "Er. S. Meena (RRSL-Ahmedabad)", "RRSL Ahmedabad", 24.5, 58.0, 1009.0, "pass", 0.04, "Crane scale field verification passed."),
            # 10. TradeMax Class III (FAIL - Eccentricity Failure)
            ("TRADEMAX-15K", "type_evaluation", "Er. Priya Nair (RRSL-Mumbai)", "RRSL Mumbai", 28.0, 62.0, 1009.0, "fail", 0.35, "Eccentricity corner load exceeded MPE at positions NE and SW."),
            # 11. Avery 150kg Class III (FAIL - Repeatability Span Failure)
            ("AVERY-PLATFORM-150", "type_evaluation", "Er. Priya Nair (RRSL-Mumbai)", "RRSL Mumbai", 25.0, 50.0, 1010.0, "fail", 0.42, "Repeatability span (0.12 kg) exceeds allowed limit of 1e (0.05 kg)."),
            # 12. TradeMax Class III (AI ANOMALY - High non-linear drift)
            ("TRADEMAX-15K", "type_evaluation", "Dr. Ramesh Kumar (RRSL-Delhi)", "RRSL New Delhi", 22.0, 50.0, 1013.0, "pass", 0.82, "AI Alert: Significant non-linear hysteresis and thermal sensitivity detected."),
        ]

        created_sessions = []
        for i, (m_num, t_type, insp, lab, temp, rh, pres, verdict, anomaly_score, diag) in enumerate(sessions_plan):
            inst = inst_map[m_num]
            sess_time = base_time + timedelta(days=i * 2, hours=i)
            sess = TestSession(
                id=str(uuid.uuid4()),
                instrument_id=inst.id,
                test_type=t_type,
                inspector_name=insp,
                lab_location=lab,
                ambient_temp_c=temp,
                relative_humidity=rh,
                pressure_hpa=pres,
                overall_status=verdict,
                rule_version=RULE_VERSION,
                env_warnings="[]",
                created_at=sess_time.isoformat(),
                completed_at=(sess_time + timedelta(hours=1)).isoformat()
            )
            session.add(sess)
            session.commit()
            session.refresh(sess)
            created_sessions.append((sess, inst, verdict, anomaly_score, diag, sess_time))

        # Add records and reports for each session
        for idx, (sess, inst, verdict, anomaly_score, diag, sess_time) in enumerate(created_sessions):
            e = inst.scale_interval_e
            max_cap = inst.max_capacity

            # ── 1. Weighing test records ──
            step_count = 8
            loads = [round((max_cap / step_count) * j, 4) for j in range(step_count + 1)]
            for s_idx, L in enumerate(loads):
                mpe = calculate_mpe(L, e, inst.accuracy_class)
                if verdict == "fail" and idx == 10 and s_idx > 5:
                    err = mpe * 1.6  # fail
                elif anomaly_score > 0.7:
                    err = mpe * 0.9 * (1 if s_idx % 2 == 0 else -1)  # noisy anomaly
                else:
                    err = mpe * 0.3 * (1 if s_idx % 2 == 0 else -1)  # normal pass
                
                ind = L + err
                session.add(TestRecord(
                    session_id=sess.id,
                    test_module="weighing",
                    load_applied=L,
                    indication_raw=ind,
                    delta_load=0.0,
                    calculated_error=err,
                    mpe_limit=mpe,
                    corrected_error=err,
                    is_compliant=abs(err) <= mpe,
                    sequence_order=s_idx,
                    direction="increasing" if s_idx <= step_count // 2 else "decreasing"
                ))

            # ── 2. Eccentricity records ──
            ecc_load = round(max_cap / 3.0, 4)
            ecc_mpe = calculate_mpe(ecc_load, e, inst.accuracy_class)
            is_ecc_fail = (verdict == "fail" and idx == 9)
            positions = [("center", 0.0), ("ne", 1.8 if is_ecc_fail else 0.3), ("nw", 0.2), ("sw", 1.5 if is_ecc_fail else 0.4), ("se", 0.2)]
            for p_pos, p_mult in positions:
                diff = ecc_mpe * p_mult
                session.add(TestRecord(
                    session_id=sess.id,
                    test_module="eccentricity",
                    load_applied=ecc_load,
                    indication_raw=ecc_load + diff,
                    calculated_error=diff,
                    mpe_limit=ecc_mpe,
                    is_compliant=diff <= ecc_mpe,
                    position=p_pos
                ))

            # ── 3. Repeatability records ──
            is_rep_fail = (verdict == "fail" and idx == 10)
            rep_span = e * (2.4 if is_rep_fail else 0.4)
            for r_idx in range(5):
                r_val = (max_cap * 0.5) + (rep_span * (r_idx / 4.0))
                session.add(TestRecord(
                    session_id=sess.id,
                    test_module="repeatability",
                    load_applied=round(max_cap * 0.5, 4),
                    indication_raw=round(r_val, 4),
                    calculated_error=round(r_val - max_cap * 0.5, 4),
                    mpe_limit=e,
                    is_compliant=not is_rep_fail,
                    sequence_order=r_idx
                ))

            # ── 4. Generate Report ──
            rep_num = f"MLX-{sess_time.strftime('%Y%m%d')}-{verdict.upper()}-{idx+1:03d}"
            payload = {
                "session": sess.id,
                "instrument": inst.model_number,
                "verdict": verdict.upper(),
                "rule_version": RULE_VERSION,
                "timestamp": sess_time.isoformat()
            }
            sha256 = compute_sha256(payload)
            session.add(TestReport(
                session_id=sess.id,
                report_number=rep_num,
                sha256_hash=sha256,
                ai_anomaly_score=anomaly_score,
                ai_diagnosis=diag,
                overall_verdict=verdict,
                rule_version=RULE_VERSION,
                inspector_sign_name=sess.inspector_name,
                inspector_sign_designation="Legal Metrology Officer",
                inspector_sign_date=sess_time.strftime("%Y-%m-%d"),
                issued_at=(sess_time + timedelta(hours=1)).isoformat()
            ))

        session.commit()
        return {
            "instruments_seeded": len(instruments_data),
            "sessions_seeded": len(sessions_plan),
            "reports_seeded": len(sessions_plan),
            "summary": "6 instruments (Classes I-IIII), 12 sessions (9 pass, 2 fail, 1 anomaly) with certificates."
        }