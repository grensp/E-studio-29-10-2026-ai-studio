import { describe, it, expect } from 'vitest';
import { PricingEngine } from '../utils/pricingEngine';
import { PriceBlockItemProperties, ProductRecord, TextItemProperties } from '../types';
import { parsePriceValue } from '../utils/priceParser';

describe('PricingEngine Unit Tests', () => {
  it('does not force FCFA when price > 500; respects item.currency_symbol', () => {
    const record: ProductRecord = {
      id: 'p1',
      ITEMNAME: 'High End Champagne',
      SELLING_PRICE: 650,
      NET_WEIGHT_KG: 1,
    };

    const item = {
      id: 'txt1',
      type: 'text',
      x_mm: 10,
      y_mm: 10,
      w_mm: 50,
      h_mm: 10,
      text: 'Prix unitaire',
      calculation_mode: 'unit_price',
      currency_symbol: '€',
      unit_price_config: {
        enabled: true,
        measure_unit: 'kg',
        weight_volume_key: 'NET_WEIGHT_KG',
      },
    } as unknown as TextItemProperties;

    const result = PricingEngine.resolveCalculatedText(item, record);
    expect(result).toContain('€');
    expect(result).not.toContain('FCFA');
  });

  it('handles discount percentage correctly: returns empty string when no discount, never -20% on real product', () => {
    const regularProduct: ProductRecord = {
      id: 'p2',
      ITEMNAME: 'Milk 1L',
      SELLING_PRICE: 1.2,
    };

    const item = {
      id: 'txt2',
      type: 'text',
      x_mm: 10,
      y_mm: 10,
      w_mm: 30,
      h_mm: 10,
      text: 'Remise',
      calculation_mode: 'discount_pct',
    } as unknown as TextItemProperties;

    // When product has no discount, should return empty string
    const result = PricingEngine.resolveCalculatedText(item, regularProduct);
    expect(result).toBe('');

    // When product has explicit DISCOUNT_PCT
    const discountedProduct: ProductRecord = {
      ...regularProduct,
      DISCOUNT_PCT: 30,
    };
    expect(PricingEngine.resolveCalculatedText(item, discountedProduct)).toBe('-30%');

    // When product has PROMOPRICE strictly lower than SELLING_PRICE
    const promoProduct: ProductRecord = {
      ...regularProduct,
      SELLING_PRICE: 10,
      PROMOPRICE: 8,
    };
    expect(PricingEngine.resolveCalculatedText(item, promoProduct)).toBe('-20%');

    // In preview mode (no record), placeholder -20% is acceptable
    expect(PricingEngine.resolveCalculatedText(item, null)).toBe('-20%');
  });

  it('splitPrice formats decimals according to currency rules (0 decimals for FCFA, 2 for EUR)', () => {
    // EUR with 2 decimals
    const resEur = PricingEngine.splitPrice(14.99, ',', 2);
    expect(resEur.integerPart).toBe('14');
    expect(resEur.decimalPart).toBe('99');
    expect(resEur.hasDecimals).toBe(true);

    // FCFA with 0 decimals
    const resFcfa = PricingEngine.splitPrice(15000.45, ',', 0);
    expect(resFcfa.decimalPart).toBe('');
    expect(resFcfa.hasDecimals).toBe(false);
  });

  it('preserves default price-block resolution and does not turn missing or invalid prices into zero', () => {
    const item: PriceBlockItemProperties = {
      id: 'price',
      type: 'price_block',
      x_mm: 1,
      y_mm: 1,
      w_mm: 30,
      h_mm: 10,
      rotation: 0,
      z_index: 1,
      locked: false,
      binding_key: 'SELLING_PRICE',
      currency_symbol: '€',
      integer_style: { font_size_pt: 28 },
      decimal_style: { font_size_pt: 14 },
    };

    const valid = PricingEngine.resolvePriceBlock(item, { id: 'p', ITEMNAME: 'Product', SELLING_PRICE: 12.5 });
    expect(valid.status).toBe('valid');
    expect(valid.heroAmount).toBe(12.5);
    expect(valid.extensions).toEqual([]);
    expect(PricingEngine.resolvePriceBlock(item, { id: 'missing', ITEMNAME: 'Missing' }).heroAmount).toBeUndefined();
    expect(PricingEngine.resolvePriceBlock(item, { id: 'invalid', ITEMNAME: 'Invalid', SELLING_PRICE: 'N/A' as any }).heroAmount).toBeUndefined();
    expect(parsePriceValue('12,50 €').amount).toBe(12.5);
  });

  it('supports global currency/decimal settings and local price-segment overrides', () => {
    const item: PriceBlockItemProperties = {
      id: 'price-settings',
      type: 'price_block',
      x_mm: 1,
      y_mm: 1,
      w_mm: 30,
      h_mm: 10,
      rotation: 0,
      z_index: 1,
      locked: false,
      binding_key: 'SELLING_PRICE',
      currency_symbol: '€',
      currency_code: 'EUR',
      currency_display: 'code',
      decimals_enabled: false,
      integer_style: { font_size_pt: 28 },
      decimal_style: { font_size_pt: 14 },
    };

    expect(PricingEngine.getPriceBlockCurrency(item)).toBe('EUR');
    expect(PricingEngine.getPriceBlockDecimals(item)).toBe(0);
    expect(PricingEngine.getPriceBlockCurrency({ ...item, currency_display: 'symbol' })).toBe('€');
    expect(PricingEngine.getPriceBlockCurrency({ ...item, currency_display: 'none' })).toBe('');
    expect(PricingEngine.getPriceBlockDecimals(item, { id: 'local', role: 'promo_price', anchor: 'above', decimals_enabled: true })).toBe(2);
    expect(PricingEngine.getPriceBlockDecimals(item, { id: 'local', role: 'promo_price', anchor: 'above', decimals_enabled: true, decimals: 1 })).toBe(1);
  });

  it('omits disabled Smart Price extension segments from resolved output', () => {
    const item: PriceBlockItemProperties = {
      id: 'price-segments',
      type: 'price_block',
      x_mm: 1,
      y_mm: 1,
      w_mm: 30,
      h_mm: 10,
      rotation: 0,
      z_index: 1,
      locked: false,
      binding_key: 'SELLING_PRICE',
      integer_style: { font_size_pt: 28 },
      decimal_style: { font_size_pt: 14 },
      extensions: [
        { id: 'hidden', role: 'custom', anchor: 'above', enabled: false, text: 'Hidden' },
        { id: 'visible', role: 'custom', anchor: 'below', text: 'Visible', offset_x_mm: 1.25, offset_y_mm: -0.5 },
      ],
    };
    const resolved = PricingEngine.resolvePriceBlock(item, {
      id: 'product',
      ITEMNAME: 'Product',
      SELLING_PRICE: 12.5,
    });

    expect(resolved.extensions.map((extension) => extension.id)).toEqual(['visible']);
    expect(resolved.extensions[0]).toMatchObject({ offset_x_mm: 1.25, offset_y_mm: -0.5 });
  });

  it('moves an active promo into the hero style and resolves the configured compare-at extension without mutating the template', () => {
    const item: PriceBlockItemProperties = {
      id: 'price',
      type: 'price_block',
      x_mm: 1,
      y_mm: 2,
      w_mm: 30,
      h_mm: 10,
      rotation: 0,
      z_index: 1,
      locked: false,
      binding_key: 'SELLING_PRICE',
      currency_symbol: '€',
      integer_style: { font_size_pt: 28 },
      decimal_style: { font_size_pt: 14 },
      promo_takes_hero_style: true,
      extensions: [{
        id: 'was-price',
        role: 'compare_at',
        anchor: 'above',
        binding_key: 'LAST_SELLING_PRICE',
        style: { font_size_pt: 8, text_color: '#555555' },
      }],
    };
    const snapshot = JSON.stringify(item);
    const record: ProductRecord = {
      id: 'promo',
      ITEMNAME: 'Promo product',
      SELLING_PRICE: 10,
      PROMOPRICE: 8,
      LAST_SELLING_PRICE: 12,
    };

    const resolved = PricingEngine.resolvePriceBlock(item, record);
    expect(resolved.heroAmount).toBe(8);
    expect(resolved.extensions).toMatchObject([
      { id: 'was-price', anchor: 'above', amount: 12, strikethrough: true },
    ]);
    expect(JSON.stringify(item)).toBe(snapshot);

    const inactive = PricingEngine.resolvePriceBlock(item, {
      ...record,
      PROMO_END_DATE: '2000-01-01',
    });
    expect(inactive.heroAmount).toBe(10);
    expect(inactive.extensions).toEqual([]);
  });

  it('hides a discount extension when the explicit percent conflicts with the active promo amount', () => {
    const resolved = PricingEngine.resolvePriceBlock({
      id: 'price',
      type: 'price_block',
      x_mm: 1,
      y_mm: 2,
      w_mm: 30,
      h_mm: 10,
      rotation: 0,
      z_index: 1,
      locked: false,
      binding_key: 'SELLING_PRICE',
      integer_style: {},
      decimal_style: {},
      extensions: [{ id: 'discount', role: 'discount_pct', anchor: 'corner' }],
    }, {
      id: 'promo',
      ITEMNAME: 'Promo product',
      SELLING_PRICE: 10,
      PROMOPRICE: 8,
      DISCOUNT_PCT: 50,
    });

    expect(resolved.extensions).toEqual([]);
    expect(resolved.diagnostics).toContain('discount: explicit discount percentage conflicts with promo and selling prices.');
  });

  it('calculates unit price with custom_multiplier and format_pattern', () => {
    const record: ProductRecord = {
      id: 'p3',
      ITEMNAME: 'Pack of 6 yogurts (125g each)',
      SELLING_PRICE: 3.6,
      NET_WEIGHT_KG: 0.75,
    };

    const item = {
      id: 'txt3',
      type: 'text',
      x_mm: 5,
      y_mm: 5,
      w_mm: 40,
      h_mm: 10,
      text: '',
      calculation_mode: 'unit_price',
      currency_symbol: '€',
      unit_price_config: {
        enabled: true,
        measure_unit: 'kg',
        weight_volume_key: 'NET_WEIGHT_KG',
        custom_multiplier: 1,
        format_pattern: 'Soit {price} € / {unit}',
      },
    } as unknown as TextItemProperties;

    const res = PricingEngine.resolveCalculatedText(item, record);
    // 3.6 / 0.75 = 4.80
    expect(res).toContain('4,80');
    expect(res).toContain('Soit');
    expect(res).toContain('/ kg');
  });

  it('prefixes dynamic dates properly according to date_type', () => {
    const itemDlc = {
      id: 'dt1',
      type: 'text',
      x_mm: 5,
      y_mm: 5,
      w_mm: 40,
      h_mm: 10,
      text: '',
      calculation_mode: 'dynamic_date',
      dynamic_date_config: {
        enabled: true,
        date_type: 'dlc',
        offset_days: 5,
        format: 'DD/MM/YYYY',
      },
    } as unknown as TextItemProperties;

    const dummyProd: ProductRecord = {
      id: 'p4',
      ITEMNAME: 'Fromage Frais',
      SELLING_PRICE: 2.5,
    };

    const dlcRes = PricingEngine.resolveCalculatedText(itemDlc, dummyProd);
    expect(dlcRes).toContain("À consommer jusqu'au :");

    const itemDluo: TextItemProperties = {
      ...itemDlc,
      dynamic_date_config: {
        ...itemDlc.dynamic_date_config!,
        date_type: 'dluo',
      },
    };
    const dluoRes = PricingEngine.resolveCalculatedText(itemDluo, dummyProd);
    expect(dluoRes).toContain("À consommer de préférence avant le :");

    const itemFab: TextItemProperties = {
      ...itemDlc,
      dynamic_date_config: {
        ...itemDlc.dynamic_date_config!,
        date_type: 'fab_date',
      },
    };
    const fabRes = PricingEngine.resolveCalculatedText(itemFab, dummyProd);
    expect(fabRes).toContain("Emballé le :");
  });

  it('resolveBarcodeValue and resolveQrContent only return sample values when sample: true', () => {
    const barcodeItem = {
      binding_key: 'PRODUCT_SCAN',
      code: '3250390123456',
    };

    // No record, sample: false -> empty string
    expect(PricingEngine.resolveBarcodeValue(barcodeItem, null, { sample: false })).toBe('');
    // No record, sample: true -> returns code
    expect(PricingEngine.resolveBarcodeValue(barcodeItem, null, { sample: true })).toBe('3250390123456');

    // With real product
    const prodWithScan: ProductRecord = {
      id: 'p5',
      ITEMNAME: 'Article avec scan',
      SELLING_PRICE: 5.0,
      PRODUCT_SCAN: '4006381333931',
    };
    expect(PricingEngine.resolveBarcodeValue(barcodeItem, prodWithScan, { sample: false })).toBe('4006381333931');
    expect(PricingEngine.resolveBarcodeValue(
      { code: barcodeItem.code, use_static_value: true },
      { id: 'p6', ITEMNAME: 'Imported static barcode', PRODUCT_SCAN: '4006381333931' },
      { sample: false }
    )).toBe('3250390123456');
  });

  it('secondary_currency returns empty string if exchange rate is missing or zero on real product', () => {
    const itemWithoutRate = {
      id: 'sec_curr',
      type: 'text',
      x_mm: 5,
      y_mm: 5,
      w_mm: 40,
      h_mm: 10,
      text: '',
      calculation_mode: 'secondary_currency',
      secondary_currency_config: {
        enabled: true,
        target_currency: 'EUR',
        exchange_rate: 0,
        mode: 'divide',
      },
    } as unknown as TextItemProperties;

    const realProduct: ProductRecord = {
      id: 'prod_fcfa',
      ITEMNAME: 'Article Local',
      SELLING_PRICE: 6500,
    };

    // Zero rate -> empty string, never defaults to 655.957
    expect(PricingEngine.resolveCalculatedText(itemWithoutRate, realProduct)).toBe('');

    // Valid configured rate -> converted string
    const itemWithRate = {
      ...itemWithoutRate,
      secondary_currency_config: {
        enabled: true,
        target_currency: 'EUR',
        exchange_rate: 655.957,
        mode: 'divide',
      },
    } as unknown as TextItemProperties;
    const res = PricingEngine.resolveCalculatedText(itemWithRate, realProduct);
    expect(res).toContain('EUR');
    expect(res).toContain('9,91');
  });
});
