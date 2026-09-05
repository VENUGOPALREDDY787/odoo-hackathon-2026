import React from 'react';
import { motion } from 'framer-motion';

export default function StatusBadge({ status, pulse = false, className = '' }) {
  if (!status) return null;

  const normalized = String(status).toLowerCase().replace(/[\s-]/g, '_');

  let label = status;
  let bgClass = 'bg-surface-interactive text-text-secondary border-border-subtle';
  let dotColor = null;
  let pulseColor = null;

  switch (normalized) {
    case 'draft':
      label = 'DRAFT';
      bgClass = 'bg-surface-interactive text-text-secondary border-border-subtle';
      break;

    case 'pending_approval':
      label = 'PENDING APPROVAL';
      bgClass = 'bg-status-warning/15 text-status-warning border-status-warning/40';
      dotColor = 'bg-status-warning';
      pulseColor = 'rgba(245, 158, 11, 0.75)';
      break;

    case 'approved':
      label = 'APPROVED';
      bgClass = 'bg-status-live/15 text-status-live border-status-live/40';
      dotColor = 'bg-status-live';
      pulseColor = 'rgba(74, 222, 128, 0.75)';
      break;

    case 'negotiation':
      label = 'UNDER NEGOTIATION';
      bgClass = 'bg-primary-container/20 text-accent-blue border-accent-blue/40';
      dotColor = 'bg-accent-blue';
      break;

    case 'confirmed':
    case 'fulfilled':
      label = normalized === 'confirmed' ? 'CONFIRMED' : 'FULFILLED';
      bgClass = 'bg-status-live/20 text-status-live border-status-live/50';
      dotColor = 'bg-status-live';
      pulseColor = 'rgba(74, 222, 128, 0.75)';
      break;

    case 'low':
      label = 'LOW RISK';
      bgClass = 'bg-accent-blue/15 text-accent-blue border-accent-blue/40';
      break;

    case 'medium':
      label = 'MEDIUM RISK';
      bgClass = 'bg-status-warning/15 text-status-warning border-status-warning/40';
      dotColor = 'bg-status-warning';
      break;

    case 'high':
      label = 'HIGH RISK';
      bgClass = 'bg-status-danger/15 text-status-danger border-status-danger/40';
      dotColor = 'bg-status-danger';
      pulseColor = 'rgba(239, 68, 68, 0.75)';
      break;

    case 'active':
      label = 'ACTIVE';
      bgClass = 'bg-status-live/15 text-status-live border-status-live/40';
      dotColor = 'bg-status-live';
      pulseColor = 'rgba(74, 222, 128, 0.75)';
      break;

    case 'paused':
      label = 'PAUSED';
      bgClass = 'bg-status-warning/15 text-status-warning border-status-warning/40';
      break;

    case 'cancelled':
      label = 'CANCELLED';
      bgClass = 'bg-surface-interactive text-text-secondary border-border-subtle';
      break;

    case 'paid':
      label = 'PAID';
      bgClass = 'bg-status-live/15 text-status-live border-status-live/40';
      dotColor = 'bg-status-live';
      break;

    case 'unpaid':
      label = 'UNPAID';
      bgClass = 'bg-status-warning/15 text-status-warning border-status-warning/40';
      dotColor = 'bg-status-warning';
      break;

    case 'split_pending':
      label = 'SPLIT PENDING';
      bgClass = 'bg-accent-blue/15 text-accent-blue border-accent-blue/40';
      break;

    case 'backorder':
      label = 'BACKORDER';
      bgClass = 'bg-status-danger/15 text-status-danger border-status-danger/40';
      dotColor = 'bg-status-danger';
      break;

    case 'stalled':
      label = 'STALLED';
      bgClass = 'bg-status-warning/15 text-status-warning border-status-warning/40';
      dotColor = 'bg-status-warning';
      break;

    case 'anomaly':
      label = 'DISCOUNT ANOMALY';
      bgClass = 'bg-status-danger/15 text-status-danger border-status-danger/40';
      dotColor = 'bg-status-danger';
      break;

    case 'slippage':
      label = 'DELIVERY SLIPPAGE';
      bgClass = 'bg-accent-pink/15 text-accent-pink border-accent-pink/40';
      dotColor = 'bg-accent-pink';
      break;

    default:
      label = String(status).toUpperCase();
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono-tag text-mono-tag tracking-wider border select-none ${bgClass} ${className}`}
    >
      {dotColor && (
        <span className="relative flex h-2 w-2">
          {pulse && pulseColor && (
            <motion.span
              animate={{ scale: [1, 2.5, 1], opacity: [0.75, 0, 0.75] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className={`absolute inset-0 rounded-full ${dotColor}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
        </span>
      )}
      <span>{label}</span>
    </span>
  );
}