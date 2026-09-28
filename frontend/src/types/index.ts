export interface Instrument {
  id: string;
  model_number: string;
  manufacturer: string;
  serial_number: string;
  accuracy_class: string;
  max_capacity: number;
  min_capacity: number;
  scale_interval_e: number;
  scale_interval_d: number;
  unit: string;
  created_at: string;
  test_count?: number;
}

export interface TestSession {
  id: string;
  instrument_id: string;
  test_type: string;
  inspector_name: string;
  lab_location: string;
  ambient_temp_c: number;
  relative_humidity: number;
  pressure_hpa: number;
  overall_status: 'pending' | 'pass' | 'fail';
  created_at: string;
}

export interface WeighingPoint {
  load: number;
  indication: number;
  delta_load: number;
  direction: 'increasing' | 'decreasing';
}

export interface TestRecord {
  id: string;
  session_id: string;
  test_module: string;
  load_applied: number;
  indication_raw: number;
  delta_load: number;
  calculated_error: number;
  corrected_error: number;
  mpe_limit: number;
  is_compliant: boolean;
  sequence_order: number;
  direction: string;
  position: string;
}

export interface DashboardStats {
  total_instruments: number;
  total_sessions: number;
  total_reports: number;
  pass_count: number;
  fail_count: number;
  pending_count: number;
  pass_rate: number;
  recent_sessions: Array<{
    id: string;
    instrument: string;
    inspector: string;
    status: string;
    created_at: string;
  }>;
}

export interface AIAnalysisResult {
  session_id: string;
  ai_results: {
    anomaly: {
      anomaly_score: number;
      anomalies_found: boolean;
      anomaly_indices: number[];
      diagnosis: string;
    };
    creep: {
      a: number;
      b: number;
      r_squared: number;
      risk_level: string;
    };
    thermal: {
      slope_per_c: number;
      slope_per_5c: number;
      limit_per_5c: number;
      is_compliant: boolean;
      risk_level: string;
    };
  };
  test_summary: {
    weighing_pass: boolean;
    eccentricity_pass: boolean;
    repeatability_pass: boolean;
  };
  recommendations: Array<{
    severity: string;
    area: string;
    message: string;
    action: string;
  }>;
  overall_verdict: string;
}

export interface Report {
  id: string;
  report_number: string;
  session_id: string;
  instrument_model: string;
  inspector_name: string;
  overall_verdict: string;
  sha256_hash: string;
  issued_at: string;
}
