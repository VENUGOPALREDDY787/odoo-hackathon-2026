import { resolvePrice } from '../services/priceResolver.js';

describe('priceResolver - Pure Price Resolution Service', () => {
  const baseProduct = {
    id: 'prod-100',
    sku: 'LAPTOP-PRO-15',
    name: 'Pro Laptop 15"',
    base_price: 1500.0,
    is_active: true,
    currency: 'USD',
    deleted_at: null,
  };

  const activeVariant = {
    id: 'var-100',
    product_id: 'prod-100',
    sku: 'LAPTOP-PRO-15-32GB',
    name: '32GB RAM Upgrade',
    price_adjustment: 300.0,
    is_active: true,
    deleted_at: null,
  };

  describe('No Override (Base Price Fallback)', () => {
    it('returns base product price when no price list items exist', () => {
      const result = resolvePrice({
        product: baseProduct,
        priceListItems: [],
        customerTier: 'Bronze',
        currency: 'USD',
        quantity: 1,
      });

      expect(result).toEqual({
        effective_price: 1500.0,
        source: 'base_price',
        currency: 'USD',
        details: {
          base_price: 1500.0,
          variant_price_adjustment: 0,
          variant_id: null,
        },
      });
    });

    it('applies variant price adjustment to base price when variant is provided', () => {
      const result = resolvePrice({
        product: baseProduct,
        variant: activeVariant,
        priceListItems: [],
        customerTier: 'Bronze',
        currency: 'USD',
        quantity: 1,
      });

      expect(result).toEqual({
        effective_price: 1800.0,
        source: 'base_price',
        currency: 'USD',
        details: {
          base_price: 1500.0,
          variant_price_adjustment: 300.0,
          variant_id: 'var-100',
        },
      });
    });
  });

  describe('Override Exists (Price List Item Matching)', () => {
    const priceListItems = [
      {
        id: 'pli-1',
        price_list_id: 'pl-wholesale',
        price_list_name: 'Wholesale Price List',
        currency: 'USD',
        customer_tier: null,
        min_quantity: 1,
        max_quantity: null,
        unit_price: 1400.0,
        is_default: true,
      },
      {
        id: 'pli-2',
        price_list_id: 'pl-gold',
        price_list_name: 'Gold Tier Special',
        currency: 'USD',
        customer_tier: 'Gold',
        min_quantity: 1,
        max_quantity: null,
        unit_price: 1200.0,
        is_default: false,
      },
      {
        id: 'pli-3',
        price_list_id: 'pl-bulk',
        price_list_name: 'Bulk Purchase List',
        currency: 'USD',
        customer_tier: 'Gold',
        min_quantity: 10,
        max_quantity: 100,
        unit_price: 1000.0,
        is_default: false,
      },
    ];

    it('returns effective price from matching price list override', () => {
      const result = resolvePrice({
        product: baseProduct,
        priceListItems,
        customerTier: 'Bronze',
        currency: 'USD',
        quantity: 1,
      });

      expect(result.effective_price).toBe(1400.0);
      expect(result.source).toBe('price_list_override');
      expect(result.details.price_list_id).toBe('pl-wholesale');
    });

    it('prioritizes customer tier specific override over general price list override', () => {
      const result = resolvePrice({
        product: baseProduct,
        priceListItems,
        customerTier: 'Gold',
        currency: 'USD',
        quantity: 1,
      });

      expect(result.effective_price).toBe(1200.0);
      expect(result.source).toBe('price_list_override');
      expect(result.details.price_list_id).toBe('pl-gold');
      expect(result.details.customer_tier).toBe('Gold');
    });

    it('selects volume tier price list override when quantity threshold is met', () => {
      const result = resolvePrice({
        product: baseProduct,
        priceListItems,
        customerTier: 'Gold',
        currency: 'USD',
        quantity: 15,
      });

      expect(result.effective_price).toBe(1000.0);
      expect(result.source).toBe('price_list_override');
      expect(result.details.price_list_id).toBe('pl-bulk');
      expect(result.details.min_quantity).toBe(10);
    });

    it('prioritizes variant-specific price list override when variant is requested', () => {
      const variantItems = [
        ...priceListItems,
        {
          id: 'pli-var-1',
          price_list_id: 'pl-gold',
          price_list_name: 'Gold Tier Special',
          currency: 'USD',
          variant_id: 'var-100',
          customer_tier: 'Gold',
          min_quantity: 1,
          max_quantity: null,
          unit_price: 1350.0,
          is_default: false,
        },
      ];

      const result = resolvePrice({
        product: baseProduct,
        variant: activeVariant,
        priceListItems: variantItems,
        customerTier: 'Gold',
        currency: 'USD',
        quantity: 1,
      });

      expect(result.effective_price).toBe(1350.0);
      expect(result.source).toBe('price_list_override');
      expect(result.details.price_list_item_id).toBe('pli-var-1');
    });
  });

  describe('Currency Mismatch', () => {
    it('ignores price list items with non-matching currency', () => {
      const eurItems = [
        {
          id: 'pli-eur',
          price_list_id: 'pl-eur',
          price_list_name: 'EUR Price List',
          currency: 'EUR',
          customer_tier: 'Gold',
          min_quantity: 1,
          unit_price: 1100.0,
        },
      ];

      const result = resolvePrice({
        product: baseProduct,
        priceListItems: eurItems,
        customerTier: 'Gold',
        currency: 'USD',
        quantity: 1,
      });

      // Should fall back to USD base price
      expect(result.effective_price).toBe(1500.0);
      expect(result.source).toBe('base_price');
      expect(result.currency).toBe('USD');
    });

    it('returns currency_mismatch status when product base currency differs and no matching override exists', () => {
      const eurProduct = { ...baseProduct, currency: 'EUR' };

      const result = resolvePrice({
        product: eurProduct,
        priceListItems: [],
        customerTier: 'Bronze',
        currency: 'USD',
        quantity: 1,
      });

      expect(result.effective_price).toBeNull();
      expect(result.source).toBe('currency_mismatch');
      expect(result.currency).toBe('USD');
      expect(result.reason).toContain('Currency mismatch');
    });
  });

  describe('Inactive / Deleted Product or Variant', () => {
    it('returns inactive state and null price for inactive product', () => {
      const inactiveProduct = { ...baseProduct, is_active: false };

      const result = resolvePrice({
        product: inactiveProduct,
        priceListItems: [],
        customerTier: 'Bronze',
        currency: 'USD',
      });

      expect(result.effective_price).toBeNull();
      expect(result.source).toBe('inactive');
      expect(result.reason).toBe('Product is inactive');
    });

    it('returns deleted state and null price for soft-deleted product', () => {
      const deletedProduct = { ...baseProduct, deleted_at: new Date() };

      const result = resolvePrice({
        product: deletedProduct,
        priceListItems: [],
        customerTier: 'Bronze',
        currency: 'USD',
      });

      expect(result.effective_price).toBeNull();
      expect(result.source).toBe('deleted');
      expect(result.reason).toBe('Product is deleted');
    });

    it('returns inactive_variant state when requested variant is inactive', () => {
      const inactiveVar = { ...activeVariant, is_active: false };

      const result = resolvePrice({
        product: baseProduct,
        variant: inactiveVar,
        priceListItems: [],
        customerTier: 'Bronze',
        currency: 'USD',
      });

      expect(result.effective_price).toBeNull();
      expect(result.source).toBe('inactive_variant');
      expect(result.reason).toBe('Product variant is inactive or deleted');
    });

    it('returns not_found state when product is null', () => {
      const result = resolvePrice({
        product: null,
        priceListItems: [],
        customerTier: 'Bronze',
        currency: 'USD',
      });

      expect(result.effective_price).toBeNull();
      expect(result.source).toBe('not_found');
      expect(result.reason).toBe('Product not found');
    });
  });
});
