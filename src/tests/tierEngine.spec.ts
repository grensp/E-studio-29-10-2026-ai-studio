import { describe, it, expect } from 'vitest';
import { TierEngine } from '../utils/tierEngine';
import { ProductRecord } from '../types';

describe('TierEngine Specification Tests', () => {
  it('price_tiers gagne si les deux tableaux divergent', () => {
    // Record having conflicting price_tiers vs TIERS
    const record: ProductRecord = {
      id: 'prod_divergent',
      ITEMNAME: 'Article Paliers Divergents',
      SELLING_PRICE: 100.0,
      price_tiers: [
        { min_qty: 10, unit_price: 80.0, label: 'Canonique Qty 10' },
        { min_qty: 50, unit_price: 60.0, label: 'Canonique Qty 50' },
      ],
      TIERS: [
        { qty: 10, unit_price: 95.0, label: 'Legacy Qty 10' },
        { qty: 50, unit_price: 90.0, label: 'Legacy Qty 50' },
      ],
    };

    const resolved = TierEngine.resolve(
      {
        primary_index: 0,
        keyword_prefix: 'Par',
        unit_label: '€',
      },
      record
    );

    expect(resolved).not.toBeNull();
    // Canonical price_tiers must win: unit_price 80, not 95
    expect(resolved?.unit_price).toBe(80.0);
    expect(resolved?.qty).toBe(10);
  });
});
