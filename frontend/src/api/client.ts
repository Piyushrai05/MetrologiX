import axios from 'axios';

const client = axios.create({ baseURL: '/api', timeout: 10000 });

export const api = {
  // ── Health & OIML config ──────────────────────────────────────────────────
  health: () => client.get('/health'),
  /** Fetch OIML rule config (MPE tables, class limits, env thresholds). */
  getOimlConfig: () => client.get('/oiml/config'),
  /** Compute MPE for a single (load, e, class) on the server. */
  computeMPE: (load: number, e: number, accuracy_class: string, in_service = false) =>
    client.get('/oiml/mpe', { params: { load, e, accuracy_class, in_service } }),

  // ── Dashboard ─────────────────────────────────────────────────────────────
  getDashboardStats: () => client.get('/dashboard/stats'),

  // ── Instruments ───────────────────────────────────────────────────────────
  getInstruments: () => client.get('/instruments'),
  getInstrument: (id: string) => client.get(`/instruments/${id}`),
  createInstrument: (data: unknown) => client.post('/instruments', data),

  // ── Sessions ──────────────────────────────────────────────────────────────
  createSession: (data: unknown) => client.post('/sessions', data),
  getSession: (id: string) => client.get(`/sessions/${id}`),
  getSessions: (params?: { instrument_id?: string }) =>
    client.get('/sessions', { params }),
  getSessionsByInstrument: (instrumentId: string) =>
    client.get('/sessions', { params: { instrument_id: instrumentId } }),

  // ── Test evaluations ──────────────────────────────────────────────────────
  runWeighingTest: (data: unknown) => client.post('/tests/weighing', data),
  runEccentricityTest: (data: unknown) => client.post('/tests/eccentricity', data),
  runRepeatabilityTest: (data: unknown) => client.post('/tests/repeatability', data),
  runDiscriminationTest: (data: unknown) => client.post('/tests/discrimination', data),
  runCreepTest: (data: unknown) => client.post('/tests/creep', data),
  runTareTest: (data: unknown) => client.post('/tests/tare', data),
  runZeroSettingTest: (data: unknown) => client.post('/tests/zero-setting', data),
  runTemperatureEffectTest: (data: unknown) => client.post('/tests/temperature-effect', data),

  // ── AI analysis ───────────────────────────────────────────────────────────
  runAIAnalysis: (sessionId: string, data: unknown) =>
    client.post(`/sessions/${sessionId}/ai-analysis`, data),

  // ── Reports ───────────────────────────────────────────────────────────────
  generateReport: (sessionId: string) =>
    client.post(`/sessions/${sessionId}/generate-report`, {}),
  getReports: (params?: { verdict?: string; instrument_id?: string }) =>
    client.get('/reports', { params }),
  verifyReport: (reportNumber: string) =>
    client.get(`/reports/${reportNumber}/verify`),

  // ── Demo ──────────────────────────────────────────────────────────────────
  seedDemo: () => client.post('/demo/seed', {}),
};
