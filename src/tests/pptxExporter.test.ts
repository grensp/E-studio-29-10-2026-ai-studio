import { describe, expect, it } from 'vitest';
import { ImpositionCalculation, ImpositionConfig, LabelTemplate } from '../types';
import { PptxExporter } from '../utils/pptxExporter';

describe('PptxExporter guards', () => {
  const template: LabelTemplate = {
    id: 'pptx-guard-template',
    name: 'PPTX guard',
    revision: 1,
    schema_version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    width_mm: 300,
    height_mm: 40,
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
  const invalidImposition: ImpositionCalculation = {
    page_w_mm: 210,
    page_h_mm: 297,
    cols: 0,
    rows: 0,
    total_per_page: 0,
    horizontal_offset_mm: 0,
    vertical_offset_mm: 0,
    label_total_w_mm: 300,
    label_total_h_mm: 40,
    fits_on_page: false,
  };

  it('rejects an impossible sheet layout before creating an export', async () => {
    await expect(
      PptxExporter.exportToPptx(
        template,
        [{ id: 'product', ITEMNAME: 'Product' }],
        invalidImposition,
        config
      )
    ).rejects.toThrow('The label does not fit on the selected page.');
  });
});
