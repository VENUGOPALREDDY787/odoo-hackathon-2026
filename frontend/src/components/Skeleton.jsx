import React from 'react';
import { motion } from 'framer-motion';

export default function Skeleton({ className = '', variant = 'text', width, height }) {
  const baseStyle = {
    background: 'linear-gradient(90deg, var(--border) 25%, var(--interactive) 50%, var(--border) 75%)',
    backgroundSize: '200% 100%',
    borderRadius: variant === 'circular' ? '50%' : variant === 'rounded' ? '12px' : '8px',
    width: width || '100%',
    height: height || (variant === 'text' ? '1rem' : '100%'),
  };

  return (
    <motion.div
      initial={{ opacity: 0.4 }}
      animate={{ opacity: [0.4, 1, 0.4] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      style={baseStyle}
      className={className}
    />
  );
}