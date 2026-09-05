import React from 'react';
import { motion } from 'framer-motion';

export default function CircularGauge({
  value = 94,
  label = 'SLA COMPLIANCE',
  size = 160,
  strokeWidth = 8,
  strokeColor = '#B9C9E1',
  trackColor = '#2A2A2A',
  unit = '%',
}) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(100, Math.max(0, value));
  const offset = circumference - (clampedValue / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center relative select-none">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress ring - animated with Framer Motion */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
          strokeLinecap="round"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-kpi-value text-3xl font-bold tracking-tight text-text-primary leading-none">
          {clampedValue}
          <span className="text-base text-accent-blue font-normal">{unit}</span>
        </div>
        {label && (
          <div className="font-label-caps text-[10px] uppercase tracking-wider text-text-secondary mt-1.5 px-2">
            {label}
          </div>
        )}
      </div>
    </div>
  );
}