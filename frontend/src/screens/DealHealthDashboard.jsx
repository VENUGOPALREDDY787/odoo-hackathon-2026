import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import BigNumber from '../components/BigNumber';
import CircularGauge from '../components/CircularGauge';
import BarChart from '../components/BarChart';
import Tag from '../components/Tag';
import { DEAL_HEALTH_ANOMALIES } from '../data/mockData';

export default function DealHealthDashboard({ _onNavigate }) {
  const { t } = useTranslation();
  const [anomalies] = useState(DEAL_HEALTH_ANOMALIES);
  const [actionAlert, setActionAlert] = useState(null);

  const stalledCount = anomalies.filter((a) => a.issueType === 'STALLED').length;
  const anomalyCount = anomalies.filter((a) => a.issueType === 'ANOMALY').length;
  const slippageCount = anomalies.filter((a) => a.issueType === 'SLIPPAGE').length;

  const handleNudgeRep = (item) => {
    setActionAlert(`Notification ping dispatched to ${item.rep} for deal ${item.dealId}.`);
    setTimeout(() => setActionAlert(null), 3000);
  };

  const handleEscalate = (item) => {
    setActionAlert(`Deal ${item.dealId} escalated directly to VP Commercial Operations.`);
    setTimeout(() => setActionAlert(null), 3000);
  };

  return (
    <div className="w-full max-w-max-width mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-3xl md:text-4xl font-bold tracking-tight text-text-primary">
            {t('dealHealth.title', 'Deal Health & Anomaly Telemetry')}
          </h1>
          <p className="text-body-sm text-text-secondary mt-1">
            {t('dealHealth.subtitle', 'Algorithmic detection of stalled stages, rep concession anomalies, and fulfillment slippage')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Tag variant="green">ENGINE ONLINE</Tag>
          <span className="font-mono-tag text-xs text-text-secondary">Scanned 1m ago</span>
        </div>
      </div>

      {actionAlert && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="p-4 bg-status-live/15 border border-status-live/40 text-status-live rounded-2xl text-xs font-mono flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{actionAlert}</span>
        </motion.div>
      )}

      {/* Bento Grid: 12-col grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-gutter-lg">
        {/* Row 1: Three Alert Stat Cards (3 cols each = 9) + Circular Gauge (3 cols) = 12 */}
        {/* Card 1: Stalled Deals Alert (Amber) */}
        <Card className="lg:col-span-3 md:col-span-6 flex flex-col justify-between p-6 min-h-[160px]">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-xs uppercase text-text-secondary">
              Stalled Pipelines
            </span>
            <span className="w-2 h-2 rounded-full bg-status-warning animate-pulse" />
          </div>
          <div className="my-4">
            <BigNumber
              value={stalledCount}
              color="text-status-warning"
              delta="+1 vs last wk"
              deltaType="negative"
            />
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Deals with zero status or touchpoint movement &gt; 7 business days.
          </p>
        </Card>

        {/* Card 2: Discount Anomalies Alert (Red) */}
        <Card className="lg:col-span-3 md:col-span-6 flex flex-col justify-between p-6 min-h-[160px]">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-xs uppercase text-text-secondary">
              Discount Anomalies
            </span>
            <span className="w-2 h-2 rounded-full bg-status-danger animate-pulse" />
          </div>
          <div className="my-4">
            <BigNumber
              value={anomalyCount}
              color="text-status-danger"
              delta="Critical Flag"
              deltaType="negative"
            />
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Rep concession exceeds historical rep behavioral mean by &gt; 12%.
          </p>
        </Card>

        {/* Card 3: Fulfillment Slippage Alert (Pink) */}
        <Card className="lg:col-span-3 md:col-span-6 flex flex-col justify-between p-6 min-h-[160px]">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-xs uppercase text-text-secondary">
              Delivery Slippage
            </span>
            <span className="w-2 h-2 rounded-full bg-accent-pink animate-pulse" />
          </div>
          <div className="my-4">
            <BigNumber
              value={slippageCount}
              color="text-accent-pink"
              delta="Customs Delay"
              deltaType="neutral"
            />
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Estimated fulfillment date lapsed without status progression.
          </p>
        </Card>

        {/* Card 4: Circular Gauge SLA Compliance (3-col span) */}
        <Card className="lg:col-span-3 md:col-span-6 flex flex-col items-center justify-center p-6 text-center min-h-[160px]">
          <CircularGauge value={94} label="APPROVAL SLA COMPLIANCE" size={140} />
          <span className="font-mono-tag text-[10px] text-text-secondary mt-3">
            Target SLA: 90% in &lt; 24h
          </span>
        </Card>

        {/* Row 2: Pink Margin Protected Card (6 cols) + Bar Chart (6 cols) = 12 */}
        {/* Card 5: Pink "Margin Protected This Month" Card (6-col span) */}
        <div className="lg:col-span-6 md:col-span-12 bg-surface-card border border-accent-pink/40 rounded-[32px] p-7 flex flex-col justify-between relative overflow-hidden group min-h-[200px]">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-accent-pink/10 blur-3xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono-tag text-xs uppercase tracking-wider text-accent-pink font-semibold">
                MARGIN PROTECTED THIS MONTH
              </span>
              <Tag variant="pink">POLICY SAVINGS</Tag>
            </div>
            <div className="my-5 flex items-baseline gap-3">
              <div className="font-kpi-value text-5xl md:text-kpi-value text-accent-pink font-bold tracking-tighter leading-none">
                +$148.4k
              </div>
              <span className="font-mono-tag text-xs text-status-live font-semibold">
                ▲ +18.2% vs target
              </span>
            </div>
          </div>
          <p className="text-body-sm text-text-secondary text-xs leading-relaxed max-w-lg">
            Gross capital margin saved by the automated discount governance engine catching
            over-limit lines before proposal issuance to clients.
          </p>
        </div>

        {/* Card 6: 8-bar Trailing Window Stalled-Deal Trend (6-col span) */}
        <Card className="lg:col-span-6 md:col-span-12 p-7 flex flex-col justify-between min-h-[200px]">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-label-caps text-xs uppercase text-text-secondary">
                8-Day Stalled Deals Volume Trend
              </span>
              <h4 className="font-headline-sm text-lg font-bold text-text-primary mt-0.5">
                Trailing Trajectory
              </h4>
            </div>
            <span className="font-mono-tag text-xs text-accent-blue">Trailing 8 Days</span>
          </div>

          <div className="flex-1 flex items-end">
            <BarChart
              data={[40, 60, 55, 75, 45, 85, 30, 25]}
              labels={['D-7', 'D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'TODAY']}
              height="h-24"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-xs text-text-secondary font-mono">
            <span>Peak stalled: D-2 (85% index)</span>
            <span className="text-status-live">Declining trend (-58%)</span>
          </div>
        </Card>
      </div>

      {/* Alert Table: Deal, Issue Type, Flagged Date, Action Buttons */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle mb-2">
          <span className="font-label-caps text-xs uppercase text-text-secondary font-semibold">
            Real-Time Anomaly Audit Queue
          </span>
          <span className="font-mono-tag text-xs text-text-secondary">
            {anomalies.length} active flags
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle font-label-caps text-text-secondary uppercase text-[10px]">
                <th className="py-3 px-3">Deal</th>
                <th className="py-3 px-3">Customer / Rep</th>
                <th className="py-3 px-3">Summary</th>
                <th className="py-3 px-3 text-center">Issue Type</th>
                <th className="py-3 px-3 text-center">Flagged</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50">
              {anomalies.map((item) => (
                <tr key={item.id} className="hover:bg-surface-interactive/30">
                  <td className="py-3 px-3">
                    <span className="font-mono-tag text-xs font-bold text-accent-blue bg-surface-interactive px-2.5 py-1 rounded">
                      {item.dealId}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div>
                      <span className="font-semibold text-sm text-text-primary">{item.customer}</span>
                      <div className="text-xs text-text-secondary font-mono">Rep: {item.rep}</div>
                    </div>
                  </td>
                  <td className="py-3 px-3 max-w-md">
                    <p className="text-text-secondary leading-relaxed">{item.summary}</p>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <Tag
                      variant={
                        item.issueType === 'ANOMALY'
                          ? 'danger'
                          : item.issueType === 'STALLED'
                          ? 'amber'
                          : 'pink'
                      }
                    >
                      {item.issueType}
                    </Tag>
                  </td>
                  <td className="py-3 px-3 text-center font-mono-tag text-text-secondary">
                    {item.flaggedDate}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <PillButton
                        variant="outline"
                        size="sm"
                        onClick={() => handleNudgeRep(item)}
                      >
                        Nudge Rep
                      </PillButton>
                      <PillButton
                        variant="danger"
                        size="sm"
                        onClick={() => handleEscalate(item)}
                      >
                        Escalate
                      </PillButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}