import { describe, it, expect, vi } from 'vitest';
import jsPDF from 'jspdf';
import { drawPdfItem } from '../render/drawPdfItem';
import { ImpositionConfig, LabelTemplate, PriceBlockItemProperties, ProductRecord } from '../types';
import { renderImposedPdfJob } from '../utils/pdfJobRenderer';

describe('drawPdfItem Specification Tests', () => {
  it('un gabarit fixe avec un price_block produit un PDF dont le texte extrait contient le montant, et ne contient pas le rectangle « PALIERS DE PRIX » ni un unique !', () => {
    const doc = new jsPDF({ unit: 'mm', format: [100, 50] });

    const priceBlockItem: PriceBlockItemProperties = {
      id: 'price_block_fixed',
      type: 'price_block',
      x_mm: 10,
      y_mm: 10,
      w_mm: 40,
      h_mm: 20,
      rotation: 0,
      z_index: 1,
      locked: false,
      binding_key: 'SELLING_PRICE',
      currency_symbol: '€',
      decimal_separator: ',',
      integer_style: { font_size_pt: 24, font_weight: 'bold', text_color: '#000000' },
      decimal_style: { font_size_pt: 12, baseline_shift: 'superscript' },
      currency_style: { font_size_pt: 12 },
    };

    const record: ProductRecord = {
      id: 'prod_99',
      ITEMNAME: 'Article Test Prix',
      SELLING_PRICE: 29.99,
    };

    drawPdfItem(doc, priceBlockItem, 10, 10, record);

    const pdfOutput = doc.output('datauristring');
    // Also extract raw text stream representation
    const rawPdf = doc.output();

    // Check that PDF output stream contains formatted price numbers "29" and "99"
    expect(rawPdf).toContain('29');
    expect(rawPdf).toContain('99');

    // Must NOT contain dummy/error text
    expect(rawPdf).not.toContain('PALIERS DE PRIX');
    // Ensure it's not a single exclamation mark isolated error placeholder
    expect(rawPdf).not.toMatch(/\(!\)\s*Tj/);
  });

  it('renders a tier price in PDF instead of a placeholder', () => {
    const doc = new jsPDF({ unit: 'mm', format: [100, 50] });
    const item = {
      id: 'tier_pdf',
      type: 'tier_price',
      x_mm: 10,
      y_mm: 10,
      w_mm: 45,
      h_mm: 12,
      rotation: 0,
      z_index: 1,
      locked: false,
      primary_tier: 1,
      prefix_text: 'Lot de',
      unit_label: '€',
      strict_required: true,
    } as any;
    const record: ProductRecord = {
      id: 'tier_product',
      ITEMNAME: 'Pack test',
      SELLING_PRICE: 5,
      price_tiers: [{ min_qty: 5, unit_price: 4.5, label: 'Lot de 5' }],
    };

    drawPdfItem(doc, item, 10, 10, record);

    const output = doc.output();
    expect(output).toContain('4,5');
    expect(output).not.toContain('PALIERS DE PRIX');
  });

  it('applies independent segment offsets in millimeters', () => {
    const doc = new jsPDF({ unit: 'mm', format: [100, 50] });
    const textSpy = vi.spyOn(doc, 'text');
    const item: PriceBlockItemProperties = {
      id: 'price-with-child',
      type: 'price_block',
      x_mm: 2,
      y_mm: 2,
      w_mm: 30,
      h_mm: 10,
      rotation: 0,
      z_index: 1,
      locked: false,
      binding_key: 'SELLING_PRICE',
      integer_style: { font_size_pt: 12 },
      decimal_style: { font_size_pt: 8 },
      extensions: [{
        id: 'child',
        role: 'custom',
        anchor: 'above',
        text: 'Child segment',
        offset_x_mm: 1,
        offset_y_mm: 2,
        style: { font_size_pt: 8 },
      }],
    };

    drawPdfItem(doc, item, 10, 10, { id: 'product', ITEMNAME: 'Product', SELLING_PRICE: 12 });

    const childTextCall = textSpy.mock.calls.find(([text]) => text === 'Child segment');
    expect(childTextCall?.[1]).toBe(11);
    expect(childTextCall?.[2]).toBeCloseTo(14.8);
  });

  it('rebuilds imposed PDF jobs from the saved template, products, and sheet configuration', () => {
    const template: LabelTemplate = {
      id: 'job_template',
      name: 'Job template',
      revision: 1,
      schema_version: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      width_mm: 40,
      height_mm: 20,
      inner_margins_mm: { top: 0, bottom: 0, left: 0, right: 0 },
      outer_margins_mm: { top: 0, bottom: 0, left: 0, right: 0 },
      bg_color: '#ffffff',
      bg_opacity: 1,
      items: [
        {
          id: 'job_price',
          type: 'price_block',
          x_mm: 2,
          y_mm: 2,
          w_mm: 30,
          h_mm: 10,
          rotation: 0,
          z_index: 1,
          locked: false,
          binding_key: 'SELLING_PRICE',
          integer_style: { font_size_pt: 12 },
          decimal_style: { font_size_pt: 8 },
        },
      ],
    };
    const config: ImpositionConfig = {
      page_size: 'A6',
      orientation: 'portrait',
      gap_mm: 0,
      show_cut_marks: false,
    };
    const product: ProductRecord = { id: 'job_product', ITEMNAME: 'Job product', SELLING_PRICE: 12.5 };
    const doc = renderImposedPdfJob(template, [product], config);

    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output()).toContain('12,50');
  });

  it('rejects imposed PDF jobs when labels do not fit or no products are supplied', () => {
    const template: LabelTemplate = {
      id: 'oversized_template',
      name: 'Oversized',
      revision: 1,
      schema_version: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      width_mm: 300,
      height_mm: 50,
      inner_margins_mm: { top: 0, bottom: 0, left: 0, right: 0 },
      outer_margins_mm: { top: 0, bottom: 0, left: 0, right: 0 },
      bg_color: '#ffffff',
      bg_opacity: 1,
      items: [],
    };
    const config: ImpositionConfig = {
      page_size: 'A4',
      orientation: 'portrait',
      gap_mm: 0,
      show_cut_marks: false,
    };

    expect(() => renderImposedPdfJob(template, [{ id: 'product', ITEMNAME: 'Product' }], config))
      .toThrow('The label does not fit on the selected page.');
    expect(() => renderImposedPdfJob({ ...template, width_mm: 40 }, [], config))
      .toThrow('The print job has no product snapshot to render.');
  });
});
