import React from 'react';

export default function Card({
  children,
  className = '',
  accent = 'none', // 'none' | 'blue' | 'pink' | 'interactive'
  onClick,
  radiance = false,
}) {
  let baseClass = 'bg-surface-card border border-border-subtle rounded-[32px] p-6 md:p-8 relative overflow-hidden transition-all duration-300';
  
  if (accent === 'blue') {
    baseClass = 'bg-accent-blue text-surface-base rounded-[32px] p-6 md:p-8 relative overflow-hidden shadow-lg transition-all duration-300';
  } else if (accent === 'interactive') {
    baseClass = 'bg-surface-interactive border border-border-subtle rounded-[24px] p-6 relative overflow-hidden transition-all duration-300';
  }

  return (
    <div
      onClick={onClick}
      className={`${baseClass} ${onClick ? 'cursor-pointer hover:border-text-secondary/40 hover:scale-[1.008]' : ''} ${className}`}
    >
      {radiance && (
        <>
          <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-accent-blue/5 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-tertiary/5 blur-3xl pointer-events-none" />
        </>
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
