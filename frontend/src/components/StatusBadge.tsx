import React from 'react';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Info, Minus } from 'lucide-react';

interface StatusStyle {
  bg: string; text: string; border: string; dotColor: string;
  icon: React.ElementType; animate?: boolean;
}

const statusMap: Record<string, StatusStyle> = {
  pass:        { bg:'rgba(16,185,129,0.10)',  text:'#065f46',  border:'rgba(16,185,129,0.30)',  dotColor:'#10b981', icon:CheckCircle2 },
  completed:   { bg:'rgba(16,185,129,0.10)',  text:'#065f46',  border:'rgba(16,185,129,0.30)',  dotColor:'#10b981', icon:CheckCircle2 },
  verified:    { bg:'rgba(16,185,129,0.10)',  text:'#065f46',  border:'rgba(16,185,129,0.30)',  dotColor:'#10b981', icon:CheckCircle2 },
  fail:        { bg:'rgba(239,68,68,0.08)',   text:'#991b1b',  border:'rgba(239,68,68,0.25)',   dotColor:'#ef4444', icon:XCircle },
  'not found': { bg:'rgba(239,68,68,0.08)',   text:'#991b1b',  border:'rgba(239,68,68,0.25)',   dotColor:'#ef4444', icon:XCircle },
  critical:    { bg:'rgba(220,38,38,0.10)',   text:'#7f1d1d',  border:'rgba(220,38,38,0.30)',   dotColor:'#dc2626', icon:XCircle },
  pending:     { bg:'rgba(245,158,11,0.08)',  text:'#92400e',  border:'rgba(245,158,11,0.25)',  dotColor:'#f59e0b', icon:Clock, animate:true },
  warning:     { bg:'rgba(245,158,11,0.08)',  text:'#92400e',  border:'rgba(245,158,11,0.25)',  dotColor:'#f59e0b', icon:AlertTriangle },
  medium:      { bg:'rgba(245,158,11,0.08)',  text:'#92400e',  border:'rgba(245,158,11,0.25)',  dotColor:'#f59e0b', icon:AlertTriangle },
  high:        { bg:'rgba(249,115,22,0.08)',  text:'#c2410c',  border:'rgba(249,115,22,0.25)',  dotColor:'#f97316', icon:AlertTriangle },
  in_progress: { bg:'rgba(59,130,246,0.08)', text:'#1d4ed8',  border:'rgba(59,130,246,0.25)', dotColor:'#3b82f6', icon:Clock, animate:true },
  low:         { bg:'rgba(0,0,0,0.04)',       text:'#52566b',  border:'rgba(0,0,0,0.10)',      dotColor:'#9ea3b8', icon:Minus },
};

const fallback: StatusStyle = {
  bg:'rgba(0,0,0,0.04)', text:'#52566b', border:'rgba(0,0,0,0.10)', dotColor:'#9ea3b8', icon:Info,
};

export const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({
  status, size = 'sm',
}) => {
  const key = (status || 'low').toLowerCase().trim();
  const s = statusMap[key] ?? fallback;
  const Icon = s.icon;
  const label = status.replace(/_/g, ' ');

  return (
    <span
      role="status"
      aria-label={label}
      className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider whitespace-nowrap"
      style={{
        background: s.bg,
        color: s.text,
        border: `1.5px solid ${s.border}`,
        borderRadius: 'var(--radius-full)',
        padding: size === 'sm' ? '2px 8px' : '3px 10px',
        fontSize: size === 'sm' ? 'var(--text-2xs)' : 'var(--text-xs)',
        letterSpacing: '0.05em',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Icon always present — not color-only */}
      <Icon
        size={10}
        aria-hidden="true"
        className={s.animate ? 'animate-pulse-dot' : ''}
        style={{ flexShrink: 0 }}
      />
      <span>{label}</span>
    </span>
  );
};
