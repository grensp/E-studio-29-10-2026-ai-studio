import { describe, it, expect } from 'vitest';
import { PricingEngine } from '../utils/pricingEngine';
import { ProductRecord, TextItemProperties } from '../types';

describe('PricingEngine Specification Tests', () => {
  it("pas de '-20%' sans promo", () => {
    const item: TextItemProperties = {
      id: 'txt_discount',
      type: 'text',
      x_mm: 10,
      y_mm: 10,
      w_mm: 30,
      h_mm: 10,
      rotation: 0,
      z_index: 1,
      locked: false,
      text: '',
      font_family: 'Arial',
      font_size_pt: 12,
      font_weight: 'normal',
      font_style: 'normal',
      text_decoration: 'none',
      text_color: '#000000',
      alignment: 'left',
      valign: 'top',
      wrap: false,
      overflow: 'clip',
      calculation_mode: 'discount_pct',
    };

    // Product with standard selling price only, no promo
    const product: ProductRecord = {
      id: 'prod_1',
      ITEMNAME: 'Article Standard',
      SELLING_PRICE: 15.0,
    };

    const result = PricingEngine.resolveCalculatedText(item, product);
    expect(result).toBe('');
    expect(result).not.toBe('-20%');
  });

  it('pas de FCFA au-dessus de 500 si le symbole est €', () => {
    const item: TextItemProperties = {
      id: 'txt_unit_price',
      type: 'text',
      x_mm: 10,
      y_mm: 10,
      w_mm: 30,
      h_mm: 10,
      rotation: 0,
      z_index: 1,
      locked: false,
      text: '',
      font_family: 'Arial',
      font_size_pt: 12,
      font_weight: 'normal',
      font_style: 'normal',
      text_decoration: 'none',
      text_color: '#000000',
      alignment: 'left',
      valign: 'top',
      wrap: false,
      overflow: 'clip',
      currency_symbol: '€',
      calculation_mode: 'unit_price',
      unit_price_config: {
        enabled: true,
        weight_volume_key: 'NET_WEIGHT_KG',
        measure_unit: 'kg',
      },
    };

    const product: ProductRecord = {
      id: 'prod_expensive',
      ITEMNAME: 'Article Luxe',
      SELLING_PRICE: 600.0,
      NET_WEIGHT_KG: 1.0,
    };

    const result = PricingEngine.resolveCalculatedText(item, product);
    expect(result).toContain('€');
    expect(result).not.toContain('FCFA');
    expect(result).not.toContain('CFA');
  });

  it("splitPrice(10, ',', 0) pour le FCFA", () => {
    const decimals = PricingEngine.getDecimalsForCurrency('FCFA');
    expect(decimals).toBe(0);

    const split = PricingEngine.splitPrice(10, ',', 0);
    expect(split.integerPart).toBe('10');
    expect(split.decimalPart).toBe('');
    expect(split.hasDecimals).toBe(false);
  });

  it('has_tiers avec seulement price_tiers', () => {
    const item: TextItemProperties = {
      id: 'txt_tiers_check',
      type: 'text',
      x_mm: 10,
      y_mm: 10,
      w_mm: 30,
      h_mm: 10,
      rotation: 0,
      z_index: 1,
      locked: false,
      text: 'Paliers disponibles',
      font_family: 'Arial',
      font_size_pt: 12,
      font_weight: 'normal',
      font_style: 'normal',
      text_decoration: 'none',
      text_color: '#000000',
      alignment: 'left',
      valign: 'top',
      wrap: false,
      overflow: 'clip',
      conditional_display: {
        enabled: true,
        rule: 'has_tiers',
      },
    };

    const productWithOnlyPriceTiers: ProductRecord = {
      id: 'prod_tiers',
      ITEMNAME: 'Article Paliers',
      SELLING_PRICE: 20.0,
      price_tiers: [
        { min_qty: 5, unit_price: 18.0 },
        { min_qty: 10, unit_price: 15.0 },
      ],
      // TIERS is strictly undefined
    };

    const displayed = PricingEngine.shouldDisplayItem(item, productWithOnlyPriceTiers);
    expect(displayed).toBe(true);
  });

  it('promo hors dates masquée', () => {
    const item: TextItemProperties = {
      id: 'txt_promo_check',
      type: 'text',
      x_mm: 10,
      y_mm: 10,
      w_mm: 30,
      h_mm: 10,
      rotation: 0,
      z_index: 1,
      locked: false,
      text: 'PROMO ACTIVE',
      font_family: 'Arial',
      font_size_pt: 12,
      font_weight: 'normal',
      font_style: 'normal',
      text_decoration: 'none',
      text_color: '#000000',
      alignment: 'left',
      valign: 'top',
      wrap: false,
      overflow: 'clip',
      conditional_display: {
        enabled: true,
        rule: 'has_promo',
      },
    };

    // Past promo that has already expired
    const expiredPromoProduct: ProductRecord = {
      id: 'prod_expired_promo',
      ITEMNAME: 'Promo Expirée',
      SELLING_PRICE: 20.0,
      PROMOPRICE: 15.0,
      PROMO_START_DATE: '2020-01-01',
      PROMO_END_DATE: '2020-01-10',
    };

    const shouldDisplay = PricingEngine.shouldDisplayItem(item, expiredPromoProduct);
    expect(shouldDisplay).toBe(false);

    // Resolving promo price directly must return missing
    const resolvedPromo = PricingEngine.resolvePromoPrice(expiredPromoProduct);
    expect(resolvedPromo.status).toBe('missing');
  });

  it('code-barres vide sans sample', () => {
    const barcodeItem = {
      id: 'bc_1',
      type: 'barcode' as const,
      x_mm: 10,
      y_mm: 10,
      w_mm: 40,
      h_mm: 15,
      rotation: 0,
      z_index: 1,
      locked: false,
      barcode_type: 'ean13' as const,
      binding_key: 'PRODUCT_SCAN',
      code: '3250390123456',
      show_text: true,
      bar_color: '#000000',
    };

    const emptyProduct: ProductRecord = {
      id: 'prod_no_scan',
      ITEMNAME: 'Sans Code Barres',
      SELLING_PRICE: 5.0,
      // No scan, no barcode, no partno
    };

    // Without sample: false (export mode)
    const valExport = PricingEngine.resolveBarcodeValue(barcodeItem, emptyProduct, { sample: false });
    expect(valExport).toBe('');
    expect(valExport).not.toBe('3250390123456');

    // With sample: true (screen design mode)
    const valSample = PricingEngine.resolveBarcodeValue(barcodeItem, emptyProduct, { sample: true });
    expect(valSample).toBe('3250390123456');
  });
});
