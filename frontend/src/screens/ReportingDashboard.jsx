import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import BigNumber from '../components/BigNumber';
import Tag from '../components/Tag';

export default function ReportingDashboard() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('Quarter'); // 'Month' | 'Quarter' | 'Year'
  const [team, setTeam] = useState('All'); // 'All' | 'Enterprise' | 'EMEA' | 'Americas'
  const [approvalStatus, setApprovalStatus] = useState('All'); // 'All' | 'Approved' | 'Flagged'
  const [exportingType, setExportingType] = useState(null); // 'pdf' | 'xls' | null
  const [exportProgress, setExportProgress] = useState(0);

  const handleExport = (type) => {
    setExportingType(type);
    setExportProgress(10);

    const interval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setExportingType(null);
            setExportProgress(0);
            alert(`Streamed ${type.toUpperCase()} analytics report compiled and downloaded successfully.`);
          }, 300);
          return 100;
        }
        return prev + 25;
      });
    }, 250);
  };

  return (
    <div className="w-full max-w-max-width mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Export Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-3xl font-bold tracking-tight text-text-primary">
            {t('reports.title', 'Executive Analytics & Reporting')}
          </h1>
          <p className="text-body-sm text-text-secondary mt-1">
            {t('reports.subtitle', 'Global deal throughput, approval cycle latencies, and cross-sell attach metrics')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PillButton
            variant="outline"
            size="md"
            icon="picture_as_pdf"
            disabled={exportingType !== null}
            onClick={() => handleExport('pdf')}
          >
            {exportingType === 'pdf' ? `Streaming PDF (${exportProgress}%)...` : `${t('common.export', 'Export')} PDF`}
          </PillButton>
          <PillButton
            variant="secondary"
            size="md"
            icon="table_view"
            disabled={exportingType !== null}
            onClick={() => handleExport('xls')}
          >
            {exportingType === 'xls' ? `Streaming XLS (${exportProgress}%)...` : `${t('common.export', 'Export')} XLS`}
          </PillButton>
        </div>
      </div>

      {/* Connected Filter Bar */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Period Filter */}
          <div className="flex items-center gap-2">
            <span className="font-label-caps text-xs text-text-secondary uppercase">{t('reports.dateRange', 'Period')}:</span>
            <div className="flex items-center bg-surface-interactive border border-border-subtle rounded-full p-1 text-xs">
              {[
                { id: 'Month', label: t('reports.thisMonth', 'Month') },
                { id: 'Quarter', label: t('reports.thisQuarter', 'Quarter') },
                { id: 'Year', label: t('reports.thisYear', 'Year') },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`px-3 py-1 rounded-full font-medium transition-colors ${
                    period === p.id
                      ? 'bg-text-primary text-surface-base'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sales Team Filter */}
          <div className="flex items-center gap-2">
            <span className="font-label-caps text-xs text-text-secondary uppercase">Team:</span>
            <div className="flex items-center bg-surface-interactive border border-border-subtle rounded-full p-1 text-xs">
              {['All', 'Enterprise', 'EMEA', 'Americas'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTeam(t)}
                  className={`px-3 py-1 rounded-full font-medium transition-colors ${
                    team === t
                      ? 'bg-text-primary text-surface-base'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Approval Filter */}
          <div className="flex items-center gap-2">
            <span className="font-label-caps text-xs text-text-secondary uppercase">Status:</span>
            <div className="flex items-center bg-surface-interactive border border-border-subtle rounded-full p-1 text-xs">
              {['All', 'Approved', 'Flagged'].map((s) => (
                <button
                  key={s}
                  onClick={() => setApprovalStatus(s)}
                  className={`px-3 py-1 rounded-full font-medium transition-colors ${
                    approvalStatus === s
                      ? 'bg-text-primary text-surface-base'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Three KPI Big-Number Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-lg">
        <Card className="p-7">
          <BigNumber
            value="142"
            label="QUOTES CREATED"
            delta="+24.2% vs last period"
            deltaType="positive"
            subtitle="Pipeline aggregate: $14.8M"
          />
        </Card>

        <Card className="p-7">
          <BigNumber
            value="3.4h"
            label="AVG APPROVAL TIME"
            delta="-42% SLA acceleration"
            deltaType="positive"
            subtitle="Previous benchmark: 5.8h"
          />
        </Card>

        <Card className="p-7">
          <span className="font-label-caps text-xs uppercase text-text-secondary mb-2 block">
            TOP UP-SOLD PRODUCT
          </span>
          <div className="font-kpi-value text-3xl md:text-4xl font-bold text-accent-pink mt-1">
            AI Copilot Fleet
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono-tag text-xs text-text-secondary">Attach Rate: 68.4%</span>
            <Tag variant="pink">+$384k Margin</Tag>
          </div>
        </Card>
      </div>

      {/* Breakdown Matrix Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-3">
          <h3 className="font-headline-sm text-lg font-bold text-text-primary">
            Regional Revenue & Margin Performance
          </h3>
          <span className="font-mono-tag text-xs text-text-secondary">
            Filter: {period} • {team} Team
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle font-label-caps text-text-secondary uppercase text-[10px]">
                <th className="py-3">Commercial Segment</th>
                <th className="py-3 text-center">Active Deals</th>
                <th className="py-3 text-right">Gross Bookings</th>
                <th className="py-3 text-right">Avg Discount</th>
                <th className="py-3 text-right">Dual Approval Rate</th>
                <th className="py-3 text-right">Blended Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/60">
              {[
                { seg: 'Strategic Global Accounts', deals: 28, book: '$6.42M', disc: '14.2%', dual: '32%', margin: '34.8%' },
                { seg: 'Enterprise Mid-Market', deals: 64, book: '$5.18M', disc: '8.6%', dual: '11%', margin: '41.2%' },
                { seg: 'Public Sector & Defense', deals: 19, book: '$2.85M', disc: '18.4%', dual: '58%', margin: '28.4%' },
                { seg: 'Emerging Cloud Native', deals: 31, book: '$1.94M', disc: '6.1%', dual: '4%', margin: '48.9%' },
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-surface-interactive/30">
                  <td className="py-3.5 font-semibold text-text-primary">{row.seg}</td>
                  <td className="py-3.5 text-center font-mono text-text-secondary">{row.deals}</td>
                  <td className="py-3.5 text-right font-mono font-bold text-text-primary">{row.book}</td>
                  <td className="py-3.5 text-right font-mono text-accent-blue">{row.disc}</td>
                  <td className="py-3.5 text-right font-mono text-status-warning">{row.dual}</td>
                  <td className="py-3.5 text-right font-mono font-bold text-status-live">{row.margin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
