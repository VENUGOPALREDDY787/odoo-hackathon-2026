import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import StatusBadge from '../components/StatusBadge';
import Tag from '../components/Tag';
import ListItem from '../components/ListItem';
import Skeleton from '../components/Skeleton';
import { consolidateBackorders, listStockLevels, listWarehouses, overrideFulfillment, reserveStock } from '../api/client';

export default function FulfillmentHub() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSuccess, setOverrideSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listWarehouses().then(async (warehouses) => {
      const liveOrders = await Promise.all(warehouses.map(async (warehouse) => {
        const stock = await listStockLevels(warehouse.id);
        const items = stock.map((item) => ({
          warehouse: warehouse.name,
          warehouse_id: warehouse.id,
          qtyFulfilled: item.available_quantity || item.quantity_available || 0,
          estShipments: 1,
          cost: item.shipping_cost || 0,
          status: (item.available_quantity || item.quantity_available || 0) > 0 ? 'Ready' : 'Backorder',
        }));
        return { id: warehouse.id, customer: warehouse.name, quotationId: warehouse.code || warehouse.id, warehouses: [warehouse.name], totalItems: items.length, backorderQty: items.filter((item) => item.status === 'Backorder').length, backorderProduct: items.find((item) => item.status === 'Backorder')?.product || 'stock item', status: 'Pending', splitDetail: items, lineId: items[0]?.quotation_line_id };
      }));
      setOrders(liveOrders);
    }).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  }, []);

  const handleAcceptSplit = async () => {
    if (!selectedOrder) return;
    try {
      await reserveStock(selectedOrder.lineId, { suggested_splits: selectedOrder.splitDetail });
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? { ...o, status: 'Fulfilled' } : o)));
      setSelectedOrder((prev) => (prev ? { ...prev, status: 'Fulfilled' } : null));
    } catch (requestError) { setError(requestError.message); }
  };

  const handleManualOverride = async (e) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      setError('Override rationale is required for audit trail.');
      return;
    }

    try {
      await overrideFulfillment({ quotation_line_id: selectedOrder.lineId, override_reason: overrideReason, custom_splits: selectedOrder.splitDetail.map((split) => ({ warehouse_id: split.warehouse_id, quantity: split.qtyFulfilled })) });
      setOrders((prev) => prev.map((o) => o.id === selectedOrder.id ? { ...o, status: 'Split Pending (Manual Override)' } : o));
      setShowOverrideModal(false); setOverrideSuccess(true); setTimeout(() => setOverrideSuccess(false), 3000);
    } catch (requestError) { setError(requestError.message); }
  };

  const handleConsolidate = async () => {
    try { await consolidateBackorders({ quotation_id: selectedOrder?.quotationId }); } catch (requestError) { setError(requestError.message); }
  };

  if (loading) return <div className="space-y-4"><Skeleton height="6rem" /><Skeleton variant="rounded" height="28rem" /></div>;
  if (error) return <Card className="p-6 text-status-danger">Unable to load fulfillment data: {error}</Card>;

  return (
    <div data-tour="fulfillment" className="w-full max-w-max-width mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-3xl font-bold tracking-tight text-text-primary">
            {t('fulfillment.title', 'Fulfillment & Logistics Engine')}
          </h1>
          <p className="text-body-sm text-text-secondary mt-1">
            {t('fulfillment.subtitle', 'Real-time warehouse stock balancing, multi-facility splits, and backorder orchestration')}
          </p>
        </div>

        {/* Global Warehouse Status Chips */}
        <div className="flex items-center gap-3">
          <div className="bg-surface-card border border-border-subtle rounded-2xl px-4 py-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-live animate-pulse" />
            <span className="font-mono text-xs text-text-primary">Austin Hub: 142 Nodes</span>
          </div>
          <div className="bg-surface-card border border-border-subtle rounded-2xl px-4 py-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-live" />
            <span className="font-mono text-xs text-text-primary">Berlin Hub: 68 Nodes</span>
          </div>
        </div>
      </div>

      {overrideSuccess && (
        <div className="p-4 bg-status-live/15 border border-status-live/40 text-status-live rounded-2xl text-xs font-mono flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>Manual override successfully registered and committed to system audit log.</span>
        </div>
      )}

      {!selectedOrder ? (
        /* Fulfillment List (Screen 7) */
        <Card className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-2">
            <span className="font-label-caps text-xs uppercase text-text-secondary font-semibold">
              {t('fulfillment.activeOrders', 'Active Fulfillment Queue')}
            </span>
            <span className="font-mono-tag text-xs text-text-secondary">
              {orders.length} orders
            </span>
          </div>

          <div className="divide-y divide-border-subtle">
            {orders.map((ord) => (
              <ListItem
                key={ord.id}
                onClick={() => setSelectedOrder(ord)}
                className="py-4 px-3 -mx-3 rounded-2xl"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono-tag text-xs font-bold text-accent-blue bg-surface-interactive px-2.5 py-1 rounded">
                    {ord.id}
                  </span>
                  <div>
                    <div className="font-medium text-sm text-text-primary flex items-center gap-2">
                      <span>{ord.customer}</span>
                      <span className="text-xs text-text-secondary">({ord.quotationId})</span>
                    </div>
                    <div className="text-body-sm text-text-secondary text-xs mt-0.5">
                      Warehouses: {ord.warehouses.join(', ')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Tag variant={ord.backorderQty > 0 ? 'danger' : 'blue'}>
                    {ord.totalItems} Items ({ord.backorderQty > 0 ? `${ord.backorderQty} Backordered` : 'In Stock'})
                  </Tag>

                  <StatusBadge status={ord.status} />

                  <PillButton variant="secondary" size="sm">
                    Inspect Split →
                  </PillButton>
                </div>
              </ListItem>
            ))}
          </div>
        </Card>
      ) : (
        /* Fulfillment Detail (Screen 8) */
        <div className="space-y-6">
          <Card className="p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-subtle">
              <div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="inline-flex items-center gap-1 font-mono-tag text-xs text-accent-blue hover:underline mb-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                  <span>{t('common.back', 'Back to Orders List')}</span>
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-headline-sm text-2xl font-bold text-text-primary">
                    {selectedOrder.customer}
                  </h2>
                  <span className="font-mono-tag text-xs text-text-secondary">
                    {selectedOrder.id}
                  </span>
                  <StatusBadge status={selectedOrder.status} />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <PillButton
                  variant="outline"
                  size="md"
                  onClick={() => setShowOverrideModal(true)}
                >
                  Manual Override
                </PillButton>
                <PillButton
                  variant="primary"
                  size="md"
                  icon="inventory_2"
                  onClick={handleAcceptSplit}
                >
                  {t('fulfillment.markFulfilled', 'Accept Suggested Split')}
                </PillButton>
              </div>
            </div>

            {/* Backorder Callout Banner (if backorder quantity > 0) */}
            {selectedOrder.backorderQty > 0 && (
              <div className="mt-6 p-5 bg-status-danger/10 border border-status-danger/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-status-danger text-[24px] mt-0.5">
                    report_problem
                  </span>
                  <div>
                    <h4 className="font-semibold text-sm text-status-danger">
                      Backorder Required: {selectedOrder.backorderQty} Units of {selectedOrder.backorderProduct}
                    </h4>
                    <p className="text-body-sm text-text-secondary text-xs mt-0.5 max-w-xl leading-relaxed">
                      Available primary warehouse inventory exhausted. Factory production line 2
                      forecast indicates replenishment in 12 business days. Consolidate remaining
                      backorder or authorize expedited air freight.
                    </p>
                  </div>
                </div>
                <PillButton
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleConsolidate()
                  }
                >
                  Consolidate Remaining Backorder
                </PillButton>
              </div>
            )}

            {/* Split Fulfillment Table: Warehouse, Qty Fulfilled, Est. Shipments, Cost */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="font-label-caps text-xs uppercase text-text-secondary font-semibold">
                  splitFulfillment() Algorithmic Allocation Matrix
                </span>
                <Tag variant="blue">LEAST-COST ROUTING</Tag>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-border-subtle font-label-caps text-text-secondary uppercase text-[10px]">
                      <th className="py-3">Fulfillment Warehouse / Facility</th>
                      <th className="py-3 text-center">Qty Fulfilled</th>
                      <th className="py-3 text-center">Est. Shipments</th>
                      <th className="py-3 text-right">Logistics Cost</th>
                      <th className="py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {selectedOrder.splitDetail?.map((sp, idx) => (
                      <tr key={idx} className="hover:bg-surface-interactive/30">
                        <td className="py-3.5 font-medium text-text-primary flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-text-secondary">
                            warehouse
                          </span>
                          <span>{sp.warehouse}</span>
                        </td>
                        <td className="py-3.5 text-center font-mono font-bold text-text-primary">
                          {sp.qtyFulfilled} units
                        </td>
                        <td className="py-3.5 text-center font-mono-tag text-text-secondary">
                          {sp.estShipments}
                        </td>
                        <td className="py-3.5 text-right font-mono-data text-accent-blue font-semibold">
                          {sp.cost}
                        </td>
                        <td className="py-3.5 text-right">
                          <Tag variant={sp.status === 'Backorder' ? 'danger' : sp.status === 'Completed' ? 'green' : 'blue'}>
                            {sp.status}
                          </Tag>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Manual Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-surface-base/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <Card className="max-w-md w-full p-6 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto" radiance>
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <h3 className="font-headline-sm text-lg font-bold text-text-primary">
                Manual Fulfillment Override
              </h3>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-body-sm text-text-secondary text-xs leading-relaxed">
              Manual overrides bypass automated least-cost allocation algorithms. An explicit reason
              is required and will be permanently recorded in audit_trails.
            </p>

            <form onSubmit={handleManualOverride} className="space-y-4">
              <div>
                <label className="block font-label-caps text-xs uppercase text-text-secondary mb-1.5">
                  Mandatory Override Reason *
                </label>
                <textarea
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. VIP Customer expedite request authorized by Regional Director..."
                  className="w-full aether-input h-28 resize-none text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <PillButton
                  variant="ghost"
                  size="md"
                  onClick={() => setShowOverrideModal(false)}
                >
                  Cancel
                </PillButton>
                <PillButton variant="primary" size="md" type="submit">
                  Commit Override
                </PillButton>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
