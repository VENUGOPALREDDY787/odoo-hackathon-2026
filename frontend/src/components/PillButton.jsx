import React from 'react';

export default function PillButton({
  children,
  onClick,
  variant = 'secondary', // 'primary' | 'secondary' | 'outline' | 'green' | 'danger' | 'ghost'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon = null,
  disabled = false,
  className = '',
  type = 'button',
}) {
  const sizeClasses = {
    sm: 'px-3.5 py-1.5 text-xs font-medium gap-1.5',
    md: 'px-5 py-2.5 text-sm font-medium gap-2',
    lg: 'px-6 py-3 text-sm font-semibold gap-2.5',
  };

  const variantClasses = {
    primary:
      'bg-text-primary text-surface-base hover:opacity-90 hover:shadow-[0_0_24px_rgb(var(--text-primary)/0.2)] active:scale-[0.98]',
    secondary:
      'bg-surface-interactive text-text-primary border border-border-subtle hover:border-text-secondary/50 hover:text-accent-blue active:scale-[0.98]',
    outline:
      'bg-transparent text-text-primary border border-border-subtle hover:border-text-primary hover:bg-surface-interactive/50 active:scale-[0.98]',
    green:
      'bg-status-live/15 text-status-live border border-status-live/40 hover:bg-status-live/25 active:scale-[0.98]',
    danger:
      'bg-status-danger/15 text-status-danger border border-status-danger/40 hover:bg-status-danger/25 active:scale-[0.98]',
    ghost:
      'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-interactive/40',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-full transition-all duration-200 select-none ${
        sizeClasses[size]
      } ${variantClasses[variant]} ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'} ${className}`}
    >
      {icon && <span className="material-symbols-outlined text-[18px]">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
