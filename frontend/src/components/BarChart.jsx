import React from 'react';
import { motion } from 'framer-motion';

const barVariants = {
  hidden: { scaleY: 0, opacity: 0 },
  show: {
    scaleY: 1,
    opacity: 1,
    transition: { duration: 0.8, ease: [0.2, 0.8, 0.2, 1] },
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    transition: { staggerChildren: 0.05 },
  },
};

export default function BarChart({
  data = [35, 52, 44, 68, 60, 82, 75, 100],
  labels = ['D-7', 'D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'TODAY'],
  height = 'h-14',
  inverse = false,
  className = '',
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className={`pt-2 w-full ${className}`}
    >
      <div
        className={`flex items-end justify-between gap-1.5 ${height} w-full ${
          inverse ? 'bg-surface-base/10' : 'bg-surface-base/60'
        } p-2 rounded-xl`}
      >
        {data.map((val, idx) => {
          const isLatest = idx === data.length - 1;
          let barBg = inverse
            ? isLatest
              ? 'bg-surface-base'
              : 'bg-surface-base/40 hover:bg-surface-base'
            : isLatest
            ? 'bg-accent-blue shadow-[0_0_12px_rgba(185,201,225,0.4)]'
            : 'bg-surface-container-high hover:bg-accent-blue/70';

          return (
            <motion.div
              key={idx}
              variants={barVariants}
              title={`${labels[idx] || `Day ${idx + 1}`}: ${val}%`}
              className={`flex-1 rounded-t-sm cursor-pointer ${barBg}`}
              style={{ height: `${Math.max(12, val)}%` }}
            />
          );
        })}
      </div>
      <div
        className={`flex justify-between font-mono-tag text-[10px] mt-2 px-1 select-none ${
          inverse ? 'text-surface-base/70' : 'text-text-secondary'
        }`}
      >
        <span>{labels[0] || 'D-7'}</span>
        <span>{labels[Math.floor(labels.length / 2)] || 'D-4'}</span>
        <span>{labels[labels.length - 1] || 'TODAY'}</span>
      </div>
    </motion.div>
  );
}