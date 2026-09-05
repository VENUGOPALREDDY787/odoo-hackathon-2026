import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import StatusBadge from '../components/StatusBadge';
import Tag from '../components/Tag';
import { calculateQuotationTotals } from '../data/mockData';

export default function QuotationsKanban({
  quotations = [],
  onSelectQuotation,
  onNewQuotation,
}) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');

  const columns = [
    { id: 'draft', label: t('quotations.columnDraft', 'Draft'), color: 'text-text-secondary' },
    { id: 'pending_approval', label: t('quotations.columnPending', 'Pending Approval'), color: 'text-status-warning' },
    { id: 'approved', label: t('quotations.columnApproved', 'Approved'), color: 'text-status-live' },
    { id: 'negotiation', label: t('status.negotiation', 'Negotiation'), color: 'text-accent-blue' },
    { id: 'confirmed', label: t('status.confirmed', 'Confirmed'), color: 'text-status-live' },
  ];

  const filteredQuotations = quotations.filter((q) => {
    const matchesSearch =
      q.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.assignedTo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = tierFilter === 'ALL' || q.customerTier === tierFilter;
    return matchesSearch && matchesTier;
  });

  return (
    <div className="w-full max-w-max-width mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-3xl md:text-4xl font-bold tracking-tight text-text-primary">
            {t('quotations.title', 'Quotations Pipeline')}
          </h1>
          <p className="text-body-sm text-text-secondary mt-1">
            {t('quotations.subtitle', 'Real-time stage tracking with embedded blended risk governance')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-secondary">
              search
            </span>
            <input
              type="text"
              placeholder={t('quotations.searchQuotation', 'Search quotes, customers...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface-interactive border border-border-subtle rounded-full pl-9 pr-4 py-2 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-blue w-48 sm:w-60"
            />
          </div>

          {/* Tier Filter Toggle */}
          <div className="flex items-center bg-surface-interactive border border-border-subtle rounded-full p-1 text-xs">
            {['ALL', 'Bronze', 'Silver', 'Gold'].map((tier) => (
              <button
                key={tier}
                onClick={() => setTierFilter(tier)}
                className={`px-2.5 py-1 rounded-full font-mono text-[11px] transition-colors cursor-pointer ${
                  tierFilter === tier
                    ? 'bg-accent-blue text-surface-base font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {tier === 'ALL' ? t('common.all', 'ALL') : tier}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-surface-interactive border border-border-subtle rounded-full p-1 text-xs">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-text-primary text-surface-base'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">view_kanban</span>
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-text-primary text-surface-base'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">table_rows</span>
              <span>{t('common.details', 'Table')}</span>
            </button>
          </div>

          <PillButton variant="primary" icon="add" onClick={onNewQuotation}>
            {t('quotations.newQuotation', '+ New Quote')}
          </PillButton>
        </div>
      </div>

      {/* Kanban Board View */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start overflow-x-auto pb-6">
          {columns.map((col) => {
            const colQuotes = filteredQuotations.filter((q) => q.status === col.id);
            return (
              <div
                key={col.id}
                className="bg-surface-interactive/40 border border-border-subtle/80 rounded-[28px] p-4 min-w-[250px] flex flex-col gap-3 min-h-[520px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border-subtle/70 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      col.id === 'approved' || col.id === 'confirmed'
                        ? 'bg-status-live'
                        : col.id === 'pending_approval'
                        ? 'bg-status-warning'
                        : col.id === 'negotiation'
                        ? 'bg-accent-blue'
                        : 'bg-text-secondary'
                    }`} />
                    <span className="font-label-caps text-xs uppercase tracking-wider text-text-primary font-semibold">
                      {col.label}
                    </span>
                  </div>
                  <span className="font-mono-tag text-xs font-bold px-2 py-0.5 rounded-full bg-surface-card border border-border-subtle text-text-secondary">
                    {colQuotes.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="flex flex-col gap-3">
                  {colQuotes.length === 0 ? (
                    <div className="py-12 text-center text-text-secondary font-mono-tag text-xs">
                      No deals in {col.label}
                    </div>
                  ) : (
                    colQuotes.map((q) => {
                      const totals = calculateQuotationTotals(q.lines);
                      const isHighRisk = q.blended_risk_score > 60;
                      return (
                        <div
                          key={q.id}
                          onClick={() => onSelectQuotation(q)}
                          className="bg-surface-card border border-border-subtle hover:border-text-secondary/60 rounded-[24px] p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl group"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono-tag text-xs text-text-secondary group-hover:text-accent-blue transition-colors">
                              {q.id}
                            </span>
                            <Tag variant={q.customerTier === 'Gold' ? 'pink' : q.customerTier === 'Silver' ? 'blue' : 'neutral'}>
                              {q.customerTier}
                            </Tag>
                          </div>

                          <h4 className="font-semibold text-sm text-text-primary mb-1 line-clamp-1">
                            {q.customer}
                          </h4>

                          <div className="my-3 flex items-baseline justify-between">
                            <span className="font-kpi-value text-2xl font-bold text-text-primary">
                              ₹{(totals.total / 1000).toFixed(1)}k
                            </span>
                            <span className="font-mono-tag text-xs text-text-secondary">
                              {q.lines.length} {q.lines.length === 1 ? 'line' : 'lines'}
                            </span>
                          </div>

                          {/* Risk Score Pill & Rep */}
                          <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-label-caps text-[10px] text-text-secondary uppercase">
                                Risk
                              </span>
                              <span
                                className={`font-mono-tag text-xs font-bold px-1.5 py-0.5 rounded ${
                                  isHighRisk
                                    ? 'bg-status-danger/20 text-status-danger'
                                    : q.blended_risk_score > 25
                                    ? 'bg-status-warning/20 text-status-warning'
                                    : 'bg-accent-blue/20 text-accent-blue'
                                }`}
                              >
                                {q.blended_risk_score}
                              </span>
                            </div>
                            <span className="text-[11px] text-text-secondary font-mono truncate max-w-[90px]">
                              {q.assignedTo.split(' ')[0]}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Data Table View */
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-interactive/60 font-label-caps text-xs text-text-secondary uppercase">
                  <th className="py-3.5 px-6">Quote ID</th>
                  <th className="py-3.5 px-6">{t('common.customer', 'Customer')} & Tier</th>
                  <th className="py-3.5 px-6">{t('common.status', 'Status')}</th>
                  <th className="py-3.5 px-6">{t('builder.riskScore', 'Blended Risk')}</th>
                  <th className="py-3.5 px-6">{t('builder.totalAmount', 'Total Value')}</th>
                  <th className="py-3.5 px-6">{t('quotations.owner', 'Assigned Rep')}</th>
                  <th className="py-3.5 px-6 text-right">{t('common.actions', 'Action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-sm">
                {filteredQuotations.map((q) => {
                  const totals = calculateQuotationTotals(q.lines);
                  return (
                    <tr
                      key={q.id}
                      onClick={() => onSelectQuotation(q)}
                      className="hover:bg-surface-interactive/40 cursor-pointer transition-colors"
                    >
                      <td className="py-4 px-6 font-mono-tag text-accent-blue font-semibold">
                        {q.id}
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-medium text-text-primary">{q.customer}</div>
                        <div className="mt-0.5">
                          <Tag variant={q.customerTier === 'Gold' ? 'pink' : 'blue'}>
                            {q.customerTier}
                          </Tag>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <StatusBadge status={q.status} pulse={q.status === 'confirmed'} />
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`font-mono-tag text-xs font-bold px-2 py-1 rounded-full ${
                            q.blended_risk_score > 60
                              ? 'bg-status-danger/20 text-status-danger'
                              : q.blended_risk_score > 25
                              ? 'bg-status-warning/20 text-status-warning'
                              : 'bg-accent-blue/20 text-accent-blue'
                          }`}
                        >
                          Score: {q.blended_risk_score}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono-data font-semibold text-text-primary">
                                ₹{totals.total.toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-text-secondary">{q.assignedTo}</td>
                      <td className="py-4 px-6 text-right">
                        <span className="font-mono-tag text-xs text-accent-blue group-hover:underline">
                          {t('quotations.viewQuotation', 'Open Details →')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
