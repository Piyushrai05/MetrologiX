"""
MetrologiX — OIML R-76-1 Engine Unit Tests
===========================================
Every test case is annotated with one of:
  [ASSUMED]  — expected value derived from interpretation of R 76-1; needs verification
  [VERIFY]   — expected value came from user / problem-statement review

Run:  cd backend && pip install pytest && pytest tests/ -v

⚠ Tests marked [ASSUMED] must be confirmed against the official
  OIML R 76-1:2006/AMD 1:2018 text before this system is used in production.
"""
import math
import sys
import os

import pytest

# Ensure the backend package is on the path when run from backend/ or project root
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import oiml_engine as engine


# ===========================================================================
# Fixtures / helpers
# ===========================================================================

def _mpe(load, e, cls):
    return engine.calculate_mpe(load, e, cls)


# ===========================================================================
# 1. MPE per accuracy class and load band
# ===========================================================================

class TestMPE:
    """
    OIML R-76-1 Table 2 — Maximum permissible errors at initial verification.
    [ASSUMED] All tier boundaries and mpe_factors below need document verification.
    """

    # ── Class I ──────────────────────────────────────────────────────────────

    def test_class_I_tier1_mid(self):
        """Load = 1000e → n = 1000 ≤ 50000 → MPE = 0.5e [ASSUMED]"""
        e = 0.001
        load = 1000 * e
        assert _mpe(load, e, "I") == pytest.approx(0.5 * e, rel=1e-9)

    def test_class_I_tier1_boundary_exact(self):
        """Load = 50000e exactly → still in tier1 (n ≤ 50000) → MPE = 0.5e [ASSUMED]"""
        e = 0.001
        load = 50000 * e
        assert _mpe(load, e, "I") == pytest.approx(0.5 * e, rel=1e-9)

    def test_class_I_tier2_just_above_boundary(self):
        """n = 50001 → tier2, MPE = 1.0e [ASSUMED]"""
        e = 0.001
        load = 50001 * e
        assert _mpe(load, e, "I") == pytest.approx(1.0 * e, rel=1e-9)

    def test_class_I_tier2_boundary_exact(self):
        """n = 200000 exactly → MPE = 1.0e [ASSUMED]"""
        e = 0.001
        load = 200000 * e
        assert _mpe(load, e, "I") == pytest.approx(1.0 * e, rel=1e-9)

    def test_class_I_tier3_above_200000e(self):
        """n > 200000 → MPE = 1.5e [ASSUMED]"""
        e = 0.001
        load = 300000 * e
        assert _mpe(load, e, "I") == pytest.approx(1.5 * e, rel=1e-9)

    # ── Class II ─────────────────────────────────────────────────────────────

    def test_class_II_tier1(self):
        """n = 100 → MPE = 0.5e [ASSUMED]"""
        e = 0.01
        assert _mpe(100 * e, e, "II") == pytest.approx(0.5 * e, rel=1e-9)

    def test_class_II_tier1_at_boundary(self):
        """n = 500 exactly → MPE = 0.5e [ASSUMED]"""
        e = 0.01
        assert _mpe(500 * e, e, "II") == pytest.approx(0.5 * e, rel=1e-9)

    def test_class_II_tier2(self):
        """n = 501 → MPE = 1.0e [ASSUMED]"""
        e = 0.01
        assert _mpe(501 * e, e, "II") == pytest.approx(1.0 * e, rel=1e-9)

    def test_class_II_tier3(self):
        """n = 2001 → MPE = 1.5e [ASSUMED]"""
        e = 0.01
        assert _mpe(2001 * e, e, "II") == pytest.approx(1.5 * e, rel=1e-9)

    # ── Class III ────────────────────────────────────────────────────────────

    def test_class_III_tier1(self):
        """n = 100 → MPE = 0.5e [ASSUMED]"""
        e = 0.01
        assert _mpe(100 * e, e, "III") == pytest.approx(0.5 * e, rel=1e-9)

    def test_class_III_tier1_boundary(self):
        """n = 500 exactly → MPE = 0.5e [ASSUMED]"""
        e = 0.01
        assert _mpe(500 * e, e, "III") == pytest.approx(0.5 * e, rel=1e-9)

    def test_class_III_tier2(self):
        """n = 1000 → MPE = 1.0e [ASSUMED]"""
        e = 0.01
        assert _mpe(1000 * e, e, "III") == pytest.approx(1.0 * e, rel=1e-9)

    def test_class_III_tier2_boundary(self):
        """n = 2000 exactly → MPE = 1.0e [ASSUMED]"""
        e = 0.01
        assert _mpe(2000 * e, e, "III") == pytest.approx(1.0 * e, rel=1e-9)

    def test_class_III_tier3(self):
        """n = 2001 → MPE = 1.5e [ASSUMED]"""
        e = 0.01
        assert _mpe(2001 * e, e, "III") == pytest.approx(1.5 * e, rel=1e-9)

    def test_class_III_zero_load(self):
        """Zero load → n = 0 → tier1 → MPE = 0.5e [ASSUMED]"""
        e = 0.01
        assert _mpe(0.0, e, "III") == pytest.approx(0.5 * e, rel=1e-9)

    # ── Class IIII ───────────────────────────────────────────────────────────

    def test_class_IIII_tier1(self):
        """n = 10 → MPE = 0.5e [ASSUMED]"""
        e = 0.005
        assert _mpe(10 * e, e, "IIII") == pytest.approx(0.5 * e, rel=1e-9)

    def test_class_IIII_tier1_boundary(self):
        """n = 50 exactly → MPE = 0.5e [ASSUMED]"""
        e = 0.005
        assert _mpe(50 * e, e, "IIII") == pytest.approx(0.5 * e, rel=1e-9)

    def test_class_IIII_tier2(self):
        """n = 51 → MPE = 1.0e [ASSUMED]"""
        e = 0.005
        assert _mpe(51 * e, e, "IIII") == pytest.approx(1.0 * e, rel=1e-9)

    def test_class_IIII_tier3(self):
        """n = 201 → MPE = 1.5e [ASSUMED]"""
        e = 0.005
        assert _mpe(201 * e, e, "IIII") == pytest.approx(1.5 * e, rel=1e-9)

    # ── Legacy alias IV = IIII ────────────────────────────────────────────────

    def test_legacy_class_IV_alias(self):
        """'IV' should be treated as 'IIII' [ASSUMED]"""
        e = 0.005
        assert _mpe(10 * e, e, "IV") == _mpe(10 * e, e, "IIII")

    # ── In-service factor ─────────────────────────────────────────────────────

    def test_in_service_doubles_mpe(self):
        """In-service MPE = initial × 2.0 [ASSUMED — VERIFY R76-1 §3.5.1]"""
        e = 0.01
        initial = engine.calculate_mpe(100 * e, e, "III")
        in_svc = engine.calculate_mpe(100 * e, e, "III", in_service=True)
        assert in_svc == pytest.approx(initial * 2.0, rel=1e-9)


# ===========================================================================
# 2. Weighing error calculation (rounding correction)
# ===========================================================================

class TestWeighingError:
    """
    R 76-1 §3.5 formulas:
      P = I + 0.5e − ΔL
      E = P − L
      Ec = E − E₀  (E₀ = zero reading error)
    [ASSUMED] — formula interpretation needs document verification.
    """

    def test_corrected_indication(self):
        """P = 10.003 + 0.5×0.01 − 0.000 = 10.008 [ASSUMED]"""
        P = engine.calculate_corrected_indication(10.003, 0.01, 0.0)
        assert P == pytest.approx(10.008, rel=1e-9)

    def test_corrected_indication_with_delta(self):
        """P = 10.003 + 0.005 − 0.002 = 10.006 [ASSUMED]"""
        P = engine.calculate_corrected_indication(10.003, 0.01, 0.002)
        assert P == pytest.approx(10.006, rel=1e-9)

    def test_error_calculation(self):
        """E = P − L = 10.008 − 10.0 = 0.008 [ASSUMED]"""
        E = engine.calculate_error(10.008, 10.0)
        assert E == pytest.approx(0.008, rel=1e-9)

    def test_weighing_point_compliant(self):
        """
        Point clearly within MPE should pass [ASSUMED].
        load=5, e=0.01 → n=500 → MPE=0.5e=0.005
        indication=5.0 → P=5.005 → E=0.005 = MPE → compliant (|Ec| ≤ MPE)
        """
        res = engine.evaluate_weighing_point(
            load=5.0, indication=5.0, delta_load=0.0,
            e=0.01, accuracy_class="III"
        )
        assert res["is_compliant"] is True
        assert res["mpe"] == pytest.approx(0.005, rel=1e-9)  # 0.5×0.01 at n≤500 [ASSUMED]

    def test_weighing_point_exactly_at_mpe(self):
        """Exactly at MPE boundary — should be compliant (|Ec| ≤ MPE) [ASSUMED]"""
        e = 0.01
        mpe = 0.5 * e  # at n≤500
        load = 5.0
        # Craft indication so that Ec = +mpe exactly (zero_error = 0)
        # Ec = (I + 0.5e - 0) - load = mpe → I = load + mpe - 0.5e
        indication = load + mpe - 0.5 * e
        res = engine.evaluate_weighing_point(load, indication, 0.0, e, "III")
        assert res["is_compliant"] is True
        assert abs(res["Ec"]) == pytest.approx(mpe, rel=1e-9)

    def test_weighing_point_just_above_mpe(self):
        """Just above MPE — must fail [ASSUMED]"""
        e = 0.01
        mpe = 0.5 * e
        load = 5.0
        indication = load + mpe - 0.5 * e + 1e-9  # ε above
        res = engine.evaluate_weighing_point(load, indication, 0.0, e, "III")
        assert res["is_compliant"] is False

    def test_weighing_test_zero_error_subtracted(self):
        """First point error is subtracted from subsequent Ec values [ASSUMED]"""
        e = 0.01
        points = [
            {"load": 0.0, "indication": 0.002, "delta_load": 0.0, "direction": "increasing"},
            {"load": 5.0, "indication": 5.003, "delta_load": 0.0, "direction": "increasing"},
        ]
        result = engine.evaluate_weighing_test(points, e, "III")
        # zero_error at load=0: P = 0.002 + 0.005 = 0.007; E0 = 0.007 - 0 = 0.007
        zero_error = result["zero_error"]
        assert zero_error == pytest.approx(0.007, rel=1e-9)
        # Ec at load=5: P = 5.003+0.005 = 5.008; E=0.008; Ec = 0.008 - 0.007 = 0.001
        assert result["points"][1]["Ec"] == pytest.approx(0.001, rel=1e-9)

    def test_weighing_test_overall_pass(self):
        """All points within MPE → overall_pass True [ASSUMED]"""
        e = 0.01
        points = [
            {"load": 0.0, "indication": 0.0, "delta_load": 0.0, "direction": "increasing"},
            {"load": 5.0, "indication": 5.002, "delta_load": 0.0, "direction": "increasing"},
            {"load": 10.0, "indication": 10.003, "delta_load": 0.0, "direction": "increasing"},
        ]
        result = engine.evaluate_weighing_test(points, e, "III")
        assert result["overall_pass"] is True

    def test_weighing_test_overall_fail(self):
        """One point exceeds MPE → overall_pass False [ASSUMED]"""
        e = 0.01
        points = [
            {"load": 0.0, "indication": 0.0, "delta_load": 0.0, "direction": "increasing"},
            {"load": 20.0, "indication": 20.05, "delta_load": 0.0, "direction": "increasing"},  # error >> MPE
        ]
        result = engine.evaluate_weighing_test(points, e, "III")
        assert result["overall_pass"] is False


# ===========================================================================
# 3. Eccentricity
# ===========================================================================

class TestEccentricity:
    """R 76-1 §3.6 corner load test [ASSUMED]"""

    def test_all_within_mpe(self):
        """All corner differences < MPE → overall_pass True [ASSUMED]"""
        e = 0.01
        center = 10.0
        points = [
            {"position": "ne", "load": 10.0, "indication": 10.002},
            {"position": "nw", "load": 10.0, "indication": 10.001},
            {"position": "sw", "load": 10.0, "indication": 10.003},
            {"position": "se", "load": 10.0, "indication": 10.002},
        ]
        result = engine.evaluate_eccentricity_test(points, e, "III", center)
        assert result["overall_pass"] is True

    def test_one_corner_exceeds_mpe(self):
        """One corner difference > MPE → overall_pass False [ASSUMED]"""
        e = 0.01
        center = 10.0
        points = [
            {"position": "ne", "load": 10.0, "indication": 10.02},  # diff = 0.02 > MPE=0.005
            {"position": "nw", "load": 10.0, "indication": 10.001},
        ]
        result = engine.evaluate_eccentricity_test(points, e, "III", center)
        assert result["overall_pass"] is False

    def test_exactly_at_mpe(self):
        """Difference exactly at MPE → compliant [ASSUMED]"""
        e = 0.01
        center = 10.0
        mpe = engine.calculate_mpe(10.0, e, "III")  # 0.5×0.01 = 0.005 at n=1000
        points = [{"position": "ne", "load": 10.0, "indication": center + mpe}]
        result = engine.evaluate_eccentricity_test(points, e, "III", center)
        assert result["points"][0]["is_compliant"] is True


# ===========================================================================
# 4. Repeatability
# ===========================================================================

class TestRepeatability:
    """R 76-1 §3.6.1 — span of repeated readings ≤ 1e [ASSUMED]"""

    def test_span_within_limit(self):
        """span = 0.005 ≤ e = 0.01 → pass [ASSUMED]"""
        series = [10.002, 10.003, 10.004, 10.002, 10.003]
        result = engine.evaluate_repeatability_test(series, e=0.01)
        assert result["is_compliant"] is True
        assert result["span"] == pytest.approx(0.002, rel=1e-9)

    def test_span_equals_limit(self):
        """span exactly = e → compliant (≤ not <) [ASSUMED]"""
        e = 0.01
        series = [10.000, 10.010]
        result = engine.evaluate_repeatability_test(series, e)
        assert result["span"] == pytest.approx(e, rel=1e-9)
        assert result["is_compliant"] is True

    def test_span_just_above_limit(self):
        """span = e + ε → fail [ASSUMED]"""
        e = 0.01
        series = [10.000, 10.010 + 1e-9]
        result = engine.evaluate_repeatability_test(series, e)
        assert result["is_compliant"] is False

    def test_empty_series_passes(self):
        """Empty series → compliant (no data = no failure) [ASSUMED]"""
        result = engine.evaluate_repeatability_test([], e=0.01)
        assert result["is_compliant"] is True


# ===========================================================================
# 5. Discrimination
# ===========================================================================

class TestDiscrimination:
    """R 76-1 §3.7 [ASSUMED]"""

    def test_sufficient_change(self):
        """Indication change > d → pass [ASSUMED]"""
        result = engine.evaluate_discrimination_test(
            base_load=10.0, base_indication=10.0,
            extra_weight=0.01, new_indication=10.02,   # change=0.02 > d=0.01
            d=0.01,
        )
        assert result["is_compliant"] is True

    def test_insufficient_change(self):
        """Indication change < d → fail [ASSUMED]"""
        result = engine.evaluate_discrimination_test(
            base_load=10.0, base_indication=10.0,
            extra_weight=0.01, new_indication=10.005,  # change=0.005 < d=0.01
            d=0.01,
        )
        assert result["is_compliant"] is False

    def test_exactly_at_limit(self):
        """Change exactly = d → compliant (≥ not >) [ASSUMED]"""
        # Use base_indication=0 so change = new_indication - 0 = d exactly (no FP subtraction loss)
        d = 0.01
        result = engine.evaluate_discrimination_test(
            base_load=0.0, base_indication=0.0,
            extra_weight=d, new_indication=d,
            d=d,
        )
        assert result["is_compliant"] is True




# ===========================================================================
# 6. Creep
# ===========================================================================

class TestCreep:
    """R 76-1 §3.9 — max drift ≤ 0.5e over 30 min [ASSUMED]"""

    def test_within_limit(self):
        """drift = 0.003 ≤ 0.5×0.01 = 0.005 → pass [ASSUMED]"""
        ts = [{"indication": 0.0}, {"indication": 0.001}, {"indication": 0.003}]
        result = engine.evaluate_creep_test(ts, e=0.01)
        assert result["is_compliant"] is True

    def test_exceeds_limit(self):
        """drift = 0.008 > 0.5×0.01 = 0.005 → fail [ASSUMED]"""
        ts = [{"indication": 0.0}, {"indication": 0.005}, {"indication": 0.008}]
        result = engine.evaluate_creep_test(ts, e=0.01)
        assert result["is_compliant"] is False

    def test_exactly_at_limit(self):
        """drift = 0.5e → compliant [ASSUMED]"""
        e = 0.01
        ts = [{"indication": 0.0}, {"indication": 0.5 * e}]
        result = engine.evaluate_creep_test(ts, e)
        assert result["is_compliant"] is True


# ===========================================================================
# 7. Temperature effect
# ===========================================================================

class TestTemperatureEffect:
    """R 76-1 T.3.3 — error change per 5 °C ≤ 1e [ASSUMED]"""

    def test_within_limit(self):
        """Change 0.005 over 10 °C → 0.0025/5°C ≤ e=0.01 → pass [ASSUMED]"""
        result = engine.evaluate_temperature_effect_test(
            temp_low_c=15.0, error_at_low=0.0,
            temp_high_c=25.0, error_at_high=0.005,
            e=0.01,
        )
        assert result["is_compliant"] is True

    def test_exceeds_limit(self):
        """Change 0.1 over 10 °C → 0.05/5°C > e=0.01 → fail [ASSUMED]"""
        result = engine.evaluate_temperature_effect_test(
            temp_low_c=15.0, error_at_low=0.0,
            temp_high_c=25.0, error_at_high=0.1,
            e=0.01,
        )
        assert result["is_compliant"] is False

    def test_exactly_at_limit(self):
        """Change = 1e per 5°C exactly → compliant [ASSUMED]"""
        e = 0.01
        result = engine.evaluate_temperature_effect_test(
            temp_low_c=15.0, error_at_low=0.0,
            temp_high_c=20.0, error_at_high=e,  # 0.01 over 5°C
            e=e,
        )
        assert result["is_compliant"] is True


# ===========================================================================
# 8. Session status derivation
# ===========================================================================

class TestSessionStatus:
    """Deterministic status logic — no dependency on AI [ASSUMED]"""

    def test_all_required_pass(self):
        modules = {"weighing": [True, True], "eccentricity": [True], "repeatability": [True, True]}
        assert engine.compute_session_status("type_evaluation", modules) == "pass"

    def test_any_fail(self):
        modules = {"weighing": [True, False], "eccentricity": [True], "repeatability": [True]}
        assert engine.compute_session_status("type_evaluation", modules) == "fail"

    def test_missing_required_module(self):
        modules = {"weighing": [True, True]}  # eccentricity and repeatability missing
        assert engine.compute_session_status("type_evaluation", modules) == "pending"

    def test_no_records(self):
        assert engine.compute_session_status("type_evaluation", {}) == "pending"

    def test_verification_only_needs_weighing(self):
        modules = {"weighing": [True, True]}
        # For 'verification', config requires only weighing
        assert engine.compute_session_status("verification", modules) == "pass"


# ===========================================================================
# 9. Input validation
# ===========================================================================

class TestValidation:
    """validate_instrument_params field-level checks [ASSUMED]"""

    def test_valid_params(self):
        errs = engine.validate_instrument_params("III", 30.0, 0.1, 0.01, 0.01)
        assert errs == []

    def test_d_greater_than_e_rejected(self):
        """d > e → error [VERIFY - R76-1 §3.2]"""
        errs = engine.validate_instrument_params("III", 30.0, 0.1, 0.01, 0.02)
        assert any("scale_interval_d" in e or "d" in e.lower() for e in errs)

    def test_max_le_min_rejected(self):
        errs = engine.validate_instrument_params("III", 1.0, 5.0, 0.01, 0.01)
        assert any("max_capacity" in e or "min" in e.lower() for e in errs)

    def test_unknown_class_rejected(self):
        errs = engine.validate_instrument_params("V", 30.0, 0.1, 0.01, 0.01)
        assert any("accuracy_class" in e or "class" in e.lower() for e in errs)

    def test_environment_warning_outside_range(self):
        """Temperature 10 °C → warning, not rejection [ASSUMED - R76-1 §4.1.1]"""
        warnings = engine.check_environment_warnings(10.0)
        assert len(warnings) > 0
        assert "10" in warnings[0] or "warning" in warnings[0].lower() or "outside" in warnings[0].lower()

    def test_environment_no_warning_in_range(self):
        """Temperature 20 °C → no warning [ASSUMED]"""
        warnings = engine.check_environment_warnings(20.0)
        assert warnings == []


# ===========================================================================
# 10. Rule version loaded correctly
# ===========================================================================

def test_rule_version_not_empty():
    """Config must load a non-empty rule version string."""
    assert engine.RULE_VERSION != ""
    assert "R76" in engine.RULE_VERSION or "OIML" in engine.RULE_VERSION.upper()


def test_config_verified_flags_are_false():
    """
    All 'verified' flags should remain False until the user confirms against the
    official document. This test will FAIL once you start setting them to True,
    which is intentional — remove this test entry-by-entry as you verify.
    """
    assert engine.CFG["mpe_tables"]["verified"] is False
    assert engine.CFG["class_limits"]["verified"] is False
    assert engine.CFG["in_service_factor"]["verified"] is False
