import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, PlusCircle, Scale, Brain, FileCheck2, Calendar, Layers } from 'lucide-react';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import type { Instrument, TestSession } from '../types';

const classConfig: Record<string, { color: string; bg: string }> = {
  I: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)' },
  II: { color: '#6366f1', bg: 'rgba(99,102,241,0.10)' },
  III: { color: '#0ea5e9', bg: 'rgba(14,165,233,0.10)' },
  IIII: { color: '#f97316', bg: 'rgba(249,115,22,0.10)' },
};
const getClass = (c: string) => classConfig[c] ?? { color: '#9ea3b8', bg: 'rgba(158,163,184,0.10)' };

const cardStyle = {
  background: 'var(--color-surface-1)',
  border: '1.5px solid var(--color-border-default)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-md)',
};

export const InstrumentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const [instRes, sessRes] = await Promise.all([api.getInstrument(id), api.getSessionsByInstrument(id)]);
      setInstrument(instRes.data);
      setSessions(sessRes.data ?? []);
    } catch { setError('Failed to load instrument details.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div className="skeleton" style={{ height: 20, width: 140, borderRadius: 'var(--radius-md)' }} />
      <div className="skeleton" style={{ height: 150, borderRadius: 'var(--radius-xl)' }} />
      <div className="skeleton" style={{ height: 220, borderRadius: 'var(--radius-xl)' }} />
    </div>
  );

  if (error || !instrument) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Link to="/instruments" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
        <ArrowLeft size={13} /> Back to Catalog
      </Link>
      <div className="alert alert-error">
        <AlertTriangle size={14} className="shrink-0" />
        <span>{error ?? 'Instrument not found.'}</span>
        <button onClick={fetchData} className="ml-auto font-semibold underline" style={{ fontSize: 'var(--text-xs)' }}>Retry</button>
      </div>
    </div>
  );

  const { color, bg } = getClass(instrument.accuracy_class);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <Link to="/instruments"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textDecoration: 'none' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-primary)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-secondary)')}
      >
        <ArrowLeft size={13} /> Back to Catalog
      </Link>

      {/* Profile Card */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ height: 5, background: `linear-gradient(90deg, ${color} 0%, ${color}50 100%)` }} />
        <div style={{ padding: 'var(--space-6)' }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-xl)', background: bg, border: `1.5px solid ${color}25`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Scale size={26} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="badge" style={{ background: bg, color, borderColor: `${color}20`, borderRadius: 'var(--radius-full)' }}>Class {instrument.accuracy_class} NAWI</span>
                  <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>S/N: {instrument.serial_number}</span>
                </div>
                <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', letterSpacing: '-0.025em', margin: 0 }}>
                  {instrument.model_number}
                </h1>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  by <strong style={{ color: 'var(--color-text-primary)' }}>{instrument.manufacturer}</strong>
                </p>
              </div>
            </div>
            <Link to="/test/new" className="btn btn-primary">
              <PlusCircle size={14} /> Initiate Test Session
            </Link>
          </div>
        </div>
      </div>

      {/* Specs Grid */}
      <div style={cardStyle}>
        <div style={{ padding: 'var(--space-5)', borderBottom: '1.5px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={15} style={{ color: 'var(--color-primary)' }} />
          <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>OIML R-76 Technical Specifications</h2>
        </div>
        <div style={{ padding: 'var(--space-5)' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Max Capacity', val: `${instrument.max_capacity} ${instrument.unit}`, color: 'var(--color-text-primary)' },
              { label: 'Min Capacity', val: `${instrument.min_capacity} ${instrument.unit}`, color: 'var(--color-text-secondary)' },
              { label: 'Scale Interval (e)', val: `${instrument.scale_interval_e} ${instrument.unit}`, color: '#6366f1' },
              { label: 'Verification Interval (d)', val: `${instrument.scale_interval_d} ${instrument.unit}`, color: '#8b5cf6' },
              { label: 'Accuracy Class', val: `Class ${instrument.accuracy_class}`, color },
              { label: 'Unit', val: instrument.unit, color: 'var(--color-text-primary)' },
              { label: 'Registered Date', val: new Date(instrument.created_at).toLocaleDateString(), color: 'var(--color-text-secondary)' },
              { label: 'Total Sessions', val: `${sessions.length} Recorded`, color: '#f97316' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '12px 14px', background: 'var(--color-base)', border: '1.5px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)' }}>
                <div className="label-overline mb-1.5">{item.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--text-sm)', color: item.color }}>{item.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1.5px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileCheck2 size={15} style={{ color: '#8b5cf6' }} />
            <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>Test &amp; Verification History</h2>
          </div>
          <span className="badge" style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1', borderColor: 'rgba(99,102,241,0.20)', borderRadius: 'var(--radius-full)', fontFamily: 'var(--font-mono)' }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </span>
        </div>

        {sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ background: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.20)', color: '#8b5cf6' }}>
              <Calendar size={20} />
            </div>
            <p className="empty-state-title">No sessions recorded</p>
            <p className="empty-state-description">No test sessions have been run for this instrument yet.</p>
            <Link to="/test/new" className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-3)' }}>
              <PlusCircle size={12} /> Start First Session
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>{['Session Date','Test Type','Inspector','Lab Location','Verdict','Action'].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{new Date(s.created_at).toLocaleString()}</td>
                    <td>
                      <span className="badge" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-default)', borderRadius: 'var(--radius-full)', textTransform: 'capitalize' }}>
                        {s.test_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{s.inspector_name}</td>
                    <td>{s.lab_location}</td>
                    <td><StatusBadge status={s.overall_status} /></td>
                    <td>
                      <Link to={`/diagnostics?session=${s.id}`} className="btn btn-ghost btn-sm" style={{ color: '#8b5cf6' }}>
                        <Brain size={12} /> AI Diagnostics
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
