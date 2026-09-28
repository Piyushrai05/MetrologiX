import { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Brain,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
  Zap,
  Scale,
  ShieldCheck,
  Award,
  Check,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import type { Instrument, AIAnalysisResult } from '../types';

// ─────────────────────────────────────────────
// OIML config types (mirrors /api/oiml/config)
// ─────────────────────────────────────────────
interface MPETier { max_n: number | null; mpe_factor: number; verified: boolean }
interface OimlConfig {
  rule_version: string;
  mpe_tables: Record<string, MPETier[]>;
  accuracy_classes: string[];
  repeatability_limit_factor: number;
  environment: { temp_warning_min_c: number; temp_warning_max_c: number };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Compute MPE from server-fetched OIML config.
 * Replaces the old hard-coded getMPELimit() which ignored accuracy class.
 */
function computeMPEFromConfig(
  load: number,
  e: number,
  accuracyClass: string,
  config: OimlConfig | null,
): number {
  if (!config || e <= 0) return e * 1.5; // safe fallback
  const cls = accuracyClass === 'IV' ? 'IIII' : accuracyClass;
  const tiers = config.mpe_tables[cls] ?? config.mpe_tables['III'];
  if (!tiers) return e * 1.5;
  const n = load / e;
  for (const tier of tiers) {
    if (tier.max_n === null || n <= tier.max_n) return e * tier.mpe_factor;
  }
  return e * 1.5;
}

function genLoadPoints(max: number, steps = 10): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    pts.push(parseFloat(((max / steps) * i).toFixed(4)));
  }
  return pts;
}

// ─────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────
const STEPS = [
  'Instrument',
  'Environment',
  'Weighing (3.5)',
  'Eccentricity (3.6)',
  'Repeatability (3.6.1)',
  'Discrimination & Creep (3.7/3.9)',
  'AI Audit',
  'Certificate Vault',
];

const StepIndicator = ({ current }: { current: number }) => (
  <div
    className="mb-6 p-3 sm:p-4 rounded-2xl flex items-center justify-between gap-1.5 overflow-hidden"
    style={{
      background: 'var(--color-surface-1)',
      border: '1.5px solid var(--color-border-default)',
      boxShadow: 'var(--shadow-sm)',
    }}
  >
    {STEPS.map((label, idx) => {
      const done = idx < current;
      const active = idx === current;
      return (
        <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center transition-all duration-300 shrink-0"
              style={{
                width: 28, height: 28,
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
                transform: active ? 'scale(1.05)' : 'scale(1)',
                background: done ? '#10b981' : active ? 'linear-gradient(135deg, #1e40af, #3b82f6)' : '#f1f5f9',
                color: done ? '#fff' : active ? '#fff' : '#64748b',
                border: done ? '1.5px solid #10b981' : active ? '1.5px solid #3b82f6' : '1.5px solid #cbd5e1',
                boxShadow: active ? '0 3px 10px rgba(30,64,175,0.25)' : done ? '0 2px 6px rgba(16,185,129,0.20)' : 'none',
              }}
            >
              {done ? <Check size={13} strokeWidth={3} /> : idx + 1}
            </div>
            {active && (
              <span
                className="font-bold whitespace-nowrap text-xs hidden sm:inline"
                style={{ color: '#1e40af', fontFamily: 'var(--font-heading)' }}
              >
                {label}
              </span>
            )}
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className="flex-1 h-0.5 mx-1 transition-all duration-300"
              style={{ background: done ? '#10b981' : '#e2e8f0', minWidth: 6 }}
            />
          )}
        </div>
      );
    })}
  </div>
);

const Card = ({
  title,
  subtitle,
  children,
  badge,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  badge?: string;
}) => (
  <div
    className="rounded-2xl relative overflow-hidden"
    style={{
      background: 'var(--color-surface-1)',
      border: '1.5px solid var(--color-border-default)',
      boxShadow: 'var(--shadow-md)',
    }}
  >
    <div
      className="px-6 py-4 flex items-center justify-between"
      style={{ borderBottom: '1px solid var(--color-border-subtle)', background: '#fafbfc' }}
    >
      <div>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>{title}</h2>
        {subtitle && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 3 }}>{subtitle}</p>
        )}
      </div>
      {badge && (
        <span
          className="badge"
          style={{
            background: 'var(--color-info-bg)',
            color: 'var(--color-info-text)',
            borderColor: 'var(--color-info-border)',
            fontSize: 'var(--text-2xs)',
            fontWeight: 700,
          }}
        >
          {badge}
        </span>
      )}
    </div>
    <div className="p-6">{children}</div>
  </div>
);

// ─────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────
const Field = ({
  label,
  value,
  onChange,
  type = 'text',
  required,
  step,
  placeholder,
  error,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  step?: string;
  placeholder?: string;
  error?: string;
}) => (
  <div>
    <label
      style={{
        display: 'block',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        marginBottom: 6,
      }}
    >
      {label}{' '}
      {required && <span style={{ color: 'var(--color-error)' }}>*</span>}
    </label>
    <input
      type={type}
      step={step}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`input input-mono ${error ? 'border-rose-500 ring-1 ring-rose-500/50' : ''}`}
    />
    {error && (
      <p style={{ color: 'var(--color-error)', fontSize: '11px', marginTop: 4, fontWeight: 500 }}>
        {error}
      </p>
    )}
  </div>
);

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export const NewTest = () => {
  const [step, setStep] = useState(0);
  const [oimlConfig, setOimlConfig] = useState<OimlConfig | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Step 1
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState('');
  const [showNewInstrument, setShowNewInstrument] = useState(false);
  const [newInst, setNewInst] = useState({
    model_number: '',
    manufacturer: '',
    serial_number: '',
    accuracy_class: 'III',
    max_capacity: '30',
    min_capacity: '0.02',
    scale_interval_e: '0.01',
    scale_interval_d: '0.01',
    unit: 'kg',
  });

  // Step 2
  const [sessionForm, setSessionForm] = useState({
    inspector_name: 'Dr. Ramesh Kumar (Legal Metrology Officer)',
    lab_location: 'Regional Reference Standards Laboratory, New Delhi',
    test_type: 'type_evaluation',
    ambient_temp_c: '20.0',
    relative_humidity: '50.0',
    pressure_hpa: '1013.2',
  });

  // Session & instrument state
  const [sessionId, setSessionId] = useState('');
  const [instrument, setInstrument] = useState<Instrument | null>(null);

  // Step 3: Weighing
  interface WeighRow {
    load: number;
    indication: string;
    delta_load: string;
    direction: 'increasing' | 'decreasing';
  }
  const [weighRows, setWeighRows] = useState<WeighRow[]>([]);

  // Step 4: Eccentricity
  const [eccRows, setEccRows] = useState([
    { position: 'center', label: 'Center (Position 1)', indication: '' },
    { position: 'ne', label: 'NE Corner (Position 2)', indication: '' },
    { position: 'nw', label: 'NW Corner (Position 3)', indication: '' },
    { position: 'sw', label: 'SW Corner (Position 4)', indication: '' },
    { position: 'se', label: 'SE Corner (Position 5)', indication: '' },
  ]);

  // Step 5: Repeatability
  const [rep50, setRep50] = useState<string[]>(Array(5).fill(''));
  const [repMax, setRepMax] = useState<string[]>(Array(5).fill(''));

  // Step 6: Discrimination & Creep
  const [discForm, setDiscForm] = useState({
    base_load: '15.0',
    base_indication: '15.000',
    extra_weight: '0.014',
    new_indication: '15.010',
  });
  const [creepRows, setCreepRows] = useState([
    { time_min: 0, label: '0 min (Initial)', indication: '30.000' },
    { time_min: 5, label: '5 min', indication: '30.001' },
    { time_min: 15, label: '15 min', indication: '30.002' },
    { time_min: 30, label: '30 min (Final)', indication: '30.003' },
  ]);

  // Step 7: AI
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Step 8: Report
  const [report, setReport] = useState<{
    report_number: string;
    sha256_hash: string;
    overall_verdict: string;
  } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // General
  const [submitting, setSubmitting] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // ── Load instruments & OIML config
  useEffect(() => {
    api
      .getInstruments()
      .then((r) => {
        const list = r.data ?? [];
        setInstruments(list);
        if (list.length > 0) {
          setSelectedInstrumentId(list[0].id);
        }
      })
      .catch(() => {});

    api
      .getOimlConfig()
      .then((r) => {
        setOimlConfig(r.data);
      })
      .catch(() => {});
  }, []);

  // ── Set up weighing rows when instrument changes
  useEffect(() => {
    if (!instrument) return;
    const loads = genLoadPoints(instrument.max_capacity, 10);
    const rows: WeighRow[] = loads.map((load, i) => ({
      load,
      indication: load.toFixed(4),
      delta_load: '0.000',
      direction: i <= loads.length / 2 ? 'increasing' : 'decreasing',
    }));
    setWeighRows(rows);

    // Also preset eccentricity load
    const eccDefault = (instrument.max_capacity / 3).toFixed(4);
    setEccRows([
      { position: 'center', label: 'Center (Position 1)', indication: eccDefault },
      { position: 'ne', label: 'NE Corner (Position 2)', indication: eccDefault },
      { position: 'nw', label: 'NW Corner (Position 3)', indication: eccDefault },
      { position: 'sw', label: 'SW Corner (Position 4)', indication: eccDefault },
      { position: 'se', label: 'SE Corner (Position 5)', indication: eccDefault },
    ]);

    // Preset repeatability
    const halfLoad = (instrument.max_capacity * 0.5).toFixed(4);
    const fullLoad = instrument.max_capacity.toFixed(4);
    setRep50(Array(5).fill(halfLoad));
    setRepMax(Array(5).fill(fullLoad));

    // Preset discrimination & creep
    setDiscForm({
      base_load: halfLoad,
      base_indication: halfLoad,
      extra_weight: (instrument.scale_interval_d * 1.4).toFixed(4),
      new_indication: (parseFloat(halfLoad) + instrument.scale_interval_d).toFixed(4),
    });
    setCreepRows([
      { time_min: 0, label: '0 min (Initial)', indication: fullLoad },
      { time_min: 5, label: '5 min', indication: (parseFloat(fullLoad) + instrument.scale_interval_e * 0.1).toFixed(4) },
      { time_min: 15, label: '15 min', indication: (parseFloat(fullLoad) + instrument.scale_interval_e * 0.2).toFixed(4) },
      { time_min: 30, label: '30 min (Final)', indication: (parseFloat(fullLoad) + instrument.scale_interval_e * 0.25).toFixed(4) },
    ]);
  }, [instrument]);

  const selectedInstrument = instruments.find((i) => i.id === selectedInstrumentId) ?? null;

  // ─── Step nav helpers
  const nextStep = () => {
    setStepError(null);
    setFieldErrors({});
    setStep((s) => s + 1);
  };
  const prevStep = () => {
    setStepError(null);
    setFieldErrors({});
    setStep((s) => s - 1);
  };

  // ─── Preset Handlers for Judges
  const fillCompliantWeighing = () => {
    if (!instrument) return;
    setWeighRows((prev) =>
      prev.map((r) => ({
        ...r,
        indication: (r.load + 0.001 * (Math.sin(r.load) * 0.5)).toFixed(4),
        delta_load: '0.000',
      }))
    );
  };

  const fillDefectiveWeighing = () => {
    if (!instrument) return;
    setWeighRows((prev) =>
      prev.map((r, i) => ({
        ...r,
        indication: (r.load + (i > 4 ? 0.025 : 0.002)).toFixed(4),
        delta_load: '0.000',
      }))
    );
  };

  // ─── Step 1: Select/register instrument
  const handleStep1 = async () => {
    setStepError(null);
    setFieldErrors({});
    if (showNewInstrument) {
      if (!newInst.model_number || !newInst.manufacturer || !newInst.serial_number) {
        setStepError('Model number, manufacturer and serial number are required.');
        return;
      }
      setSubmitting(true);
      try {
        const res = await api.createInstrument({
          ...newInst,
          max_capacity: parseFloat(newInst.max_capacity),
          min_capacity: parseFloat(newInst.min_capacity),
          scale_interval_e: parseFloat(newInst.scale_interval_e),
          scale_interval_d: parseFloat(newInst.scale_interval_d),
        });
        const created: Instrument = res.data;
        setInstruments((prev) => [...prev, created]);
        setSelectedInstrumentId(created.id);
        setInstrument(created);
        nextStep();
      } catch (err: any) {
        const backendFields = err.response?.data?.fields || err.response?.data?.detail?.fields;
        if (backendFields) {
          setFieldErrors(backendFields);
          const firstMsg = Object.values(backendFields)[0] as string;
          setStepError(firstMsg || 'Validation failed.');
        } else {
          setStepError(err.response?.data?.detail || 'Failed to register instrument.');
        }
      } finally {
        setSubmitting(false);
      }
    } else {
      if (!selectedInstrumentId) {
        setStepError('Please select an instrument.');
        return;
      }
      setInstrument(selectedInstrument);
      nextStep();
    }
  };

  // ─── Step 2: Create session
  const handleStep2 = async () => {
    setStepError(null);
    setFieldErrors({});
    if (!sessionForm.inspector_name || !sessionForm.lab_location) {
      setStepError('Inspector name and lab location are required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createSession({
        instrument_id: instrument!.id,
        test_type: sessionForm.test_type,
        inspector_name: sessionForm.inspector_name,
        lab_location: sessionForm.lab_location,
        ambient_temp_c: parseFloat(sessionForm.ambient_temp_c),
        relative_humidity: parseFloat(sessionForm.relative_humidity),
        pressure_hpa: parseFloat(sessionForm.pressure_hpa),
      });
      setSessionId(res.data.id);
      nextStep();
    } catch (err: any) {
      const backendFields = err.response?.data?.fields || err.response?.data?.detail?.fields;
      if (backendFields) {
        setFieldErrors(backendFields);
        const firstMsg = Object.values(backendFields)[0] as string;
        setStepError(firstMsg || 'Validation failed.');
      } else {
        setStepError(err.response?.data?.detail || 'Failed to create test session.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step 3: Weighing test
  const handleStep3 = async () => {
    setStepError(null);
    setSubmitting(true);
    try {
      const points = weighRows.map((r) => ({
        load: r.load,
        indication: parseFloat(r.indication) || r.load,
        delta_load: parseFloat(r.delta_load) || 0,
        direction: r.direction,
      }));
      await api.runWeighingTest({ session_id: sessionId, points });
      nextStep();
    } catch {
      setStepError('Weighing test submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step 4: Eccentricity test
  const handleStep4 = async () => {
    setStepError(null);
    setSubmitting(true);
    try {
      const eccLoad = parseFloat((instrument!.max_capacity / 3).toFixed(4));
      const centerPt = eccRows.find((r) => r.position === 'center');
      const centerIndication = parseFloat(centerPt?.indication || '') || eccLoad;
      const cornerPts = eccRows
        .filter((r) => r.position !== 'center')
        .map((r) => ({
          position: r.position,
          load: eccLoad,
          indication: parseFloat(r.indication) || eccLoad,
        }));

      await api.runEccentricityTest({
        session_id: sessionId,
        center_indication: centerIndication,
        points: cornerPts,
      });
      nextStep();
    } catch {
      setStepError('Eccentricity test submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step 5: Repeatability test
  const handleStep5 = async () => {
    setStepError(null);
    setSubmitting(true);
    try {
      const load50 = instrument!.max_capacity * 0.5;
      const loadMax = instrument!.max_capacity;
      await api.runRepeatabilityTest({
        session_id: sessionId,
        series_half_max: rep50.map((v) => parseFloat(v) || load50),
        series_max: repMax.map((v) => parseFloat(v) || loadMax),
      });
      nextStep();
    } catch {
      setStepError('Repeatability test submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step 6: Discrimination & Creep tests
  const handleStepDiscriminationCreep = async () => {
    setStepError(null);
    setSubmitting(true);
    try {
      await api.runDiscriminationTest({
        session_id: sessionId,
        base_load: parseFloat(discForm.base_load) || 0,
        base_indication: parseFloat(discForm.base_indication) || 0,
        extra_weight: parseFloat(discForm.extra_weight) || 0,
        new_indication: parseFloat(discForm.new_indication) || 0,
      });

      await api.runCreepTest({
        session_id: sessionId,
        time_series: creepRows.map((r) => ({
          time_min: r.time_min,
          indication: parseFloat(r.indication) || instrument!.max_capacity,
        })),
      });

      nextStep();
    } catch {
      setStepError('Discrimination & Creep test submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step 7: AI Analysis
  const handleAIAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await api.runAIAnalysis(sessionId, {});
      setAiResult(res.data);
    } catch {
      setAiError('AI analysis failed. Please ensure all tests have been submitted.');
    } finally {
      setAiLoading(false);
    }
  };

  // ─── Step 8: Generate report
  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const res = await api.generateReport(sessionId);
      setReport(res.data);
    } catch {
      setStepError('Report generation failed.');
    } finally {
      setReportLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // Weighing row helpers
  // ─────────────────────────────────────────────
  const updateWeighRow = useCallback(
    (idx: number, field: 'indication' | 'delta_load', value: string) => {
      setWeighRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
    },
    []
  );

  const calcError = (row: WeighRow) => {
    const ind = parseFloat(row.indication);
    const dl = parseFloat(row.delta_load) || 0;
    if (isNaN(ind)) return null;
    return ind - row.load + dl;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div
              className="flex items-center justify-center"
              style={{
                width: 34,
                height: 34,
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
                color: 'white',
                boxShadow: '0 4px 12px rgba(30,64,175,0.25)',
              }}
            >
              <Scale size={18} />
            </div>
            <h1 style={{ fontSize: 'clamp(18px, 3vw, 22px)', fontWeight: 900, color: 'var(--color-text-primary)', letterSpacing: '-0.025em', margin: 0 }}>
              OIML R-76 Type Evaluation Wizard
            </h1>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginLeft: 44 }}>
            Step-by-step metrological testing protocol per Legal Metrology Act 2009 &amp; OIML R-76:2006
          </p>
        </div>
      </div>

      {/* Stepper Navigation */}
      <StepIndicator current={step} />

      {stepError && (
        <div className="alert alert-error animate-fade-in-up">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{stepError}</span>
        </div>
      )}

      {/* ── STEP 0: Select Instrument ── */}
      {step === 0 && (
        <Card
          title="Step 1 &mdash; Select Instrument for Testing"
          subtitle="Choose an existing verified model or register a new prototype"
          badge="OIML R-76 Section 2"
        >
          <div className="space-y-5">
            {!showNewInstrument ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Select Target Instrument
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {instruments.map((inst) => {
                      const isSelected = selectedInstrumentId === inst.id;
                      return (
                        <div
                          key={inst.id}
                          onClick={() => setSelectedInstrumentId(inst.id)}
                          className={`p-4 rounded-xl cursor-pointer border transition-all duration-200 ${
                            isSelected
                              ? 'bg-indigo-50/60 border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-mono font-bold text-sm text-slate-900">
                                {inst.model_number}
                              </span>
                              <p className="text-xs text-slate-500">{inst.manufacturer}</p>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                              Class {inst.accuracy_class}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs font-mono text-slate-500 pt-2 border-t border-slate-100">
                            <span>Max: {inst.max_capacity} {inst.unit}</span>
                            <span>e: {inst.scale_interval_e} {inst.unit}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                    onClick={() => setShowNewInstrument(true)}
                  >
                    <span>+ Register a brand new scale prototype</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200/80 text-indigo-900 text-xs flex items-center gap-2">
                  <Sparkles size={15} className="text-indigo-600 shrink-0" />
                  <span>Registering new NAWI prototype &mdash; specify metrological parameters below</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Model Number"
                    value={newInst.model_number}
                    onChange={(v) => setNewInst((p) => ({ ...p, model_number: v }))}
                    error={fieldErrors['model_number']}
                    required
                    placeholder="e.g. ULTRA-SCALE-50"
                  />
                  <Field
                    label="Manufacturer"
                    value={newInst.manufacturer}
                    onChange={(v) => setNewInst((p) => ({ ...p, manufacturer: v }))}
                    error={fieldErrors['manufacturer']}
                    required
                    placeholder="e.g. Precision Tech Labs"
                  />
                  <Field
                    label="Serial Number"
                    value={newInst.serial_number}
                    onChange={(v) => setNewInst((p) => ({ ...p, serial_number: v }))}
                    error={fieldErrors['serial_number']}
                    required
                    placeholder="e.g. SN-2026-X99"
                  />
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Accuracy Class <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newInst.accuracy_class}
                      onChange={(e) => setNewInst((p) => ({ ...p, accuracy_class: e.target.value }))}
                      className="input select"
                    >
                      {['I', 'II', 'III', 'IIII'].map((c) => (
                        <option key={c} value={c}>Class {c}</option>
                      ))}
                    </select>
                    {fieldErrors['accuracy_class'] && (
                      <p style={{ color: 'var(--color-error)', fontSize: '11px', marginTop: 4 }}>
                        {fieldErrors['accuracy_class']}
                      </p>
                    )}
                  </div>
                  <Field
                    label="Max Capacity"
                    type="number"
                    step="0.001"
                    value={newInst.max_capacity}
                    onChange={(v) => setNewInst((p) => ({ ...p, max_capacity: v }))}
                    error={fieldErrors['max_capacity']}
                    required
                  />
                  <Field
                    label="Min Capacity"
                    type="number"
                    step="0.001"
                    value={newInst.min_capacity}
                    onChange={(v) => setNewInst((p) => ({ ...p, min_capacity: v }))}
                    error={fieldErrors['min_capacity']}
                    required
                  />
                  <Field
                    label="Scale Interval (e)"
                    type="number"
                    step="0.001"
                    value={newInst.scale_interval_e}
                    onChange={(v) => setNewInst((p) => ({ ...p, scale_interval_e: v }))}
                    error={fieldErrors['scale_interval_e']}
                    required
                  />
                  <Field
                    label="Verification Interval (d)"
                    type="number"
                    step="0.001"
                    value={newInst.scale_interval_d}
                    onChange={(v) => setNewInst((p) => ({ ...p, scale_interval_d: v }))}
                    error={fieldErrors['scale_interval_d'] || fieldErrors['_instrument']}
                    required
                  />
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Unit</label>
                    <select
                      value={newInst.unit}
                      onChange={(e) => setNewInst((p) => ({ ...p, unit: e.target.value }))}
                      className="input select"
                    >
                      {['kg', 'g', 'lb', 't'].map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <button
                  className="text-xs text-slate-500 hover:text-slate-900 underline"
                  onClick={() => setShowNewInstrument(false)}
                >
                  &larr; Return to existing instruments
                </button>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-200">
              <button
                onClick={handleStep1}
                disabled={submitting || (!showNewInstrument && !selectedInstrumentId)}
                className="btn btn-primary"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                <span>Continue to Environment Setup</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── STEP 1: Session Setup ── */}
      {step === 1 && (
        <Card
          title="Step 2 &mdash; Laboratory &amp; Environmental Conditions"
          subtitle="Record mandatory ambient temperature, relative humidity, and atmospheric pressure"
          badge="OIML R-76 Clause 3.9"
        >
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="Lead Inspector Name"
                value={sessionForm.inspector_name}
                onChange={(v) => setSessionForm((p) => ({ ...p, inspector_name: v }))}
                error={fieldErrors['inspector_name']}
                required
              />
              <Field
                label="Testing Facility / Lab Location"
                value={sessionForm.lab_location}
                onChange={(v) => setSessionForm((p) => ({ ...p, lab_location: v }))}
                error={fieldErrors['lab_location']}
                required
              />
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Evaluation Protocol <span className="text-rose-500">*</span>
                </label>
                <select
                  value={sessionForm.test_type}
                  onChange={(e) => setSessionForm((p) => ({ ...p, test_type: e.target.value }))}
                  className="input select"
                >
                  <option value="type_evaluation">Pattern Approval / Type Evaluation (Full Test)</option>
                  <option value="verification">Initial Verification (Field)</option>
                </select>
              </div>
              <Field
                label="Ambient Temperature (°C)"
                type="number"
                step="0.1"
                value={sessionForm.ambient_temp_c}
                onChange={(v) => setSessionForm((p) => ({ ...p, ambient_temp_c: v }))}
                error={fieldErrors['ambient_temp_c']}
              />
              <Field
                label="Relative Humidity (% RH)"
                type="number"
                step="0.1"
                value={sessionForm.relative_humidity}
                onChange={(v) => setSessionForm((p) => ({ ...p, relative_humidity: v }))}
                error={fieldErrors['relative_humidity']}
              />
              <Field
                label="Atmospheric Pressure (hPa)"
                type="number"
                step="0.1"
                value={sessionForm.pressure_hpa}
                onChange={(v) => setSessionForm((p) => ({ ...p, pressure_hpa: v }))}
                error={fieldErrors['pressure_hpa']}
              />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="text-slate-500">Target Scale:</span>
                <span className="font-mono font-bold text-slate-900">{instrument?.model_number}</span>
                <span className="text-slate-300">|</span>
                <span className="text-indigo-700 font-mono font-bold">Max {instrument?.max_capacity} {instrument?.unit}</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Class {instrument?.accuracy_class}
              </span>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-200">
              <button
                onClick={prevStep}
                className="btn btn-ghost"
              >
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={handleStep2}
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                <span>Initialize Test Run</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── STEP 2: Weighing Test ── */}
      {step === 2 && (
        <Card
          title="Step 3 &mdash; Weighing Performance Test"
          subtitle="Measure error across ascending & descending load steps. MPE limits computed dynamically per OIML standards."
          badge="OIML R-76 Clause 3.5"
        >
          <div className="space-y-4">
            {/* Judge Quick Filler Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Zap size={15} className="text-amber-500" />
                <span>Quick Test Presets:</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fillCompliantWeighing}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 transition-all"
                >
                  ⚡ Fill Compliant Readings
                </button>
                <button
                  type="button"
                  onClick={fillDefectiveWeighing}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 transition-all"
                >
                  ⚠️ Fill Non-Compliant Drift
                </button>
              </div>
            </div>

            {/* Weighing Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 text-[11px] uppercase font-bold">
                    {['#', 'Load (L)', 'Indication (I)', 'ΔL', 'Direction', 'Error (Ec)', 'MPE Limit', 'Status'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {weighRows.map((row, idx) => {
                    const err = calcError(row);
                    const mpe = instrument
                      ? computeMPEFromConfig(row.load, instrument.scale_interval_e, instrument.accuracy_class, oimlConfig)
                      : 0;
                    const compliant = err === null || Math.abs(err) <= mpe;
                    return (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          !compliant ? 'bg-rose-50/70 hover:bg-rose-50' : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-3 py-2 text-slate-400 font-sans">{idx + 1}</td>
                        <td className="px-3 py-2 font-bold text-slate-900">{row.load.toFixed(4)}</td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            step="0.0001"
                            value={row.indication}
                            onChange={(e) => updateWeighRow(idx, 'indication', e.target.value)}
                            className="w-24 px-2 py-1 rounded-md bg-white border border-slate-300 text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-mono text-xs"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            step="0.0001"
                            value={row.delta_load}
                            onChange={(e) => updateWeighRow(idx, 'delta_load', e.target.value)}
                            className="w-20 px-2 py-1 rounded-md bg-white border border-slate-300 text-slate-700 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-mono text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-bold uppercase ${
                              row.direction === 'increasing'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {row.direction}
                          </span>
                        </td>
                        <td
                          className={`px-3 py-2 font-bold ${
                            compliant ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {err !== null ? err.toFixed(4) : '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-500">±{mpe.toFixed(4)}</td>
                        <td className="px-3 py-2">
                          {err !== null &&
                            (compliant ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                                <CheckCircle2 size={11} /> PASS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-300">
                                <AlertTriangle size={11} /> FAIL
                              </span>
                            ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-200">
              <button
                onClick={prevStep}
                className="btn btn-ghost"
              >
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={handleStep3}
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                <span>Submit Weighing &amp; Proceed to Eccentricity</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── STEP 3: Eccentricity ── */}
      {step === 3 && (
        <Card
          title="Step 4 &mdash; Eccentricity Corner Load Test"
          subtitle="Apply 1/3 of Max capacity to center and all four quadrants"
          badge="OIML R-76 Clause 3.6"
        >
          <div className="space-y-5">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Target Corner Test Load (1/3 Max):</span>
              <span className="font-mono font-bold text-indigo-700 text-sm">
                {instrument ? (instrument.max_capacity / 3).toFixed(4) : '—'} {instrument?.unit}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {eccRows.map((row, idx) => {
                const target = instrument ? instrument.max_capacity / 3 : 0;
                const val = parseFloat(row.indication) || 0;
                const error = row.indication ? val - target : 0;
                const pass =
                  instrument &&
                  Math.abs(error) <= instrument.scale_interval_e;

                return (
                  <div
                    key={row.position}
                    className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-900">{row.label}</span>
                      {row.indication && (
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            pass
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-50 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {pass ? 'PASS' : 'FAIL'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.0001"
                        value={row.indication}
                        placeholder={target.toFixed(4)}
                        onChange={(e) =>
                          setEccRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, indication: e.target.value } : r))
                          )
                        }
                        className="w-full px-3 py-2 rounded-lg text-xs text-slate-900 bg-white border border-slate-300 font-mono outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-200">
              <button
                onClick={prevStep}
                className="btn btn-ghost"
              >
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={handleStep4}
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                <span>Submit Eccentricity &amp; Proceed</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── STEP 4: Repeatability ── */}
      {step === 4 && (
        <Card
          title="Step 5 &mdash; Repeatability Test"
          subtitle="Perform 5 consecutive weighings at 50% and 100% capacity"
          badge="OIML R-76 Clause 3.6.1"
        >
          <div className="space-y-6">
            {[
              {
                label: '50% Load Series',
                load: instrument ? instrument.max_capacity * 0.5 : 0,
                vals: rep50,
                setter: setRep50,
              },
              {
                label: '100% Max Load Series',
                load: instrument ? instrument.max_capacity : 0,
                vals: repMax,
                setter: setRepMax,
              },
            ].map(({ label, load, vals, setter }) => {
              const nums = vals.map((v) => parseFloat(v)).filter((v) => !isNaN(v));
              const span = nums.length ? Math.max(...nums) - Math.min(...nums) : 0;
              const repLimit = instrument
                ? (oimlConfig?.repeatability_limit_factor ?? 1.0) * instrument.scale_interval_e
                : 0;
              const pass = span <= repLimit;

              return (
                <div key={label} className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      {label} &mdash; <span className="font-mono text-indigo-700">{load.toFixed(4)} {instrument?.unit}</span>
                    </span>
                    {nums.length === 5 && (
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded ${
                          pass
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-50 text-rose-800 border border-rose-300'
                        }`}
                      >
                        Span: {span.toFixed(4)} (Limit: {repLimit.toFixed(4)}) &bull; {pass ? 'PASS' : 'FAIL'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {vals.map((v, i) => (
                      <div key={i}>
                        <label className="block text-[10px] text-slate-500 uppercase font-mono mb-1 font-bold">
                          Rep #{i + 1}
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          value={v}
                          placeholder={load.toFixed(4)}
                          onChange={(e) =>
                            setter((prev) => prev.map((p, pi) => (pi === i ? e.target.value : p)))
                          }
                          className="w-full px-2 py-1.5 rounded-lg text-xs bg-white border border-slate-300 text-slate-900 font-mono outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="flex justify-between pt-4 border-t border-slate-200">
              <button
                onClick={prevStep}
                className="btn btn-ghost"
              >
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={handleStep5}
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                <span>Submit Repeatability &amp; Proceed to Discrimination &amp; Creep</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── STEP 5: Discrimination & Creep Tests (§3.7 & §3.9) ── */}
      {step === 5 && (
        <Card
          title="Step 6 &mdash; Discrimination &amp; Load Cell Creep Tests"
          subtitle="Record response to small extra load (Discrimination §3.7) and time-dependent drift under load (Creep §3.9)"
          badge="OIML R-76 Clauses 3.7 &amp; 3.9"
        >
          <div className="space-y-6">
            {/* Discrimination Form (§3.7) */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Discrimination Test (§3.7)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Apply base load, then add extra weight (&ge; 1.4d). Indication change (&Delta;I) must be &ge; 1.0d ({instrument?.scale_interval_d} {instrument?.unit}).
                  </p>
                </div>
                {(() => {
                  const bInd = parseFloat(discForm.base_indication) || 0;
                  const nInd = parseFloat(discForm.new_indication) || 0;
                  const change = Math.abs(nInd - bInd);
                  const req = instrument?.scale_interval_d ?? 0.01;
                  const isDiscPass = change >= req;
                  return (
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded ${
                        isDiscPass
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-50 text-rose-800 border border-rose-300'
                      }`}
                    >
                      &Delta;I: {change.toFixed(4)} (Req: &ge; {req.toFixed(4)}) &bull; {isDiscPass ? 'PASS' : 'FAIL'}
                    </span>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field
                  label="Base Test Load"
                  type="number"
                  step="0.0001"
                  value={discForm.base_load}
                  onChange={(v) => setDiscForm((p) => ({ ...p, base_load: v }))}
                  required
                />
                <Field
                  label="Base Indication (I₁)"
                  type="number"
                  step="0.0001"
                  value={discForm.base_indication}
                  onChange={(v) => setDiscForm((p) => ({ ...p, base_indication: v }))}
                  required
                />
                <Field
                  label="Extra Weight (≈ 1.4d)"
                  type="number"
                  step="0.0001"
                  value={discForm.extra_weight}
                  onChange={(v) => setDiscForm((p) => ({ ...p, extra_weight: v }))}
                  required
                />
                <Field
                  label="New Indication (I₂)"
                  type="number"
                  step="0.0001"
                  value={discForm.new_indication}
                  onChange={(v) => setDiscForm((p) => ({ ...p, new_indication: v }))}
                  required
                />
              </div>
            </div>

            {/* Creep Form (§3.9) */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Load Cell Creep Test (§3.9)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Apply Max Capacity ({instrument?.max_capacity} {instrument?.unit}). Record indication at 0, 5, 15, and 30 min. Max drift must be &le; 0.5e ({((instrument?.scale_interval_e ?? 0.01) * 0.5).toFixed(4)} {instrument?.unit}).
                  </p>
                </div>
                {(() => {
                  const baseInd = parseFloat(creepRows[0]?.indication) || 0;
                  const drifts = creepRows.map((r) => Math.abs((parseFloat(r.indication) || baseInd) - baseInd));
                  const maxDrift = Math.max(...drifts, 0);
                  const creepLimit = (instrument?.scale_interval_e ?? 0.01) * 0.5;
                  const isCreepPass = maxDrift <= creepLimit;
                  return (
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded ${
                        isCreepPass
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-50 text-rose-800 border border-rose-300'
                      }`}
                    >
                      Max Drift: {maxDrift.toFixed(4)} (Limit: &le; {creepLimit.toFixed(4)}) &bull; {isCreepPass ? 'PASS' : 'FAIL'}
                    </span>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {creepRows.map((r, i) => (
                  <div key={r.time_min}>
                    <label className="block text-[10px] text-slate-600 uppercase font-mono mb-1 font-bold">
                      {r.label}
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={r.indication}
                      onChange={(e) =>
                        setCreepRows((prev) =>
                          prev.map((item, idx) => (idx === i ? { ...item, indication: e.target.value } : item))
                        )
                      }
                      className="w-full px-2 py-1.5 rounded-lg text-xs bg-white border border-slate-300 text-slate-900 font-mono outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-200">
              <button
                onClick={prevStep}
                className="btn btn-ghost"
              >
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={handleStepDiscriminationCreep}
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                <span>Submit &amp; Proceed to AI Audit</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── STEP 6: AI Analysis ── */}
      {step === 6 && (
        <Card
          title="Step 7 &mdash; AI Anomaly &amp; Metrological Health Audit"
          subtitle="Isolation Forest anomaly detection, power-law load cell creep fitting, and thermal drift analysis"
          badge="Machine Learning Layer"
        >
          <div className="space-y-6">
            {aiError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                <AlertTriangle size={16} />
                <span>{aiError}</span>
              </div>
            )}

            {!aiResult && !aiLoading && (
              <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4">
                <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 inline-block shadow-2xs">
                  <Brain size={32} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Execute Machine Learning Diagnostics</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Process submitted measurement points to detect micro-anomalies, measure visco-elastic load-cell creep, and evaluate temperature sensitivity.
                  </p>
                </div>
                <button
                  onClick={handleAIAnalysis}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  Run Full AI Metrology Pipeline
                </button>
              </div>
            )}

            {aiLoading && (
              <div className="py-16 text-center space-y-3">
                <Loader2 size={32} className="animate-spin text-indigo-600 mx-auto" />
                <p className="text-xs font-bold text-slate-900">Running AI Pipeline...</p>
                <p className="text-[11px] text-slate-500">
                  Isolation Forest &bull; Log-Regression Creep Model &bull; Thermal Drift Fit
                </p>
              </div>
            )}

            {aiResult && (
              <div className="space-y-5">
                {/* 3 Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block mb-1 font-bold">
                      Anomaly Score
                    </span>
                    <span className="text-3xl font-black font-mono text-indigo-700">
                      {aiResult.ai_results.anomaly.anomaly_score.toFixed(3)}
                    </span>
                    <p className="text-xs text-slate-600 mt-1">
                      {aiResult.ai_results.anomaly.anomalies_found ? '⚠️ Anomalies Detected' : '✅ Nominal Readings'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block mb-1 font-bold">
                      Creep Risk Level
                    </span>
                    <StatusBadge status={aiResult.ai_results.creep.risk_level} />
                    <p className="text-xs text-slate-600 font-mono mt-2">
                      R² Fit: {aiResult.ai_results.creep.r_squared.toFixed(4)}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block mb-1 font-bold">
                      Thermal Drift Verdict
                    </span>
                    <StatusBadge status={aiResult.ai_results.thermal.is_compliant ? 'pass' : 'fail'} />
                    <p className="text-xs text-slate-600 font-mono mt-2">
                      Slope: {aiResult.ai_results.thermal.slope_per_5c.toFixed(5)} / 5°C
                    </p>
                  </div>
                </div>

                {/* Recommendations */}
                {aiResult.recommendations.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck size={15} className="text-indigo-600" />
                      <span>AI Expert Recommendations:</span>
                    </span>
                    <div className="space-y-2">
                      {aiResult.recommendations.map((rec, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs flex items-start gap-3"
                        >
                          <StatusBadge status={rec.severity} />
                          <div>
                            <p className="text-xs font-bold text-slate-900">{rec.area}</p>
                            <p className="text-xs text-slate-600">{rec.message}</p>
                            <p className="text-[11px] text-indigo-700 mt-1 font-mono font-semibold">
                              Action: {rec.action}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-slate-200">
              <button
                onClick={prevStep}
                className="btn btn-ghost"
              >
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={nextStep}
                className="btn btn-primary"
              >
                <span>Proceed to Report &amp; Cryptographic Certificate</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── STEP 7: Generate Report ── */}
      {step === 7 && (
        <Card
          title="Step 8 &mdash; Issue Cryptographically Signed OIML Certificate"
          subtitle="Generate final verification report with SHA-256 seal for tamper-proof regulatory storage"
          badge="Regulatory Certificate Vault"
        >
          <div className="space-y-6">
            {!report && (
              <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4">
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 inline-block shadow-2xs">
                  <Award size={32} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Generate Official Test Certificate</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Digitally signs all module evaluations with a SHA-256 cryptographic hash and archives the record into the MetrologiX regulatory vault.
                  </p>
                </div>
                <button
                  onClick={handleGenerateReport}
                  disabled={reportLoading}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/25 active:scale-95 transition-all disabled:opacity-50"
                >
                  {reportLoading ? 'Generating Cryptographic Seal...' : 'Issue Final Certificate'}
                </button>
              </div>
            )}

            {report && (
              <div className="space-y-4">
                <div
                  className={`p-6 rounded-2xl border text-center space-y-2 ${
                    report.overall_verdict.toUpperCase() === 'PASS'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-rose-50 border-rose-300 text-rose-950'
                  }`}
                >
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase ${
                      report.overall_verdict.toUpperCase() === 'PASS'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    FINAL VERDICT: {report.overall_verdict.toUpperCase()}
                  </span>
                  <h2 className="text-xl font-black">
                    {report.overall_verdict.toUpperCase() === 'PASS'
                      ? 'Model Approval Recommended per OIML R-76'
                      : 'Non-Compliant &mdash; Type Approval Rejected'}
                  </h2>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 font-mono text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-slate-500 font-sans">Official Certificate No:</span>
                    <span className="font-bold text-slate-900 text-sm">{report.report_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-sans block mb-1 font-semibold">SHA-256 Digital Verification Hash:</span>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-indigo-700 break-all text-[11px] font-bold">
                      {report.sha256_hash}
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 font-sans">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/reports/${report.report_number}/pdf`}
                        download
                        className="btn btn-sm btn-primary flex items-center gap-1.5"
                      >
                        <Download size={13} /> Download PDF Report
                      </a>
                      <a
                        href={`/api/reports/${report.report_number}/docx`}
                        download
                        className="btn btn-sm btn-secondary flex items-center gap-1.5"
                      >
                        <FileSpreadsheet size={13} /> Word .docx
                      </a>
                    </div>
                    <span className="text-slate-500 text-xs">
                      Archived in MetrologiX Vault
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
