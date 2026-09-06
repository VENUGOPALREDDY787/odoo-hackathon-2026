import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import Tag from '../components/Tag';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Skeleton from '../components/Skeleton';
import { acceptQuotation, getNegotiationHistory, listQuotations, negotiateQuotation } from '../api/client';

export default function CustomerPortal({ onReturnToInternal }) {
  const { t } = useTranslation();
  const [activePortalTab, setActivePortalTab] = useState('quotation');
  const [counterDiscount, setCounterDiscount] = useState(18.5);
  const [deliveryDate, setDeliveryDate] = useState('2026-10-15');
  const [customerComment, setCustomerComment] = useState(
    'We have competitive quotes from Dynatrace and Datadog. Countering at 18.5% with annual upfront payment.'
  );
  const [negotiationRounds, setNegotiationRounds] = useState([]);
  const [submittedMessage, setSubmittedMessage] = useState(false);
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listQuotations().then((quotations) => {
      const current = quotations.find((item) => ['negotiation', 'pending_approval', 'approved'].includes(item.status)) || quotations[0];
      setQuotation(current);
      if (current?.id) return getNegotiationHistory(current.id).then(setNegotiationRounds);
      return undefined;
    }).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  }, []);

  const handleSubmitCounter = async (e) => {
    e.preventDefault();
    try {
      if (!quotation?.id) throw new Error('No quotation is available for negotiation.');
      await negotiateQuotation(quotation.id, { seller_min: 50000, seller_max: 100000, buyer_min: 50000 * (1 - counterDiscount / 100), buyer_max: 100000 * (1 - counterDiscount / 100), message: customerComment });
      setNegotiationRounds(await getNegotiationHistory(quotation.id));
      setSubmittedMessage(true); setTimeout(() => setSubmittedMessage(false), 4000);
    } catch (requestError) { setError(requestError.message); }
  };

  const handleConfirmQuotation = async () => {
    try {
      if (!quotation?.id) throw new Error('No quotation is available to confirm.');
      setQuotation(await acceptQuotation(quotation.id));
      setSubmittedMessage(true);
    } catch (requestError) { setError(requestError.message); }
  };

  if (loading) return <div className="space-y-4"><Skeleton height="5rem" /><Skeleton variant="rounded" height="30rem" /></div>;
  if (error) return <Card className="p-6 text-status-danger">Unable to load customer quotation data: {error}</Card>;

  const quotationLines = quotation?.lines || [];
  const quotationTotal = Number(quotation?.grand_total || quotationLines.reduce((total, line) => total + Number(line.quantity || line.qty || 0) * Number(line.list_price || line.unitPrice || 0), 0));

  return (
    <div data-tour="dashboard" className="w-full max-w-max-width mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Simplified Customer Portal Top Bar */}
      <div data-tour="customer-portal" className="bg-surface-card border border-border-subtle rounded-[28px] sm:rounded-full px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between shadow-lg gap-3">
        <div className="flex items-center gap-3">
          <img src="/brand-mark.svg" alt="DealFlow360" className="h-7 w-auto" />
          <span className="font-mono-tag text-xs text-text-secondary border-l border-border-subtle pl-3 hidden sm:inline">
            {t('portal.title', 'Client Commercial Portal')}
          </span>
        </div>

        {/* Portal Nav: My Quotation / Messages / Profile */}
        <div className="flex items-center gap-2">
          {[
            { id: 'quotation', label: t('portal.myQuotation', 'My Quotation') },
            { id: 'messages', label: t('portal.messages', 'Messages') },
            { id: 'profile', label: t('portal.profile', 'Profile') },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActivePortalTab(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activePortalTab === tab.id
                  ? 'bg-accent-blue text-surface-base font-bold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Language Switcher for Portal */}
          <LanguageSwitcher />

          {onReturnToInternal && (
            <PillButton variant="outline" size="sm" onClick={onReturnToInternal}>
              {t('portal.returnToInternal', 'Return to Internal Workspace →')}
            </PillButton>
          )}
        </div>
      </div>

      {submittedMessage && (
        <div className="p-4 bg-status-live/15 border border-status-live/40 text-status-live rounded-2xl text-xs font-mono flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>Counter-proposal transmitted to Deal Desk. Round 4 negotiation logged.</span>
        </div>
      )}

      {/* Main Negotiation Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start">
        {/* Left Column (8-col): Quotation Lines & Customer Counter Form */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono-tag text-xs text-accent-blue font-semibold">
                    {quotation?.id || 'No quotation'}
                  </span>
                  <Tag variant="blue">{t('status.negotiation', 'Under Negotiation')}</Tag>
                </div>
                <h2 className="font-headline-sm text-2xl font-bold text-text-primary">
                  {quotation?.customer || 'Customer quotation'} — Commercial Proposal
                </h2>
                <p className="text-body-sm text-text-secondary text-xs mt-0.5">
                  Prepared by {quotation?.assignedTo || 'Deal Desk'}
                </p>
              </div>

              <div className="text-right">
                <span className="font-label-caps text-xs text-text-secondary uppercase">
                  {t('portal.proposedValue', 'Proposed Value')}
                </span>
                <div className="font-kpi-value text-3xl font-bold text-text-primary mt-0.5">
                  ₹{quotationTotal.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Line Table with Customer Comment Column */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border-subtle font-label-caps text-text-secondary uppercase text-[10px]">
                    <th className="py-2.5">{t('portal.itemDescription', 'Item Description')}</th>
                    <th className="py-2.5 text-center">{t('portal.billing', 'Billing')}</th>
                    <th className="py-2.5 text-center">{t('builder.quantity', 'Qty')}</th>
                    <th className="py-2.5 text-right">{t('builder.unitPrice', 'List Price')}</th>
                    <th className="py-2.5 text-right">{t('portal.offerPrice', 'Offer Price')}</th>
                    <th className="py-2.5 pl-4">{t('portal.buyerComment', 'Buyer Comment / Condition')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {quotationLines.map((line) => {
                    const quantity = Number(line.quantity || line.qty || 0);
                    const listPrice = Number(line.list_price || line.unitPrice || 0);
                    const discount = Number(line.discount_percent || line.discountPct || 0);
                    const offerPrice = quantity * listPrice * (1 - discount / 100);
                    return (
                      <tr key={line.id} className="hover:bg-surface-interactive/30">
                        <td className="py-3.5 font-semibold text-text-primary">{line.product || line.product_name || line.custom_name}</td>
                        <td className="py-3.5 text-center"><Tag variant={line.isRecurring ? 'blue' : 'neutral'}>{line.isRecurring ? 'RECURRING' : 'ONE-TIME'}</Tag></td>
                        <td className="py-3.5 text-center font-mono">{quantity}</td>
                        <td className="py-3.5 text-right font-mono text-text-secondary">₹{(quantity * listPrice).toLocaleString()}</td>
                        <td className="py-3.5 text-right font-mono font-bold text-text-primary">₹{offerPrice.toLocaleString()}</td>
                        <td className="py-3.5 pl-4 text-text-secondary font-mono text-[11px]">{line.custom_description || 'Quotation line item'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Counter Offer Form */}
            <form onSubmit={handleSubmitCounter} className="mt-8 pt-6 border-t border-border-subtle space-y-4">
              <h3 className="font-headline-sm text-base font-bold text-text-primary">
                {t('portal.submitCounter', 'Submit Client Counter-Proposal')}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-caps text-xs uppercase text-text-secondary mb-1.5">
                    {t('portal.targetCounterDiscount', 'Target Counter Discount %')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="40"
                      value={counterDiscount}
                      onChange={(e) => setCounterDiscount(parseFloat(e.target.value) || 0)}
                      className="w-full aether-input font-mono font-bold text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary font-mono">
                      %
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-label-caps text-xs uppercase text-text-secondary mb-1.5">
                    {t('portal.requestedDeliveryDate', 'Requested Delivery / Go-Live Date')}
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full aether-input font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-label-caps text-xs uppercase text-text-secondary mb-1.5">
                  {t('portal.commercialConditions', 'Commercial Conditions / Procurement Comment')}
                </label>
                <textarea
                  value={customerComment}
                  onChange={(e) => setCustomerComment(e.target.value)}
                  className="w-full aether-input h-20 resize-none text-xs"
                />
              </div>

              {/* Critical Policy Note */}
              <div className="p-3.5 bg-surface-interactive border border-border-subtle rounded-xl text-xs text-text-secondary leading-relaxed">
                <strong className="text-text-primary">Governance Notice: </strong>
                {t('portal.governanceNotice', 'Confirming quotation terms exceeding standard discount ceilings will automatically route through internal Sales Manager & Finance signoff rather than instant order confirmation.')}
                {' '}Confirming is only possible while the offer is in Approved / Sent / Negotiation state and is verified server-side.
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <PillButton type="submit" variant="secondary" size="md">
                  {t('portal.submitCounterBtn', 'Submit Counter Request')}
                </PillButton>
                <PillButton
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleConfirmQuotation}
                >
                  {t('portal.confirmQuotationBtn', 'Confirm Quotation Terms')}
                </PillButton>
              </div>
            </form>
          </Card>
        </div>

        {/* Right Column (4-col): Algorithmic Negotiation History */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-4">
              <div>
                <h3 className="font-headline-sm text-base font-bold text-text-primary">
                  {t('portal.negotiationLog', 'Negotiation Log')}
                </h3>
                <p className="text-body-sm text-text-secondary text-xs">
                  {t('portal.negotiationSubtitle', 'Autonomous convergence rounds')}
                </p>
              </div>
              <Tag variant="blue">ROUND {negotiationRounds.length}/5</Tag>
            </div>

            <div className="space-y-3">
              {negotiationRounds.map((nr, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-surface-interactive/80 border border-border-subtle rounded-xl space-y-1.5"
                >
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-bold text-text-primary">{t('portal.round', 'Round')} {nr.round}</span>
                    <span className="text-accent-blue">{nr.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-secondary font-mono">
                    <span>{t('portal.buyer', 'Buyer')}: {nr.buyerOffer}</span>
                    <span>{t('portal.seller', 'Seller')}: {nr.sellerOffer}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-border-subtle text-[11px] text-text-secondary font-mono">
              Convergence threshold: ₹5,000 delta. Current gap: ₹3,300 (Deal zone reached).
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
