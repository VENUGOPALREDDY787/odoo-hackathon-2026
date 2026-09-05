import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import Tag from '../components/Tag';
import StatusBadge from '../components/StatusBadge';
import { listProducts } from '../auth/authApi';

function mapProduct(product) {
  return {
    ...product,
    category: product.category_name || product.category || 'Uncategorized',
    price: Number(product.base_price ?? product.price ?? 0),
    unit: product.unit_of_measure || product.unit || 'EA',
    tax: Number(product.tax ?? 0),
    status: product.is_active === false ? 'Inactive' : 'Active',
    isSubscription: Boolean(product.is_recurring_eligible ?? product.isSubscription),
    variants: product.variants || [],
    pricelists: product.pricelists || [],
  };
}

export default function ProductCatalog({ onSelectProduct, onNewProduct, onDeleteProduct, canDelete = false, canEdit = false, reloadKey = 0 }) {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  useEffect(() => {
    let active = true;
    listProducts({ limit: 100 })
      .then((response) => {
        if (active) setProducts((response.data || []).map(mapProduct));
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [reloadKey]);

  const totalVariants = products.reduce((acc, p) => acc + (p.variants?.length || 0), 0);
  const totalPricelists = products.reduce((acc, p) => acc + (p.pricelists?.length || 0), 0);

  const filtered = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'ALL' || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div data-tour="products" className="w-full max-w-max-width mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-3xl font-bold tracking-tight text-text-primary">
            {t('products.title', 'Product Catalog & Pricelist Matrix')}
          </h1>
          <p className="text-body-sm text-text-secondary mt-1">
            {t('products.subtitle', 'Global SKU definitions, dynamic tier pricelists, and subscription cycle parameters')}
          </p>
        </div>

        {/* Stat Chips + New Product CTA */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-surface-card border border-border-subtle rounded-2xl px-4 py-2 flex items-center gap-2">
            <span className="font-label-caps text-xs text-text-secondary uppercase">SKUs:</span>
            <span className="font-mono text-sm font-bold text-accent-blue">{products.length}</span>
          </div>
          <div className="bg-surface-card border border-border-subtle rounded-2xl px-4 py-2 flex items-center gap-2">
            <span className="font-label-caps text-xs text-text-secondary uppercase">Pricelists:</span>
            <span className="font-mono text-sm font-bold text-text-primary">{totalPricelists}</span>
          </div>
          <div className="bg-surface-card border border-border-subtle rounded-2xl px-4 py-2 flex items-center gap-2">
            <span className="font-label-caps text-xs text-text-secondary uppercase">Variants:</span>
            <span className="font-mono text-sm font-bold text-text-primary">{totalVariants}</span>
          </div>
          {canEdit && <PillButton variant="primary" icon="add" onClick={onNewProduct}>
            {t('products.addProduct', '+ New Product')}
          </PillButton>}
        </div>
      </div>

      {error && <div className="rounded-2xl border border-status-danger/40 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">{error}</div>}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-card border border-border-subtle rounded-2xl p-4">
        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-secondary">
            search
          </span>
          <input
            type="text"
            placeholder={t('products.searchProducts', 'Search catalog SKUs...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-interactive border border-border-subtle rounded-full pl-9 pr-4 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-blue"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {['ALL', ...new Set(products.map((product) => product.category))].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-mono transition-colors whitespace-nowrap ${
                categoryFilter === cat
                  ? 'bg-accent-blue text-surface-base font-bold'
                  : 'bg-surface-interactive border border-border-subtle text-text-secondary hover:text-text-primary'
              }`}
            >
              {cat === 'ALL' ? t('common.all', 'ALL') : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-interactive/60 font-label-caps text-text-secondary uppercase text-[10px]">
                <th className="py-3.5 px-6">{t('builder.productName', 'Product Name')}</th>
                <th className="py-3.5 px-4">{t('products.category', 'Category')}</th>
                <th className="py-3.5 px-4 text-center">{t('common.status', 'Type')}</th>
                <th className="py-3.5 px-4 text-right">{t('products.price', 'Base Price')}</th>
                <th className="py-3.5 px-4 text-center">Unit</th>
                <th className="py-3.5 px-4 text-center">{t('builder.tax', 'Tax %')}</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading && (
                <tr><td colSpan="8" className="py-10 text-center text-text-secondary">Loading products...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan="8" className="py-10 text-center text-text-secondary">No products found.</td></tr>
              )}
              {!loading && filtered.map((prod) => (
                <tr
                  key={prod.id}
                  onClick={() => onSelectProduct(prod)}
                  className="hover:bg-surface-interactive/40 cursor-pointer transition-colors"
                >
                  <td className="py-4 px-6">
                    <div className="font-semibold text-sm text-text-primary">{prod.name}</div>
                    <div className="text-[11px] text-text-secondary line-clamp-1 mt-0.5">
                      {prod.description}
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono-tag text-text-secondary">
                    {prod.category}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <Tag variant={prod.isSubscription ? 'blue' : 'neutral'}>
                      {prod.isSubscription ? 'RECURRING' : 'ONE-TIME'}
                    </Tag>
                  </td>
                  <td className="py-4 px-4 text-right font-mono-data font-semibold text-text-primary text-sm">
                    ₹{prod.price.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-center font-mono text-text-secondary">
                    /{prod.unit}
                  </td>
                  <td className="py-4 px-4 text-center font-mono text-text-secondary">
                    {prod.tax}%
                  </td>
                  <td className="py-4 px-4 text-center">
                    <StatusBadge status={prod.status} />
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <span className="font-mono-tag text-accent-blue hover:underline">Configure →</span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteProduct?.(prod);
                          }}
                          className="font-mono-tag text-status-danger hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
