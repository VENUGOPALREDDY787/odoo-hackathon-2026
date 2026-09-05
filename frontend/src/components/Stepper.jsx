import React from 'react';

export default function Stepper({
  steps = [],
  currentStepIndex = 0,
  className = '',
}) {
  return (
    <div className={`w-full py-4 ${className}`}>
      <div className="flex items-center justify-between relative">
        {/* Background track line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border-subtle -translate-y-1/2 z-0" />

        {steps.map((step, idx) => {
          const isCompleted = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;
          const _isUpcoming = idx > currentStepIndex;

          let circleBg = 'bg-surface-card border-border-subtle text-text-secondary';
          let textColor = 'text-text-secondary';

          if (isCompleted) {
            circleBg = 'bg-accent-blue border-accent-blue text-surface-base font-bold';
            textColor = 'text-accent-blue';
          } else if (isCurrent) {
            circleBg = 'bg-text-primary border-text-primary text-surface-base font-bold shadow-[0_0_16px_rgba(255,255,255,0.4)]';
            textColor = 'text-text-primary font-semibold';
          }

          return (
            <div key={idx} className="relative z-10 flex flex-col items-center group">
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs transition-all duration-300 ${circleBg}`}
              >
                {isCompleted ? (
                  <span className="material-symbols-outlined text-[16px]">check</span>
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <div className="mt-2 text-center">
                <span className={`block font-label-caps text-xs uppercase tracking-wider ${textColor}`}>
                  {step.label || step}
                </span>
                {step.sub && (
                  <span className="block font-mono-tag text-[10px] text-text-secondary mt-0.5">
                    {step.sub}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
