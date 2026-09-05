import React from 'react';

export default function BigNumber({
  value,
  label,
  delta,
  deltaType = 'positive', // 'positive' | 'negative' | 'neutral'
  className = '',
  size = 'lg', // 'lg' (64px) | 'md' (40px) | 'sm' (28px)
  color = 'text-text-primary',
  subtitle,
}) {
  const sizeClasses = {
    lg: 'text-kpi-value-mobile md:text-kpi-value leading-none font-bold tracking-tighter',
    md: 'text-3xl md:text-4xl leading-tight font-bold tracking-tight',
    sm: 'text-xl md:text-2xl leading-tight font-semibold tracking-tight',
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <span className="font-label-caps text-label-caps uppercase tracking-wider text-text-secondary mb-2">
          {label}
        </span>
      )}
      <div className="flex items-baseline gap-3">
        <div className={`font-kpi-value ${sizeClasses[size]} ${color}`}>
          {value}
        </div>
        {delta && (
          <span
            className={`font-mono-tag text-xs font-semibold px-2 py-0.5 rounded-full ${
              deltaType === 'positive'
                ? 'text-status-live bg-status-live/10'
                : deltaType === 'negative'
                ? 'text-status-danger bg-status-danger/10'
                : 'text-text-secondary bg-surface-interactive'
            }`}
          >
            {delta}
          </span>
        )}
      </div>
      {subtitle && (
        <span className="text-body-sm text-text-secondary mt-1.5 font-normal">
          {subtitle}
        </span>
      )}
    </div>
  );
}
