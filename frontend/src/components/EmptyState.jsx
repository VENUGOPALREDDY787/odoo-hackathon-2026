import React from 'react';
import Card from './Card';
import PillButton from './PillButton';

export default function EmptyState({
  icon = 'inbox',
  title = 'No records found',
  description = 'There are no active items matching this filter or criteria.',
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <Card className={`text-center py-16 flex flex-col items-center justify-center max-w-xl mx-auto ${className}`}>
      <div className="w-16 h-16 rounded-full bg-surface-interactive flex items-center justify-center text-text-secondary mb-4 border border-border-subtle">
        <span className="material-symbols-outlined text-[32px]">{icon}</span>
      </div>
      <h3 className="font-headline-sm text-lg font-semibold text-text-primary mb-2">
        {title}
      </h3>
      <p className="text-body-md text-text-secondary max-w-md mx-auto leading-relaxed mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <PillButton variant="primary" onClick={onAction}>
          {actionLabel}
        </PillButton>
      )}
    </Card>
  );
}
