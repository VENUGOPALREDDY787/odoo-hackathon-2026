import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import Tag from '../components/Tag';
import {
  INITIAL_PRODUCTS,
  UPSELL_SUGGESTIONS,
  calculateBlendedRisk,
  calculateQuotationTotals,
  calculateLineTotal,
  CATEGORY_DISCOUNT_CEILINGS,
  TIER_DISCOUNT_CEILINGS,
} from '../data/mockData';

export default function QuotationBuilder({
  initialQuotation,
  onSaveDraft,
  onSubmitApproval,
  onBack,
}) {
  const lineCounterRef = useRef(0);
  const [quotationId] = useState(() =>
    initialQuotation?.id || `QT-2026-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [customer, setCustomer] = useState(initialQuotation?.customer || 'Apex Global Logistics');
  const [customerTier, setCustomerTier] = useState(initialQuotation?.customerTier || 'Gold');
  const [lines, setLines] = useState(
    initialQuotation?.lines || [
      {
        id: 'ln-1',
        productId: 'prod-01',
        product: 'AETHER Edge Compute Node X4',
        category: 'Enterprise Hardware',
        qty: 8,
        unitPrice: 14500,
        discountPct: 22,
        categoryLimitPct: 12,
        tierLimitPct: 25,
        isRecurring: false,
      },
      {
        id: 'ln-2',
        productId: 'prod-02',
        product: 'DealFlow360 Enterprise Core License',
        category: 'SaaS Licenses',
        qty: 2,
        unitPrice: 36000,
        discountPct: 28,
        categoryLimitPct: 20,
        tierLimitPct: 25,
        isRecurring: true,
      },
      {
        id: 'ln-3',
        productId: 'prod-04',
        product: 'Enterprise Architecture Deployment Sprint',
        category: 'Professional Services',
        qty: 1,
        unitPrice: 28000,
        discountPct: 10,
        categoryLimitPct: 15,
        tierLimitPct: 25,
        isRecurring: false,
      },
    ]
  );

  const [upsells, setUpsells] = useState(UPSELL_SUGGESTIONS);
  const [highlightScore, setHighlightScore] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Compute live risk and totals
  const riskAnalysis = calculateBlendedRisk(lines, customerTier);
  const totals = calculateQuotationTotals(lines);

  const triggerRiskHighlight = () => {
    setHighlightScore(true);
    setTimeout(() => setHighlightScore(false), 800);
  };

  const handleUpdateLine = (id, field, value) => {
    setLines((prev) =>
      prev.map((ln) => {
        if (ln.id === id) {
          const updated = { ...ln, [field]: value };
          return updated;
        }
        return ln;
      })
    );
    triggerRiskHighlight();
  };

  const handleRemoveLine = (id) => {
    setLines((prev) => prev.filter((ln) => ln.id !== id));
    triggerRiskHighlight();
  };

  const generateLineId = () => {
    lineCounterRef.current += 1;
    return `ln-${lineCounterRef.current}`;
  };

  const handleAddUpsell = (upsell) => {
    const matchingProd = INITIAL_PRODUCTS.find((p) => p.id === upsell.productId) || {
      id: upsell.id,
      name: upsell.name,
      category: upsell.category,
      price: upsell.unitPrice,
      isSubscription: upsell.category.includes('SaaS') || upsell.category.includes('Cloud'),
    };

    const newLine = {
      id: generateLineId(),
      productId: matchingProd.id,
      product: matchingProd.name,
      category: matchingProd.category,
      qty: 1,
      unitPrice: upsell.unitPrice,
      discountPct: 0,
      categoryLimitPct: CATEGORY_DISCOUNT_CEILINGS[matchingProd.category] || 15,
      tierLimitPct: TIER_DISCOUNT_CEILINGS[customerTier] || 20,
      isRecurring: matchingProd.isSubscription || false,
    };

    setLines((prev) => [...prev, newLine]);
    setUpsells((prev) => prev.filter((u) => u.id !== upsell.id));
    triggerRiskHighlight();
  };

  const handleAddProductFromCatalog = (product) => {
    const newLine = {
      id: generateLineId(),
      productId: product.id,
      product: product.name,
      category: product.category,
      qty: 1,
      unitPrice: product.price,
      discountPct: 5,
      categoryLimitPct: CATEGORY_DISCOUNT_CEILINGS[product.category] || 15,
      tierLimitPct: TIER_DISCOUNT_CEILINGS[customerTier] || 20,
      isRecurring: product.isSubscription || false,
    };

    setLines((prev) => [...prev, newLine]);
    setShowProductPicker(false);
    triggerRiskHighlight();
  };

  const handleSave = () => {
    if (onSaveDraft) {
      onSaveDraft({
        id: quotationId,
        customer,
        customerTier,
        lines,
        status: 'draft',
        blended_risk_score: riskAnalysis.score,
      });
    }
  };

  const handleSubmit = () => {
    if (onSubmitApproval) {
      onSubmitApproval({
        id: quotationId,
        customer,
        customerTier,
        lines,
        status: 'pending_approval',
        blended_risk_score: riskAnalysis.score,
        requiresFinance: riskAnalysis.requiresFinance,
      });
    }
  };

  return (
    <div className="w-full max-w-max-width mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-surface-interactive border border-border-subtle flex items-center justify-center text-text-secondary hover:text-white hover:border-accent-blue transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono-tag text-xs text-accent-blue font-semibold">
                {quotationId}
              </span>
              <Tag variant={customerTier === 'Gold' ? 'pink' : customerTier === 'Silver' ? 'blue' : 'neutral'}>
                {customerTier} Tier Customer
              </Tag>
              {riskAnalysis.requiresFinance && (
                <Tag variant="danger">DUAL APPROVAL MANDATE</Tag>
              )}
            </div>
            <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold tracking-tight text-text-primary mt-1">
              Quotation Builder & Risk Engine
            </h1>
          </div>
        </div>

        {/* Customer & Tier Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-surface-interactive border border-border-subtle rounded-full px-3 py-1.5 text-xs">
            <span className="text-text-secondary mr-2 font-label-caps uppercase">Customer:</span>
            <input
              type="text"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="bg-transparent text-text-primary font-semibold focus:outline-none w-40 min-w-[120px]"
            />
          </div>

          <div className="flex items-center bg-surface-interactive border border-border-subtle rounded-full p-1 text-xs font-mono">
            {['Bronze', 'Silver', 'Gold'].map((t) => (
              <button
                key={t}
                onClick={() => {
                  setCustomerTier(t);
                  triggerRiskHighlight();
                }}
                className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer ${
                  customerTier === t
                    ? 'bg-accent-blue text-surface-base font-bold'
                    : 'text-text-secondary hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 7/5 Grid Split (mirroring AETHER Model Latency section proportions) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start">
        {/* Left Column (7-col): Line items table & live risk KPI */}
        <div className="lg:col-span-7 space-y-6 min-w-0">
          {/* Running Blended Risk Score KPI Strip */}
          <Card
            className={`transition-all duration-500 ${
              highlightScore
                ? 'border-status-warning bg-surface-card/90 shadow-[0_0_24px_rgba(245,158,11,0.2)] ring-1 ring-status-warning/30'
                : ''
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <span className="font-label-caps text-label-caps text-text-secondary uppercase">
                  Running Blended Risk Score
                </span>
                <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                  <motion.div
                    className={`font-kpi-value text-5xl font-bold tracking-tighter transition-all duration-300 ${
                      riskAnalysis.score > 60
                        ? 'text-status-danger'
                        : riskAnalysis.score > 25
                        ? 'text-status-warning'
                        : 'text-status-live'
                    }`}
                    key={riskAnalysis.score}
                  >
                    {riskAnalysis.score}
                    <span className="text-xl font-normal text-text-secondary">/100</span>
                  </motion.div>
                  <Tag
                    variant={
                      riskAnalysis.level === 'HIGH'
                        ? 'danger'
                        : riskAnalysis.level === 'MEDIUM'
                        ? 'amber'
                        : 'green'
                    }
                  >
                    {riskAnalysis.level} RISK
                  </Tag>
                </div>
                <p className="text-body-sm text-text-secondary mt-1">
                  {riskAnalysis.flaggedLines.length > 0
                    ? `${riskAnalysis.flaggedLines.length} line(s) breach category/tier ceilings`
                    : 'All line discounts within approved policy thresholds'}
                </p>
              </div>

              {/* Running Value Telemetry */}
              <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-l border-border-subtle pt-3 sm:pt-0 sm:pl-6 flex-shrink-0">
                <span className="font-label-caps text-label-caps text-text-secondary uppercase block sm:hidden mb-2">
                  Net Quotation Value
                </span>
                <div className="font-kpi-value text-3xl font-bold text-text-primary mt-1 sm:mt-0">
                  ${totals.total.toLocaleString()}
                </div>
                <div className="font-mono-tag text-xs text-accent-pink font-semibold mt-0.5">
                  Savings: -${totals.totalDiscount.toLocaleString()} ({totals.effectiveDiscountPct.toFixed(1)}%)
                </div>
              </div>
            </div>
          </Card>

          {/* Line Items Table Card */}
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <h3 className="font-headline-sm text-lg font-bold text-text-primary">
                  Quotation Line Items
                </h3>
                <span className="font-mono-tag text-xs text-text-secondary">
                  ({lines.length})
                </span>
              </div>
              <PillButton
                variant="secondary"
                size="sm"
                icon="add"
                onClick={() => setShowProductPicker(true)}
              >
                + Add Product
              </PillButton>
            </div>

            {/* Table - responsive horizontal scroll on mobile */}
            <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0 pt-3">
              <table className="w-full min-w-[700px] text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border-subtle text-text-secondary font-label-caps uppercase text-[11px]">
                    <th className="py-2.5 pr-3">Product</th>
                    <th className="py-2.5 px-2 text-center w-20">Type</th>
                    <th className="py-2.5 px-2 text-center w-16">Qty</th>
                    <th className="py-2.5 px-2 text-right w-28">Unit Price</th>
                    <th className="py-2.5 px-2 text-center w-24">Disc %</th>
                    <th className="py-2.5 px-2 text-center w-20">Limit</th>
                    <th className="py-2.5 px-2 text-center w-28">Status</th>
                    <th className="py-2.5 px-2 text-right w-28">Net Total</th>
                    <th className="py-2.5 pl-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/60">
                  {lines.map((line) => {
                    const lineTotal = calculateLineTotal(line);
                    const effectiveCeiling = Math.min(
                      TIER_DISCOUNT_CEILINGS[customerTier] || 15,
                      CATEGORY_DISCOUNT_CEILINGS[line.category] || 15
                    );
                    const isOverLimit = line.discountPct > effectiveCeiling;

                    return (
                      <tr key={line.id} className="group hover:bg-surface-interactive/30">
                        <td className="py-3 pr-3 font-medium text-text-primary">
                          <div className="font-semibold text-sm line-clamp-1">{line.product}</div>
                          <div className="text-[10px] text-text-secondary">{line.category}</div>
                        </td>

                        <td className="py-3 px-2 text-center">
                          <Tag variant={line.isRecurring ? 'blue' : 'neutral'} pill>
                            {line.isRecurring ? 'RECURRING' : 'ONE-TIME'}
                          </Tag>
                        </td>

                        <td className="py-3 px-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={line.qty}
                            onChange={(e) =>
                              handleUpdateLine(line.id, 'qty', parseInt(e.target.value) || 1)
                            }
                            className="w-full max-w-[50px] text-center bg-surface-interactive border border-border-subtle rounded-lg py-1 text-xs text-text-primary focus:outline-none focus:border-accent-blue"
                          />
                        </td>

                        <td className="py-3 px-2 text-right font-mono-data text-text-secondary">
                          ${line.unitPrice.toLocaleString()}
                        </td>

                        <td className="py-3 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={line.discountPct}
                              onChange={(e) =>
                                handleUpdateLine(
                                  line.id,
                                  'discountPct',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className={`w-full max-w-[50px] text-center rounded-lg py-1 text-xs font-mono font-bold border focus:outline-none ${
                                isOverLimit
                                  ? 'bg-status-danger/15 border-status-danger/50 text-status-danger'
                                  : 'bg-surface-interactive border-border-subtle text-text-primary focus:border-accent-blue'
                              }`}
                            />
                            <span className="text-text-secondary font-mono">%</span>
                          </div>
                        </td>

                        <td className="py-3 px-2 text-center font-mono-tag text-text-secondary">
                          {effectiveCeiling}%
                        </td>

                        <td className="py-3 px-2 text-center">
                          {isOverLimit ? (
                            <Tag variant="danger" pill className="text-[10px]">
                              OVER (+{(line.discountPct - effectiveCeiling).toFixed(1)}%)
                            </Tag>
                          ) : (
                            <Tag variant="blue" pill className="text-[10px]">
                              OK
                            </Tag>
                          )}
                        </td>

                        <td className="py-3 px-2 text-right font-mono-data font-semibold text-text-primary">
                          ${lineTotal.toLocaleString()}
                        </td>

                        <td className="py-3 pl-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.id)}
                            className="opacity-40 group-hover:opacity-100 text-text-secondary hover:text-status-danger transition-opacity p-1"
                            title="Remove line item"
                          >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Product Picker Modal / Inline Drawer */}
            {showProductPicker && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 p-4 bg-surface-interactive border border-border-subtle rounded-2xl"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-label-caps text-xs uppercase text-text-secondary">
                    Select Product from Catalog
                  </span>
                  <button
                    onClick={() => setShowProductPicker(false)}
                    className="text-text-secondary hover:text-white p-1"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {INITIAL_PRODUCTS.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => handleAddProductFromCatalog(prod)}
                      className="p-2.5 bg-surface-card border border-border-subtle rounded-xl hover:border-accent-blue cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="font-medium text-xs text-text-primary line-clamp-1">{prod.name}</div>
                        <div className="font-mono-tag text-[10px] text-text-secondary">{prod.category}</div>
                      </div>
                      <span className="font-mono text-xs font-semibold text-accent-blue">
                        ${prod.price.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </Card>
        </div>

        {/* Right Column (5-col): Upsell & Cross-Sell Suggestions */}
        <div className="lg:col-span-5 space-y-6 min-w-0">
          <Card className="p-6 sm:p-7 relative overflow-hidden h-full min-h-[500px]">
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
              <div>
                <h3 className="font-headline-sm text-lg font-bold text-text-primary tracking-tight">
                  Upsell & Cross-Sell AI
                </h3>
                <p className="text-body-sm text-text-secondary mt-0.5">
                  Autonomous margin recommendations
                </p>
              </div>
              <Tag variant="pink">MARGIN OPTIMIZER</Tag>
            </div>

            {/* Suggestions list */}
            <div className="space-y-4 pt-4 flex-1 overflow-y-auto pr-2">
              {upsells.length === 0 ? (
                <div className="text-center py-8 text-text-secondary text-xs font-mono">
                  All active upsell recommendations applied to this deal!
                </div>
              ) : (
                upsells.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 bg-surface-interactive/80 border border-border-subtle hover:border-accent-blue/40 rounded-2xl space-y-3 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm text-text-primary truncate">
                            {item.name}
                          </h4>
                          {item.isPromoted && <Tag variant="pink" pill className="text-[10px]">PROMOTED</Tag>}
                        </div>
                        <span className="font-mono-tag text-[11px] text-text-secondary block mt-0.5">
                          {item.category}
                        </span>
                      </div>
                      <span className="font-mono-tag text-xs font-bold text-status-live bg-status-live/15 px-2 py-0.5 rounded whitespace-nowrap">
                        +{item.marginDeltaPct}% Margin
                      </span>
                    </div>

                    <p className="text-body-sm text-text-secondary text-xs leading-relaxed">
                      {item.reason}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono-data text-sm font-semibold text-text-primary">
                        +${item.unitPrice.toLocaleString()}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <PillButton
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setUpsells((prev) => prev.filter((u) => u.id !== item.id))
                          }
                        >
                          Dismiss
                        </PillButton>
                        <PillButton
                          variant="primary"
                          size="sm"
                          icon="add"
                          onClick={() => handleAddUpsell(item)}
                        >
                          + Add to Quote
                        </PillButton>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </Card>

          {/* Pricing Policy Card */}
          <Card className="p-6 border-dashed border-border-subtle/50">
            <h4 className="font-label-caps text-xs uppercase tracking-wider text-text-secondary mb-2">
              Discount Governance Rule
            </h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              Discounts exceeding category ceilings require Sales Manager approval. Aggregate
              blended risk &gt; 50 triggers mandatory Finance dual-signoff before quotation
              release.
            </p>
          </Card>
        </div>
      </div>

      {/* Footer Sticky Toolbar */}
      <div className="sticky bottom-4 z-40 bg-surface-card/90 backdrop-blur-xl border border-border-subtle rounded-full p-3.5 shadow-[0_10px_35px_rgba(0,0,0,0.6)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-max-width mx-auto px-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono-tag text-xs text-text-secondary">Summary:</span>
          <span className="font-mono-data font-semibold text-text-primary text-sm">
            {lines.length} Line Items &bull; ${totals.total.toLocaleString()} Total
          </span>
        </div>

        <div className="flex items-center gap-3">
          <PillButton variant="secondary" size="md" onClick={handleSave}>
            Save Draft
          </PillButton>
          <PillButton
            variant="primary"
            size="md"
            icon="send"
            onClick={handleSubmit}
          >
            Submit for Approval
          </PillButton>
        </div>
      </div>
    </div>
  );
}