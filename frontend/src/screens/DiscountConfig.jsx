import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import Tag from '../components/Tag';
import {
  TIER_DISCOUNT_CEILINGS,
  CATEGORY_DISCOUNT_CEILINGS,
  APPROVAL_TIER_RULES,
} from '../data/mockData';

export default function DiscountConfig() {
  const { t } = useTranslation();
  const [tierCeilings, setTierCeilings] = useState(TIER_DISCOUNT_CEILINGS);
  const [categoryCeilings, setCategoryCeilings] = useState(CATEGORY_DISCOUNT_CEILINGS);
  const [approvalRules, _setApprovalRules] = useState(APPROVAL_TIER_RULES);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleUpdateTier = (tier, val) => {
    setTierCeilings((prev) => ({ ...prev, [tier]: parseFloat(val) || 0 }));
  };

  const handleUpdateCategory = (cat, val) => {
    setCategoryCeilings((prev) => ({ ...prev, [cat]: parseFloat(val) || 0 }));
  };

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="w-full max-w-max-width mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-3xl font-bold tracking-tight text-text-primary">
            {t('discounts.title', 'Discount Governance & Approval Chains')}
          </h1>
          <p className="text-body-sm text-text-secondary mt-1">
            {t('discounts.subtitle', 'Global discount ceilings, category policy thresholds, and dual-signoff trigger rules')}
          </p>
        </div>

        <PillButton variant="primary" icon="check" onClick={handleSave}>
          {t('common.save', 'Save Policy Configuration')}
        </PillButton>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-status-live/15 border border-status-live/40 text-status-live rounded-2xl text-xs font-mono flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">verified</span>
          <span>Discount policy updated! New blended risk limits propagated to live quotation engine.</span>
        </div>
      )}

      {/* CORE ARCHITECTURAL RULE BANNER */}
      <Card className="p-6 bg-surface-card border-2 border-accent-blue/40 relative overflow-hidden" radiance>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent-blue/15 border border-accent-blue/40 flex items-center justify-center text-accent-blue shrink-0">
            <span className="material-symbols-outlined text-[26px]">balance</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-label-caps text-xs uppercase tracking-wider text-accent-blue font-bold">
                CORE SYSTEM ARCHITECTURE RULE
              </span>
              <Tag variant="blue">MANDATORY POLICY</Tag>
            </div>
            <h3 className="font-headline-sm text-lg font-bold text-text-primary">
              Per-Line Evaluation with Blended Order Violations
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed font-mono">
              The governance engine evaluates <strong>every individual quotation line item</strong>{' '}
              against both its customer tier ceiling and its product category ceiling. Any single
              breach contributes incrementally to the aggregate{' '}
              <strong className="text-text-primary">blended_risk_score</strong>. Dual approvals
              (Sales Manager + Finance VP) are deterministically triggered whenever aggregated
              excess exceeds threshold or individual hardware concessions exceed policy caps.
            </p>
          </div>
        </div>
      </Card>

      {/* Two Side-by-Side Tables: Tier Ceilings vs Category Ceilings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter-lg items-start">
        {/* Tier Discount Ceilings */}
        <Card className="p-6 sm:p-7">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-4">
            <div>
              <h3 className="font-headline-sm text-lg font-bold text-text-primary">
                Customer Tier Discount Ceilings
              </h3>
              <p className="text-body-sm text-text-secondary text-xs">
                Maximum allowable rep discount before governance escalation
              </p>
            </div>
            <Tag variant="blue">TIER CAPS</Tag>
          </div>

          <div className="space-y-4">
            {Object.entries(tierCeilings).map(([tier, maxPct]) => (
              <div
                key={tier}
                className="p-4 bg-surface-interactive rounded-2xl border border-border-subtle flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Tag variant={tier === 'Gold' ? 'pink' : tier === 'Silver' ? 'blue' : 'neutral'}>
                    {tier.toUpperCase()} TIER
                  </Tag>
                  <span className="text-xs text-text-secondary font-mono">
                    {tier === 'Gold'
                      ? 'Enterprise SLA Partner'
                      : tier === 'Silver'
                      ? 'High-Volume Commercial'
                      : 'Standard Direct Customer'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary font-mono">Max:</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={maxPct}
                    onChange={(e) => handleUpdateTier(tier, e.target.value)}
                    className="w-16 text-center aether-input py-1 text-xs font-mono font-bold text-accent-blue"
                  />
                  <span className="font-mono text-xs text-text-secondary">%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Category Discount Ceilings */}
        <Card className="p-6 sm:p-7">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-4">
            <div>
              <h3 className="font-headline-sm text-lg font-bold text-text-primary">
                Product Category Discount Ceilings
              </h3>
              <p className="text-body-sm text-text-secondary text-xs">
                Margin protection limits enforced per catalog taxonomy
              </p>
            </div>
            <Tag variant="pink">MARGIN LIMITS</Tag>
          </div>

          <div className="space-y-4">
            {Object.entries(categoryCeilings).map(([cat, maxPct]) => (
              <div
                key={cat}
                className="p-3.5 bg-surface-interactive rounded-2xl border border-border-subtle flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-xs text-text-primary">{cat}</div>
                  <div className="text-[10px] text-text-secondary font-mono">
                    Enforced at line item evaluation
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary font-mono">Ceiling:</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={maxPct}
                    onChange={(e) => handleUpdateCategory(cat, e.target.value)}
                    className="w-16 text-center aether-input py-1 text-xs font-mono font-bold text-accent-pink"
                  />
                  <span className="font-mono text-xs text-text-secondary">%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Discount Range → Max Discount Approval Chain Mapping */}
      <Card className="p-6 sm:p-8">
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-4">
          <div>
            <h3 className="font-headline-sm text-lg font-bold text-text-primary">
              Approval Chain Escalation Ladder
            </h3>
            <p className="text-body-sm text-text-secondary text-xs">
              State-machine pathing determined by discount violation scale
            </p>
          </div>
          <Tag variant="green">STATE MACHINE</Tag>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {approvalRules.map((rule, idx) => (
            <div
              key={idx}
              className="p-5 bg-surface-interactive/80 border border-border-subtle rounded-2xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-label-caps text-[11px] uppercase text-text-secondary">
                  Level {idx + 1}
                </span>
                <Tag
                  variant={
                    rule.requiredApprover === 'none'
                      ? 'green'
                      : rule.requiredApprover === 'manager'
                      ? 'amber'
                      : 'danger'
                  }
                >
                  {rule.requiredApprover.toUpperCase()}
                </Tag>
              </div>

              <div>
                <div className="font-mono text-2xl font-bold text-text-primary">
                  {idx === 0 ? '≤ 10%' : idx === 1 ? '10% – 20%' : '> 20%'}
                </div>
                <div className="text-xs text-text-secondary mt-0.5">Aggregate Concession</div>
              </div>

              <p className="text-body-sm text-text-secondary text-xs border-t border-border-subtle pt-3 leading-relaxed">
                {rule.label}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
