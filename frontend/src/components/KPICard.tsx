import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
  color?: string;
  colorBg?: string;
  badge?: string;
  loading?: boolean;
}

const TrendIcon = ({ type }: { type: 'positive' | 'negative' | 'neutral' }) => {
  if (type === 'positive') return <TrendingUp size={10} />;
  if (type === 'negative') return <TrendingDown size={10} />;
  return <Minus size={10} />;
};

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendType = 'positive',
  color = '#6366f1',
  colorBg,
  badge,
  loading = false,
}) => {
  const bg = colorBg ?? `${color}12`;

  const trendStyle =
    trendType === 'positive'
      ? { bg: 'var(--color-success-bg)', color: 'var(--color-success-text)', border: 'var(--color-success-border)' }
      : trendType === 'negative'
      ? { bg: 'var(--color-error-bg)', color: 'var(--color-error-text)', border: 'var(--color-error-border)' }
      : { bg: 'var(--color-surface-2)', color: 'var(--color-text-secondary)', border: 'var(--color-border-subtle)' };

  return (
    <div
      className="card card-interactive relative overflow-hidden flex flex-col"
      style={{ padding: 'var(--space-5)', minHeight: 140 }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${color} 0%, ${color}60 100%)`,
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        }}
      />

      <div className="flex items-start justify-between gap-3" style={{ flex: 1 }}>
        {/* Left content */}
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex items-center gap-2 mb-3">
            <p className="label-overline truncate">{title}</p>
            {badge && (
              <span
                className="badge shrink-0"
                style={{ background: bg, color, borderColor: `${color}25` }}
              >
                {badge}
              </span>
            )}
          </div>

          {loading ? (
            <div className="skeleton" style={{ height: 36, width: 100, marginBottom: 8 }} />
          ) : (
            <p
              className="font-black leading-none mb-2 tracking-tight"
              style={{ fontSize: 32, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}
            >
              {value}
            </p>
          )}

          {subtitle && (
            <p className="text-metadata leading-snug truncate mt-1">{subtitle}</p>
          )}

          {trend && !loading && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 'var(--radius-full)',
                  background: trendStyle.bg,
                  color: trendStyle.color,
                  border: `1px solid ${trendStyle.border}`,
                }}
              >
                <TrendIcon type={trendType} />
                {trend}
              </span>
            </div>
          )}
        </div>

        {/* Icon */}
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-xl)',
            background: bg,
            border: `1.5px solid ${color}20`,
            color,
            boxShadow: `0 4px 12px ${color}18`,
            marginTop: 4,
          }}
        >
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
};
