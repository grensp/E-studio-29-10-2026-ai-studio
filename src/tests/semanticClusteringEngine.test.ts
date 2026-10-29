import { describe, expect, it } from 'vitest';
import { SemanticClusteringEngine } from '../utils/semanticClusteringEngine';
import { ProductRecord } from '../types';

describe('SemanticClusteringEngine assortment identity safety', () => {
  it('does not copy a member barcode or invent an assortment selling price', () => {
    const products: ProductRecord[] = [
      { id: 'member-1', ITEMNAME: 'Gel Douche Lavande', PRODUCT_SCAN: '3012345678901', SELLING_PRICE: 4 },
      { id: 'member-2', ITEMNAME: 'Gel Douche Rose', PRODUCT_SCAN: '3012345678918', SELLING_PRICE: 8 },
    ];
    const assortment = SemanticClusteringEngine.createManualAssortment(
      products,
      'GEL-GAMME',
      'Gamme gels douche'
    );

    expect(assortment.is_virtual_assortment).toBe(true);
    expect(assortment.PRODUCT_SCAN).toBeUndefined();
    expect(assortment.SELLING_PRICE).toBeUndefined();
    expect(assortment.PROMOPRICE).toBeUndefined();
    expect(assortment.cluster_member_ids).toEqual(['member-1', 'member-2']);
  });

  it('keeps a common explicitly supplied member price without copying member identifiers', () => {
    const products: ProductRecord[] = [
      { id: 'member-1', ITEMNAME: 'Juice Orange', PRODUCT_SCAN: '3012345678901', SELLING_PRICE: 4 },
      { id: 'member-2', ITEMNAME: 'Juice Apple', PRODUCT_SCAN: '3012345678918', SELLING_PRICE: 4 },
    ];
    const assortment = SemanticClusteringEngine.createManualAssortment(
      products,
      'JUICE-GAMME',
      'Gamme jus'
    );

    expect(assortment.PRODUCT_SCAN).toBeUndefined();
    expect(assortment.SELLING_PRICE).toBe(4);
  });

  it('creates automated assortments without reusing member barcodes', () => {
    const assortment = SemanticClusteringEngine.createVirtualAssortmentItem({
      rootName: 'JUICE',
      clusterType: 'flavor',
      items: [
        { id: 'juice-1', ITEMNAME: 'Juice Orange', PRODUCT_SCAN: '3012345678901', SELLING_PRICE: 4 },
        { id: 'juice-2', ITEMNAME: 'Juice Apple', PRODUCT_SCAN: '3012345678918', SELLING_PRICE: 4 },
      ],
      discriminators: ['ORANGE', 'APPLE'],
      sharedPrice: 4,
      isPromoPrice: false,
    });

    expect(assortment.PRODUCT_SCAN).toBeUndefined();
    expect(assortment.SELLING_PRICE).toBe(4);
  });
});
