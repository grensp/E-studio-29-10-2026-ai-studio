import { describe, it, expect } from 'vitest';
import { ZplExporter } from '../utils/zplExporter';
import { LabelTemplate, ProductRecord, TemplateItem } from '../types';

describe('ZplExporter Unit Tests', () => {
  const template: LabelTemplate = {
    id: 'zpl_tpl',
    name: 'Gabarit Thermique',
    revision: 1,
    schema_version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    width_mm: 50,
    height_mm: 30,
    inner_margins_mm: { top: 1, bottom: 1, left: 1, right: 1 },
    outer_margins_mm: { top: 0, bottom: 0, left: 0, right: 0 },
    bg_color: '#ffffff',
    bg_opacity: 1,
    items: [
      {
        id: 'price',
        type: 'text',
        x_mm: 5,
        y_mm: 5,
        w_mm: 40,
        h_mm: 10,
        text: '5,00 €',
        is_price: true,
        binding_key: 'SELLING_PRICE',
      } as unknown as TemplateItem,
      {
        id: 'barcode',
        type: 'barcode',
        x_mm: 5,
        y_mm: 15,
        w_mm: 35,
        h_mm: 12,
        binding_key: 'PRODUCT_SCAN',
        barcode_type: 'ean13',
      } as unknown as TemplateItem,
    ],
  };

  const product: ProductRecord = {
    id: 'zpl_prod',
    ITEMNAME: 'Café Bio 250g',
    SELLING_PRICE: 4.95,
    PRODUCT_SCAN: '3017620422003', // valid EAN
  };

  it('includes ^CI28 for UTF-8 support in generated ZPL', () => {
    const zpl = ZplExporter.generateLabelZpl(template, product, { dpi: 203 });
    expect(zpl).toContain('^CI28');
  });

  it('escapes special characters using ^FH', () => {
    const templateSpecial: LabelTemplate = {
      ...template,
      items: [
        {
          id: 'text_special',
          type: 'text',
          x_mm: 5,
          y_mm: 5,
          w_mm: 40,
          h_mm: 10,
          text: 'Thé & Café ^ ~ _',
        } as unknown as TemplateItem,
      ],
    };

    const zpl = ZplExporter.generateLabelZpl(templateSpecial, product, { dpi: 203 });
    expect(zpl).toContain('^FH');
    expect(zpl).not.toContain('Thé & Café ^ ~ _');
  });

  it('does not invent barcode or sample data when product barcode is missing', () => {
    const productNoScan: ProductRecord = {
      id: 'no_scan',
      ITEMNAME: 'Sans Code',
      SELLING_PRICE: 10,
    };

    const zpl = ZplExporter.generateLabelZpl(template, productNoScan, { dpi: 203 });
    // Should not include dummy barcode like 3250390123456 or 1234567890128
    expect(zpl).not.toContain('3250390123456');
    expect(zpl).not.toContain('1234567890128');
  });

  it('emits elements in visual z-index order without mutating the template', () => {
    const visuallyOrderedTemplate: LabelTemplate = {
      ...template,
      items: [
        {
          id: 'top',
          type: 'text',
          x_mm: 1,
          y_mm: 1,
          w_mm: 20,
          h_mm: 8,
          rotation: 0,
          z_index: 9,
          locked: false,
          text: 'TOP LAYER',
          font_family: 'A',
          font_size_pt: 10,
          font_weight: 'normal',
          font_style: 'normal',
          text_decoration: 'none',
          text_color: '#000000',
          alignment: 'left',
          valign: 'top',
          wrap: false,
          overflow: 'clip',
        },
        {
          id: 'bottom',
          type: 'text',
          x_mm: 1,
          y_mm: 1,
          w_mm: 20,
          h_mm: 8,
          rotation: 0,
          z_index: 1,
          locked: false,
          text: 'BOTTOM LAYER',
          font_family: 'A',
          font_size_pt: 10,
          font_weight: 'normal',
          font_style: 'normal',
          text_decoration: 'none',
          text_color: '#000000',
          alignment: 'left',
          valign: 'top',
          wrap: false,
          overflow: 'clip',
        },
      ],
    };
    const originalOrder = visuallyOrderedTemplate.items.map((item) => item.id);
    const zpl = ZplExporter.generateLabelZpl(visuallyOrderedTemplate, product, { dpi: 203 });

    expect(zpl.indexOf('BOTTOM LAYER')).toBeLessThan(zpl.indexOf('TOP LAYER'));
    expect(visuallyOrderedTemplate.items.map((item) => item.id)).toEqual(originalOrder);
  });
});
