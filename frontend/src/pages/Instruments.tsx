import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  FlaskConical,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Search,
  LayoutGrid,
  List,
  Scale,
} from 'lucide-react';
import { api } from '../api/client';
import type { Instrument } from '../types';

const classConfig: Record<string, { color: string; bg: string; label: string }> = {
  I:    { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'Class I — Special' },
  II:   { color: '#6366f1', bg: 'rgba(99,102,241,0.10)',  label: 'Class II — Fine' },
  III:  { color: '#0ea5e9', bg: 'rgba(14,165,233,0.10)',  label: 'Class III — Medium' },
  IIII: { color: '#f97316', bg: 'rgba(249,115,22,0.10)',  label: 'Class IIII — Coarse' },
};
const getClass = (c: string) => classConfig[c] ?? { color: '#9ea3b8', bg: 'rgba(158,163,184,0.10)', label: `Class ${c}` };

const cardStyle = {
  background: 'var(--color-surface-1)',
  border: '1.5px solid var(--color-border-default)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-md)',
};

export const Instruments = () => {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const fetchInstruments = async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.getInstruments();
      setInstruments(res.data ?? []);
    } catch {
      setError('Failed to load instruments. Please check backend server connectivity.');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchInstruments(); }, []);

  const filtered = instruments.filter((inst) => {
    const matchSearch = inst.model_number.toLowerCase().includes(search.toLowerCase()) ||
      inst.manufacturer.toLowerCase().includes(search.toLowerCase()) ||
      inst.serial_number.toLowerCase().includes(search.toLowerCase());
    const matchClass = classFilter === 'all' || inst.accuracy_class.toUpperCase() === classFilter;
    return matchSearch && matchClass;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, #14b8a6, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(20,184,166,0.30)' }}>
              <FlaskConical size={17} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: 'clamp(17px,3vw,21px)', fontWeight: 900, color: 'var(--color-text-primary)', letterSpacing: '-0.025em', margin: 0 }}>NAWI Instrument Catalog</h1>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>Registered weighing instruments under OIML R-76 evaluation</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={fetchInstruments} disabled={loading} className="btn btn-secondary btn-sm">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link to="/test/new" className="btn btn-primary">
            <PlusCircle size={14} />
            Register &amp; Test
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-4" style={cardStyle}>
        <div className="input-with-icon w-full md:w-80">
          <Search size={14} className="icon" />
          <input type="text" placeholder="Search model, manufacturer, serial…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="input" />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div className="pill-group">
            {['all', 'I', 'II', 'III', 'IIII'].map((c) => {
              const cfg = c !== 'all' ? getClass(c) : null;
              return (
                <button
                  key={c}
                  onClick={() => setClassFilter(c)}
                  className={`pill-item ${classFilter === c ? 'active' : ''}`}
                  style={classFilter === c && cfg ? { color: cfg.color, borderColor: `${cfg.color}30`, background: cfg.bg } : {}}
                >
                  {c === 'all' ? 'All Classes' : `Class ${c}`}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1" style={{ background: 'var(--color-surface-2)', border: '1.5px solid var(--color-border-default)', borderRadius: 'var(--radius-full)', padding: 3 }}>
            {[{ mode: 'grid', Icon: LayoutGrid }, { mode: 'table', Icon: List }].map(({ mode, Icon }) => (
              <button key={mode} onClick={() => setViewMode(mode as any)} className="btn-icon-sm flex items-center justify-center"
                style={{ background: viewMode === mode ? '#fff' : 'transparent', color: viewMode === mode ? 'var(--color-primary)' : 'var(--color-text-tertiary)', border: viewMode === mode ? '1.5px solid var(--color-border-default)' : '1.5px solid transparent', cursor: 'pointer', borderRadius: 'var(--radius-full)', boxShadow: viewMode === mode ? 'var(--shadow-xs)' : 'none' }}>
                <Icon size={13} />
              </button>
            ))}
          </div>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
            {filtered.length} instrument{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {error && (
        <div className="alert alert-warning animate-fade-in-up">
          <AlertTriangle size={14} className="shrink-0" />
          <span>{error}</span>
          <button onClick={fetchInstruments} className="ml-auto font-semibold underline" style={{ fontSize: 'var(--text-xs)' }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1,2,3,4,5,6].map((i) => <div key={i} className="skeleton" style={{ height: 240, borderRadius: 'var(--radius-xl)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={cardStyle}>
          <div className="empty-state">
            <div className="empty-state-icon" style={{ background: 'rgba(20,184,166,0.08)', borderColor: 'rgba(20,184,166,0.20)', color: '#14b8a6' }}>
              <Scale size={22} />
            </div>
            <p className="empty-state-title">No instruments match</p>
            <p className="empty-state-description">
              {search || classFilter !== 'all' ? 'Try adjusting your filter or search.' : 'Register your first weighing instrument to begin.'}
            </p>
            <Link to="/test/new" className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-3)' }}>
              <PlusCircle size={13} /> Register New Scale
            </Link>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((inst) => {
            const { color, bg, label } = getClass(inst.accuracy_class);
            return (
              <div key={inst.id} className="card card-interactive flex flex-col overflow-hidden">
                {/* Colored top bar */}
                <div style={{ height: 4, background: `linear-gradient(90deg, ${color} 0%, ${color}60 100%)` }} />
                <div style={{ padding: 'var(--space-5)', flex: 1 }}>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <span className="badge mb-2" style={{ background: bg, color, borderColor: `${color}20`, borderRadius: 'var(--radius-full)' }}>{label}</span>
                      <h3 className="truncate" style={{ fontSize: 'var(--text-base)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', margin: 0 }}>
                        {inst.model_number}
                      </h3>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>{inst.manufacturer}</p>
                    </div>
                    <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg)', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1.5px solid ${color}18` }}>
                      <Scale size={18} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      { label: 'Max Capacity', val: `${inst.max_capacity} ${inst.unit}` },
                      { label: 'Interval (e)', val: `${inst.scale_interval_e} ${inst.unit}` },
                      { label: 'Min Capacity', val: `${inst.min_capacity} ${inst.unit}` },
                      { label: 'Sessions', val: `${inst.test_count ?? 0} runs` },
                    ].map((spec) => (
                      <div key={spec.label} style={{ padding: '8px 10px', background: 'var(--color-base)', border: '1.5px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)' }}>
                        <div className="label-overline mb-0.5">{spec.label}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>{spec.val}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    S/N: {inst.serial_number}
                  </div>
                </div>

                <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1.5px solid var(--color-border-subtle)', display: 'flex', gap: 8 }}>
                  <Link to={`/instruments/${inst.id}`} className="btn btn-secondary btn-sm flex-1 justify-center">
                    <ExternalLink size={12} /> View Profile
                  </Link>
                  <Link to="/test/new" className="btn btn-primary btn-sm flex-1 justify-center">
                    <PlusCircle size={12} /> Run Test
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {['Model Number','Manufacturer','Class','Max Cap.','Interval (e)','Sessions','Serial No','Registered','Action'].map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inst) => {
                  const { color, bg } = getClass(inst.accuracy_class);
                  return (
                    <tr key={inst.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{inst.model_number}</td>
                      <td>{inst.manufacturer}</td>
                      <td><span className="badge" style={{ background: bg, color, borderColor: `${color}20`, borderRadius: 'var(--radius-full)' }}>Class {inst.accuracy_class}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{inst.max_capacity} {inst.unit}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>{inst.scale_interval_e} {inst.unit}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#8b5cf6', fontWeight: 700 }}>{inst.test_count ?? 0}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>{inst.serial_number}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>{new Date(inst.created_at).toLocaleDateString()}</td>
                      <td><Link to={`/instruments/${inst.id}`} className="btn btn-ghost btn-sm"><ExternalLink size={11} /> Inspect</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
