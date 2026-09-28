import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Scale, ClipboardList, CheckCircle2, FileStack,
  AlertTriangle, PlusCircle, Brain,
  Calculator, ArrowUpRight, ShieldCheck, Activity,
  XCircle, Inbox,
} from 'lucide-react';
import {
  ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { api } from '../api/client';
import { KPICard } from '../components/KPICard';
import { StatusBadge } from '../components/StatusBadge';
import type { DashboardStats } from '../types';

// ── Chart data ─────────────────────────────────────────────────
const LOADS = [0,2,4,6,8,10,12,14,16,18,20,22,24,26,30];
const MPE_U  = [.005,.005,.005,.005,.005,.01,.01,.01,.01,.01,.015,.015,.015,.015,.015];
const MPE_L  = MPE_U.map((v) => -v);
const EC_OK  = [.001,.002,.003,.002,.004,.003,.005,.006,.004,.005,.007,.008,.009,.008,.009];
const EC_BAD = [.001,.003,.005,.007,.004,.009,.011,.013,.008,.009,.012,.016,.014,.016,.017];

const buildChart = (mode: 'compliant'|'defective') =>
  LOADS.map((load,i) => ({ load, mpe_upper:MPE_U[i], mpe_lower:MPE_L[i], error: mode==='compliant'?EC_OK[i]:EC_BAD[i] }));

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#fff', border:'1.5px solid var(--color-border-default)', borderRadius:'var(--radius-lg)', padding:'10px 14px', boxShadow:'var(--shadow-lg)', fontSize:12 }}>
      <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--color-primary)', marginBottom:6, paddingBottom:5, borderBottom:'1px solid var(--color-border-subtle)' }}>
        Load: {label} kg
      </div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display:'flex', justifyContent:'space-between', gap:24, marginBottom:2 }}>
          <span style={{ color:p.color??p.fill, fontSize:11 }}>{p.name}</span>
          <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--color-text-primary)' }}>
            {typeof p.value==='number' ? p.value.toFixed(4)+' kg' : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Section header ─────────────────────────────────────────────
const Hd = ({ icon:Icon, iconColor='#6366f1', title, subtitle, action }:
  { icon:any; iconColor?:string; title:string; subtitle?:string; action?:React.ReactNode }) => (
  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:20 }}>
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ width:28, height:28, borderRadius:'var(--radius-md)', background:`${iconColor}12`, color:iconColor, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Icon size={14} />
      </div>
      <div>
        <h2 style={{ fontSize:'var(--text-sm)', fontWeight:700, color:'var(--color-text-primary)', margin:0, fontFamily:'var(--font-heading)' }}>{title}</h2>
        {subtitle && <p style={{ fontSize:'var(--text-xs)', color:'var(--color-text-secondary)', margin:'2px 0 0', fontFamily:'var(--font-body)' }}>{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

// ── Helpers ────────────────────────────────────────────────────
const hasData = (stats: DashboardStats | null) =>
  stats && (stats.total_instruments > 0 || stats.total_sessions > 0);

const fmtPassRate = (stats: DashboardStats | null, loading: boolean) => {
  if (loading) return '—';
  if (!stats || stats.total_sessions === 0) return '—';
  return `${stats.pass_rate.toFixed(1)}%`;
};

const cardBase = {
  background:'var(--color-surface-1)',
  border:'1.5px solid var(--color-border-default)',
  borderRadius:'var(--radius-xl)',
  boxShadow:'var(--shadow-md)',
};

// ── Dashboard ──────────────────────────────────────────────────
export const Dashboard = () => {
  const [stats, setStats]         = useState<DashboardStats|null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string|null>(null);
  const [demoMode, setDemoMode]   = useState<'compliant'|'defective'>('compliant');
  const [calcLoad, setCalcLoad]   = useState(12);
  const [calcE, setCalcE]         = useState(0.01);

  const fetch = async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.getDashboardStats(); setStats(r.data);
    } catch {
      setError('Unable to connect to backend.');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const n = calcLoad / calcE;
  const mpe = (n <= 500 ? 0.5 : n <= 2000 ? 1.0 : 1.5) * calcE;
  const mpeLabel = n <= 500 ? '0–500 e' : n <= 2000 ? '500–2000 e' : '> 2000 e';
  const chart = buildChart(demoMode);

  const noData = !loading && !hasData(stats);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>

      {/* ── Hero — compact, calmer gradient ─────────────────── */}
      <div
        className="hero-gradient relative overflow-hidden"
        style={{ borderRadius:'var(--radius-2xl)', padding:'var(--space-5) var(--space-6)', boxShadow:'0 6px 24px rgba(30,64,175,0.25)' }}
      >
        {/* Subtle decorative orb */}
        <div style={{ position:'absolute', top:-40, right:-40, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }} />

        <div style={{ position:'relative', zIndex:1 }}>
          {/* One-line top row */}
          <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:12 }}>
            <div>
              <h1
                className="hero-gradient-text-high-contrast"
                style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(17px,2.5vw,22px)', fontWeight:800, letterSpacing:'-0.025em', margin:0, lineHeight:1.2 }}
              >
                OIML R-76 NAWI Compliance Hub
              </h1>
              <p
                className="hero-gradient-subtitle"
                style={{ fontFamily:'var(--font-body)', fontSize:'var(--text-sm)', margin:'4px 0 0', lineHeight:1.4 }}
              >
                Automated type evaluation · ML anomaly detection · SHA-256 certificates
              </p>
            </div>
            <Link
              to="/test/new"
              style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'8px 18px', borderRadius:'var(--radius-lg)', background:'#fff', color:'#1e40af', fontSize:'var(--text-sm)', fontWeight:700, textDecoration:'none', boxShadow:'0 3px 10px rgba(0,0,0,0.15)', flexShrink:0, fontFamily:'var(--font-body)' }}
            >
              <PlusCircle size={14} /> Start New Test
            </Link>
          </div>

          {/* Compact chips row */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:12 }}>
            {[
              { label:'Standard', val:'OIML R-76:2006' },
              { label:'AI Engine', val:'Isolation Forest' },
              { label:'Certificate', val:'SHA-256' },
              { label:'Classes', val:'I · II · III · IIII' },
            ].map((c) => (
              <div key={c.label} style={{ background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:'var(--radius-md)', padding:'4px 10px' }}>
                <span style={{ fontSize:9.5, fontWeight:600, color:'rgba(255,255,255,0.60)', textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:'var(--font-body)', display:'block' }}>{c.label}</span>
                <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.92)', fontFamily:'var(--font-mono)' }}>{c.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────── */}
      {error && (
        <div className="alert alert-warning animate-fade-in-up" role="alert">
          <AlertTriangle size={15} aria-hidden="true" />
          <span style={{ fontFamily:'var(--font-body)' }}>{error}</span>
          <button onClick={fetch} className="ml-auto btn btn-sm btn-ghost" style={{ fontSize:'var(--text-xs)' }}>Retry</button>
        </div>
      )}

      {/* ── Global empty state ───────────────────────────────── */}
      {noData && !error && (
        <div style={{ ...cardBase, padding:'var(--space-12) var(--space-8)', display:'flex', flexDirection:'column', alignItems:'center', gap:'var(--space-4)', textAlign:'center' }}>
          <div style={{ width:64, height:64, borderRadius:'var(--radius-2xl)', background:'rgba(99,102,241,0.08)', border:'1.5px solid rgba(99,102,241,0.18)', color:'#6366f1', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Inbox size={28} />
          </div>
          <div>
            <h2 style={{ fontFamily:'var(--font-heading)', fontSize:'var(--text-xl)', fontWeight:700, color:'var(--color-text-primary)', margin:'0 0 6px' }}>
              No tests yet
            </h2>
            <p style={{ fontFamily:'var(--font-body)', fontSize:'var(--text-sm)', color:'var(--color-text-secondary)', margin:0, maxWidth:360, lineHeight:1.6 }}>
              Run your first NAWI test to see instruments, sessions, pass rates, and certificates populate here automatically.
            </p>
          </div>
          <Link to="/test/new" className="btn btn-primary">
            <PlusCircle size={14} /> Start New NAWI Test
          </Link>
        </div>
      )}

      {/* ── KPI Cards — each links to a detail page ──────────── */}
      {!noData && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Instruments → /instruments */}
          <Link to="/instruments" style={{ textDecoration:'none' }}>
            <KPICard
              title="Instruments"
              value={loading ? '—' : (stats?.total_instruments ?? 0) === 0 ? '—' : stats!.total_instruments}
              subtitle="Registered NAWI profiles"
              icon={Scale}
              color="#6366f1" colorBg="rgba(99,102,241,0.08)"
              loading={loading}
            />
          </Link>
          {/* Sessions → /instruments (sessions list) */}
          <Link to="/instruments" style={{ textDecoration:'none' }}>
            <KPICard
              title="Test Sessions"
              value={loading ? '—' : (stats?.total_sessions ?? 0) === 0 ? '—' : stats!.total_sessions}
              subtitle={
                stats && stats.total_sessions > 0
                  ? `${stats.pass_count} Pass · ${stats.fail_count} Fail`
                  : 'No sessions recorded'
              }
              icon={ClipboardList}
              color="#8b5cf6" colorBg="rgba(139,92,246,0.08)"
              loading={loading}
            />
          </Link>
          {/* Pass Rate — no link, informational */}
          <KPICard
            title="Pass Rate"
            value={fmtPassRate(stats, loading)}
            subtitle={stats && stats.total_sessions > 0 ? 'OIML threshold ≥ 80%' : 'Run tests to see rate'}
            icon={CheckCircle2}
            color="#10b981" colorBg="rgba(16,185,129,0.08)"
            trend={
              stats && stats.total_sessions > 0
                ? (stats.pass_rate >= 80 ? 'Within standard' : 'Below threshold')
                : undefined
            }
            trendType={stats && stats.total_sessions > 0 ? (stats.pass_rate >= 80 ? 'positive' : 'negative') : 'neutral'}
            loading={loading}
          />
          {/* Certificates → /reports */}
          <Link to="/reports" style={{ textDecoration:'none' }}>
            <KPICard
              title="Certificates"
              value={loading ? '—' : (stats?.total_reports ?? 0) === 0 ? '—' : stats!.total_reports}
              subtitle="SHA-256 signed & verifiable"
              icon={FileStack}
              color="#f97316" colorBg="rgba(249,115,22,0.08)"
              loading={loading}
            />
          </Link>
        </div>
      )}

      {/* ── Chart + Calculator ───────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* MPE Chart */}
        <div className="xl:col-span-3 p-5" style={cardBase}>
          <Hd
            icon={Activity} iconColor="#6366f1"
            title="OIML R-76 MPE Tolerance Corridor"
            subtitle="Instrument error vs. maximum permissible error boundaries"
            action={
              <div className="pill-group">
                <button
                  onClick={() => setDemoMode('compliant')}
                  className={`pill-item${demoMode==='compliant'?' active':''}`}
                  aria-pressed={demoMode==='compliant'}
                  style={demoMode==='compliant'?{color:'#10b981',borderColor:'rgba(16,185,129,0.30)',background:'rgba(16,185,129,0.08)'}:{}}
                >
                  <CheckCircle2 size={10} aria-hidden="true" /> Compliant
                </button>
                <button
                  onClick={() => setDemoMode('defective')}
                  className={`pill-item${demoMode==='defective'?' active':''}`}
                  aria-pressed={demoMode==='defective'}
                  style={demoMode==='defective'?{color:'#ef4444',borderColor:'rgba(239,68,68,0.30)',background:'rgba(239,68,68,0.08)'}:{}}
                >
                  <XCircle size={10} aria-hidden="true" /> Defective
                </button>
              </div>
            }
          />
          <div style={{ width:'100%', height:260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top:5, right:10, left:-10, bottom:15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="load" tick={{ fill:'#9ea3b8', fontSize:10 }} label={{ value:'Applied Load (kg)', position:'insideBottom', offset:-8, fill:'#9ea3b8', fontSize:10 }} />
                <YAxis tick={{ fill:'#9ea3b8', fontSize:10 }} tickFormatter={(v) => v.toFixed(3)} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ color:'#9ea3b8', fontSize:11, paddingTop:4 }} />
                <ReferenceLine y={0} stroke="#e2e8f0" />
                <Area dataKey="mpe_upper" fill="rgba(16,185,129,0.06)" stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 3" name="+MPE Limit" dot={false} />
                <Area dataKey="mpe_lower" fill="rgba(16,185,129,0.06)" stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 3" name="−MPE Limit" dot={false} />
                <Line
                  type="monotone" dataKey="error"
                  stroke={demoMode==='compliant'?'#6366f1':'#ef4444'}
                  strokeWidth={2.5}
                  dot={{ fill:demoMode==='compliant'?'#6366f1':'#ef4444', stroke:'#fff', strokeWidth:2, r:4 }}
                  activeDot={{ r:6 }} name="Instrument Error (Ec)"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ borderTop:'1px solid var(--color-border-subtle)', paddingTop:8, marginTop:4, fontSize:'var(--text-xs)', color:'var(--color-text-secondary)', fontFamily:'var(--font-body)' }}>
            Formula: <code style={{ fontFamily:'var(--font-mono)', color:'var(--color-primary)', fontSize:11 }}>Ec = (I + 0.5e − ΔL) − L − E₀</code>
          </div>
        </div>

        {/* Live OIML Inspector */}
        <div className="xl:col-span-2 flex flex-col" style={cardBase}>
          <div style={{ padding:'var(--space-5)', borderBottom:'1.5px solid var(--color-border-subtle)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:34, height:34, borderRadius:'var(--radius-lg)', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Calculator size={16} color="white" />
              </div>
              <div>
                <h3 style={{ fontFamily:'var(--font-heading)', fontSize:'var(--text-sm)', fontWeight:700, color:'var(--color-text-primary)', margin:0 }}>Live OIML Inspector</h3>
                <p style={{ fontFamily:'var(--font-body)', fontSize:'var(--text-xs)', color:'var(--color-text-secondary)', margin:0 }}>Interactive MPE evaluator · Clause 3.5</p>
              </div>
            </div>
          </div>
          <div style={{ padding:'var(--space-5)', flex:1, display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <label htmlFor="calc-load" style={{ fontFamily:'var(--font-body)', fontSize:'var(--text-xs)', fontWeight:600, color:'var(--color-text-secondary)' }}>Test Load (m)</label>
                <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:'var(--color-primary)', fontSize:'var(--text-sm)', fontVariantNumeric:'tabular-nums' }}>{calcLoad.toFixed(2)} kg</span>
              </div>
              <input id="calc-load" type="range" min="0.1" max="30" step="0.1" value={calcLoad} onChange={(e) => setCalcLoad(parseFloat(e.target.value))} aria-label="Test load in kg" />
            </div>
            <div>
              <label htmlFor="calc-interval" style={{ display:'block', fontFamily:'var(--font-body)', fontSize:'var(--text-xs)', fontWeight:600, color:'var(--color-text-secondary)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Scale Interval (e)</label>
              <select id="calc-interval" value={calcE} onChange={(e) => setCalcE(parseFloat(e.target.value))} className="input select" style={{ fontFamily:'var(--font-mono)' }}>
                <option value="0.005">0.005 kg</option>
                <option value="0.01">0.010 kg</option>
                <option value="0.02">0.020 kg</option>
                <option value="0.05">0.050 kg</option>
              </select>
            </div>
            <div style={{ padding:'var(--space-4)', background:'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(139,92,246,0.06))', border:'1.5px solid rgba(99,102,241,0.18)', borderRadius:'var(--radius-lg)', flex:1 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  { label:'Factor (n = m/e)', val:`${n.toFixed(0)} e` },
                  { label:'Tolerance tier', val:mpeLabel },
                ].map((row) => (
                  <div key={row.label} style={{ display:'flex', justifyContent:'space-between', fontSize:'var(--text-xs)' }}>
                    <span style={{ color:'var(--color-text-secondary)', fontFamily:'var(--font-body)' }}>{row.label}:</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{row.val}</span>
                  </div>
                ))}
                <div style={{ borderTop:'1px solid rgba(99,102,241,0.15)', paddingTop:10 }}>
                  <div style={{ fontFamily:'var(--font-body)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--color-text-tertiary)', marginBottom:4 }}>Computed MPE</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:26, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', fontVariantNumeric:'tabular-nums' }}>
                    ±{mpe.toFixed(4)} kg
                  </div>
                </div>
              </div>
            </div>
            <p style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--color-text-tertiary)' }}>±0.5e (0–500e) · ±1.0e (500–2000e) · ±1.5e (&gt;2000e)</p>
          </div>
        </div>
      </div>

      {/* ── Sessions feed + Module status ────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Sessions */}
        <div className="xl:col-span-2 flex flex-col" style={{ ...cardBase, overflow:'hidden' }}>
          <div style={{ padding:'var(--space-5)', borderBottom:'1.5px solid var(--color-border-subtle)' }}>
            <Hd
              icon={ClipboardList} iconColor="#8b5cf6"
              title="Recent Test Sessions"
              subtitle="Latest metrological evaluation records"
              action={
                <Link to="/reports" style={{ display:'flex', alignItems:'center', gap:4, fontSize:'var(--text-xs)', fontWeight:600, color:'var(--color-primary)', textDecoration:'none', fontFamily:'var(--font-body)' }}>
                  All Reports <ArrowUpRight size={12} aria-hidden="true" />
                </Link>
              }
            />
          </div>
          <div style={{ padding:'var(--space-4) var(--space-5)', flex:1 }}>
            {loading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height:58, borderRadius:'var(--radius-lg)' }} />)}
              </div>
            ) : !stats?.recent_sessions?.length ? (
              <div className="empty-state" style={{ padding:'var(--space-8)' }}>
                <div className="empty-state-icon" style={{ background:'rgba(139,92,246,0.08)', borderColor:'rgba(139,92,246,0.20)', color:'#8b5cf6' }}>
                  <ClipboardList size={22} aria-hidden="true" />
                </div>
                <p className="empty-state-title" style={{ fontFamily:'var(--font-heading)' }}>No tests yet. Run your first NAWI test.</p>
                <p className="empty-state-description" style={{ fontFamily:'var(--font-body)' }}>Complete the evaluation wizard to see sessions here.</p>
                <Link to="/test/new" className="btn btn-primary btn-sm" style={{ marginTop:'var(--space-3)' }}>
                  <PlusCircle size={12} /> Start New Test
                </Link>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {stats.recent_sessions.map((s) => {
                  const isPas = s.status.toLowerCase() === 'pass';
                  const isFail = s.status.toLowerCase() === 'fail';
                  return (
                    <div
                      key={s.id}
                      style={{ padding:'10px 14px', borderRadius:'var(--radius-lg)', background:'var(--color-base)', border:'1.5px solid var(--color-border-subtle)', transition:'all 0.15s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background='var(--color-surface-2)'; (e.currentTarget as HTMLElement).style.borderColor='var(--color-border-default)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background='var(--color-base)'; (e.currentTarget as HTMLElement).style.borderColor='var(--color-border-subtle)'; }}
                    >
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ minWidth:0, marginRight:12 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, fontSize:'var(--text-sm)', color:'var(--color-text-primary)', fontVariantNumeric:'tabular-nums' }}>
                              {s.instrument}
                            </span>
                            <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--color-text-tertiary)', background:'var(--color-surface-3)', padding:'1px 6px', borderRadius:'var(--radius-full)' }}>
                              #{s.id.slice(0,8)}
                            </span>
                          </div>
                          <p style={{ fontFamily:'var(--font-body)', fontSize:'var(--text-xs)', color:'var(--color-text-tertiary)', margin:'2px 0 0' }}>
                            {s.inspector} · {new Date(s.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                          {/* Pass/Fail with icon+text — never color alone */}
                          {isPas && (
                            <span className="verdict-pass" style={{ fontFamily:'var(--font-body)', fontSize:'var(--text-xs)' }}>
                              <CheckCircle2 size={13} aria-hidden="true" /> Pass
                            </span>
                          )}
                          {isFail && (
                            <span className="verdict-fail" style={{ fontFamily:'var(--font-body)', fontSize:'var(--text-xs)' }}>
                              <XCircle size={13} aria-hidden="true" /> Fail
                            </span>
                          )}
                          {!isPas && !isFail && <StatusBadge status={s.status} />}
                          <Link
                            to={`/diagnostics?session=${s.id}`}
                            className="btn btn-icon btn-ghost"
                            aria-label={`AI Diagnostics for session ${s.id.slice(0,8)}`}
                            style={{ display:'flex', alignItems:'center', justifyContent:'center' }}
                          >
                            <Brain size={14} style={{ color:'#8b5cf6' }} aria-hidden="true" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Module Status */}
        <div style={{ ...cardBase, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'var(--space-4) var(--space-5)', borderBottom:'1.5px solid var(--color-border-subtle)' }}>
            <Hd icon={ShieldCheck} iconColor="#10b981" title="OIML Module Status" subtitle="All evaluation modules active" />
          </div>
          <div style={{ padding:'var(--space-4) var(--space-5)', flex:1, display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { name:'Weighing Performance §3.5', color:'#6366f1' },
              { name:'Eccentricity Corner §3.6',  color:'#8b5cf6' },
              { name:'Repeatability §3.6.1',      color:'#14b8a6' },
              { name:'Discrimination §3.7',        color:'#f97316' },
              { name:'AI Anomaly & Drift Engine',  color:'#ec4899' },
              { name:'SHA-256 Vault Verification', color:'#10b981' },
            ].map((m) => (
              <div key={m.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', borderRadius:'var(--radius-md)', background:'var(--color-base)', border:'1.5px solid var(--color-border-subtle)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:m.color, flexShrink:0 }} aria-hidden="true" />
                  <span style={{ fontFamily:'var(--font-body)', fontSize:'var(--text-xs)', color:'var(--color-text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</span>
                </div>
                <CheckCircle2 size={13} style={{ color:'#10b981', flexShrink:0 }} aria-label="Active" />
              </div>
            ))}
          </div>
          <div style={{ padding:'var(--space-4) var(--space-5)', borderTop:'1.5px solid var(--color-border-subtle)' }}>
            <Link to="/diagnostics" className="btn btn-gradient-purple" style={{ width:'100%', justifyContent:'center' }}>
              <Brain size={14} aria-hidden="true" /> AI Diagnostic Studio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
