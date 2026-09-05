import React from 'react';

export default function Tag({
  children,
  variant = 'blue', // 'blue' | 'pink' | 'green' | 'amber' | 'danger' | 'neutral'
  className = '',
  pill = false,
}) {
  const variantStyles = {
    blue: 'bg-surface-interactive text-accent-blue border-border-subtle',
    pink: 'bg-accent-pink/15 text-accent-pink border-accent-pink/30',
    green: 'bg-status-live/15 text-status-live border-status-live/30',
    amber: 'bg-status-warning/15 text-status-warning border-status-warning/30',
    danger: 'bg-status-danger/15 text-status-danger border-status-danger/30',
    neutral: 'bg-surface-interactive text-text-secondary border-border-subtle',
  };

  return (
    <span
      className={`inline-flex items-center font-mono-tag text-mono-tag tracking-wider border px-2 py-0.5 select-none ${
        pill ? 'rounded-full px-2.5' : 'rounded'
      } ${variantStyles[variant] || variantStyles.blue} ${className}`}
    >
      {children}
    </span>
  );
}
