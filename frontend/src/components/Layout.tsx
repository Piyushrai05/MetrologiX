import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FlaskConical,
  PlusCircle,
  Brain,
  FileText,
  Scale,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Server,
  Cpu,
  Database,
  Wifi,
  WifiOff,
  AlertTriangle,
  ChevronDown,
  X,
  Menu,
} from 'lucide-react';
import { api } from '../api/client';

// ── Types ─────────────────────────────────────────────────────
type HealthState = 'online' | 'degraded' | 'offline' | 'checking';

interface SystemHealth {
  engine: HealthState;
  ai: HealthState;
  database: HealthState;
  overall: HealthState;
  lastChecked: Date | null;
}

// ── Health Check Hook ──────────────────────────────────────────
function useHealthCheck(intervalMs = 30_000) {
  const [health, setHealth] = useState<SystemHealth>({
    engine: 'checking',
    ai: 'checking',
    database: 'checking',
    overall: 'checking',
    lastChecked: null,
  });

  const check = useCallback(async () => {
    try {
      const res = await api.health();
      const data = res.data ?? {};
      const engine: HealthState = data.status === 'ok' ? 'online' : 'degraded';
      const ai: HealthState = data.ai_model_loaded === false ? 'degraded' : 'online';
      const database: HealthState = data.db === 'ok' || data.database === 'ok' ? 'online' : 'degraded';
      const allOnline = engine === 'online' && database === 'online';
      setHealth({
        engine,
        ai,
        database,
        overall: allOnline ? 'online' : 'degraded',
        lastChecked: new Date(),
      });
    } catch {
      setHealth({
        engine: 'offline',
        ai: 'offline',
        database: 'offline',
        overall: 'offline',
        lastChecked: new Date(),
      });
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [check, intervalMs]);

  return health;
}

// ── Status Indicator colours ───────────────────────────────────
const stateStyle: Record<HealthState, { bg: string; border: string; dot: string; text: string; label: string }> = {
  online:   { bg: 'var(--color-success-bg)',  border: 'var(--color-success-border)',  dot: 'var(--color-success-strong)', text: 'var(--color-success-text)', label: 'Online' },
  degraded: { bg: 'var(--color-warning-bg)',  border: 'var(--color-warning-border)',  dot: 'var(--color-warning)',        text: 'var(--color-warning-text)', label: 'Degraded' },
  offline:  { bg: 'var(--color-error-bg)',    border: 'var(--color-error-border)',    dot: 'var(--color-error)',          text: 'var(--color-error-text)',   label: 'Offline' },
  checking: { bg: 'var(--color-surface-2)',   border: 'var(--color-border-default)',  dot: 'var(--color-text-tertiary)', text: 'var(--color-text-tertiary)', label: 'Checking' },
};

const StateIcon = ({ state }: { state: HealthState }) => {
  if (state === 'online')   return <Wifi size={11} />;
  if (state === 'offline')  return <WifiOff size={11} />;
  if (state === 'degraded') return <AlertTriangle size={11} />;
  return <RefreshCw size={11} className="animate-spin" />;
};

// ── System Status Popover ──────────────────────────────────────
const SystemStatusIndicator: React.FC<{ health: SystemHealth }> = ({ health }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const s = stateStyle[health.overall];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const rows: { label: string; state: HealthState; icon: React.ElementType }[] = [
    { label: 'API Engine',  state: health.engine,   icon: Server },
    { label: 'AI Model',    state: health.ai,        icon: Cpu },
    { label: 'Database',    state: health.database,  icon: Database },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`System status: ${s.label}. Click for details.`}
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all"
        style={{
          background: s.bg,
          border: `1.5px solid ${s.border}`,
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Pulsing dot */}
        <span className="relative flex" style={{ width: 8, height: 8, flexShrink: 0 }}>
          {health.overall === 'online' && (
            <span
              className="animate-ping absolute inline-flex rounded-full opacity-60"
              style={{ inset: 0, background: s.dot }}
            />
          )}
          <span
            className="relative inline-flex rounded-full"
            style={{ width: 8, height: 8, background: s.dot }}
          />
        </span>
        <span
          className="hidden sm:inline"
          style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: s.text }}
        >
          {health.overall === 'checking' ? 'Checking…' : `System ${s.label}`}
        </span>
        <ChevronDown
          size={10}
          style={{ color: s.text, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>

      {/* Popover */}
      {open && (
        <div
          className="animate-fade-in-up"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 240,
            background: 'var(--color-surface-1)',
            border: '1.5px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}>
              System Status
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close status panel"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', display: 'flex' }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Rows */}
          <div style={{ padding: '8px 0' }}>
            {rows.map(({ label, state, icon: Icon }) => {
              const rs = stateStyle[state];
              return (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={13} style={{ color: 'var(--color-text-tertiary)' }} />
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
                      {label}
                    </span>
                  </div>
                  <span
                    className="badge"
                    style={{
                      background: rs.bg,
                      color: rs.text,
                      borderColor: rs.border,
                      borderRadius: 'var(--radius-full)',
                      fontSize: 9,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <StateIcon state={state} />
                    {rs.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer: last checked */}
          <div
            style={{
              padding: '8px 16px',
              borderTop: '1px solid var(--color-border-subtle)',
              fontSize: 10,
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {health.lastChecked
              ? `Last checked: ${health.lastChecked.toLocaleTimeString()}`
              : 'Checking…'}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Nav config (no decorative badges) ─────────────────────────
const navSections = [
  {
    title: 'Overview',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard', color: '#6366f1', colorBg: 'rgba(99,102,241,0.10)' },
    ],
  },
  {
    title: 'Testing',
    items: [
      { path: '/instruments', icon: FlaskConical, label: 'Instruments', color: '#14b8a6', colorBg: 'rgba(20,184,166,0.10)' },
      { path: '/test/new',    icon: PlusCircle,  label: 'New Test',    color: '#8b5cf6', colorBg: 'rgba(139,92,246,0.10)' },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { path: '/diagnostics', icon: Brain,    label: 'AI Diagnostics', color: '#8b5cf6', colorBg: 'rgba(139,92,246,0.10)' },
      { path: '/reports',     icon: FileText, label: 'Certificates',   color: '#ec4899', colorBg: 'rgba(236,72,153,0.10)' },
    ],
  },
];

// ── Toast ──────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: 'success' | 'error' }
let _toastId = 0;

export const toastBus = {
  listeners: [] as ((t: Toast) => void)[],
  show(message: string, type: Toast['type'] = 'success') {
    const t: Toast = { id: ++_toastId, message, type };
    this.listeners.forEach((fn) => fn(t));
  },
};

const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3500);
    };
    toastBus.listeners.push(handler);
    return () => { toastBus.listeners = toastBus.listeners.filter((fn) => fn !== handler); };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-slide-in-right"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            borderRadius: 'var(--radius-lg)',
            background: t.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
            border: `1.5px solid ${t.type === 'success' ? 'var(--color-success-border)' : 'var(--color-error-border)'}`,
            color: t.type === 'success' ? 'var(--color-success-text)' : 'var(--color-error-text)',
            boxShadow: 'var(--shadow-lg)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            maxWidth: 320,
            pointerEvents: 'auto',
          }}
        >
          {t.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {t.message}
        </div>
      ))}
    </div>
  );
};

// ── Main Layout ────────────────────────────────────────────────
export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);
  const [time, setTime] = useState('');
  const health = useHealthCheck(30_000);

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleQuickSeed = async () => {
    setSeeding(true);
    try {
      await api.seedDemo();
      setSeedSuccess(true);
      toastBus.show('Demo data loaded successfully!', 'success');
      setTimeout(() => { setSeedSuccess(false); window.location.reload(); }, 1000);
    } catch {
      toastBus.show('Failed to load demo data. Is the backend running?', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div
        className="flex items-center gap-3 px-4"
        style={{ height: 60, borderBottom: '1.5px solid var(--color-border-subtle)', flexShrink: 0 }}
      >
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 34, height: 34,
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
          }}
        >
          <Scale size={17} color="white" />
        </div>
        {(expanded || mobileOpen) && (
          <div className="min-w-0 animate-fade-in">
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 15, fontWeight: 800,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.03em',
                display: 'block',
              }}
            >
              Metrologi
              <span style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                X
              </span>
            </span>
            <div style={{ fontSize: 9.5, color: 'var(--color-text-tertiary)', fontWeight: 500, marginTop: 1, fontFamily: 'var(--font-body)' }}>
              OIML R-76 Compliance
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2.5 space-y-5 overflow-y-auto">
        {navSections.map((sec) => (
          <div key={sec.title} className="space-y-0.5">
            {(expanded || mobileOpen) && (
              <div
                className="px-2 pb-1.5"
                style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}
              >
                {sec.title}
              </div>
            )}
            {sec.items.map(({ path, icon: Icon, label, color, colorBg }) => {
              const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
              return (
                <Link
                  key={path}
                  to={path}
                  title={!expanded && !mobileOpen ? label : undefined}
                  aria-label={label}
                  onClick={() => setMobileOpen(false)}
                  className="relative group flex items-center gap-2.5 transition-all duration-150"
                  style={{
                    padding: '7px 10px',
                    borderRadius: 'var(--radius-lg)',
                    background: active ? colorBg : 'transparent',
                    border: `1.5px solid ${active ? `${color}30` : 'transparent'}`,
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)'; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {active && <span className="nav-item-active-bar" style={{ background: color }} />}
                  <div
                    className="shrink-0 flex items-center justify-center"
                    style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', background: active ? colorBg : 'transparent', color: active ? color : 'var(--color-text-tertiary)', transition: 'all 0.15s' }}
                  >
                    <Icon size={16} />
                  </div>
                  {(expanded || mobileOpen) && (
                    <span
                      className="truncate"
                      style={{ fontSize: 'var(--text-sm)', fontWeight: active ? 700 : 500, color: active ? color : 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                    >
                      {label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Inspector badge — single canonical SIH mention */}
      {(expanded || mobileOpen) && (
        <div className="mx-3 mb-3 p-3 rounded-xl" style={{ background: 'var(--color-success-bg)', border: '1.5px solid var(--color-success-border)' }}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} style={{ color: 'var(--color-success-strong)', flexShrink: 0 }} />
            <div className="min-w-0">
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-success-text)', margin: 0, lineHeight: 1.2, fontFamily: 'var(--font-heading)' }}>
                SIH 2026 · PS26035
              </p>
              <p style={{ fontSize: 9.5, color: 'var(--color-success-strong)', margin: 0, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                Govt. Metrology Lab
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle (desktop only) */}
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        className="flex items-center justify-center py-3 w-full transition-colors"
        style={{ background: 'transparent', cursor: 'pointer', border: 'none', borderTop: '1.5px solid var(--color-border-subtle)' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
      >
        <ChevronRight
          size={14}
          style={{ transition: 'transform 0.3s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--color-text-tertiary)' }}
        />
      </button>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-base)', fontFamily: 'var(--font-body)' }}>

      {/* ── Mobile drawer backdrop ─────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Desktop Sidebar ───────────────────────────────── */}
      <aside
        className={`hidden md:flex flex-col shrink-0 transition-all duration-300 relative z-30 ${expanded ? 'w-[220px]' : 'w-[60px]'}`}
        style={{ background: 'var(--color-surface-0)', borderRight: '1.5px solid var(--color-border-default)', boxShadow: '2px 0 20px rgba(0,0,0,0.04)' }}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile Drawer ─────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 md:hidden transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--color-surface-0)', borderRight: '1.5px solid var(--color-border-default)', boxShadow: 'var(--shadow-xl)' }}
      >
        <SidebarContent />
      </aside>

      {/* ── Main ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header — clean: only clock, status, demo toggle */}
        <header
          className="flex items-center justify-between px-4 md:px-6 shrink-0"
          style={{ height: 60, background: 'var(--color-surface-0)', borderBottom: '1.5px solid var(--color-border-default)', boxShadow: '0 1px 0 rgba(0,0,0,0.04)' }}
        >
          {/* Left — mobile menu + brand on mobile */}
          <div className="flex items-center gap-3">
            <button
              className="flex md:hidden items-center justify-center"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}
            >
              <Menu size={20} />
            </button>
            <span className="md:hidden font-black tracking-tight" style={{ fontSize: 15, fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}>
              Metrologi<span style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>X</span>
            </span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Clock */}
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
              style={{ background: 'var(--color-surface-2)', border: '1.5px solid var(--color-border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
            >
              <Clock size={11} style={{ color: 'var(--color-primary)' }} />
              <span aria-live="polite" aria-label={`Current time: ${time}`}>{time || '--:--:--'}</span>
            </div>

            {/* Demo Data */}
            <button
              onClick={handleQuickSeed}
              disabled={seeding}
              aria-label="Load demo data"
              className="btn btn-sm btn-secondary"
              style={seedSuccess ? { background: 'var(--color-success-bg)', color: 'var(--color-success-text)', borderColor: 'var(--color-success-border)' } : {}}
            >
              {seeding ? (
                <RefreshCw size={11} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
              ) : seedSuccess ? (
                <CheckCircle2 size={11} style={{ color: 'var(--color-success-strong)' }} />
              ) : (
                <RefreshCw size={11} />
              )}
              <span className="hidden sm:inline">{seeding ? 'Syncing…' : seedSuccess ? 'Loaded!' : 'Demo Data'}</span>
            </button>

            {/* System Status — single real indicator */}
            <SystemStatusIndicator health={health} />
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-6)' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>

      {/* Toast container */}
      <ToastContainer />
    </div>
  );
};
