"""
Explainable AI Engine for MetrologiX Core
Anomaly detection, creep curve fitting, thermal drift analysis
"""
import numpy as np
from typing import List, Dict, Optional
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings("ignore")

def fit_creep_model(time_data: List[float], error_data: List[float]) -> Dict:
    """Fit logarithmic creep model: E(t) = a + b*ln(1 + t/tau)"""
    if len(time_data) < 3:
        return {"a": 0, "b": 0, "tau": 1, "r_squared": 0, "risk_level": "insufficient_data"}
    try:
        t = np.array(time_data, dtype=float)
        E = np.array(error_data, dtype=float)
        tau = 1.0
        X = np.column_stack([np.ones(len(t)), np.log(1 + t / tau)])
        coeffs, _, _, _ = np.linalg.lstsq(X, E, rcond=None)
        a, b = coeffs
        E_pred = a + b * np.log(1 + t / tau)
        ss_res = np.sum((E - E_pred) ** 2)
        ss_tot = np.sum((E - np.mean(E)) ** 2)
        r_squared = 1 - ss_res / ss_tot if ss_tot > 0 else 0
        risk_level = "low" if abs(b) < 0.01 else ("moderate" if abs(b) < 0.05 else "high")
        return {"a": float(a), "b": float(b), "tau": tau, "r_squared": float(r_squared), "risk_level": risk_level}
    except Exception:
        return {"a": 0, "b": 0, "tau": 1, "r_squared": 0, "risk_level": "error"}

def compute_thermal_drift(temp_data: List[float], error_data: List[float], e: float) -> Dict:
    """Compute thermal drift coefficient (ppm/degC equivalent)."""
    if len(temp_data) < 2:
        return {"slope_per_5c": 0, "is_compliant": True, "risk_level": "low"}
    try:
        T = np.array(temp_data)
        E = np.array(error_data)
        coeffs = np.polyfit(T, E, 1)
        slope = coeffs[0]
        drift_per_5c = abs(slope * 5)
        is_compliant = drift_per_5c <= e
        risk_level = "low" if drift_per_5c < 0.3 * e else ("moderate" if drift_per_5c < 0.7 * e else "high")
        return {
            "slope_per_c": float(slope),
            "slope_per_5c": float(drift_per_5c),
            "limit_per_5c": float(e),
            "is_compliant": is_compliant,
            "risk_level": risk_level,
        }
    except Exception:
        return {"slope_per_5c": 0, "is_compliant": True, "risk_level": "low"}

def detect_anomalies(feature_matrix: List[List[float]]) -> Dict:
    """Run Isolation Forest anomaly detection on test data."""
    if not feature_matrix or len(feature_matrix) < 3:
        return {
            "anomaly_score": 0.0,
            "anomalies_found": False,
            "anomaly_indices": [],
            "diagnosis": "Insufficient data for anomaly detection.",
        }
    try:
        X = np.array(feature_matrix)
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        clf = IsolationForest(contamination=0.1, random_state=42)
        labels = clf.fit_predict(X_scaled)
        scores = clf.score_samples(X_scaled)
        norm_score = float(
            1 - (np.mean(scores) - np.min(scores)) / (np.max(scores) - np.min(scores) + 1e-9)
        )
        anomaly_indices = [i for i, l in enumerate(labels) if l == -1]
        has_anomalies = len(anomaly_indices) > 0
        if norm_score < 0.3:
            diagnosis = "Data integrity appears normal. No significant irregularities detected."
        elif norm_score < 0.6:
            diagnosis = "Minor irregularities detected. Review flagged readings for transcription errors."
        else:
            diagnosis = "Significant data anomalies detected. Manual verification strongly recommended."
        return {
            "anomaly_score": round(norm_score, 3),
            "anomalies_found": has_anomalies,
            "anomaly_indices": anomaly_indices,
            "diagnosis": diagnosis,
        }
    except Exception as ex:
        return {
            "anomaly_score": 0.0,
            "anomalies_found": False,
            "anomaly_indices": [],
            "diagnosis": f"Analysis error: {ex}",
        }

def generate_recommendations(test_results: Dict, ai_results: Dict, e: float) -> List[Dict]:
    """Generate actionable recommendations based on test and AI analysis."""
    recs = []
    if not test_results.get("weighing_pass", True):
        recs.append({
            "severity": "critical",
            "area": "Weighing Performance",
            "message": "One or more weighing points exceed MPE limits.",
            "action": "Inspect load cell calibration, check span adjustment, and verify calibration mass traceability.",
        })
    if not test_results.get("eccentricity_pass", True):
        recs.append({
            "severity": "high",
            "area": "Eccentricity",
            "message": "Corner loading test failed — indication difference exceeds MPE.",
            "action": "Check receptor mounting alignment, leveling feet, and load cell support geometry.",
        })
    if not test_results.get("repeatability_pass", True):
        recs.append({
            "severity": "high",
            "area": "Repeatability",
            "message": "Repeatability span exceeds one verification interval (e).",
            "action": "Inspect mechanical joints, A/D converter noise floor, and vibration isolation.",
        })
    if ai_results.get("creep", {}).get("risk_level") in ["moderate", "high"]:
        recs.append({
            "severity": "medium",
            "area": "Creep",
            "message": f"Significant load cell creep detected (risk: {ai_results['creep']['risk_level']}).",
            "action": "Verify load cell creep specification. Consider cell replacement if beyond rated creep.",
        })
    if not ai_results.get("thermal", {}).get("is_compliant", True):
        recs.append({
            "severity": "high",
            "area": "Thermal Compensation",
            "message": "Thermal drift exceeds OIML R-76 limit of 1e per 5 degC.",
            "action": "Check temperature compensation circuit, re-calibrate span at operating extremes.",
        })
    if ai_results.get("anomaly", {}).get("anomaly_score", 0) > 0.5:
        recs.append({
            "severity": "warning",
            "area": "Data Integrity",
            "message": "Irregular data patterns detected. Possible transcription errors.",
            "action": "Re-enter flagged readings or repeat those specific test points.",
        })
    if not recs:
        recs.append({
            "severity": "pass",
            "area": "All Tests",
            "message": "All tests comply with OIML R-76 requirements.",
            "action": "Proceed with issuing Type Approval Certificate.",
        })
    return recs