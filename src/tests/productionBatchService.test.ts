import { describe, expect, it } from 'vitest';
import { prepareProductionBatchWithRules } from '../services/productionBatchService';
import type { LabelTemplate, ProductRecord } from '../types';

const template: LabelTemplate = {
  id: 'batch-service-template',
  revision: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  schema_version: 1,
  name: 'Batch service test',
  width_mm: 50,
  height_mm: 30,
  inner_margins_mm: { top: 0, right: 0, bottom: 0, left: 0 },
  outer_margins_mm: { top: 0, right: 0, bottom: 0, left: 0 },
  bg_color: '#FFFFFF',
  bg_opacity: 1,
  items: [],
};

const product: ProductRecord = {
  id: 'batch-service-product',
  ITEMNAME: 'Sample',
  SELLING_PRICE: 2.5,
};

describe('production batch service', () => {
  it('prepares products, templates, audit snapshots, and rules as one batch result', () => {
    const batch = prepareProductionBatchWithRules(template, [product], [], 'pdf', 300, '2026-10-28T00:00:00.000Z');

    expect(batch.products).toHaveLength(1);
    expect(batch.products[0]).toMatchObject({ id: product.id, ITEMNAME: product.ITEMNAME });
    expect(batch.templates).toEqual([template]);
    expect(batch.audits).toHaveLength(1);
    expect(batch.rules).toEqual([]);
  });
});
