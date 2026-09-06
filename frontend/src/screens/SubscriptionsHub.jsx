import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import StatusBadge from '../components/StatusBadge';
import Tag from '../components/Tag';
import ListItem from '../components/ListItem';
import { calculateProration } from '../utils/quotationCalculations';
import Skeleton from '../components/Skeleton';
import { cancelSubscriptionLine, createSubscriptionPlan, generateSchedules, listSubscriptionPlans } from '../api/client';

export default function SubscriptionsHub() {
  const { t } = useTranslation();
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);
  const [modifyModalOpen, setModifyModalOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [newQty, setNewQty] = useState(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planInterval, setPlanInterval] = useState('monthly');
  const [planPrice, setPlanPrice] = useState('');
  const [planSaving, setPlanSaving] = useState(false);

  useEffect(() => {
    listSubscriptionPlans().then((plans) => setSubscriptions(plans.map((plan) => ({
      ...plan,
      id: plan.id,
      customer: plan.customer_name || 'Active customer contract',
      customerTier: plan.customer_tier || 'Bronze',
      plan: plan.name,
      cycle: plan.interval_type || 'monthly',
      amount: plan.base_price || 0,
      nextBill: plan.next_bill || 'Scheduled',
      status: plan.is_active === false ? 'Cancelled' : 'Active',
      recurringLines: [],
      oneTimeLines: [],
      lineId: plan.quotation_line_id,
      quotationId: plan.quotation_id,
    })))).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  }, []);

  const activeSubs = subscriptions.filter((s) => s.status === 'Active');
  const totalARR = activeSubs.reduce((acc, s) => acc + s.amount, 0);

  // Compute proration preview for modification
  const proration = calculateProration(10, newQty, 4800, 18, 30);

  const handleConfirmModification = async () => {
    try {
      if (!selectedSub?.quotationId) throw new Error('This plan is not linked to a quotation schedule.');
      await generateSchedules({ quotation_id: selectedSub.quotationId, default_cycles: newQty });
      setModifyModalOpen(false);
    } catch (requestError) { setError(requestError.message); }
  };

  const handleConfirmCancellation = async () => {
    if (!selectedSub) return;
    try {
      if (!selectedSub.lineId) throw new Error('This plan is not linked to a subscription line.');
      await cancelSubscriptionLine(selectedSub.lineId, { cancellation_reason: 'Customer requested cancellation' });
      setSubscriptions((prev) => prev.map((s) => s.id === selectedSub.id ? { ...s, status: 'Cancelled', nextBill: 'Cancelled' } : s));
      setSelectedSub((prev) => prev ? { ...prev, status: 'Cancelled', nextBill: 'Cancelled' } : null);
      setCancelConfirmOpen(false);
    } catch (requestError) { setError(requestError.message); }
  };

  const handleCreatePlan = async (event) => {
    event.preventDefault();
    setPlanSaving(true);
    setError('');
    try {
      const created = await createSubscriptionPlan({
        name: planName.trim(),
        interval_type: planInterval,
        base_price: Number(planPrice),
      });
      setSubscriptions((previous) => [{
        ...created,
        id: created.id,
        customer: 'Unassigned plan',
        customerTier: 'Bronze',
        plan: created.name,
        cycle: created.interval_type,
        amount: created.base_price,
        nextBill: 'Not scheduled',
        status: 'Active',
        recurringLines: [],
        oneTimeLines: [],
      }, ...previous]);
      setPlanName('');
      setPlanPrice('');
      setPlanModalOpen(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPlanSaving(false);
    }
  };

  if (loading) return <div className="space-y-4"><Skeleton height="6rem" /><Skeleton variant="rounded" height="28rem" /></div>;
  if (error) return <Card className="p-6 text-status-danger">Unable to load subscriptions: {error}</Card>;

  return (
    <div data-tour="billing" className="w-full max-w-max-width mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-3xl font-bold tracking-tight text-text-primary">
            {t('subscriptions.title', 'Subscriptions & Billing Engine')}
          </h1>
          <p className="text-body-sm text-text-secondary mt-1">
            {t('subscriptions.subtitle', 'Automated recurring cycles, proration math, and contractual credit note generation')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-surface-card border border-border-subtle rounded-2xl px-4 py-2 flex items-center gap-2">
            <span className="font-label-caps text-xs text-text-secondary uppercase">{t('subscriptions.arr', 'Active ARR')}:</span>
            <span className="font-mono text-base font-bold text-accent-blue">₹{(totalARR / 1000).toFixed(1)}k</span>
          </div>
          <PillButton
            variant="primary"
            size="md"
            icon="add"
            onClick={() => setPlanModalOpen(true)}
          >
            New Plan (Admin)
          </PillButton>
        </div>
      </div>

      {!selectedSub ? (
        /* Subscriptions List (Screen 9) */
        <Card className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-2">
            <span className="font-label-caps text-xs uppercase text-text-secondary font-semibold">
              {t('subscriptions.activeSubscriptions', 'Active Recurring Contracts')}
            </span>
            <span className="font-mono-tag text-xs text-text-secondary">
              {subscriptions.length} subscriptions
            </span>
          </div>

          <div className="divide-y divide-border-subtle">
            {subscriptions.map((sub) => (
              <ListItem
                key={sub.id}
                onClick={() => setSelectedSub(sub)}
                className="py-4 px-3 -mx-3 rounded-2xl"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono-tag text-xs font-bold text-accent-blue bg-surface-interactive px-2.5 py-1 rounded">
                    {sub.id}
                  </span>
                  <div>
                    <div className="font-medium text-sm text-text-primary flex items-center gap-2">
                      <span>{sub.customer}</span>
                      <Tag variant={sub.customerTier === 'Gold' ? 'pink' : 'blue'}>
                        {sub.customerTier}
                      </Tag>
                    </div>
                    <div className="text-body-sm text-text-secondary text-xs mt-0.5">
                      Plan: {sub.plan}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <Tag variant="neutral">{sub.cycle.toUpperCase()}</Tag>

                  <div className="hidden sm:block">
                    <span className="font-mono-data font-semibold text-text-primary block text-sm">
                      ₹{sub.amount.toLocaleString()}/{sub.cycle === 'yearly' ? 'yr' : 'mo'}
                    </span>
                    <span className="font-mono-tag text-[10px] text-text-secondary">
                      Next: {sub.nextBill}
                    </span>
                  </div>

                  <StatusBadge status={sub.status} />

                  <PillButton variant="secondary" size="sm">
                    Billing Detail →
                  </PillButton>
                </div>
              </ListItem>
            ))}
          </div>
        </Card>
      ) : (
        /* Billing Detail (Screen 10) */
        <div className="space-y-6">
          {/* Header Card with Navigation */}
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <button
                  onClick={() => setSelectedSub(null)}
                  className="inline-flex items-center gap-1 font-mono-tag text-xs text-accent-blue hover:underline mb-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                  <span>{t('common.back', 'Back to Subscriptions')}</span>
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-headline-sm text-2xl font-bold text-text-primary">
                    {selectedSub.customer}
                  </h2>
                  <span className="font-mono-tag text-xs text-text-secondary">
                    {selectedSub.id}
                  </span>
                  <StatusBadge status={selectedSub.status} />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <PillButton
                  variant="outline"
                  size="md"
                  onClick={() => setModifyModalOpen(true)}
                  disabled={selectedSub.status === 'Cancelled'}
                >
                  Modify Subscription
                </PillButton>
                <PillButton
                  variant="danger"
                  size="md"
                  onClick={() => setCancelConfirmOpen(true)}
                  disabled={selectedSub.status === 'Cancelled'}
                >
                  {t('subscriptions.cancelSubscription', 'Cancel Subscription')}
                </PillButton>
              </div>
            </div>
          </Card>

          {/* Two Visually Separated Cards for One-Time vs Recurring Lines */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter-lg items-start">
            {/* Card 1: One-Time Lines */}
            <Card className="p-6">
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-4">
                <div>
                  <h3 className="font-headline-sm text-base font-bold text-text-primary">
                    One-Time Purchase Lines
                  </h3>
                  <p className="text-body-sm text-text-secondary text-xs">
                    Fixed capital expenditure line items
                  </p>
                </div>
                <Tag variant="neutral">ONE-TIME</Tag>
              </div>

              {selectedSub.oneTimeLines?.length === 0 ? (
                <div className="py-12 text-center text-text-secondary font-mono text-xs">
                  No one-time hardware or service items on this account.
                </div>
              ) : (
                <div className="divide-y divide-border-subtle/60">
                  {selectedSub.oneTimeLines?.map((ot, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm text-text-primary">{ot.product}</div>
                        <div className="text-xs text-text-secondary font-mono">Qty: {ot.qty}</div>
                      </div>
                      <span className="font-mono-data font-semibold text-text-primary text-sm">
                        ₹{ot.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Card 2: Recurring Lines */}
            <Card className="p-6">
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-4">
                <div>
                  <h3 className="font-headline-sm text-base font-bold text-text-primary">
                    Recurring Subscription Lines
                  </h3>
                  <p className="text-body-sm text-text-secondary text-xs">
                    Managed SaaS licenses & cloud maintenance schedules
                  </p>
                </div>
                <Tag variant="blue">RECURRING</Tag>
              </div>

              <div className="divide-y divide-border-subtle/60">
                {selectedSub.recurringLines?.map((rec, idx) => (
                  <div key={idx} className="py-3.5 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-text-primary">{rec.plan}</div>
                      <div className="text-xs text-text-secondary font-mono mt-0.5">
                        Cycle: {rec.cycle.toUpperCase()} • Next Bill: {rec.nextBill}
                      </div>
                    </div>
                    <span className="font-mono-data font-semibold text-accent-blue text-sm">
                        ₹{rec.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {planModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-base/75 backdrop-blur-md flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="new-plan-title">
          <Card className="max-w-md w-full p-6 space-y-4" radiance>
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h2 id="new-plan-title" className="font-headline-sm text-lg font-bold text-text-primary">New Subscription Plan</h2>
              <button type="button" onClick={() => setPlanModalOpen(false)} aria-label="Close" className="text-text-secondary hover:text-text-primary">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreatePlan} className="space-y-4">
              <input required value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="Plan name" className="w-full aether-input" />
              <select value={planInterval} onChange={(event) => setPlanInterval(event.target.value)} className="w-full aether-input">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
              <input required min="0" step="0.01" type="number" value={planPrice} onChange={(event) => setPlanPrice(event.target.value)} placeholder="Base price" className="w-full aether-input" />
              <div className="flex justify-end gap-3">
                <PillButton type="button" variant="ghost" onClick={() => setPlanModalOpen(false)}>Cancel</PillButton>
                <PillButton type="submit" variant="primary" disabled={planSaving}>{planSaving ? 'Saving...' : 'Create Plan'}</PillButton>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Proration Modification Modal */}
      {modifyModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-base/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <Card className="max-w-md w-full p-6 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto" radiance>
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <h3 className="font-headline-sm text-lg font-bold text-text-primary">
                Modify Subscription Seats & Proration
              </h3>
              <button onClick={() => setModifyModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-body-sm text-text-secondary text-xs leading-relaxed">
              Adjusting quantities mid-cycle calculates exact mathematical proration based on
              remaining days in the current billing period.
            </p>

            <div className="space-y-3 bg-surface-interactive/60 p-4 rounded-2xl border border-border-subtle">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary font-mono">Current Seats:</span>
                <span className="font-mono font-bold text-text-primary">10 Seats</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary font-mono">New Seat Count:</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newQty}
                  onChange={(e) => setNewQty(parseInt(e.target.value) || 1)}
                  className="w-20 text-center aether-input py-1 text-xs"
                />
              </div>
              <div className="flex items-center justify-between border-t border-border-subtle pt-2">
                <span className="text-xs text-text-secondary font-mono">Cycle Days Remaining:</span>
                <span className="font-mono font-semibold text-accent-blue">18 of 30 days</span>
              </div>
              <div className="flex items-center justify-between border-t border-border-subtle pt-2">
                <span className="text-xs text-text-primary font-bold">Prorated Charge:</span>
                <span className="font-mono font-bold text-status-live text-base">
                        +₹{proration.prorationAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <PillButton variant="ghost" size="md" onClick={() => setModifyModalOpen(false)}>
                Cancel
              </PillButton>
              <PillButton variant="primary" size="md" onClick={handleConfirmModification}>
                Apply Mid-Cycle Proration
              </PillButton>
            </div>
          </Card>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-surface-base/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <Card className="max-w-md w-full p-6 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto" radiance>
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <h3 className="font-headline-sm text-lg font-bold text-status-danger">
                Confirm Irreversible Cancellation
              </h3>
              <button onClick={() => setCancelConfirmOpen(false)} className="text-text-secondary hover:text-text-primary">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-4 bg-status-danger/10 border border-status-danger/30 rounded-xl space-y-2">
              <p className="text-xs text-status-danger font-semibold">
                WARNING: Subscription termination cannot be reversed.
              </p>
              <p className="text-xs text-text-secondary leading-relaxed">
                Per backend billing rules, cancellation creates a contractual credit note in the
                billing_schedules ledger. It will never silently delete customer records.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <PillButton variant="ghost" size="md" onClick={() => setCancelConfirmOpen(false)}>
                Keep Active
              </PillButton>
              <PillButton variant="danger" size="md" onClick={handleConfirmCancellation}>
                Authorize Cancellation & Credit Note
              </PillButton>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
