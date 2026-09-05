import React, { useState } from 'react';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import StatusBadge from '../components/StatusBadge';
import Tag from '../components/Tag';
import Stepper from '../components/Stepper';
import ListItem from '../components/ListItem';
import { INVOICES_DATA } from '../data/mockData';

export default function InvoicesHub() {
  const [invoices, setInvoices] = useState(INVOICES_DATA);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const totalInvoiced = invoices.reduce((acc, inv) => acc + inv.amount, 0);
  const totalPaid = invoices.filter((i) => i.status === 'Paid').reduce((acc, i) => acc + i.amount, 0);
  const totalUnpaid = totalInvoiced - totalPaid;

  const handleRecordPayment = () => {
    if (!selectedInvoice) return;
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === selectedInvoice.id
          ? { ...inv, status: 'Paid', stepperState: 'Paid' }
          : inv
      )
    );
    setSelectedInvoice((prev) => (prev ? { ...prev, status: 'Paid', stepperState: 'Paid' } : null));
    alert('Payment receipt registered! General ledger synced.');
  };

  return (
    <div className="w-full max-w-max-width mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-3xl font-bold tracking-tight text-text-primary">
            Invoicing & Accounts Receivable
          </h1>
          <p className="text-body-sm text-text-secondary mt-1">
            Partial milestone billing, fulfillment reconciliations, and payment logging
          </p>
        </div>

        {/* Summary Stat Chips */}
        <div className="flex items-center gap-3">
          <div className="bg-surface-card border border-border-subtle rounded-2xl px-4 py-2 flex items-center gap-2">
            <span className="font-label-caps text-xs text-text-secondary uppercase">Unpaid:</span>
            <span className="font-mono text-base font-bold text-status-warning">
              ${(totalUnpaid / 1000).toFixed(1)}k
            </span>
          </div>
          <div className="bg-surface-card border border-border-subtle rounded-2xl px-4 py-2 flex items-center gap-2">
            <span className="font-label-caps text-xs text-text-secondary uppercase">Paid:</span>
            <span className="font-mono text-base font-bold text-status-live">
              ${(totalPaid / 1000).toFixed(1)}k
            </span>
          </div>
        </div>
      </div>

      {!selectedInvoice ? (
        /* Invoices List (Screen 12) */
        <Card className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-2">
            <span className="font-label-caps text-xs uppercase text-text-secondary font-semibold">
              Commercial Invoices
            </span>
            <span className="font-mono-tag text-xs text-text-secondary">
              {invoices.length} invoices
            </span>
          </div>

          <div className="divide-y divide-border-subtle">
            {invoices.map((inv) => (
              <ListItem
                key={inv.id}
                onClick={() => setSelectedInvoice(inv)}
                className="py-4 px-3 -mx-3 rounded-2xl"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono-tag text-xs font-bold text-accent-blue bg-surface-interactive px-2.5 py-1 rounded">
                    {inv.id}
                  </span>
                  <div>
                    <div className="font-medium text-sm text-text-primary flex items-center gap-2">
                      <span>{inv.customer}</span>
                      <span className="text-xs text-text-secondary">({inv.orderId})</span>
                    </div>
                    <div className="text-body-sm text-text-secondary text-xs mt-0.5">
                      Issued: {inv.issuedDate} • Due: {inv.dueDate}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <span className="font-mono-data font-bold text-base text-text-primary">
                    ${inv.amount.toLocaleString()}
                  </span>

                  <StatusBadge status={inv.status} />

                  <PillButton variant="secondary" size="sm">
                    View Invoice →
                  </PillButton>
                </div>
              </ListItem>
            ))}
          </div>
        </Card>
      ) : (
        /* Invoice Detail (Screen 13) */
        <div className="space-y-6">
          <Card className="p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-subtle">
              <div>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="inline-flex items-center gap-1 font-mono-tag text-xs text-accent-blue hover:underline mb-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                  <span>Back to Invoices</span>
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-headline-sm text-2xl font-bold text-text-primary">
                    {selectedInvoice.customer}
                  </h2>
                  <span className="font-mono-tag text-xs text-text-secondary">
                    {selectedInvoice.id}
                  </span>
                  <StatusBadge status={selectedInvoice.status} />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <PillButton
                  variant="outline"
                  size="md"
                  onClick={() => alert('PDF invoice statement downloaded.')}
                >
                  Download Summary
                </PillButton>
                <PillButton
                  variant="primary"
                  size="md"
                  icon="payments"
                  onClick={handleRecordPayment}
                  disabled={selectedInvoice.status === 'Paid'}
                >
                  {selectedInvoice.status === 'Paid' ? 'Payment Recorded' : 'Record Payment'}
                </PillButton>
              </div>
            </div>

            {/* Stepper: Order Confirmed → Shipped → Invoiced → Paid */}
            <div className="pt-6">
              <span className="font-label-caps text-xs uppercase text-text-secondary font-semibold block mb-2">
                Invoice Settlement Progression
              </span>
              <Stepper
                steps={[
                  { label: 'Order Confirmed', sub: 'MSA Signed' },
                  { label: 'Shipped', sub: 'Warehouse Dispatch' },
                  { label: 'Invoiced', sub: 'AP Ledger Entry' },
                  { label: 'Paid', sub: 'Funds Cleared' },
                ]}
                currentStepIndex={selectedInvoice.status === 'Paid' ? 3 : 2}
              />
            </div>

            {/* Partial Invoicing Note */}
            <div className="mt-6 p-4 bg-surface-interactive border border-border-subtle rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="material-symbols-outlined text-accent-blue text-[18px]">
                  info
                </span>
                <span>
                  <strong>Partial Invoicing Architecture: </strong>
                  {selectedInvoice.partialNote} Multiple invoice lines can exist per commercial order.
                </span>
              </div>
              <Tag variant="blue">PARTIAL RECONCILIATION</Tag>
            </div>

            {/* Line Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border-subtle font-label-caps text-text-secondary uppercase text-[10px]">
                    <th className="py-2.5">Line Description</th>
                    <th className="py-2.5 text-center">Qty</th>
                    <th className="py-2.5 text-right">Unit Price</th>
                    <th className="py-2.5 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {selectedInvoice.lines?.map((ln, idx) => (
                    <tr key={idx} className="hover:bg-surface-interactive/30">
                      <td className="py-3 font-medium text-text-primary">
                        {ln.description}
                      </td>
                      <td className="py-3 text-center font-mono">{ln.qty}</td>
                      <td className="py-3 text-right font-mono text-text-secondary">
                        ${ln.unitPrice.toLocaleString()}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-text-primary">
                        ${ln.total.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Footer */}
            <div className="mt-6 pt-4 border-t border-border-subtle flex justify-end">
              <div className="text-right">
                <span className="font-label-caps text-xs text-text-secondary uppercase block">
                  Total Payable Amount
                </span>
                <span className="font-kpi-value text-3xl font-bold text-text-primary mt-1 block">
                  ${selectedInvoice.amount.toLocaleString()}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
