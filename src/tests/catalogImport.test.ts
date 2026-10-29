import { describe, expect, it } from 'vitest';
import { applyCatalogImport, normalizeCatalogProduct, prepareCatalogImport } from '../utils/catalogImport';

const headers = ['Nom', 'Code-barres', 'Référence', 'Prix', 'Promo'];
const mappings = {
  ITEMNAME: 'Nom',
  PRODUCT_SCAN: 'Code-barres',
  PARTNO: 'Référence',
  SELLING_PRICE: 'Prix',
  PROMOPRICE: 'Promo',
};

describe('prepareCatalogImport', () => {
  it('normalizes valid currency strings and rejects malformed or negative prices', () => {
    expect(normalizeCatalogProduct({ id: 'p1', ITEMNAME: 'Product', SELLING_PRICE: '12,50 €' } as any).SELLING_PRICE).toBe(12.5);
    expect(() => normalizeCatalogProduct({ id: 'p2', ITEMNAME: 'Bad', SELLING_PRICE: 'abc' } as any)).toThrow(/invalid SELLING_PRICE/);
    expect(() => normalizeCatalogProduct({ id: 'p3', ITEMNAME: 'Negative', SELLING_PRICE: -1 })).toThrow(/invalid SELLING_PRICE/);
  });

  it('falls back to a barcode or part number when the product id is blank', () => {
    expect(normalizeCatalogProduct({ id: '   ', ITEMNAME: 'Product', PRODUCT_SCAN: '00123' }).id).toBe('scan:00123');
    expect(normalizeCatalogProduct({ id: '', ITEMNAME: 'Product', PARTNO: 'SKU-1' }).id).toBe('part:SKU-1');
  });

  it('parses locale currency prices and preserves matched product identity', () => {
    const existing = [{ id: 'existing-1', ITEMNAME: 'Old name', PRODUCT_SCAN: '00123', PARTNO: 'SKU-1', SELLING_PRICE: 10 }];
    const result = prepareCatalogImport(headers, [['New name', '00123', 'SKU-1', '12,50 €', '9,99 €']], mappings, existing);

    expect(result.issues).toEqual([]);
    expect(result.products[0]).toMatchObject({
      id: 'existing-1',
      SELLING_PRICE: 12.5,
      PROMOPRICE: 9.99,
    });
    expect(result.collisions[0].id).toBe('existing-1');
  });

  it('collapses mapped repeated quantity and price rows into one product with price tiers', () => {
    const headersWithQty = [...headers, 'Quantité palier'];
    const mappingsWithQty = { ...mappings, TIER_QTY: 'Quantité palier' };
    const result = prepareCatalogImport(
      headersWithQty,
      [
        ['Product', '00123', 'SKU-1', '10,00 €', '', '1'],
        ['Product', '00123', 'SKU-1', '8,50 €', '', '5'],
      ],
      mappingsWithQty,
      []
    );

    expect(result.issues).toEqual([]);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].price_tiers).toMatchObject([
      { min_qty: 1, unit_price: 10 },
      { min_qty: 5, unit_price: 8.5 },
    ]);
  });

  it('namespaces new barcode and part-number identities and rejects conflicting existing matches', () => {
    const existing = [
      { id: 'scan-product', ITEMNAME: 'Scan match', PRODUCT_SCAN: '100', SELLING_PRICE: 1 },
      { id: 'part-product', ITEMNAME: 'Part match', PARTNO: 'SKU-1', SELLING_PRICE: 2 },
    ];
    const result = prepareCatalogImport(
      headers,
      [
        ['New barcode', '200', '', '3.00', ''],
        ['New part', '', '200', '4.00', ''],
        ['Ambiguous', '100', 'SKU-1', '5.00', ''],
      ],
      mappings,
      existing
    );

    expect(result.products[0].id).toBe('scan:200');
    expect(result.products[1].id).toBe('part:200');
    expect(result.issues).toContain('Ligne 4: Le code-barres et la référence correspondent à deux articles différents');
  });

  it('reports invalid prices and missing catalog identity instead of converting them to zero', () => {
    const result = prepareCatalogImport(headers, [['Product', '', '', 'bad price', '']], mappings, []);

    expect(result.issues).toEqual([
      'Ligne 2: Code-barres ou référence article obligatoire',
      'Ligne 2: Prix invalide "bad price"',
    ]);
    expect(result.products[0].SELLING_PRICE).toBeUndefined();
  });

  it('reports duplicate identifiers within one import file', () => {
    const result = prepareCatalogImport(
      headers,
      [
        ['First', '123', 'SKU-1', '1.00', ''],
        ['Second', '123', 'SKU-2', '2.00', ''],
      ],
      mappings,
      []
    );

    expect(result.issues).toContain('Ligne 3: Code-barres ou référence en doublon dans le fichier');
  });

  it('applies overwrite and keep-existing decisions by stable product id', () => {
    const existing = [
      { id: 'product-1', ITEMNAME: 'Old name', PRODUCT_SCAN: '123', SELLING_PRICE: 10, DEPT_NAME: 'Fresh' },
    ];
    const incoming = [{ id: 'product-1', ITEMNAME: 'New name' }];

    const overwritten = applyCatalogImport(existing, incoming, 'merge_update');
    expect(overwritten.products[0]).toMatchObject({
      ITEMNAME: 'New name',
      SELLING_PRICE: 10,
      DEPT_NAME: 'Fresh',
    });
    expect(overwritten.toPersist[0]).toMatchObject({ SELLING_PRICE: 10, DEPT_NAME: 'Fresh' });

    const kept = applyCatalogImport(existing, incoming, 'review_collisions', new Set(['product-1']));
    expect(kept.products[0]).toEqual(existing[0]);
    expect(kept.toPersist).toEqual([]);
  });

  it('deduplicates repeated incoming ids before merge and keeps a single persisted row', () => {
    const existing = [{ id: 'product-1', ITEMNAME: 'Old name', SELLING_PRICE: 10 }];
    const incoming = [
      { id: 'product-1', ITEMNAME: 'First update', SELLING_PRICE: 11 },
      { id: 'product-1', ITEMNAME: 'Second update', SELLING_PRICE: 12 },
    ];

    const result = applyCatalogImport(existing, incoming, 'merge_update');

    expect(result.products).toHaveLength(1);
    expect(result.toPersist).toHaveLength(1);
    expect(result.products[0]).toMatchObject({ id: 'product-1', ITEMNAME: 'Second update', SELLING_PRICE: 12 });
  });
});