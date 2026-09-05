import React, { useState } from 'react';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import Tag from '../components/Tag';

export default function CustomerPortal({ onReturnToInternal }) {
  const [activePortalTab, setActivePortalTab] = useState('quotation');
  const [counterDiscount, setCounterDiscount] = useState(18.5);
  const [deliveryDate, setDeliveryDate] = useState('2026-10-15');
  const [customerComment, setCustomerComment] = useState(
    'We have competitive quotes from Dynatrace and Datadog. Countering at 18.5% with annual upfront payment.'
  );
  const [negotiationRounds, setNegotiationRounds] = useState([
    { round: 1, buyerOffer: '$66,000', sellerOffer: '$87,000', status: 'Countered' },
    { round: 2, buyerOffer: '$69,500', sellerOffer: '$82,000', status: 'Countered' },
    { round: 3, buyerOffer: '$73,500', sellerOffer: '$76,800', status: 'Active (Convergence Delta: $3,300)' },
  ]);
  const [submittedMessage, setSubmittedMessage] = useState(false);

  const handleSubmitCounter = (e) => {
    e.preventDefault();
    setSubmittedMessage(true);
    setNegotiationRounds((prev) => [
      ...prev,
      {
        round: prev.length + 1,
        buyerOffer: `$${(76000 * (1 - counterDiscount / 100)).toFixed(0)}`,
        sellerOffer: 'Pending Deal Desk Review',
        status: 'Counter Submitted',
      },
    ]);
    setTimeout(() => setSubmittedMessage(false), 4000);
  };

  const handleConfirmQuotation = () => {
    alert(
      'NOTICE: Confirming quotation under negotiated terms (18.5% discount) exceeds Bronze Tier 10% ceiling. This will auto-resubmit for Sales Manager & Finance dual-signoff before final order activation.'
    );
  };

  return (
    <div className="w-full max-w-max-width mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Simplified Customer Portal Top Bar */}
      <div className="bg-surface-card border border-border-subtle rounded-full px-6 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <img src="/brand-mark.svg" alt="DealFlow360" className="h-7 w-auto" />
          <span className="font-mono-tag text-xs text-text-secondary border-l border-border-subtle pl-3 hidden sm:inline">
            Client Commercial Portal
          </span>
        </div>

        {/* Portal Nav: My Quotation / Messages / Profile */}
        <div className="flex items-center gap-2">
          {['quotation', 'messages', 'profile'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActivePortalTab(tab)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                activePortalTab === tab
                  ? 'bg-accent-blue text-surface-base font-bold'
                  : 'text-text-secondary hover:text-white'
              }`}
            >
              {tab === 'quotation' ? 'My Quotation' : tab}
            </button>
          ))}
        </div>

        {onReturnToInternal && (
          <PillButton variant="outline" size="sm" onClick={onReturnToInternal}>
            Return to Internal Workspace →
          </PillButton>
        )}
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
                    QT-2026-8837
                  </span>
                  <Tag variant="blue">Under Negotiation</Tag>
                </div>
                <h2 className="font-headline-sm text-2xl font-bold text-text-primary">
                  Solaria Cyber Defense — Commercial Proposal
                </h2>
                <p className="text-body-sm text-text-secondary text-xs mt-0.5">
                  Prepared by Devon Miles (Enterprise Deal Desk)
                </p>
              </div>

              <div className="text-right">
                <span className="font-label-caps text-xs text-text-secondary uppercase">
                  Proposed Value
                </span>
                <div className="font-kpi-value text-3xl font-bold text-text-primary mt-0.5">
                  $76,800
                </div>
              </div>
            </div>

            {/* Line Table with Customer Comment Column */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border-subtle font-label-caps text-text-secondary uppercase text-[10px]">
                    <th className="py-2.5">Item Description</th>
                    <th className="py-2.5 text-center">Billing</th>
                    <th className="py-2.5 text-center">Qty</th>
                    <th className="py-2.5 text-right">List Price</th>
                    <th className="py-2.5 text-right">Offer Price</th>
                    <th className="py-2.5 pl-4">Buyer Comment / Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  <tr className="hover:bg-surface-interactive/30">
                    <td className="py-3.5 font-semibold text-text-primary">
                      <div>DealFlow360 Enterprise Core License</div>
                      <div className="text-[10px] text-text-secondary font-mono">
                        Autonomous pricing & risk orchestration
                      </div>
                    </td>
                    <td className="py-3.5 text-center">
                      <Tag variant="blue">RECURRING</Tag>
                    </td>
                    <td className="py-3.5 text-center font-mono">2</td>
                    <td className="py-3.5 text-right font-mono text-text-secondary line-through">
                      $72,000
                    </td>
                    <td className="py-3.5 text-right font-mono font-bold text-text-primary">
                      $58,680
                    </td>
                    <td className="py-3.5 pl-4 text-text-secondary font-mono text-[11px]">
                      Requires sub-10ms disaster recovery mesh SLA
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-interactive/30">
                    <td className="py-3.5 font-semibold text-text-primary">
                      <div>Enterprise Architecture Deployment Sprint</div>
                      <div className="text-[10px] text-text-secondary font-mono">
                        Dedicated solutions architect onboarding
                      </div>
                    </td>
                    <td className="py-3.5 text-center">
                      <Tag variant="neutral">ONE-TIME</Tag>
                    </td>
                    <td className="py-3.5 text-center font-mono">1</td>
                    <td className="py-3.5 text-right font-mono text-text-secondary line-through">
                      $28,000
                    </td>
                    <td className="py-3.5 text-right font-mono font-bold text-text-primary">
                      $18,120
                    </td>
                    <td className="py-3.5 pl-4 text-text-secondary font-mono text-[11px]">
                      Target production cutoff date: mid October
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Counter Offer Form */}
            <form onSubmit={handleSubmitCounter} className="mt-8 pt-6 border-t border-border-subtle space-y-4">
              <h3 className="font-headline-sm text-base font-bold text-text-primary">
                Submit Client Counter-Proposal
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-caps text-xs uppercase text-text-secondary mb-1.5">
                    Target Counter Discount %
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
                    Requested Delivery / Go-Live Date
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
                  Commercial Conditions / Procurement Comment
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
                Confirming quotation terms exceeding standard discount ceilings will automatically
                route through internal Sales Manager & Finance signoff rather than instant order
                confirmation.
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <PillButton type="submit" variant="secondary" size="md">
                  Submit Counter Request
                </PillButton>
                <PillButton
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleConfirmQuotation}
                >
                  Confirm Quotation Terms
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
                  Negotiation Log
                </h3>
                <p className="text-body-sm text-text-secondary text-xs">
                  Autonomous convergence rounds
                </p>
              </div>
              <Tag variant="blue">ROUND 3/5</Tag>
            </div>

            <div className="space-y-3">
              {negotiationRounds.map((nr, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-surface-interactive/80 border border-border-subtle rounded-xl space-y-1.5"
                >
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-bold text-text-primary">Round {nr.round}</span>
                    <span className="text-accent-blue">{nr.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-secondary font-mono">
                    <span>Buyer: {nr.buyerOffer}</span>
                    <span>Seller: {nr.sellerOffer}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-border-subtle text-[11px] text-text-secondary font-mono">
              Convergence threshold: $5,000 delta. Current gap: $3,300 (Deal zone reached).
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
