import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export default function StatusBadge({ status, pulse = false, className = '' }) {
  const { t } = useTranslation();
  if (!status) return null;

  const normalized = String(status).toLowerCase().replace(/[\s-]/g, '_');

  let label = status;
  let bgClass = 'bg-surface-interactive text-text-secondary border-border-subtle';
  let dotColor = null;
  let pulseColor = null;

  switch (normalized) {
    case 'draft':
      label = t('status.draft', 'DRAFT');
      bgClass = 'bg-surface-interactive text-text-secondary border-border-subtle';
      break;

    case 'pending_approval':
      label = t('status.pending_approval', 'PENDING APPROVAL');
      bgClass = 'bg-status-warning/15 text-status-warning border-status-warning/40';
      dotColor = 'bg-status-warning';
      pulseColor = 'rgba(245, 158, 11, 0.75)';
      break;

    case 'approved':
      label = t('status.approved', 'APPROVED');
      bgClass = 'bg-status-live/15 text-status-live border-status-live/40';
      dotColor = 'bg-status-live';
      pulseColor = 'rgba(74, 222, 128, 0.75)';
      break;

    case 'negotiation':
      label = t('status.negotiation', 'UNDER NEGOTIATION');
      bgClass = 'bg-primary-container/20 text-accent-blue border-accent-blue/40';
      dotColor = 'bg-accent-blue';
      break;

    case 'confirmed':
    case 'fulfilled':
      label = normalized === 'confirmed' ? t('status.confirmed', 'CONFIRMED') : t('status.fulfilled', 'FULFILLED');
      bgClass = 'bg-status-live/20 text-status-live border-status-live/50';
      dotColor = 'bg-status-live';
      pulseColor = 'rgba(74, 222, 128, 0.75)';
      break;

    case 'low':
      label = t('status.low', 'LOW RISK');
      bgClass = 'bg-accent-blue/15 text-accent-blue border-accent-blue/40';
      break;

    case 'medium':
      label = t('status.medium', 'MEDIUM RISK');
      bgClass = 'bg-status-warning/15 text-status-warning border-status-warning/40';
      dotColor = 'bg-status-warning';
      break;

    case 'high':
      label = t('status.high', 'HIGH RISK');
      bgClass = 'bg-status-danger/15 text-status-danger border-status-danger/40';
      dotColor = 'bg-status-danger';
      pulseColor = 'rgba(239, 68, 68, 0.75)';
      break;

    case 'active':
      label = t('status.active', 'ACTIVE');
      bgClass = 'bg-status-live/15 text-status-live border-status-live/40';
      dotColor = 'bg-status-live';
      pulseColor = 'rgba(74, 222, 128, 0.75)';
      break;

    case 'paused':
      label = t('status.paused', 'PAUSED');
      bgClass = 'bg-status-warning/15 text-status-warning border-status-warning/40';
      break;

    case 'cancelled':
      label = t('status.cancelled', 'CANCELLED');
      bgClass = 'bg-surface-interactive text-text-secondary border-border-subtle';
      break;

    case 'paid':
      label = t('status.paid', 'PAID');
      bgClass = 'bg-status-live/15 text-status-live border-status-live/40';
      dotColor = 'bg-status-live';
      break;

    case 'unpaid':
      label = t('status.unpaid', 'UNPAID');
      bgClass = 'bg-status-warning/15 text-status-warning border-status-warning/40';
      dotColor = 'bg-status-warning';
      break;

    case 'split_pending':
      label = t('status.split_pending', 'SPLIT PENDING');
      bgClass = 'bg-accent-blue/15 text-accent-blue border-accent-blue/40';
      break;

    case 'backorder':
      label = t('status.backorder', 'BACKORDER');
      bgClass = 'bg-status-danger/15 text-status-danger border-status-danger/40';
      dotColor = 'bg-status-danger';
      break;

    case 'stalled':
      label = t('status.stalled', 'STALLED');
      bgClass = 'bg-status-warning/15 text-status-warning border-status-warning/40';
      dotColor = 'bg-status-warning';
      break;

    case 'anomaly':
      label = t('status.anomaly', 'DISCOUNT ANOMALY');
      bgClass = 'bg-status-danger/15 text-status-danger border-status-danger/40';
      dotColor = 'bg-status-danger';
      break;

    case 'slippage':
      label = t('status.slippage', 'DELIVERY SLIPPAGE');
      bgClass = 'bg-accent-pink/15 text-accent-pink border-accent-pink/40';
      dotColor = 'bg-accent-pink';
      break;

    default:
      label = t(`status.${normalized}`, String(status).toUpperCase());
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