import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import Tag from '../components/Tag';
import {
  calculateBlendedRisk,
  calculateQuotationTotals,
  calculateLineTotal,
  CATEGORY_DISCOUNT_CEILINGS,
  TIER_DISCOUNT_CEILINGS,
} from '../utils/quotationCalculations';
import Skeleton from '../components/Skeleton';
import { addQuotationLine, createQuotation, getQuotation, getUpsellSuggestions, listProducts, listQuotationAuditTrails, removeQuotationLine, submitQuotation, updateQuotationLine } from '../api/client';

// Audit rows store changed_fields as a JSON string in MySQL; parse defensively
// so both array payloads (API) and string payloads (raw column) render.
function formatAuditFields(fields) {
  if (Array.isArray(fields)) return fields.join(', ');
  try {
    const parsed = JSON.parse(fields);
    return Array.isArray(parsed) ? parsed.join(', ') : String(fields);
  } catch {
    return String(fields);
  }
}

export default function QuotationBuilder({
  initialQuotation,
  onSaveDraft,
  onSubmitApproval,
  onBack,
  currentUser,
}) {
  const { t } = useTranslation();
  const lineCounterRef = useRef(0);
  // Optimistic-lock version kept in sync with the server after every persisted
  // mutation (via versionRef.current) so submit sends a valid expected_version.
  const versionRef = useRef(initialQuotation?.version ?? null);
  const [quotationId] = useState(() =>
    initialQuotation?.id || `QT-2026-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [persistedQuotationId, setPersistedQuotationId] = useState(initialQuotation?.id || null);
  const [customer, setCustomer] = useState(initialQuotation?.customer || '');
  const [customerTier, setCustomerTier] = useState(initialQuotation?.customerTier || 'Bronze');
  // New quotations start empty — every line must come from the real catalog
  // (or an upsell suggestion). Existing quotations load their persisted lines.
  const [lines, setLines] = useState(initialQuotation?.lines || []);

  const [upsells, setUpsells] = useState([]);
  const [products, setProducts] = useState([]);
  const [auditTrails, setAuditTrails] = useState([]);
  const [loading, setLoading] = useState(Boolean(initialQuotation?.id));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [highlightScore, setHighlightScore] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);

  const activeQuotationId = persistedQuotationId || quotationId;
  const isPersisted = Boolean(persistedQuotationId && /^[0-9a-f-]{36}$/i.test(persistedQuotationId));
  const isUuid = (value) => /^[0-9a-f-]{36}$/i.test(String(value || ''));
  const toLinePayload = (line, extra = {}) => ({
    ...(isUuid(line.productId) ? { product_id: line.productId } : {}),
    custom_name: line.product,
    custom_description: line.category,
    quantity: line.qty,
    list_price: line.unitPrice,
    discount_percent: line.discountPct,
    line_type: line.isRecurring ? 'recurring' : 'one_time',
    ...extra,
  });

  useEffect(() => {
    let active = true;
    const quoteId = initialQuotation?.id;
    Promise.all([
      listProducts({ limit: 100 }),
      // The list endpoint does not return lines, so when opening an existing
      // quotation we fetch its full detail (lines, audit trail, fresh version).
      quoteId ? getQuotation(quoteId) : Promise.resolve(null),
      quoteId ? getUpsellSuggestions(quoteId) : Promise.resolve([]),
      // Real role-attributed operation ledger for this quotation
      // (created/edited/approved — who, which role, when).
      quoteId ? listQuotationAuditTrails(quoteId).catch(() => []) : Promise.resolve([]),
    ]).then(([response, fullQuote, suggestions, trails]) => {
      if (!active) return;
      setProducts(response?.data?.items || response?.data || []);
      setUpsells(suggestions);
      setAuditTrails(trails || []);
      if (fullQuote) {
        setLines(fullQuote.lines || []);
        if (fullQuote.customer) setCustomer(fullQuote.customer);
        if (fullQuote.customerTier) setCustomerTier(fullQuote.customerTier);
        versionRef.current = fullQuote.version ?? versionRef.current;
      }
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [initialQuotation?.id]);

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
    if (isPersisted) {
      const line = lines.find((item) => item.id === id);
      if (line) updateQuotationLine(activeQuotationId, id, { [field === 'qty' ? 'quantity' : field === 'discountPct' ? 'discount_percent' : field]: value })
        .then((updated) => { if (updated?.version != null) versionRef.current = updated.version; })
        .catch((requestError) => setError(requestError.message));
    }
    triggerRiskHighlight();
  };

  const handleRemoveLine = (id) => {
    setLines((prev) => prev.filter((ln) => ln.id !== id));
    if (isPersisted) removeQuotationLine(activeQuotationId, id)
      .then((updated) => { if (updated?.version != null) versionRef.current = updated.version; })
      .catch((requestError) => setError(requestError.message));
    triggerRiskHighlight();
  };

  const generateLineId = () => {
    lineCounterRef.current += 1;
    return `ln-${lineCounterRef.current}`;
  };

  const handleAddUpsell = (upsell) => {
    const matchingProd = products.find((p) => p.id === upsell.productId) || {
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
    if (isPersisted) addQuotationLine(activeQuotationId, {
      ...toLinePayload(newLine),
      is_upsell: true,
    })
      .then((updated) => { if (updated?.version != null) versionRef.current = updated.version; })
      .catch((requestError) => setError(requestError.message));
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
    if (isPersisted) addQuotationLine(activeQuotationId, toLinePayload(newLine))
      .then((updated) => { if (updated?.version != null) versionRef.current = updated.version; })
      .catch((requestError) => setError(requestError.message));
    setShowProductPicker(false);
    triggerRiskHighlight();
  };

  const persistDraft = async () => {
    setSaving(true);
    try {
      let savedQuotation = initialQuotation;
      if (!isPersisted) {
        savedQuotation = await createQuotation({
          customer_id: initialQuotation?.customer_id || currentUser?.customer_id,
          customer_name: customer,
          customer_tier: customerTier,
          currency: 'INR',
          valid_until: new Date(Date.now() + 30 * 86400000).toISOString(),
          metadata: { customer_name: customer },
        });
        setPersistedQuotationId(savedQuotation.id);
        versionRef.current = savedQuotation?.version ?? versionRef.current;
        for (const line of lines) {
          savedQuotation = await addQuotationLine(savedQuotation.id, toLinePayload(line));
          // Each line addition bumps the server version — track it so a
          // subsequent submit passes the current expected_version.
          versionRef.current = savedQuotation?.version ?? versionRef.current;
        }
      }
      return savedQuotation;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    try {
      const saved = await persistDraft();
      onSaveDraft?.({
        ...saved,
        id: saved?.id || quotationId,
        customer,
        customerTier,
        lines,
        status: 'draft',
        blended_risk_score: riskAnalysis.score,
      });
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleSubmit = async () => {
    try {
      const saved = await persistDraft();
      const submitted = await submitQuotation(saved?.id || activeQuotationId, { expected_version: versionRef.current ?? saved?.version });
      onSubmitApproval?.({
        ...submitted,
        id: submitted?.id || saved?.id || activeQuotationId,
        customer,
        customerTier,
        lines,
        status: 'pending_approval',
        blended_risk_score: riskAnalysis.score,
        requiresFinance: riskAnalysis.requiresFinance,
      });
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  if (loading) return <div className="space-y-4"><Skeleton height="8rem" /><Skeleton variant="rounded" height="30rem" /></div>;
  if (error) return <Card className="p-6 text-status-danger">Unable to load quotation data: {error}</Card>;

  return (
    <div data-tour="quotation-builder" className="w-full max-w-max-width mx-auto space-y-6 animate-in fade-in duration-300">
      {/* ============================================================
           SECTION 1: QUOTATION HEADER
           ============================================================ */}
      <Card className="p-5 sm:p-6 border-l-4 border-accent-blue">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="w-9 h-9 rounded-full bg-surface-interactive border border-border-subtle flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-accent-blue transition-colors flex-shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono-tag text-xs text-accent-blue font-semibold whitespace-nowrap">
                  {quotationId}
                </span>
                <Tag variant={customerTier === 'Gold' ? 'pink' : customerTier === 'Silver' ? 'blue' : 'neutral'}>
                  {customerTier} Tier {t('common.customer', 'Customer')}
                </Tag>
                {riskAnalysis.requiresFinance && (
                  <Tag variant="danger" className="whitespace-nowrap">DUAL APPROVAL MANDATE</Tag>
                )}
              </div>
              <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold tracking-tight text-text-primary mt-1 truncate">
                {t('builder.title', 'Quotation Builder & Risk Engine')}
              </h1>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap items-center gap-4 sm:ml-auto">
            <div className="flex items-center gap-2 bg-surface-interactive/50 border border-border-subtle/50 rounded-full px-3 py-1.5">
              <span className="font-label-caps text-[10px] text-text-secondary uppercase">{t('common.status', 'Status')}</span>
              <span className="font-mono-tag text-xs font-semibold text-accent-blue">
                {initialQuotation?.status?.toUpperCase() || 'DRAFT'}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-surface-interactive/50 border border-border-subtle/50 rounded-full px-3 py-1.5">
              <span className="font-label-caps text-[10px] text-text-secondary uppercase">{t('builder.riskScore', 'Risk')}</span>
              <span className={`font-mono-tag text-xs font-bold px-2 py-0.5 rounded ${
                riskAnalysis.score > 60 ? 'bg-status-danger/20 text-status-danger' :
                riskAnalysis.score > 25 ? 'bg-status-warning/20 text-status-warning' :
                'bg-accent-blue/20 text-accent-blue'
              }`}>
                {riskAnalysis.score}/100
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* ============================================================
           SECTION 2: CUSTOMER INFORMATION & QUOTATION STATUS
           ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Information Card */}
        <Card className="p-4 sm:p-5">
          <h3 className="font-label-caps text-xs uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-accent-blue">person</span>
            Customer Information
          </h3>
          <div className="space-y-3">
            <div className="flex items-center bg-surface-interactive border border-border-subtle rounded-full px-3 py-2 text-xs">
              <span className="text-text-secondary mr-2 font-label-caps uppercase min-w-[80px]">Customer:</span>
              <input
                type="text"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                className="bg-transparent text-text-primary font-semibold focus:outline-none w-full min-w-[150px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-secondary font-label-caps text-xs uppercase min-w-[80px]">Tier:</span>
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
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Quotation Status & Metadata Card */}
        <Card className="p-4 sm:p-5">
          <h3 className="font-label-caps text-xs uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-accent-blue">info</span>
            Quotation Status
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-label-caps text-[10px] text-text-secondary uppercase block mb-0.5">Created</span>
              <span className="font-mono-data text-text-primary">{initialQuotation?.createdAt || 'Today'}</span>
            </div>
            <div>
              <span className="font-label-caps text-[10px] text-text-secondary uppercase block mb-0.5">Expires</span>
              <span className="font-mono-data text-text-primary">{initialQuotation?.expiresAt || '—'}</span>
            </div>
            <div>
              <span className="font-label-caps text-[10px] text-text-secondary uppercase block mb-0.5">Assigned Rep</span>
              <span className="font-mono-tag text-text-primary truncate block">{initialQuotation?.assignedTo || 'Current User'}</span>
            </div>
            <div>
              <span className="font-label-caps text-[10px] text-text-secondary uppercase block mb-0.5">Stage</span>
              <span className="font-mono-tag text-text-primary truncate block">{initialQuotation?.stage || 'Drafting Proposal'}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ============================================================
           SECTION 3: DEAL RISK SCORE (Prominent KPI Strip)
           ============================================================ */}
      <Card
        dataTour="risk"
        className={`transition-all duration-500 relative overflow-hidden ${
          highlightScore
            ? 'border-status-warning bg-surface-card/90 shadow-[0_0_24px_rgba(245,158,11,0.2)] ring-1 ring-status-warning/30'
            : ''
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
              <span className="font-label-caps text-label-caps text-text-secondary uppercase whitespace-nowrap flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">shield</span>
                {t('builder.riskScore', 'Deal Risk Score')}
              </span>
              <div className="flex items-baseline gap-3">
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
                  className="whitespace-nowrap"
                >
                  {t(`status.${riskAnalysis.level.toLowerCase()}`, `${riskAnalysis.level} RISK`)}
                </Tag>
              </div>
            </div>
            <p className="text-body-sm text-text-secondary mt-3 sm:mt-2">
              {riskAnalysis.flaggedLines.length > 0
                ? `${riskAnalysis.flaggedLines.length} line(s) breach category/tier ceilings`
                : 'All line discounts within approved policy thresholds'}
            </p>
            {/* Risk Detail Tags */}
            {riskAnalysis.flaggedLines.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {riskAnalysis.flaggedLines.slice(0, 3).map((flag, idx) => (
                  <Tag key={idx} variant="danger" pill className="text-[10px]">
                    {flag.product}: {flag.overBy}% over limit
                  </Tag>
                ))}
                {riskAnalysis.flaggedLines.length > 3 && (
                  <Tag variant="neutral" pill className="text-[10px]">
                    +{riskAnalysis.flaggedLines.length - 3} more
                  </Tag>
                )}
              </div>
            )}
          </div>

          {/* Running Value Telemetry */}
          <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-l border-border-subtle pt-3 sm:pt-0 sm:pl-6 flex-shrink-0">
            <span className="font-label-caps text-label-caps text-text-secondary uppercase block sm:hidden mb-2">
              {t('builder.totalAmount', 'Net Quotation Value')}
            </span>
            <div className="font-kpi-value text-3xl font-bold text-text-primary mt-1 sm:mt-0">
              ₹{totals.total.toLocaleString()}
            </div>
            <div className="font-mono-tag text-xs text-accent-pink font-semibold mt-0.5">
              Savings: -₹{totals.totalDiscount.toLocaleString()} ({totals.effectiveDiscountPct.toFixed(1)}%)
            </div>
            <div className="font-mono-tag text-xs text-status-live font-semibold mt-0.5">
              Blended Margin: {((totals.subtotal - totals.total) / totals.subtotal * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </Card>

      {/* ============================================================
           SECTION 4: PRODUCTS / QUOTATION LINES
           ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start">
        <div className="lg:col-span-7 space-y-6 min-w-0">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <h3 className="font-headline-sm text-lg font-bold text-text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-accent-blue">inventory_2</span>
                  {t('builder.lineItems', 'Quotation Line Items')}
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
                {t('builder.addProduct', 'Add Product')}
              </PillButton>
            </div>

            {/* Table - responsive horizontal scroll on mobile */}
            <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0 pt-3">
              <table className="w-full min-w-[700px] text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border-subtle text-text-secondary font-label-caps uppercase text-[11px]">
                    <th className="py-2.5 pr-3">{t('builder.productName', 'Product')}</th>
                    <th className="py-2.5 px-2 text-center w-20">{t('common.status', 'Type')}</th>
                    <th className="py-2.5 px-2 text-center w-16">{t('builder.quantity', 'Qty')}</th>
                    <th className="py-2.5 px-2 text-right w-28">{t('builder.unitPrice', 'Unit Price')}</th>
                    <th className="py-2.5 px-2 text-center w-24">{t('builder.discount', 'Disc %')}</th>
                    <th className="py-2.5 px-2 text-center w-20">Limit</th>
                    <th className="py-2.5 px-2 text-center w-28">{t('common.status', 'Status')}</th>
                    <th className="py-2.5 px-2 text-right w-28">{t('builder.subtotal', 'Net Total')}</th>
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
                          ₹{line.unitPrice.toLocaleString()}
                        </td>

                        <td className="py-3 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              data-tour="discount"
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
                          ₹{lineTotal.toLocaleString()}
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
                    className="text-text-secondary hover:text-text-primary p-1"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {products.map((prod) => (
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
                        ₹{prod.price.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </Card>

          {/* ============================================================
               SECTION 5: PRICING & DISCOUNTS SUMMARY
               ============================================================ */}
          <Card className="p-5 sm:p-6 bg-surface-interactive/30 border-border-subtle/50">
            <h4 className="font-label-caps text-xs uppercase tracking-wider text-text-secondary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-accent-pink">attach_money</span>
              Pricing & Discounts Summary
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-surface-card border border-border-subtle rounded-xl p-4">
                <span className="font-label-caps text-[10px] text-text-secondary uppercase block mb-1">Subtotal</span>
                <div className="font-mono-data font-semibold text-text-primary">₹{totals.subtotal.toLocaleString()}</div>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-xl p-4">
                <span className="font-label-caps text-[10px] text-text-secondary uppercase block mb-1">Total Discount</span>
                <div className="font-mono-data font-semibold text-accent-pink">-₹{totals.totalDiscount.toLocaleString()}</div>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-xl p-4">
                <span className="font-label-caps text-[10px] text-text-secondary uppercase block mb-1">Effective Discount</span>
                <div className="font-mono-data font-semibold text-text-primary">{totals.effectiveDiscountPct.toFixed(1)}%</div>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-xl p-4">
                <span className="font-label-caps text-[10px] text-text-secondary uppercase block mb-1">Net Total</span>
                <div className="font-kpi-value text-xl font-bold text-text-primary">₹{totals.total.toLocaleString()}</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border-subtle/50 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-label-caps text-[10px] text-text-secondary uppercase block mb-1">One-Time Items</span>
                <div className="font-mono-data font-semibold text-text-primary">{lines.filter(l => !l.isRecurring).length}</div>
              </div>
              <div>
                <span className="font-label-caps text-[10px] text-text-secondary uppercase block mb-1">Recurring Items</span>
                <div className="font-mono-data font-semibold text-accent-blue">{lines.filter(l => l.isRecurring).length}</div>
              </div>
              <div>
                <span className="font-label-caps text-[10px] text-text-secondary uppercase block mb-1">Tier Ceiling</span>
                <div className="font-mono-data font-semibold text-text-primary">{TIER_DISCOUNT_CEILINGS[customerTier] || 15}%</div>
              </div>
              <div>
                <span className="font-label-caps text-[10px] text-text-secondary uppercase block mb-1">Finance Approval</span>
                <div className={`font-mono-tag font-semibold ${riskAnalysis.requiresFinance ? 'text-status-danger' : 'text-status-live'}`}>
                  {riskAnalysis.requiresFinance ? 'REQUIRED' : 'Not Required'}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ============================================================
             RIGHT COLUMN: UPSELL, APPROVAL INFO, FULFILLMENT
             ============================================================ */}
        <div className="lg:col-span-5 space-y-6 min-w-0">
          {/* Upsell & Cross-Sell Suggestions */}
          <Card className="p-6 sm:p-7 relative overflow-hidden h-full min-h-[400px]">
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
              <div>
                <h3 className="font-headline-sm text-lg font-bold text-text-primary tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-accent-pink">trending_up</span>
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
                        +₹{item.unitPrice.toLocaleString()}
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
                          Add to Quote
                        </PillButton>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </Card>

          {/* Approval & Operations Audit — real backend audit_trails entries */}
          {(() => {
            // Prefer the server-side audit ledger (role-attributed operations),
            // falling back to approval logs carried on the quotation payload.
            const trails = auditTrails.length
              ? auditTrails
              : (initialQuotation?.auditTrails || []).filter(Boolean);
            if (!trails.length) return null;
            return (
              <Card className="p-5 sm:p-6 border-l-4 border-status-warning">
                <h4 className="font-label-caps text-xs uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-status-warning">gavel</span>
                  Approval &amp; Operations Audit
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {trails.slice(0, 8).map((audit, idx) => {
                    const actor = audit.actor_name || audit.user || audit.changed_by_role || 'System';
                    const role = audit.changed_by_role || audit.role || '';
                    const op = (audit.operation || audit.action || 'updated').toString().toLowerCase();
                    const when = audit.created_at || audit.date;
                    return (
                      <div key={audit.id || idx} className="p-3 bg-surface-interactive/50 border border-border-subtle/50 rounded-xl text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-text-primary capitalize">{op.replace(/_/g, ' ')}</div>
                            <div className="font-mono-tag text-[10px] text-text-secondary mt-0.5">
                              {String(actor).replace(/_/g, ' ')}{role ? ` • ${String(role).toUpperCase()}` : ''}
                            </div>
                          </div>
                          <span className="font-mono-tag text-[10px] text-text-secondary whitespace-nowrap">
                            {when ? new Date(when).toLocaleString() : ''}
                          </span>
                        </div>
                        {audit.changed_fields && (
                          <p className="text-text-secondary text-xs mt-1 leading-relaxed">
                            Fields: {formatAuditFields(audit.changed_fields)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })()}

          {/* Fulfillment Information Card */}
          {initialQuotation?.id && (
            <Card className="p-5 sm:p-6 border-l-4 border-accent-blue">
              <h4 className="font-label-caps text-xs uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-accent-blue">local_shipping</span>
                Fulfillment Information
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-label-caps text-[10px] text-text-secondary uppercase">Status</span>
                  <Tag variant={initialQuotation.status === 'confirmed' ? 'green' : 'amber'}>
                    {initialQuotation.status === 'confirmed' ? 'Ready for Fulfillment' : 'Pending Approval'}
                  </Tag>
                </div>
                <div className="flex justify-between">
                  <span className="font-label-caps text-[10px] text-text-secondary uppercase">Items to Fulfill</span>
                  <span className="font-mono-data font-semibold text-text-primary">{lines.length} line items</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-label-caps text-[10px] text-text-secondary uppercase">Recurring Lines</span>
                  <span className="font-mono-data font-semibold text-accent-blue">{lines.filter(l => l.isRecurring).length} subscription(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-label-caps text-[10px] text-text-secondary uppercase">One-Time Lines</span>
                  <span className="font-mono-data font-semibold text-text-primary">{lines.filter(l => !l.isRecurring).length} hardware/service(s)</span>
                </div>
                {initialQuotation.status !== 'confirmed' && (
                  <p className="text-xs text-text-secondary mt-2 p-3 bg-surface-interactive/50 border border-border-subtle/50 rounded-xl">
                    Fulfillment will be initiated once quotation reaches <span className="font-bold">Confirmed</span> status.
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Pricing Policy Card */}
          <Card className="p-5 sm:p-6 border-dashed border-border-subtle/50">
            <h4 className="font-label-caps text-xs uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-text-secondary">rule</span>
              Discount Governance Rule
            </h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              Discounts exceeding category ceilings require Sales Manager approval. Aggregate
              {'blended risk > 50 triggers mandatory Finance dual-signoff before quotation release.'}
            </p>
          </Card>
        </div>
      </div>

      {/* Footer Sticky Toolbar */}
      <div className="sticky bottom-4 z-40 bg-surface-card/90 backdrop-blur-xl border border-border-subtle rounded-full p-3.5 shadow-[0_10px_35px_rgb(0_0_0_/_0.28)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-max-width mx-auto px-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono-tag text-xs text-text-secondary">{t('common.details', 'Summary')}:</span>
          <span className="font-mono-data font-semibold text-text-primary text-sm">
            {lines.length} Line Items &bull; ₹{totals.total.toLocaleString()} {t('common.total', 'Total')}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <PillButton variant="secondary" size="md" onClick={handleSave} disabled={saving}>
            {t('builder.saveDraft', 'Save Draft')}
          </PillButton>
          <PillButton
            variant="primary"
            size="md"
            icon="send"
            onClick={handleSubmit}
            disabled={saving}
          >
            {t('builder.submitForApproval', 'Submit for Approval')}
          </PillButton>
        </div>
      </div>
    </div>
  );
}
