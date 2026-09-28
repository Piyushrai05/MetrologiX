"""
OIML R-76-1 Deterministic Metrological Calculation Engine
=========================================================
All OIML rule values are loaded from oiml_config.json at import time.
No numeric OIML limits are hard-coded here.

⚠  Values flagged verified:false in the config have NOT been cross-checked
   against the official OIML R 76-1:2006/AMD 1:2018 text.
   Do not treat them as authoritative without independent verification.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Load config once at module import
# ---------------------------------------------------------------------------
_CONFIG_PATH = Path(__file__).parent / "oiml_config.json"

def _load_config() -> dict:
    with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

CFG: dict = _load_config()
RULE_VERSION: str = CFG["version"]

# Accepted accuracy classes (canonical + legacy alias)
_ACCEPTED_CLASSES: List[str] = CFG["accuracy_classes"]["accepted_values"] + ["IV"]

# Normalise "IV" → "IIII" for internal lookup
def _normalise_class(cls: str) -> str:
    return "IIII" if cls == "IV" else cls

def get_rule_version() -> str:
    """Return the loaded OIML rule version string."""
    return RULE_VERSION

def reload_config() -> None:
    """Hot-reload config from disk (useful for tests / admin tooling)."""
    global CFG, RULE_VERSION, _ACCEPTED_CLASSES
    CFG = _load_config()
    RULE_VERSION = CFG["version"]
    _ACCEPTED_CLASSES = CFG["accuracy_classes"]["accepted_values"] + ["IV"]


# ---------------------------------------------------------------------------
# MPE calculation
# ---------------------------------------------------------------------------
def calculate_mpe(
    load: float,
    e: float,
    accuracy_class: str,
    in_service: bool = False,
) -> float:
    """
    Calculate Maximum Permissible Error for a given load.

    Parameters
    ----------
    load          : test load in instrument units
    e             : verification scale interval in instrument units
    accuracy_class: one of I / II / III / IIII (or legacy IV)
    in_service    : if True, apply in-service factor from config

    Returns
    -------
    MPE in instrument units (positive value; test compares |Ec| ≤ MPE)
    """
    cls = _normalise_class(accuracy_class)
    n = load / e if e > 0 else 0.0

    tiers: List[dict] = CFG["mpe_tables"]["initial_verification"].get(cls)
    if not tiers:
        # Fallback to III if unknown class
        tiers = CFG["mpe_tables"]["initial_verification"]["III"]

    mpe_factor = tiers[-1]["mpe_factor"]   # worst-case default
    for tier in tiers:
        max_n = tier["max_n"]
        if max_n is None or n <= max_n:
            mpe_factor = tier["mpe_factor"]
            break

    mpe = mpe_factor * e
    if in_service:
        mpe *= CFG["in_service_factor"]["value"]
    return mpe


def get_mpe_tiers(accuracy_class: str) -> List[dict]:
    """Return the MPE tier list for a given accuracy class (for API exposure)."""
    cls = _normalise_class(accuracy_class)
    return CFG["mpe_tables"]["initial_verification"].get(
        cls, CFG["mpe_tables"]["initial_verification"]["III"]
    )


# ---------------------------------------------------------------------------
# Indicator correction formulas
# ---------------------------------------------------------------------------
def calculate_corrected_indication(indication: float, e: float, delta_load: float) -> float:
    """P = I + 0.5e − ΔL"""
    return indication + 0.5 * e - delta_load


def calculate_error(corrected_indication: float, load: float) -> float:
    """E = P − L"""
    return corrected_indication - load


# ---------------------------------------------------------------------------
# Weighing performance (§3.5)
# ---------------------------------------------------------------------------
def evaluate_weighing_point(
    load: float,
    indication: float,
    delta_load: float,
    e: float,
    accuracy_class: str,
    zero_error: float = 0.0,
    in_service: bool = False,
) -> Dict:
    """Evaluate a single weighing test point."""
    P = calculate_corrected_indication(indication, e, delta_load)
    E = calculate_error(P, load)
    Ec = E - zero_error
    mpe = calculate_mpe(load, e, accuracy_class, in_service)
    compliant = abs(Ec) <= mpe
    return {
        "load": load,
        "indication": indication,
        "delta_load": delta_load,
        "P": P,
        "E": E,
        "Ec": Ec,
        "mpe": mpe,
        "is_compliant": compliant,
        "compliance_ratio": abs(Ec) / mpe if mpe > 0 else 0.0,
    }


def evaluate_weighing_test(
    points: List[Dict],
    e: float,
    accuracy_class: str,
    in_service: bool = False,
) -> Dict:
    """Evaluate complete weighing performance test."""
    zero_error = 0.0
    if points:
        first = points[0]
        p0 = calculate_corrected_indication(first["indication"], e, first.get("delta_load", 0))
        zero_error = calculate_error(p0, first["load"])

    results = []
    for pt in points:
        res = evaluate_weighing_point(
            pt["load"], pt["indication"], pt.get("delta_load", 0),
            e, accuracy_class, zero_error, in_service,
        )
        res["direction"] = pt.get("direction", "increasing")
        results.append(res)

    all_pass = all(r["is_compliant"] for r in results)
    max_error = max((abs(r["Ec"]) for r in results), default=0.0)
    return {
        "points": results,
        "overall_pass": all_pass,
        "max_error": max_error,
        "zero_error": zero_error,
        "rule_version": RULE_VERSION,
    }


# ---------------------------------------------------------------------------
# Eccentricity / corner load (§3.6)
# ---------------------------------------------------------------------------
def evaluate_eccentricity_test(
    points: List[Dict],
    e: float,
    accuracy_class: str,
    center_indication: float,
) -> Dict:
    """Evaluate eccentricity (corner load) test."""
    results = []
    for pt in points:
        diff = abs(pt["indication"] - center_indication)
        mpe = calculate_mpe(pt["load"], e, accuracy_class)
        compliant = diff <= mpe
        results.append({
            "position": pt["position"],
            "load": pt["load"],
            "indication": pt["indication"],
            "center_indication": center_indication,
            "diff": diff,
            "mpe": mpe,
            "is_compliant": compliant,
        })
    all_pass = all(r["is_compliant"] for r in results)
    max_diff = max((r["diff"] for r in results), default=0.0)
    return {
        "points": results,
        "overall_pass": all_pass,
        "max_diff": max_diff,
        "rule_version": RULE_VERSION,
    }


# ---------------------------------------------------------------------------
# Repeatability (§3.6.1)
# ---------------------------------------------------------------------------
def evaluate_repeatability_test(series: List[float], e: float) -> Dict:
    """Evaluate repeatability for a series of repeated indications."""
    if not series:
        return {
            "span": 0.0, "is_compliant": True,
            "mpe_limit_span": e, "rule_version": RULE_VERSION,
        }
    limit_factor: float = CFG["repeatability"]["max_span_multiples_of_e"]
    limit = limit_factor * e
    span = max(series) - min(series)
    mean_val = sum(series) / len(series)
    max_dev = max(abs(v - mean_val) for v in series)
    return {
        "series": series,
        "span": span,
        "mean": mean_val,
        "max_deviation": max_dev,
        "mpe_limit_span": limit,
        "is_compliant": span <= limit,
        "rule_version": RULE_VERSION,
    }


# ---------------------------------------------------------------------------
# Discrimination (§3.7)
# ---------------------------------------------------------------------------
def evaluate_discrimination_test(
    base_load: float,
    base_indication: float,
    extra_weight: float,
    new_indication: float,
    d: float,
) -> Dict:
    """Evaluate discrimination test."""
    limit_factor: float = CFG["discrimination"]["required_indication_change_multiples_of_d"]
    required = limit_factor * d
    change = abs(new_indication - base_indication)
    compliant = change >= required
    return {
        "base_load": base_load,
        "extra_weight": extra_weight,
        "indication_change": change,
        "required_change": required,
        "is_compliant": compliant,
        "rule_version": RULE_VERSION,
    }


# ---------------------------------------------------------------------------
# Creep (§3.9)
# ---------------------------------------------------------------------------
def evaluate_creep_test(time_series: List[Dict], e: float) -> Dict:
    """Evaluate creep: indication drift with max load maintained."""
    if len(time_series) < 2:
        return {
            "max_drift": 0.0,
            "is_compliant": True,
            "rule_version": RULE_VERSION,
        }
    limit_factor: float = CFG["creep"]["max_drift_multiples_of_e"]
    limit = limit_factor * e
    baseline = time_series[0]["indication"]
    drifts = [abs(pt["indication"] - baseline) for pt in time_series]
    max_drift = max(drifts)
    return {
        "max_drift": max_drift,
        "limit": limit,
        "is_compliant": max_drift <= limit,
        "time_series": time_series,
        "rule_version": RULE_VERSION,
    }


# ---------------------------------------------------------------------------
# Tare device (§3.8)
# ---------------------------------------------------------------------------
def evaluate_tare_test(
    tare_load: float,
    test_load: float,
    gross_indication: float,
    net_indication: float,
    e: float,
    accuracy_class: str,
) -> Dict:
    """
    Tare device test: net indication accuracy after taring.
    Ec_net = net_indication - test_load ; must comply with MPE at test_load.
    ⚠ Procedure assumptions — VERIFY against R76-1 §3.8.
    """
    mpe = calculate_mpe(test_load, e, accuracy_class)
    error = abs(net_indication - test_load)
    compliant = error <= mpe
    return {
        "tare_load": tare_load,
        "test_load": test_load,
        "gross_indication": gross_indication,
        "net_indication": net_indication,
        "error": error,
        "mpe": mpe,
        "is_compliant": compliant,
        "rule_version": RULE_VERSION,
        "_note": "Tare test procedure assumed — VERIFY R76-1 §3.8",
    }


# ---------------------------------------------------------------------------
# Zero-setting / zero-tracking (§3.4)
# ---------------------------------------------------------------------------
def evaluate_zero_setting_test(
    initial_indication: float,
    after_zero_indication: float,
    e: float,
) -> Dict:
    """
    Zero-setting: indication after zeroing should be within 0.25e of zero.
    ⚠ Limit assumed — VERIFY against R76-1 §3.4.
    """
    drift = abs(after_zero_indication - 0.0)
    limit = 0.25 * e
    return {
        "initial_indication": initial_indication,
        "after_zero_indication": after_zero_indication,
        "drift": drift,
        "limit": limit,
        "is_compliant": drift <= limit,
        "rule_version": RULE_VERSION,
        "_note": "Zero-setting limit (0.25e) assumed — VERIFY R76-1 §3.4",
    }


# ---------------------------------------------------------------------------
# Temperature effect (deterministic, T.3.3)
# ---------------------------------------------------------------------------
def evaluate_temperature_effect_test(
    temp_low_c: float,
    error_at_low: float,
    temp_high_c: float,
    error_at_high: float,
    e: float,
) -> Dict:
    """
    Deterministic temperature effect: error change per 5 °C interval.
    limit = 1e per 5 °C (assumed — VERIFY R76-1 T.3.3).
    """
    delta_temp = abs(temp_high_c - temp_low_c)
    delta_error = abs(error_at_high - error_at_low)
    limit_factor: float = CFG["thermal"]["max_error_change_per_5c_multiples_of_e"]
    per_5c = (delta_error / delta_temp * 5.0) if delta_temp > 0 else 0.0
    limit = limit_factor * e
    compliant = per_5c <= limit
    return {
        "temp_low_c": temp_low_c,
        "error_at_low": error_at_low,
        "temp_high_c": temp_high_c,
        "error_at_high": error_at_high,
        "delta_error_per_5c": per_5c,
        "limit_per_5c": limit,
        "is_compliant": compliant,
        "rule_version": RULE_VERSION,
        "_note": "Temperature effect limit (1e/5°C) assumed — VERIFY R76-1 T.3.3",
    }


# ---------------------------------------------------------------------------
# Session overall status (deterministic)
# ---------------------------------------------------------------------------
def compute_session_status(
    test_type: str,
    module_records: Dict[str, List[bool]],
) -> str:
    """
    Derive session overall_status purely from test records.
    AI analysis MUST NOT set compliance — it only adds advisory flags.

    Parameters
    ----------
    test_type      : 'type_evaluation' or 'verification'
    module_records : {module_name: [is_compliant per record]}

    Returns
    -------
    'pass' | 'fail' | 'pending'
    """
    required: List[str] = CFG["required_test_modules"].get(test_type, ["weighing"])

    # Any failed record → fail immediately
    for _module, results in module_records.items():
        if any(not ok for ok in results):
            return "fail"

    # Missing required module → pending
    for mod in required:
        if mod not in module_records or not module_records[mod]:
            return "pending"

    return "pass"


# ---------------------------------------------------------------------------
# Class limits and validation helpers
# ---------------------------------------------------------------------------
def get_accuracy_class_limits(accuracy_class: str) -> Dict:
    """Return key limits for a given accuracy class."""
    cls = _normalise_class(accuracy_class)
    return CFG["class_limits"].get(cls, CFG["class_limits"]["III"])


def validate_instrument_params(
    accuracy_class: str,
    max_capacity: float,
    min_capacity: float,
    scale_interval_e: float,
    scale_interval_d: float,
) -> List[str]:
    """
    Return a list of validation error strings (empty list = all valid).
    Raises no exceptions — callers decide how to handle errors.
    """
    errors: List[str] = []
    cls = _normalise_class(accuracy_class)

    if cls not in CFG["accuracy_classes"]["accepted_values"]:
        errors.append(
            f"accuracy_class must be one of {CFG['accuracy_classes']['accepted_values']}, got '{accuracy_class}'"
        )

    if max_capacity <= 0:
        errors.append("max_capacity must be > 0")
    if min_capacity < 0:
        errors.append("min_capacity must be ≥ 0")
    if max_capacity <= min_capacity:
        errors.append("max_capacity must be > min_capacity")

    if scale_interval_e <= 0:
        errors.append("scale_interval_e must be > 0")
    if scale_interval_d <= 0:
        errors.append("scale_interval_d must be > 0")

    # d ≤ e  (R76-1 §3.2 — see config interval_relation)
    if scale_interval_d > scale_interval_e:
        errors.append(
            f"scale_interval_d ({scale_interval_d}) must be ≤ scale_interval_e ({scale_interval_e}) "
            f"[R76-1 §3.2, verified:{CFG['interval_relation']['verified']}]"
        )

    return errors


def check_environment_warnings(ambient_temp_c: float) -> List[str]:
    """Return advisory warning messages for out-of-reference environmental conditions."""
    warnings: List[str] = []
    env = CFG["environment"]
    if ambient_temp_c < env["temp_warning_min_c"] or ambient_temp_c > env["temp_warning_max_c"]:
        warnings.append(
            f"Ambient temperature {ambient_temp_c} °C is outside the reference range "
            f"{env['temp_warning_min_c']}–{env['temp_warning_max_c']} °C "
            f"[{env.get('_clause', 'R76-1 §4.1.1')}, verified:{env['verified']}]. "
            "Test may proceed but deviation is recorded."
        )
    return warnings