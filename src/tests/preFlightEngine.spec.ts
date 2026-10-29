import { describe, it, expect } from 'vitest';
import { PreFlightEngine } from '../utils/preFlightEngine';
import { LabelTemplate, ProductRecord } from '../types';

describe('PreFlightEngine Specification Tests', () => {
  const baseTemplate: LabelTemplate = {
    id: 'tpl_test',
    name: 'Gabarit Test',
    revision: 1,
    schema_version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    width_mm: 100,
    height_mm: 50,
    inner_margins_mm: { top: 2, bottom: 2, left: 2, right: 2 },
    outer_margins_mm: { top: 0, bottom: 0, left: 0, right: 0 },
    bg_color: '#FFFFFF',
    bg_opacity: 1,
    items: [],
  };

  const sampleProduct: ProductRecord = {
    id: 'prod_1',
    ITEMNAME: 'Article Test',
    SELLING_PRICE: 19.99,
    PRODUCT_SCAN: '3017620422003', // Valid Ferrero Nutella EAN-13
  };

  it('EAN sans clé rejeté', () => {
    // EAN-13 with invalid check digit: 3017620422000 (correct checksum is 3)
    const tpl: LabelTemplate = {
      ...baseTemplate,
      items: [
        {
          id: 'bc_invalid',
          type: 'barcode',
          x_mm: 10,
          y_mm: 10,
          w_mm: 35,
          h_mm: 15,
          rotation: 0,
          z_index: 1,
          locked: false,
          barcode_type: 'ean13',
          binding_key: 'PRODUCT_SCAN',
          code: '3017620422000',
          show_text: true,
          bar_color: '#000000',
        },
        {
          id: 'price_item',
          type: 'price_block',
          x_mm: 10,
          y_mm: 30,
          w_mm: 30,
          h_mm: 15,
          rotation: 0,
          z_index: 2,
          locked: false,
          binding_key: 'SELLING_PRICE',
          integer_style: { font_size_pt: 20 },
          decimal_style: { font_size_pt: 10 },
        },
      ],
    };

    const badProduct: ProductRecord = {
      ...sampleProduct,
      PRODUCT_SCAN: '3017620422000', // Invalid check digit
    };

    const report = PreFlightEngine.analyzeTemplate(tpl, badProduct, 'pdf');
    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.id.startsWith('ean_invalid_'))).toBe(true);
  });

  it('validates the active export imposition and blocks visual-only finishing effects', () => {
    const template: LabelTemplate = {
      ...baseTemplate,
      width_mm: 300,
      items: [{
        id: 'finish-only',
        type: 'shape',
        x_mm: 0,
        y_mm: 0,
        w_mm: 10,
        h_mm: 10,
        rotation: 0,
        z_index: 0,
        locked: false,
        finish_effect: 'die_cut',
      } as any],
    };
    const activeConfig = {
      page_size: 'A4' as const,
      orientation: 'portrait' as const,
      gap_mm: 0,
      show_cut_marks: false,
    };

    const report = PreFlightEngine.analyzeTemplate(template, sampleProduct, 'pdf', activeConfig);
    expect(report.issues.map((issue) => issue.id)).toContain('imposition_page_overflow');
    expect(report.issues.map((issue) => issue.id)).toContain('unsupported_finish_pdf_finish-only');
    expect(report.passed).toBe(false);
  });

  it('EAN de démo absent lors de l export', () => {
    const tpl: LabelTemplate = {
      ...baseTemplate,
      items: [
        {
          id: 'bc_demo',
          type: 'barcode',
          x_mm: 10,
          y_mm: 10,
          w_mm: 35,
          h_mm: 15,
          rotation: 0,
          z_index: 1,
          locked: false,
          barcode_type: 'ean13',
          binding_key: 'PRODUCT_SCAN',
          code: '3250390123456',
          show_text: true,
          bar_color: '#000000',
        },
        {
          id: 'price_item',
          type: 'price_block',
          x_mm: 10,
          y_mm: 30,
          w_mm: 30,
          h_mm: 15,
          rotation: 0,
          z_index: 2,
          locked: false,
          binding_key: 'SELLING_PRICE',
          integer_style: { font_size_pt: 20 },
          decimal_style: { font_size_pt: 10 },
        },
      ],
    };

    // Product without barcode
    const emptyScanProduct: ProductRecord = {
      id: 'prod_no_scan',
      ITEMNAME: 'Article Sans Scan',
      SELLING_PRICE: 10.0,
    };

    const report = PreFlightEngine.analyzeTemplate(tpl, emptyScanProduct, 'pdf');
    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.id.startsWith('empty_barcode_'))).toBe(true);
  });

  it('export avec price_block autorisé', () => {
    const tpl: LabelTemplate = {
      ...baseTemplate,
      items: [
        {
          id: 'price_item',
          type: 'price_block',
          x_mm: 10,
          y_mm: 10,
          w_mm: 35,
          h_mm: 20,
          rotation: 0,
          z_index: 1,
          locked: false,
          binding_key: 'SELLING_PRICE',
          currency_symbol: '€',
          integer_style: { font_size_pt: 24, font_weight: 'bold' },
          decimal_style: { font_size_pt: 12 },
        },
      ],
    };

    const report = PreFlightEngine.analyzeTemplate(tpl, sampleProduct, 'pdf');
    expect(report.passed).toBe(true);
    expect(report.errorsCount).toBe(0);
  });

  it('export ZPL avec image rejeté', () => {
    const tpl: LabelTemplate = {
      ...baseTemplate,
      items: [
        {
          id: 'img_item',
          type: 'image',
          x_mm: 10,
          y_mm: 10,
          w_mm: 20,
          h_mm: 20,
          rotation: 0,
          z_index: 1,
          locked: false,
          source: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          keep_aspect_ratio: true,
          opacity: 1,
        },
        {
          id: 'price_item',
          type: 'price_block',
          x_mm: 35,
          y_mm: 10,
          w_mm: 30,
          h_mm: 15,
          rotation: 0,
          z_index: 2,
          locked: false,
          binding_key: 'SELLING_PRICE',
          integer_style: { font_size_pt: 18 },
          decimal_style: { font_size_pt: 9 },
        },
      ],
    };

    const report = PreFlightEngine.analyzeTemplate(tpl, sampleProduct, 'zpl');
    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.id === 'zpl_unsupported_img_item')).toBe(true);
  });
});
