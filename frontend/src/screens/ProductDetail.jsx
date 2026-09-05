import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import Tag from '../components/Tag';

export default function ProductDetail({ product, onBack, onSave }) {
  const { t } = useTranslation();
  const [name, setName] = useState(product?.name || '');
  const [category, setCategory] = useState(product?.category || 'SaaS Licenses');
  const [price, setPrice] = useState(product?.price || 0);
  const [unit, setUnit] = useState(product?.unit || 'seat/yr');
  const [tax, setTax] = useState(product?.tax || 0);
  const [description, setDescription] = useState(product?.description || '');
  const [isSubscription, setIsSubscription] = useState(product?.isSubscription || false);
  const [recurringCycle, setRecurringCycle] = useState(product?.recurringCycle || 'yearly');

  const [variants, setVariants] = useState(
    product?.variants || [
      { attribute: 'SLA Tier', values: ['Standard (99.5%)', 'Mission-Critical (99.99%)'], extraPrice: 6000 },
    ]
  );

  const [pricelists, _setPricelists] = useState(
    product?.pricelists || [
      { tier: 'Bronze', currency: 'USD', priceRule: 'Standard Annual Rate' },
      { tier: 'Silver', currency: 'USD', priceRule: 'Tier Credit Applied' },
      { tier: 'Gold', currency: 'USD', priceRule: 'Contractual Partner Cap' },
    ]
  );

  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      { attribute: 'Custom Option', values: ['Tier A', 'Tier B'], extraPrice: 1000 },
    ]);
  };

  const handleSave = (e) => {
    e.preventDefault();
    const updated = {
      id: product?.id || `prod-${Date.now()}`,
      name,
      category,
      price: parseFloat(price) || 0,
      unit,
      tax: parseFloat(tax) || 0,
      description,
      isSubscription,
      recurringCycle: isSubscription ? recurringCycle : null,
      variants,
      pricelists,
      status: 'Active',
    };
    if (onSave) onSave(updated);
    alert('Product configuration and pricelist resolution matrix saved.');
  };

  return (
    <div className="w-full max-w-max-width mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-surface-interactive border border-border-subtle flex items-center justify-center text-text-secondary hover:text-white"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono-tag text-xs text-accent-blue font-semibold">
                {product?.id || 'NEW SKU'}
              </span>
              <Tag variant={isSubscription ? 'blue' : 'neutral'}>
                {isSubscription ? 'SUBSCRIPTION SKU' : 'STANDARD SKU'}
              </Tag>
            </div>
            <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold tracking-tight text-text-primary mt-1">
              {name || t('products.addProduct', 'New Product Definition')}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onBack && (
            <PillButton variant="ghost" size="md" onClick={onBack}>
              {t('common.cancel', 'Cancel')}
            </PillButton>
          )}
          <PillButton variant="primary" size="md" icon="save" onClick={handleSave}>
            {t('common.save', 'Save Configuration')}
          </PillButton>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Info Card */}
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="border-b border-border-subtle pb-3">
            <h3 className="font-headline-sm text-lg font-bold text-text-primary">
              {t('productDetail.productOverview', 'General SKU Information')}
            </h3>
            <p className="text-body-sm text-text-secondary text-xs">
              Base catalog parameters and commercial descriptors
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-label-caps text-xs uppercase text-text-secondary mb-1.5">
                Product Title *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full aether-input"
                placeholder="e.g. AETHER Edge Compute Node X4"
              />
            </div>

            <div>
              <label className="block font-label-caps text-xs uppercase text-text-secondary mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full aether-input bg-surface-interactive"
              >
                <option value="Enterprise Hardware">Enterprise Hardware</option>
                <option value="SaaS Licenses">SaaS Licenses</option>
                <option value="Professional Services">Professional Services</option>
                <option value="Cloud Infrastructure">Cloud Infrastructure</option>
              </select>
            </div>

            <div>
              <label className="block font-label-caps text-xs uppercase text-text-secondary mb-1.5">
                Base Price ($) *
              </label>
              <input
                type="number"
                required
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full aether-input font-mono"
              />
            </div>

            <div>
              <label className="block font-label-caps text-xs uppercase text-text-secondary mb-1.5">
                Unit of Measure
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full aether-input"
                placeholder="e.g. node, seat/yr, month"
              />
            </div>

            <div>
              <label className="block font-label-caps text-xs uppercase text-text-secondary mb-1.5">
                Tax Rate (%)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                className="w-full aether-input font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-label-caps text-xs uppercase text-text-secondary mb-1.5">
              Commercial Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full aether-input h-20 resize-none text-xs"
              placeholder="Detailed capability overview for quotations..."
            />
          </div>

          {/* Conditional Subscription Toggle */}
          <div className="p-4 bg-surface-interactive/70 border border-border-subtle rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-sm text-text-primary">
                Recurring Subscription Product?
              </div>
              <p className="text-body-sm text-text-secondary text-xs mt-0.5">
                Flags item for recurring billing schedules and proration calculations.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Toggle Buttons */}
              <div className="flex items-center bg-surface-base border border-border-subtle rounded-full p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setIsSubscription(false)}
                  className={`px-3 py-1 rounded-full font-medium transition-colors ${
                    !isSubscription
                      ? 'bg-text-primary text-surface-base'
                      : 'text-text-secondary hover:text-white'
                  }`}
                >
                  No (One-Time)
                </button>
                <button
                  type="button"
                  onClick={() => setIsSubscription(true)}
                  className={`px-3 py-1 rounded-full font-medium transition-colors ${
                    isSubscription
                      ? 'bg-accent-blue text-surface-base font-bold'
                      : 'text-text-secondary hover:text-white'
                  }`}
                >
                  Yes (Recurring)
                </button>
              </div>

              {/* Conditional Recurring Cycle Field */}
              {isSubscription && (
                <div className="flex items-center gap-2 animate-in fade-in">
                  <span className="font-label-caps text-xs text-text-secondary uppercase">
                    Cycle:
                  </span>
                  <select
                    value={recurringCycle}
                    onChange={(e) => setRecurringCycle(e.target.value)}
                    className="bg-surface-base border border-border-subtle rounded-xl px-3 py-1 text-xs text-accent-blue font-mono font-bold"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Variants Table Card */}
        <Card className="p-6 sm:p-8">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-4">
            <div>
              <h3 className="font-headline-sm text-lg font-bold text-text-primary">
                SKU Variants & Configurable Attributes
              </h3>
              <p className="text-body-sm text-text-secondary text-xs">
                SLA tiers, memory specs, or cloud hosting configurations
              </p>
            </div>
            <PillButton variant="secondary" size="sm" icon="add" onClick={handleAddVariant}>
              + Add Variant
            </PillButton>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-subtle font-label-caps text-text-secondary uppercase text-[10px]">
                  <th className="py-2.5">Attribute Name</th>
                  <th className="py-2.5">Option Values</th>
                  <th className="py-2.5 text-right">Incremental Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {variants.map((v, i) => (
                  <tr key={i} className="hover:bg-surface-interactive/30">
                    <td className="py-3 font-semibold text-text-primary">{v.attribute}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {v.values.map((val, idx) => (
                          <Tag key={idx} variant="blue">
                            {val}
                          </Tag>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 text-right font-mono text-status-live font-semibold">
                      +${v.extraPrice.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Pricelists Table Card */}
        <Card className="p-6 sm:p-8">
          <div className="pb-3 border-b border-border-subtle mb-4">
            <h3 className="font-headline-sm text-lg font-bold text-text-primary">
              Multi-Tier Pricelists Resolution Matrix
            </h3>
            <p className="text-body-sm text-text-secondary text-xs">
              Directly feeds backend pricing-resolution engine based on customer contract tier
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-subtle font-label-caps text-text-secondary uppercase text-[10px]">
                  <th className="py-2.5">Customer Tier</th>
                  <th className="py-2.5">ISO Currency</th>
                  <th className="py-2.5">Price Rule Formulation</th>
                  <th className="py-2.5 text-right">Computed Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {pricelists.map((pl, i) => (
                  <tr key={i} className="hover:bg-surface-interactive/30">
                    <td className="py-3">
                      <Tag variant={pl.tier === 'Gold' ? 'pink' : pl.tier === 'Silver' ? 'blue' : 'neutral'}>
                        {pl.tier}
                      </Tag>
                    </td>
                    <td className="py-3 font-mono text-text-secondary">{pl.currency}</td>
                    <td className="py-3 text-text-primary font-medium">{pl.priceRule}</td>
                    <td className="py-3 text-right font-mono font-bold text-accent-blue">
                      ${(price * (pl.tier === 'Gold' ? 0.92 : pl.tier === 'Silver' ? 0.96 : 1)).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </form>
    </div>
  );
}
