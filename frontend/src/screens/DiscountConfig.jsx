import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import Tag from '../components/Tag';
import Skeleton from '../components/Skeleton';
import { listApprovalChains, listAuditTrails, listDiscountTiers, updateApprovalChain, updateDiscountTier } from '../api/client';

const TIERS = ['Bronze', 'Silver', 'Gold'];
const TIER_VARIANT = { Bronze: 'neutral', Silver: 'blue', Gold: 'pink' };

export default function DiscountConfig() {
  const { t } = useTranslation();
  const [tierRows, setTierRows] = useState([]); // real discount_tiers rows (per tier × category)
  const [draftValues, setDraftValues] = useState({}); // rowId -> { discount_percent }
  const [approvalRules, setApprovalRules] = useState([]);
  const [chainDrafts, setChainDrafts] = useState({}); // chainId -> { min, max, is_active }
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [policyAudit, setPolicyAudit] = useState([]);

  // Load real role-attributed policy-change history (audit_trails) so the
  // admin sees who changed which ceiling/chain and when.
  const refreshPolicyAudit = () => {
    listAuditTrails({ limit: 50 })
      .then((rows) => {
        const relevant = (rows || []).filter((row) => ['discount_tiers', 'approval_chains'].includes(row.table_name));
        setPolicyAudit(relevant);
      })
      .catch(() => setPolicyAudit([]));
  };

  useEffect(() => {
    Promise.all([listDiscountTiers(), listApprovalChains()])
      .then(([tiers, chains]) => {
        setTierRows(tiers || []);
        setApprovalRules(chains || []);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
    refreshPolicyAudit();
  }, []);

  // Real rows are per (customer_tier × category); group by category name for the matrix.
  const categories = useMemo(() => {
    const seen = [];
    for (const row of tierRows) {
      const name = row.category_name || 'Uncategorized';
      if (!seen.some((c) => c === name)) seen.push(name);
    }
    return seen;
  }, [tierRows]);

  const rowKey = (tier, category) => `${tier}::${category}`;
  const rowByKey = useMemo(() => {
    const map = {};
    for (const row of tierRows) {
      map[rowKey(row.customer_tier, row.category_name || 'Uncategorized')] = row;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rowKey is a pure string helper
  }, [tierRows]);

  const cellValue = (tier, category) => {
    const row = rowByKey[rowKey(tier, category)];
    if (!row) return null;
    const draft = draftValues[row.id];
    return draft ? draft.discount_percent : Number(row.discount_percent);
  };

  const handleCellChange = (tier, category, value) => {
    const row = rowByKey[rowKey(tier, category)];
    if (!row) return;
    setDraftValues((prev) => ({ ...prev, [row.id]: { discount_percent: parseFloat(value) || 0 } }));
  };

  const handleSaveTiers = async () => {
    const ids = Object.keys(draftValues);
    if (!ids.length) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      return;
    }
    setSaving(true);
    try {
      await Promise.all(ids.map((id) => updateDiscountTier(id, {
        ...draftValues[id],
        is_active: true,
      })));
      setDraftValues({});
      // Refresh from server so the saved values are shown post-roundtrip.
      const fresh = await listDiscountTiers();
      setTierRows(fresh || []);
      refreshPolicyAudit();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChainEdit = (chainId, field, value) => {
    setChainDrafts((prev) => ({ ...prev, [chainId]: { ...(prev[chainId] || {}), [field]: value } }));
  };

  const handleSaveChain = async (chain) => {
    const draft = chainDrafts[chain.id] || {};
    setSaving(true);
    try {
      await updateApprovalChain(chain.id, {
        min_discount_percent: draft.min != null ? Number(draft.min) : Number(chain.min_discount_percent),
        max_discount_percent: draft.max != null ? Number(draft.max) : Number(chain.max_discount_percent),
        is_active: draft.is_active != null ? draft.is_active : Boolean(chain.is_active),
      });
      setChainDrafts((prev) => {
        const next = { ...prev };
        delete next[chain.id];
        return next;
      });
      const fresh = await listApprovalChains();
      setApprovalRules(fresh || []);
      refreshPolicyAudit();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-4"><Skeleton height="6rem" /><Skeleton variant="rounded" height="30rem" /></div>;
  if (error) return <Card className="p-6 text-status-danger">Unable to load discount policy: {error}</Card>;

  return (
    <div data-tour="discounts" className="w-full max-w-max-width mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-3xl font-bold tracking-tight text-text-primary">
            {t('discounts.title', 'Discount Governance & Approval Chains')}
          </h1>
          <p className="text-body-sm text-text-secondary mt-1">
            {t('discounts.subtitle', 'Discount ceilings per customer tier and category, plus the sign-off chains that enforce them')}
          </p>
        </div>

        <PillButton variant="primary" icon="check" onClick={handleSaveTiers} disabled={saving}>
          {t('common.save', 'Save Ceiling Changes')}
        </PillButton>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-status-live/15 border border-status-live/40 text-status-live rounded-2xl text-xs font-mono flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">verified</span>
          <span>Discount policy updated — changes saved to the live governance engine.</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-status-danger/15 border border-status-danger/40 text-status-danger rounded-2xl text-xs font-mono">
          {error}
        </div>
      )}

      {/* Discount Ceiling Matrix: real discount_tiers rows (tier × category) */}
      <Card className="p-6 sm:p-7">
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-4">
          <div>
            <h3 className="font-headline-sm text-lg font-bold text-text-primary">
              Discount Ceilings by Customer Tier &amp; Category
            </h3>
            <p className="text-body-sm text-text-secondary text-xs">
              Each cell is the ceiling enforced on line items for that tier within that catalog category
            </p>
          </div>
          <Tag variant="blue">TIER × CATEGORY</Tag>
        </div>

        {categories.length === 0 ? (
          <div className="py-10 text-center text-text-secondary font-mono text-sm">
            No discount tiers configured yet. Use the product catalog categories to add ceilings.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-subtle font-label-caps text-[10px] text-text-secondary uppercase">
                  <th className="py-2.5 pr-3">Category</th>
                  {TIERS.map((tier) => (
                    <th key={tier} className="py-2.5 px-2 text-center">
                      <Tag variant={TIER_VARIANT[tier]}>{tier} Tier</Tag>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {categories.map((category) => (
                  <tr key={category} className="hover:bg-surface-interactive/30">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-text-primary text-xs">{category}</div>
                    </td>
                    {TIERS.map((tier) => {
                      const value = cellValue(tier, category);
                      const row = rowByKey[rowKey(tier, category)];
                      return (
                        <td key={tier} className="py-3 px-2 text-center">
                          {row ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={value ?? 0}
                              onChange={(e) => handleCellChange(tier, category, e.target.value)}
                              className="w-16 text-center aether-input py-1 text-xs font-mono font-bold text-accent-blue"
                            />
                          ) : (
                            <span className="text-text-secondary/50 font-mono text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[10px] text-text-secondary font-mono">
              Save publishes all edited ceilings via the governance API (PUT /discounts/tiers/:id).
            </p>
          </div>
        )}
      </Card>

      {/* Approval Chains (real approval_chains rows) */}
      <Card className="p-6 sm:p-8">
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-4">
          <div>
            <h3 className="font-headline-sm text-lg font-bold text-text-primary">
              Approval Chain Escalation Ladder
            </h3>
            <p className="text-body-sm text-text-secondary text-xs">
              Blended-risk score ranges routed to each sign-off chain
            </p>
          </div>
          <Tag variant="green">STATE MACHINE</Tag>
        </div>

        {approvalRules.length === 0 ? (
          <div className="py-10 text-center text-text-secondary font-mono text-sm">No approval chains configured.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {approvalRules.map((rule) => {
              const draft = chainDrafts[rule.id] || {};
              const minVal = draft.min != null ? draft.min : Number(rule.min_discount_percent);
              const maxVal = draft.max != null ? draft.max : Number(rule.max_discount_percent);
              const active = draft.is_active != null ? draft.is_active : Boolean(rule.is_active);
              const roles = Array.isArray(rule.required_approver_roles)
                ? rule.required_approver_roles
                : typeof rule.required_approver_roles === 'string'
                ? JSON.parse(rule.required_approver_roles || '[]')
                : [];
              const needsFinance = roles.includes('finance');
              const isManagerOnly = roles.length === 1 && roles.includes('manager');
              return (
                <div key={rule.id} className="p-5 bg-surface-interactive/80 border border-border-subtle rounded-2xl space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-text-primary">{rule.name || 'Approval chain'}</div>
                      <div className="text-[10px] text-text-secondary font-mono mt-0.5 truncate">{rule.description}</div>
                    </div>
                    <Tag variant={!active ? 'neutral' : needsFinance ? 'danger' : isManagerOnly ? 'amber' : 'blue'}>
                      {active ? (needsFinance ? 'MANAGER + FINANCE' : roles.join(' + ').toUpperCase()) : 'INACTIVE'}
                    </Tag>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap text-xs">
                    <label className="flex items-center gap-1.5">
                      <span className="text-text-secondary font-mono">Min %</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={minVal}
                        onChange={(e) => handleChainEdit(rule.id, 'min', e.target.value)}
                        className="w-16 text-center aether-input py-1 text-xs font-mono font-bold"
                      />
                    </label>
                    <label className="flex items-center gap-1.5">
                      <span className="text-text-secondary font-mono">Max %</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={maxVal}
                        onChange={(e) => handleChainEdit(rule.id, 'max', e.target.value)}
                        className="w-16 text-center aether-input py-1 text-xs font-mono font-bold"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleChainEdit(rule.id, 'is_active', !active)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-mono border transition-colors cursor-pointer ${
                        active
                          ? 'bg-status-live/15 border-status-live/40 text-status-live'
                          : 'bg-surface-interactive border-border-subtle text-text-secondary'
                      }`}
                    >
                      {active ? '● ACTIVE' : '○ INACTIVE'}
                    </button>
                  </div>

                  <p className="text-body-sm text-text-secondary text-[11px] border-t border-border-subtle pt-2">
                    Sign-off roles: <span className="font-mono text-text-primary">{roles.join(', ') || '—'}</span>
                    {' · '}Minimum approvals: <span className="font-mono text-text-primary">{rule.min_approvals_required ?? 1}</span>
                  </p>

                  <PillButton
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveChain(rule)}
                    disabled={saving}
                  >
                    Save Chain
                  </PillButton>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Role-attributed policy-change ledger (real audit_trails rows) */}
      {policyAudit.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-3">
            <h3 className="font-headline-sm text-base font-bold text-text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-accent-blue">history</span>
              Policy Change Audit Trail
            </h3>
            <span className="font-mono-tag text-xs text-text-secondary">{policyAudit.length} entries</span>
          </div>
          <div className="divide-y divide-border-subtle max-h-72 overflow-y-auto">
            {policyAudit.map((row) => (
              <div key={row.id} className="py-2.5 flex flex-wrap items-center gap-2 text-xs">
                <Tag variant={row.operation === 'DELETE' ? 'danger' : row.operation === 'CREATE' ? 'green' : 'blue'}>
                  {row.operation}
                </Tag>
                <span className="font-mono text-text-primary">{row.table_name === 'discount_tiers' ? 'Ceiling' : 'Approval Chain'}</span>
                <span className="text-text-secondary">
                  by <span className="font-semibold text-text-primary">{row.actor_name || row.changed_by_role || 'System'}</span>
                  {row.changed_by_role ? ` (${String(row.changed_by_role).toUpperCase()})` : ''}
                </span>
                <span className="font-mono-tag text-text-secondary ml-auto whitespace-nowrap">
                  {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
