import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import StatusBadge from '../components/StatusBadge';
import Tag from '../components/Tag';
import Stepper from '../components/Stepper';
import ListItem from '../components/ListItem';
import Skeleton from '../components/Skeleton';
import { approveQuotation, getApproval, listQuotations, rejectQuotation, returnQuotation } from '../api/client';

export default function ApprovalsHub({
  quotations = [],
  onUpdateQuotationStatus,
  onRefreshQuotations,
}) {
  const { t } = useTranslation();
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [actionModal, setActionModal] = useState(null); // 'approve' | 'return' | 'reject'
  const [actionReason, setActionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approval, setApproval] = useState(null);

  useEffect(() => {
    listQuotations().then(() => setError('')).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedQuote?.id) return;
    getApproval(selectedQuote.id).then(setApproval).catch((requestError) => setError(requestError.message));
  }, [selectedQuote?.id]);

  // Filter quotes
  const approvalQuotes = quotations.filter((q) => {
    if (pendingOnly) {
      return q.status === 'pending_approval';
    }
    return true;
  });

  const pendingCount = quotations.filter((q) => q.status === 'pending_approval').length;
  const approvedCount = quotations.filter((q) => q.status === 'approved' || q.status === 'accepted').length;
  // The list API reports each quotation's most recent approval action, so the
  // "returned" count is real data (quotations moved back to draft by a manager).
  const returnedCount = quotations.filter((q) => q.last_approval_action === 'returned').length;

  const handleAction = (type) => {
    if (!selectedQuote) return;

    const action = type === 'approve' ? approveQuotation : type === 'reject' ? rejectQuotation : returnQuotation;
    action(selectedQuote.id, actionReason).then(() => {
      onUpdateQuotationStatus?.(selectedQuote.id, type === 'approve' ? 'approved' : 'draft', '', {});
      onRefreshQuotations?.();
      // Re-fetch the selected quote's real risk + approval logs so the audit
      // trail card shows the entry we just created server-side.
      return getApproval(selectedQuote.id).then(setApproval).catch(() => {});
    }).then(() => {
      setSelectedQuote((current) => (current ? { ...current, status: type === 'approve' ? 'approved' : 'draft' } : null));
      setActionModal(null);
      setActionReason('');
    }).catch((requestError) => setError(requestError.message));
  };

  if (loading) return <div className="space-y-4"><Skeleton height="6rem" /><Skeleton variant="rounded" height="28rem" /></div>;
  if (error) return <Card className="p-6 text-status-danger">Unable to load approval data: {error}</Card>;

  return (
    <div data-tour="approval" className="w-full max-w-max-width mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Stat Chips */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-3xl font-bold tracking-tight text-text-primary">
            {t('approvals.title', 'Approvals Hub & Deal Governance')}
          </h1>
          <p className="text-body-sm text-text-secondary mt-1">
            {t('approvals.subtitle', 'Enforcing multi-tier margin limits, dual-signoff policies, and audit logging')}
          </p>
        </div>

        {/* Summary counts as three small Big-Number stat chips */}
        <div className="flex items-center gap-3">
          <div className="bg-surface-card border border-border-subtle rounded-2xl px-4 py-2.5 flex items-center gap-3">
            <span className="font-label-caps text-xs text-text-secondary uppercase">{t('status.pending_approval', 'Pending')}</span>
            <span className="font-mono text-xl font-bold text-status-warning">{pendingCount}</span>
          </div>
          <div className="bg-surface-card border border-border-subtle rounded-2xl px-4 py-2.5 flex items-center gap-3">
            <span className="font-label-caps text-xs text-text-secondary uppercase">Returned</span>
            <span className="font-mono text-xl font-bold text-text-secondary">{returnedCount}</span>
          </div>
          <div className="bg-surface-card border border-border-subtle rounded-2xl px-4 py-2.5 flex items-center gap-3">
            <span className="font-label-caps text-xs text-text-secondary uppercase">{t('status.approved', 'Approved')}</span>
            <span className="font-mono text-xl font-bold text-status-live">{approvedCount}</span>
          </div>
        </div>
      </div>

      {/* Main Container: Split or Table */}
      {!selectedQuote ? (
        /* Approvals List */
        <Card className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-2">
            <div className="flex items-center gap-2">
              <span className="font-label-caps text-xs uppercase text-text-secondary font-semibold">
                {t('approvals.pendingList', 'Quotation Approval Queue')}
              </span>
              <span className="font-mono-tag text-xs text-text-secondary">
                ({approvalQuotes.length} quotes)
              </span>
            </div>

            {/* Pending Only pill filter */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPendingOnly(!pendingOnly)}
                className={`px-3 py-1 rounded-full text-xs font-mono transition-colors flex items-center gap-1.5 border cursor-pointer ${
                  pendingOnly
                    ? 'bg-status-warning/15 border-status-warning/40 text-status-warning font-bold'
                    : 'bg-surface-interactive border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {pendingOnly ? 'check_circle' : 'circle'}
                </span>
                <span>{t('status.pending_approval', 'Pending Only')}</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-border-subtle">
            {approvalQuotes.length === 0 ? (
              <div className="py-16 text-center text-text-secondary font-mono text-sm">
                No quotes currently pending governance signoff!
              </div>
            ) : (
              approvalQuotes.map((q) => {
                const risk = { score: q.blended_risk_score || 0, level: q.blended_risk_score > 60 ? 'HIGH' : q.blended_risk_score > 25 ? 'MEDIUM' : 'LOW', flaggedLines: [] };
                return (
                  <ListItem
                    key={q.id}
                    onClick={() => setSelectedQuote(q)}
                    className="py-4 px-3 -mx-3 rounded-2xl"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-mono-tag text-xs font-bold text-accent-blue bg-surface-interactive px-2.5 py-1 rounded">
                        {q.id}
                      </span>
                      <div>
                        <div className="font-medium text-sm text-text-primary flex items-center gap-2">
                          <span>{q.customer}</span>
                          <Tag variant={q.customerTier === 'Gold' ? 'pink' : 'blue'}>
                            {q.customerTier}
                          </Tag>
                        </div>
                        <div className="text-body-sm text-text-secondary text-xs mt-0.5">
                          Assigned: {q.assignedTo} • Stage: {q.stage || 'Manager Review'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      {/* Risk Badge */}
                      <StatusBadge
                        status={
                          risk.level === 'HIGH'
                            ? 'high'
                            : risk.level === 'MEDIUM'
                            ? 'medium'
                            : 'low'
                        }
                        pulse={risk.level === 'HIGH'}
                      />

                      <div className="hidden sm:block text-right">
                        <span className="font-mono-data font-semibold text-text-primary block text-sm">
                          Score: {risk.score}
                        </span>
                        <span className="text-[10px] text-text-secondary font-mono">
                          {risk.flaggedLines.length} breach(es)
                        </span>
                      </div>

                      <PillButton variant="secondary" size="sm">
                        Review Deal →
                      </PillButton>
                    </div>
                  </ListItem>
                );
              })
            )}
          </div>
        </Card>
      ) : (
        /* Approval Detail View (Screen 6) */
        <div className="space-y-6">
          {/* Top Bar with Risk & Tier Badges */}
          <Card className="p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-subtle">
              <div>
                <button
                  onClick={() => setSelectedQuote(null)}
                  className="inline-flex items-center gap-1 font-mono-tag text-xs text-accent-blue hover:underline mb-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                  <span>{t('common.back', 'Back to Queue')}</span>
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-headline-sm text-2xl font-bold text-text-primary">
                    {selectedQuote.customer}
                  </h2>
                  <span className="font-mono-tag text-xs text-text-secondary">
                    {selectedQuote.id}
                  </span>
                  <Tag variant={selectedQuote.customerTier === 'Gold' ? 'pink' : 'blue'}>
                    {selectedQuote.customerTier} Tier
                  </Tag>
                  <StatusBadge status={selectedQuote.status} />
                </div>
              </div>

              {/* Three Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <PillButton
                  variant="outline"
                  size="md"
                  onClick={() => setActionModal('return')}
                >
                  {t('approvals.requestRevision', 'Return for Revision')}
                </PillButton>
                <PillButton
                  variant="danger"
                  size="md"
                  onClick={() => setActionModal('reject')}
                >
                  {t('approvals.rejectDeal', 'Reject')}
                </PillButton>
                <PillButton
                  variant="green"
                  size="md"
                  icon="verified"
                  onClick={() => setActionModal('approve')}
                >
                  {t('approvals.approveDeal', 'Approve Deal')}
                </PillButton>
              </div>
            </div>

            {/* Stepper: Submitted → Sales Manager → [Finance, only if required] → Confirmed */}
            <div className="pt-6">
              <span className="font-label-caps text-xs uppercase text-text-secondary font-semibold block mb-2">
                Approval Chain Progression
              </span>
              <Stepper
                steps={[
                  { label: 'Submitted', sub: 'Rep Submission' },
                  { label: 'Sales Manager', sub: 'Policy Validation' },
                  ...(selectedQuote.requiresFinance || selectedQuote.blended_risk_score > 50
                    ? [{ label: 'Finance VP', sub: 'Dual Signoff Mandate' }]
                    : []),
                  { label: 'Confirmed', sub: 'Release to Fulfillment' },
                ]}
                currentStepIndex={selectedQuote.status === 'confirmed' ? 3 : selectedQuote.requiresFinance ? 1 : 1}
              />
            </div>
          </Card>

          {/* "Why This Quote Was Flagged" Panel */}
          {(() => {
            const risk = approval || { score: selectedQuote.blended_risk_score || 0, level: 'MEDIUM', flaggedLines: [] };
            return (
              <Card className="p-6">
                <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-4">
                  <div>
                    <h3 className="font-headline-sm text-lg font-bold text-text-primary flex items-center gap-2">
                      <span className="material-symbols-outlined text-status-warning text-[20px]">
                        warning
                      </span>
                      <span>Why This Quote Was Flagged</span>
                    </h3>
                    <p className="text-body-sm text-text-secondary text-xs mt-0.5">
                      Direct output shape from calculateBlendedRisk() policy engine
                    </p>
                  </div>
                  <Tag variant={risk.level === 'HIGH' ? 'danger' : 'amber'}>
                    RISK SCORE: {risk.score}/100
                  </Tag>
                </div>

                {risk.flaggedLines.length === 0 ? (
                  <div className="py-6 text-center text-status-live font-mono text-xs">
                    ✓ All item lines meet tier & category standard discount ceilings.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-border-subtle font-label-caps text-text-secondary uppercase text-[10px]">
                          <th className="py-2.5">Flagged Product Line</th>
                          <th className="py-2.5">Category</th>
                          <th className="py-2.5 text-center">Discount Given</th>
                          <th className="py-2.5 text-center">Limit Allowed</th>
                          <th className="py-2.5 text-center">Over By</th>
                          <th className="py-2.5 text-right">Violation Impact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle/50">
                        {risk.flaggedLines.map((fl, idx) => (
                          <tr key={idx} className="hover:bg-surface-interactive/30">
                            <td className="py-3 font-medium text-text-primary">
                              {fl.product}
                            </td>
                            <td className="py-3 font-mono-tag text-text-secondary">
                              {fl.category}
                            </td>
                            <td className="py-3 text-center font-mono font-bold text-status-danger">
                              {fl.discountGiven}%
                            </td>
                            <td className="py-3 text-center font-mono text-text-secondary">
                              {fl.limitAllowed}%
                            </td>
                            <td className="py-3 text-center">
                              <Tag variant="danger" pill>
                                +{fl.overBy}%
                              </Tag>
                            </td>
                            <td className="py-3 text-right font-mono-tag text-text-secondary">
                              Ceiling breach: {fl.tierLimit}% Tier / {fl.categoryLimit}% Category
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })()}

          {/* Audit Log (List Items: User, Action, Date, Note) */}
          <Card className="p-6">
            <h3 className="font-headline-sm text-lg font-bold text-text-primary pb-3 border-b border-border-subtle mb-2">
              Quotation Audit Trail (approval_logs)
            </h3>
            <div className="divide-y divide-border-subtle">
              {(approval?.approval_logs || selectedQuote.approval_logs || selectedQuote.auditTrails || [])
                .filter(Boolean)
                .map((log, i) => {
                  const userName = log.approver_name || log.user || (log.role_at_approval ? log.role_at_approval : 'System');
                  const action = log.action || 'updated';
                  const note = log.comments || log.note || (log.discount_percent_at_review != null ? `Blended risk score at review: ${log.discount_percent_at_review}` : 'No comment recorded');
                  const date = log.created_at || log.date;
                  return (
                    <ListItem key={log.id || i} className="py-3.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-text-primary capitalize">
                            {String(userName).replace(/_/g, ' ')}
                          </span>
                          <span className="font-mono-tag text-xs text-accent-blue bg-surface-interactive px-2 py-0.5 rounded">
                            {String(action).replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-body-sm text-text-secondary text-xs mt-1">
                          {note}
                        </p>
                      </div>
                      {date && (
                        <span className="font-mono-tag text-xs text-text-secondary whitespace-nowrap">
                          {new Date(date).toLocaleString()}
                        </span>
                      )}
                    </ListItem>
                  );
                })}
            </div>
          </Card>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-surface-base/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <Card className="max-w-md w-full p-6 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto" radiance>
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <h3 className="font-headline-sm text-lg font-bold text-text-primary capitalize">
                Confirm {actionModal} Deal
              </h3>
              <button
                onClick={() => setActionModal(null)}
                className="text-text-secondary hover:text-text-primary"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-body-sm text-text-secondary text-xs leading-relaxed">
              {actionModal === 'approve'
                ? 'Approving will progress this quotation to the Fulfillment queue and notify the assigned sales representative.'
                : actionModal === 'return'
                ? 'Returning will transition status back to Draft and require the rep to adjust discounted line items.'
                : 'Rejecting will decline this commercial proposal and record a permanent audit entry.'}
            </p>

            <div>
              <label className="block font-label-caps text-xs uppercase text-text-secondary mb-1.5">
                {t('approvals.approverNotes', 'Audit Note / Reason')}
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Provide governance rationale..."
                className="w-full aether-input h-24 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <PillButton variant="ghost" size="md" onClick={() => setActionModal(null)}>
                {t('common.cancel', 'Cancel')}
              </PillButton>
              <PillButton
                variant={actionModal === 'approve' ? 'green' : actionModal === 'reject' ? 'danger' : 'outline'}
                size="md"
                onClick={() => handleAction(actionModal)}
              >
                {t('common.confirm', 'Confirm')} {actionModal.toUpperCase()}
              </PillButton>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
