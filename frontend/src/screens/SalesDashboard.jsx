import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import BarChart from '../components/BarChart';
import ListItem from '../components/ListItem';
import Tag from '../components/Tag';

export default function SalesDashboard({
  onNavigate,
  _quotations = [],
  pendingApprovalsCount = 14,
}) {
  const { t } = useTranslation();
  const recentActivities = [
    {
      user: 'Marcus Vance',
      role: 'Enterprise Rep',
      action: 'Submitted Quote QT-2026-8841',
      target: 'Apex Global Logistics ($324,500)',
      time: '12m ago',
      risk: 'HIGH',
      badge: 'Dual Approval Required',
    },
    {
      user: 'Sarah Lin',
      role: 'Sales Manager',
      action: 'Approved Quote QT-2026-8839',
      target: 'Hyperion BioDynamics ($106,000)',
      time: '1h ago',
      risk: 'LOW',
      badge: 'Tier Preferred Rate',
    },
    {
      user: 'System Bot',
      role: 'Negotiation Engine',
      action: 'Counter-Offer Generated (Round 3)',
      target: 'Solaria Cyber Defense ($76,800)',
      time: '3h ago',
      risk: 'MEDIUM',
      badge: 'Delta $3,300',
    },
    {
      user: 'Elena Rostova',
      role: 'Senior Rep',
      action: 'Fulfillment Split Confirmed',
      target: 'Vector Aerospace Systems (12 Nodes)',
      time: '5h ago',
      risk: 'LOW',
      badge: 'Austin + Berlin',
    },
  ];

  return (
    <div data-tour="dashboard" className="w-full max-w-max-width mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Bento Grid Row - 12 col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg">
        {/* Left Hero Deck (8-col span) */}
        <div className="lg:col-span-8 flex flex-col bg-surface-card border border-border-subtle rounded-[32px] p-6 sm:p-8 relative overflow-hidden min-h-[420px]">
          {/* Ambient Radiance Backgrounds */}
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-accent-blue/5 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-tertiary/5 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col h-full">
            {/* Status Pill Badge */}
            <div
              onClick={() => onNavigate('approvals')}
              className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-surface-interactive border border-border-subtle cursor-pointer hover:border-status-warning/50 transition-all select-none"
            >
              <span className="relative flex h-2.5 w-2.5">
                <motion.span
                  animate={{ scale: [1, 2, 1], opacity: [0.75, 0, 0.75] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-full bg-status-live"
                />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-live shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
              </span>
              <span className="font-mono-tag text-mono-tag uppercase tracking-wider text-text-primary">
                {pendingApprovalsCount} {t('status.pending_approval', 'PENDING APPROVALS').toUpperCase()}
              </span>
            </div>

            {/* Headline & Subhead */}
            <div className="mt-8 md:mt-10 space-y-3 flex-1">
              <h1 className="font-kpi-value text-4xl sm:text-5xl md:text-kpi-value text-text-primary tracking-tight font-bold leading-[1.05]">
                {t('dashboard.title', 'DealFlow Operations')}
              </h1>
              <p className="font-body-md text-body-md text-text-secondary max-w-xl leading-relaxed">
                {t('dashboard.subtitle', 'Real-time pricing governance, blended risk analysis, and multi-tier quotation pipeline.')}
              </p>
            </div>

            {/* Action Pill Group & Metric Strip */}
            <div className="relative z-10 pt-8 md:pt-10 mt-auto">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <PillButton
                  variant="primary"
                  size="lg"
                  icon="add"
                  onClick={() => onNavigate('quotation-builder')}
                >
                  {t('navigation.newQuotation', '+ New Quotation')}
                </PillButton>
                <PillButton
                  variant="secondary"
                  size="lg"
                  icon="rule"
                  onClick={() => onNavigate('approvals')}
                >
                  {t('dashboard.reviewApprovalsCTA', 'View Approvals')} ({pendingApprovalsCount})
                </PillButton>
                <PillButton
                  variant="outline"
                  size="lg"
                  icon="view_kanban"
                  onClick={() => onNavigate('quotations')}
                >
                  {t('navigation.quotations', 'Quotations Pipeline')}
                </PillButton>
              </div>

              {/* Inline Quick Telemetry Counters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-border-subtle bg-surface-base/30 rounded-2xl p-4 md:p-5">
                <div>
                  <div className="font-label-caps text-label-caps text-text-secondary uppercase">
                    {t('dashboard.dealVelocity', 'Gross Velocity')}
                  </div>
                  <div className="font-mono-data text-mono-data text-text-primary mt-1 font-semibold flex items-center gap-1.5">
                    <span>$3.82M</span>
                    <span className="text-status-live text-xs">▲ +14.2%</span>
                  </div>
                </div>
                <div>
                  <div className="font-label-caps text-label-caps text-text-secondary uppercase">
                    {t('dashboard.targetPacing', 'SLA Compliance')}
                  </div>
                  <div className="font-mono-data text-mono-data text-text-primary mt-1 font-semibold">
                    99.4%
                  </div>
                </div>
                <div>
                  <div className="font-label-caps text-label-caps text-text-secondary uppercase">
                    {t('dashboard.marginHealth', 'Median Margin')}
                  </div>
                  <div className="font-mono-data text-mono-data text-accent-pink mt-1 font-semibold">
                    31.8%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Bento Column (4-col span) - Two stacked cards matching left height */}
        <div className="lg:col-span-4 flex flex-col gap-gutter-lg min-h-[420px]">
          {/* Top Card: Accent Blue Filled Module */}
          <div
            onClick={() => onNavigate('quotations')}
            className="flex-1 bg-accent-blue text-surface-base rounded-[32px] p-6 sm:p-7 flex flex-col justify-between shadow-lg relative overflow-hidden group cursor-pointer hover:scale-[1.01] transition-transform min-h-[190px]"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono-tag text-mono-tag tracking-wider font-semibold uppercase text-surface-base/80">
                {t('dashboard.activeQuotations', 'OPEN QUOTATIONS').toUpperCase()}
              </span>
              <span className="font-mono-tag text-mono-tag px-2 py-0.5 rounded bg-surface-base/10 text-surface-base font-semibold">
                T-8 DAYS
              </span>
            </div>

            <div className="my-5 flex items-baseline justify-between">
              <div className="font-kpi-value text-5xl md:text-kpi-value tracking-tighter text-surface-base font-bold leading-none">
                48
              </div>
              <div className="text-right">
                <span className="font-mono-tag text-mono-tag text-surface-base/70 block">
                  {t('common.active', 'ACTIVE')} STAGE
                </span>
                <span className="font-body-sm text-body-sm font-semibold text-surface-base">
                  $2.14M Blended
                </span>
              </div>
            </div>

            {/* 8-bar Micro Chart Visualization */}
            <BarChart
              data={[35, 52, 44, 68, 60, 82, 75, 100]}
              labels={['D-7', 'D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'TODAY']}
              inverse
            />
          </div>

          {/* Bottom Card: Dark Rep Telemetry Bento */}
          <div className="flex-1 bg-surface-card border border-border-subtle rounded-[32px] p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden min-h-[190px]">
            <div className="flex items-center justify-between">
              <span className="font-mono-tag text-mono-tag tracking-wider uppercase text-text-secondary">
                {t('reports.repLeaderboard', 'ACTIVE SALES REPS').toUpperCase()}
              </span>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-status-live/15 border border-status-live/30 text-status-live font-mono-tag text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-status-live animate-pulse" />
                <span>{t('common.live', 'LIVE')}</span>
              </div>
            </div>

            <div className="my-4 flex-1 flex flex-col justify-center">
              <div className="font-kpi-value text-5xl md:text-kpi-value text-text-primary font-bold tracking-tighter leading-none">
                18
              </div>
              <p className="font-body-sm text-body-sm text-text-secondary mt-1.5 flex items-center gap-1">
                <span className="text-status-live font-mono font-medium">▲ +3</span>
                <span>active reps vs yesterday</span>
              </p>
            </div>

            {/* Rep Activity Pills */}
            <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
              <div className="flex -space-x-2 overflow-hidden">
                {['MV', 'ER', 'DM', 'SL'].map((initials, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full bg-surface-interactive border-2 border-surface-card flex items-center justify-center text-[10px] font-mono text-accent-blue font-bold"
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <span className="font-mono-tag text-[11px] text-accent-blue">
                12 Deals in Flight →
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Audit Trail Bento Section */}
      <Card className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
          <div>
            <h2 className="font-headline-sm text-xl font-bold text-text-primary tracking-tight">
              {t('approvals.approvalHistory', 'Recent Deal Governance & Audit Trail')}
            </h2>
            <p className="text-body-sm text-text-secondary mt-0.5">
              Live updates emitted from Socket.IO pricing event mesh
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tag variant="blue">{t('common.live', 'LIVE')} STREAM</Tag>
            <PillButton
              variant="outline"
              size="sm"
              onClick={() => onNavigate('deal-health')}
            >
              {t('navigation.dealHealth', 'Deal Health View')}
            </PillButton>
          </div>
        </div>

        <div className="divide-y divide-border-subtle">
          {recentActivities.map((act, idx) => (
            <ListItem key={idx} className="py-4 hover:bg-surface-interactive/40 px-3 -mx-3 rounded-2xl transition-all">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-surface-interactive border border-border-subtle flex items-center justify-center font-mono text-xs text-accent-blue font-bold">
                  {act.user.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-text-primary truncate">{act.user}</span>
                    <span className="text-text-secondary text-xs whitespace-nowrap">• {act.role}</span>
                  </div>
                  <div className="text-body-sm text-text-secondary mt-0.5 truncate">
                    {act.action} — <span className="text-text-primary font-medium">{act.target}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-right flex-shrink-0">
                <div className="hidden sm:block">
                  <Tag variant={act.risk === 'HIGH' ? 'danger' : act.risk === 'MEDIUM' ? 'amber' : 'blue'}>
                    {act.badge}
                  </Tag>
                </div>
                <span className="font-mono-tag text-xs text-text-secondary whitespace-nowrap">{act.time}</span>
              </div>
            </ListItem>
          ))}
        </div>
      </Card>
    </div>
  );
}