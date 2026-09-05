import React from 'react';
import { useTranslation } from 'react-i18next';
import EmptyState from '../components/EmptyState';

export default function InvoicesHub() {
  const { t } = useTranslation();

  return (
    <div data-tour="invoices" className="w-full max-w-max-width mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="font-headline-lg text-3xl font-bold tracking-tight text-text-primary">
          {t('invoices.title', 'Invoicing & Accounts Receivable')}
        </h1>
        <p className="text-body-sm text-text-secondary mt-1">
          {t('invoices.subtitle', 'Invoice lifecycle is not exposed by the current backend contract.')}
        </p>
      </div>
      <EmptyState
        icon="receipt_long"
        title="Invoice module unavailable"
        description="The current backend exposes billing schedules but no invoice or payment endpoints. No fabricated invoices are shown."
      />
    </div>
  );
}
