import { describe, it, expect } from 'vitest';
import { PreFlightEngine } from '../utils/preFlightEngine';
import { LabelTemplate, ProductRecord, TemplateItem } from '../types';

describe('PreFlightEngine Unit Tests', () => {
  const baseTemplate: LabelTemplate = {
    id: 'test_tpl',
    name: 'Gabarit Test',
    revision: 1,
    schema_version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    width_mm: 100,
    height_mm: 50,
    inner_margins_mm: { top: 2, bottom: 2, left: 2, right: 2 },
    outer_margins_mm: { top: 1, bottom: 1, left: 1, right: 1 },
    bg_color: '#ffffff',
    bg_opacity: 1,
    items: [
      {
        id: 'price1',
        type: 'text',
        x_mm: 10,
        y_mm: 10,
        w_mm: 40,
        h_mm: 15,
        text: '9,99 €',
        font_family: 'Arial',
        font_size_pt: 14,
        font_weight: 'bold',
        font_style: 'normal',
        text_decoration: 'none',
        alignment: 'left',
        valign: 'middle',
        line_height: 1.2,
        letter_spacing_pt: 0,
        word_wrap: true,
        text_color: '#000000',
        rotation: 0,
        is_price: true,
        binding_key: 'SELLING_PRICE',
      } as unknown as TemplateItem,
      {
        id: 'name1',
        type: 'text',
        x_mm: 10,
        y_mm: 30,
        w_mm: 80,
        h_mm: 10,
        text: 'Article Test',
        font_family: 'Arial',
        font_size_pt: 10,
        font_weight: 'normal',
        font_style: 'normal',
        text_decoration: 'none',
        alignment: 'left',
        valign: 'middle',
        line_height: 1.2,
        letter_spacing_pt: 0,
        word_wrap: true,
        text_color: '#000000',
        rotation: 0,
        binding_key: 'ITEMNAME',
      } as unknown as TemplateItem,
    ],
  };

  const sampleProduct: ProductRecord = {
    id: 'prod1',
    ITEMNAME: 'Chocolat Noir',
    SELLING_PRICE: 2.5,
  };

  it('valid template passes preflight with 0 errors (passed === true)', () => {
    const report = PreFlightEngine.analyzeTemplate(baseTemplate, sampleProduct, 'pdf');
    expect(report.passed).toBe(true);
    expect(report.errorsCount).toBe(0);
    expect(report.status).toBe('ready');
  });

  it('allows matrix barcode formats in PDF while continuing to block unsupported ZPL output', () => {
    const gs1QrItem = {
      id: 'gs1-qr-target-test',
      type: 'barcode',
      x_mm: 10,
      y_mm: 10,
      w_mm: 35,
      h_mm: 20,
      rotation: 0,
      z_index: 1,
      locked: false,
      binding_key: 'PRODUCT_SCAN',
      code: '',
      barcode_type: 'gs1_qrcode',
      show_text: false,
      bar_color: '#000000',
    } as unknown as TemplateItem;
    const product = {
      ...sampleProduct,
      PRODUCT_SCAN: '(01)09506000134352(17)250101',
    };
    const template = { ...baseTemplate, items: [...baseTemplate.items, gs1QrItem] };

    const pdfReport = PreFlightEngine.analyzeTemplate(template, product, 'pdf');
    const zplReport = PreFlightEngine.analyzeTemplate(template, product, 'zpl');

    expect(pdfReport.issues.some((issue) => issue.id === 'barcode_target_unsupported_gs1-qr-target-test')).toBe(false);
    expect(zplReport.issues.some((issue) => issue.id === 'barcode_zpl_unsupported_gs1-qr-target-test')).toBe(true);
  });

  it('fails if width_mm or height_mm <= 0', () => {
    const invalidTemplate: LabelTemplate = {
      ...baseTemplate,
      width_mm: 0,
    };
    const report = PreFlightEngine.analyzeTemplate(invalidTemplate, sampleProduct, 'screen');
    expect(report.passed).toBe(false);
    expect(report.errorsCount).toBeGreaterThan(0);
    expect(report.issues.some((i) => i.id === 'invalid_template_dimensions')).toBe(true);
  });

  it('fails if an item dimension w_mm <= 0 or h_mm <= 0', () => {
    const invalidItemTemplate: LabelTemplate = {
      ...baseTemplate,
      items: [
        {
          id: 'bad_item',
          type: 'text',
          x_mm: 10,
          y_mm: 10,
          w_mm: 0,
          h_mm: 10,
          text: 'Zero width',
          is_price: true,
        } as unknown as TemplateItem,
      ],
    };
    const report = PreFlightEngine.analyzeTemplate(invalidItemTemplate, sampleProduct, 'screen');
    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.id.startsWith('zero_dim_'))).toBe(true);
  });

  it('fails if no price element is bound when target is pdf or zpl', () => {
    const noPriceTemplate: LabelTemplate = {
      ...baseTemplate,
      items: [
        {
          id: 'text_only',
          type: 'text',
          x_mm: 10,
          y_mm: 10,
          w_mm: 50,
          h_mm: 10,
          text: 'Seulement du texte',
          binding_key: 'ITEMNAME',
        } as unknown as TemplateItem,
      ],
    };
    const reportScreen = PreFlightEngine.analyzeTemplate(noPriceTemplate, sampleProduct, 'screen');
    expect(reportScreen.passed).toBe(true);
    expect(reportScreen.status).toBe('warning');

    const reportPdf = PreFlightEngine.analyzeTemplate(noPriceTemplate, sampleProduct, 'pdf');
    expect(reportPdf.passed).toBe(false);
    expect(reportPdf.errorsCount).toBeGreaterThan(0);
    expect(reportPdf.issues.some((i) => i.id === 'missing_price')).toBe(true);
  });

  it('blocks a batch when any product has no valid selling price', () => {
    const goodProduct = { ...sampleProduct, PRODUCT_SCAN: '4006381333931' };
    const badProduct = { ...sampleProduct, id: 'prod2', ITEMNAME: 'Produit sans prix', SELLING_PRICE: undefined };
    const report = PreFlightEngine.analyzeBatch(baseTemplate, [goodProduct, badProduct], 'pdf');

    expect(report.passed).toBe(false);
    expect(report.totalProductsChecked).toBe(2);
    expect(report.defectiveProductsCount).toBe(1);
    expect(report.issues.some((issue) => issue.message.includes('Produit sans prix'))).toBe(true);
  });

  it('passes a valid product batch with a bound barcode', () => {
    const template: LabelTemplate = {
      ...baseTemplate,
      items: [
        {
          id: 'barcode1',
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
          code: '',
          show_text: true,
          bar_color: '#000000',
        } as unknown as TemplateItem,
        ...baseTemplate.items,
      ],
    };
    const report = PreFlightEngine.analyzeBatch(template, [
      { ...sampleProduct, PRODUCT_SCAN: '3017620422003' },
    ], 'pdf');

    expect(report.passed).toBe(true);
  });

  it('warns when a linear barcode module is below the conservative print-width threshold', () => {
    const template: LabelTemplate = {
      ...baseTemplate,
      items: [
        {
          id: 'narrow-barcode',
          type: 'barcode',
          x_mm: 10,
          y_mm: 10,
          w_mm: 15,
          h_mm: 15,
          rotation: 0,
          z_index: 1,
          locked: false,
          barcode_type: 'code128',
          code: '123456789012345678901234567890',
          use_static_value: true,
          show_text: false,
          bar_color: '#000000',
        } as unknown as TemplateItem,
        ...baseTemplate.items,
      ],
    };

    const report = PreFlightEngine.analyzeTemplate(template, sampleProduct, 'pdf');

    expect(report.issues).toContainEqual(expect.objectContaining({
      id: 'barcode_min_module_narrow-barcode',
      severity: 'warning',
      category: 'barcode',
    }));
  });

  it('blocks a batch when a strict required price tier is missing', () => {
    const template: LabelTemplate = {
      ...baseTemplate,
      items: [
        ...baseTemplate.items,
        {
          id: 'strict_tier',
          type: 'tier_price',
          x_mm: 10,
          y_mm: 40,
          w_mm: 40,
          h_mm: 8,
          rotation: 0,
          z_index: 3,
          locked: false,
          primary_tier: 1,
          prefix_text: 'Lot de',
          unit_label: '€',
          strict_required: true,
        } as TemplateItem,
      ],
    };
    const report = PreFlightEngine.analyzeBatch(template, [sampleProduct], 'pdf');

    expect(report.passed).toBe(false);
    expect(report.issues.some((issue) => issue.id.startsWith('strict_tier_missing_'))).toBe(true);
  });

  it('fails if element exceeds label outer boundary', () => {
    const overflowTemplate: LabelTemplate = {
      ...baseTemplate,
      items: [
        {
          id: 'price1',
          type: 'text',
          x_mm: 10,
          y_mm: 10,
          w_mm: 40,
          h_mm: 15,
          text: '9,99 €',
          is_price: true,
        } as unknown as TemplateItem,
        {
          id: 'overflow_item',
          type: 'text',
          x_mm: 90,
          y_mm: 40,
          w_mm: 30,
          h_mm: 10,
          text: 'Depassement',
        } as unknown as TemplateItem,
      ],
    };
    const report = PreFlightEngine.analyzeTemplate(overflowTemplate, sampleProduct, 'screen');
    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.id.startsWith('boundary_overflow_'))).toBe(true);
  });

  it('fails for unrepresentable elements on ZPL target', () => {
    const zplTemplateWithRichText: LabelTemplate = {
      ...baseTemplate,
      items: [
        ...baseTemplate.items,
        {
          id: 'rt1',
          type: 'rich_text',
          x_mm: 10,
          y_mm: 35,
          w_mm: 40,
          h_mm: 10,
          default_font_family: 'Arial',
          default_font_size_pt: 10,
          runs: [{ text: 'Texte enrichi', font_size_pt: 10 }],
        } as unknown as TemplateItem,
      ],
    };
    const report = PreFlightEngine.analyzeTemplate(zplTemplateWithRichText, sampleProduct, 'zpl');
    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.id.startsWith('zpl_unsupported_'))).toBe(true);
  });

  it('allows ellipses on ZPL target because they have native graphic output', () => {
    const templateWithEllipse: LabelTemplate = {
      ...baseTemplate,
      items: [
        ...baseTemplate.items,
        {
          id: 'ellipse',
          type: 'ellipse',
          x_mm: 10,
          y_mm: 10,
          w_mm: 12,
          h_mm: 8,
          rotation: 0,
          z_index: 2,
          locked: false,
          fill_color: '#ffffff',
          border_color: '#000000',
          border_width: 0.5,
        },
      ],
    };
    const report = PreFlightEngine.analyzeTemplate(templateWithEllipse, sampleProduct, 'zpl');
    expect(report.issues.some((issue) => issue.id === 'zpl_unsupported_ellipse')).toBe(false);
  });

  it('allows quarter-turned ZPL text and rejects unsupported element rotations', () => {
    const quarterTurnedText = {
      ...baseTemplate,
      items: baseTemplate.items.map((item) => ({ ...item, rotation: 90 })),
    };
    const textReport = PreFlightEngine.analyzeTemplate(quarterTurnedText, sampleProduct, 'zpl');
    expect(textReport.issues.some((issue) => issue.id.startsWith('zpl_unsupported_rotation_'))).toBe(false);

    const freeRotatedText = {
      ...baseTemplate,
      items: baseTemplate.items.map((item) => ({ ...item, rotation: 45 })),
    };
    const freeRotationReport = PreFlightEngine.analyzeTemplate(freeRotatedText, sampleProduct, 'zpl');
    expect(freeRotationReport.issues.some((issue) => issue.id === 'zpl_unsupported_rotation_price1')).toBe(true);

    const templateWithRotatedEllipse: LabelTemplate = {
      ...baseTemplate,
      items: [
        ...baseTemplate.items,
        {
          id: 'rotated_ellipse',
          type: 'ellipse',
          x_mm: 10,
          y_mm: 10,
          w_mm: 12,
          h_mm: 8,
          rotation: 90,
          z_index: 2,
          locked: false,
          fill_color: '#ffffff',
          border_color: '#000000',
          border_width: 0.5,
        },
      ],
    };
    const report = PreFlightEngine.analyzeTemplate(templateWithRotatedEllipse, sampleProduct, 'zpl');
    expect(report.issues).toContainEqual(expect.objectContaining({
      id: 'zpl_unsupported_rotation_rotated_ellipse',
      severity: 'error',
      category: 'compatibility',
    }));
  });

  it('warns when ZPL output flattens line styles or colors', () => {
    const templateWithStyledLine: LabelTemplate = {
      ...baseTemplate,
      items: [
        ...baseTemplate.items,
        {
          id: 'styled_line',
          type: 'line',
          x_mm: 10,
          y_mm: 10,
          w_mm: 20,
          h_mm: 1,
          rotation: 0,
          z_index: 2,
          locked: false,
          color: '#2563eb',
          thickness: 0.5,
          style: 'dashed',
        },
      ],
    };
    const report = PreFlightEngine.analyzeTemplate(templateWithStyledLine, sampleProduct, 'zpl');
    expect(report.issues).toContainEqual(expect.objectContaining({
      id: 'zpl_line_color_styled_line',
      severity: 'warning',
      category: 'compatibility',
    }));
    expect(report.issues).toContainEqual(expect.objectContaining({
      id: 'zpl_line_style_styled_line',
      severity: 'warning',
      category: 'compatibility',
    }));
    expect(report.passed).toBe(true);
  });

  it('warns that ZPL output will ignore item transparency', () => {
    const transparentTemplate: LabelTemplate = {
      ...baseTemplate,
      items: [
        { ...baseTemplate.items[0], id: 'transparent_price', foreground_opacity: 0.5 },
      ],
    };

    const report = PreFlightEngine.analyzeTemplate(transparentTemplate, sampleProduct, 'zpl');
    expect(report.issues).toContainEqual(expect.objectContaining({
      id: 'zpl_transparency_transparent_price',
      severity: 'warning',
      category: 'compatibility',
    }));
    expect(report.passed).toBe(true);
  });

  it('warns when secondary currency conversion has no exchange rate', () => {
    const templateSecCurr: LabelTemplate = {
      ...baseTemplate,
      items: [
        ...baseTemplate.items,
        {
          id: 'sec_curr_txt',
          type: 'text',
          x_mm: 10,
          y_mm: 35,
          w_mm: 40,
          h_mm: 10,
          text: '',
          font_size_pt: 10,
          calculation_mode: 'secondary_currency',
          secondary_currency_config: {
            enabled: true,
            target_currency: 'EUR',
            exchange_rate: 0,
            mode: 'divide',
          },
        } as unknown as TemplateItem,
      ],
    };

    const report = PreFlightEngine.analyzeTemplate(templateSecCurr, sampleProduct, 'screen');
    expect(report.issues.some((i) => i.id === 'missing_exchange_rate_sec_curr_txt')).toBe(true);
  });
});
