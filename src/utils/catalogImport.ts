import { ProductRecord } from '../types';
import { parsePriceValue } from './priceParser';
import { TierDetectionEngine } from './tierDetectionEngine';

export interface CatalogImportCollision {
  id: string;
  key: string;
  existingName: string;
  existingPrice: number;
  incomingName: string;
  incomingPrice: number;
  overwrite: boolean;
}

export interface CatalogImportPreparation {
  products: ProductRecord[];
  collisions: CatalogImportCollision[];
  issues: string[];
}

const normalizeIdentifier = (value: unknown): string => String(value ?? '').trim().toUpperCase();

export function normalizeCatalogProduct(product: ProductRecord): ProductRecord {
  const id = String(product.id ?? '').trim() ||
    (product.PRODUCT_SCAN && `scan:${normalizeIdentifier(product.PRODUCT_SCAN)}`) ||
    (product.PARTNO && `part:${normalizeIdentifier(product.PARTNO)}`) ||
    '';
  if (!id) throw new Error('Every catalog product must have an id, part number, or barcode.');

  const normalized: ProductRecord = { ...product, id };
  (['SELLING_PRICE', 'PROMOPRICE'] as const).forEach((field) => {
    const value = product[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      delete normalized[field];
      return;
    }
    const parsed = parsePriceValue(value);
    if (parsed.status !== 'valid' || parsed.amount === undefined || parsed.amount < 0) {
      throw new Error(`Product "${product.ITEMNAME || id}" has an invalid ${field}.`);
    }
    normalized[field] = parsed.amount;
  });

  return normalized;
}

export function prepareCatalogImport(
  headers: string[],
  rows: unknown[][],
  mappings: Record<string, string>,
  existingProducts: ProductRecord[]
): CatalogImportPreparation {
  const column = (key: string) => headers.indexOf(mappings[key] || '');
  const nameIndex = column('ITEMNAME');
  const scanIndex = column('PRODUCT_SCAN');
  const partIndex = column('PARTNO');
  const priceIndex = column('SELLING_PRICE');
  const promoIndex = column('PROMOPRICE');
  const tierQuantityHeader = mappings.TIER_QTY || mappings.MIN_QTY;
  const tierQuantityIndex = tierQuantityHeader ? headers.indexOf(tierQuantityHeader) : -1;
  const hasMappedImplicitTiers = tierQuantityIndex >= 0 && priceIndex >= 0;
  const explicitTierFieldMap = Object.entries(mappings).reduce<Record<string, string>>((result, [field, header]) => {
    const match = field.toLowerCase().match(/(?:^|_)tier_(\d+)_(qty|min_qty|up_to_qty|max_qty|price)$/);
    if (match) result[`tier_${match[1]}_${match[2]}`] = header;
    return result;
  }, {});
  const scanMap = new Map<string, ProductRecord>();
  const partMap = new Map<string, ProductRecord>();

  existingProducts.forEach((product) => {
    const scan = normalizeIdentifier(product.PRODUCT_SCAN || product.scan);
    const part = normalizeIdentifier(product.PARTNO || product.partno);
    if (scan) scanMap.set(scan, product);
    if (part) partMap.set(part, product);
  });

  const products: ProductRecord[] = [];
  const collisions: CatalogImportCollision[] = [];
  const issues: string[] = [];
  const seenIdentifiers = new Set<string>();

  rows.forEach((row, rowIndex) => {
    if (row.every((value) => value == null || String(value).trim() === '')) return;

    const line = rowIndex + 2;
    const name = String(row[nameIndex] ?? '').trim();
    const barcode = scanIndex >= 0 ? String(row[scanIndex] ?? '').trim() : '';
    const partNumber = partIndex >= 0 ? String(row[partIndex] ?? '').trim() : '';
    if (!name) issues.push(`Ligne ${line}: Désignation manquante`);
    if (!barcode && !partNumber) {
      issues.push(`Ligne ${line}: Code-barres ou référence article obligatoire`);
    }

    const identifiers = [
      barcode && `scan:${normalizeIdentifier(barcode)}`,
      partNumber && `part:${normalizeIdentifier(partNumber)}`,
    ].filter((value): value is string => Boolean(value));
    if (!hasMappedImplicitTiers && identifiers.some((identifier) => seenIdentifiers.has(identifier))) {
      issues.push(`Ligne ${line}: Code-barres ou référence en doublon dans le fichier`);
    }
    identifiers.forEach((identifier) => seenIdentifiers.add(identifier));

    const rawPrice = priceIndex >= 0 ? row[priceIndex] : undefined;
    const parsedPrice = parsePriceValue(rawPrice);
    if (rawPrice != null && String(rawPrice).trim() !== '' && (parsedPrice.status !== 'valid' || (parsedPrice.amount ?? 0) < 0)) {
      issues.push(`Ligne ${line}: Prix invalide "${rawPrice}"`);
    }

    const rawPromo = promoIndex >= 0 ? row[promoIndex] : undefined;
    const parsedPromo = parsePriceValue(rawPromo);
    if (rawPromo != null && String(rawPromo).trim() !== '' && (parsedPromo.status !== 'valid' || (parsedPromo.amount ?? 0) < 0)) {
      issues.push(`Ligne ${line}: Prix promotionnel invalide "${rawPromo}"`);
    }

    const scanMatch = barcode && scanMap.get(normalizeIdentifier(barcode));
    const partMatch = partNumber && partMap.get(normalizeIdentifier(partNumber));
    if (scanMatch && partMatch && scanMatch.id !== partMatch.id) {
      issues.push(`Ligne ${line}: Le code-barres et la référence correspondent à deux articles différents`);
    }
    const match = scanMatch || partMatch;
    const identity = barcode || partNumber;
    if (match) {
      collisions.push({
        id: match.id,
        key: barcode || partNumber,
        existingName: match.ITEMNAME || '',
        existingPrice: Number(match.SELLING_PRICE) || 0,
        incomingName: name,
        incomingPrice: parsedPrice.status === 'valid' ? parsedPrice.amount || 0 : 0,
        overwrite: true,
      });
    }

    const product: ProductRecord = {
      id: match?.id || `${barcode ? 'scan' : 'part'}:${normalizeIdentifier(identity)}`,
      ITEMNAME: name,
    };
    if (scanIndex >= 0 && barcode) product.PRODUCT_SCAN = barcode;
    if (partIndex >= 0 && partNumber) product.PARTNO = partNumber;
    if (parsedPrice.status === 'valid') product.SELLING_PRICE = parsedPrice.amount;
    if (hasMappedImplicitTiers) product.TIER_QTY = row[tierQuantityIndex];
    if (Object.keys(explicitTierFieldMap).length > 0) {
      const rawTierColumns = Object.values(explicitTierFieldMap).reduce<Record<string, unknown>>((values, header) => {
        const index = headers.indexOf(header);
        if (index >= 0) values[header] = row[index];
        return values;
      }, {});
      const normalized = TierDetectionEngine.normalizeSingleRow(
        { ...product, ...rawTierColumns },
        explicitTierFieldMap
      );
      product.price_tiers = normalized.price_tiers;
      product.TIERS = normalized.TIERS;
      product.tier_anomaly = normalized.tier_anomaly;
    }
    if (parsedPromo.status === 'valid') product.PROMOPRICE = parsedPromo.amount;
    const departmentIndex = column('DEPT_NAME');
    if (departmentIndex >= 0) product.DEPT_NAME = String(row[departmentIndex] ?? '').trim() || undefined;
    const categoryIndex = column('CATEGORY_NAME');
    if (categoryIndex >= 0) product.CATEGORY_NAME = String(row[categoryIndex] ?? '').trim() || undefined;
    products.push(product);
  });

  return {
    products: hasMappedImplicitTiers && Object.keys(explicitTierFieldMap).length === 0
      ? TierDetectionEngine.aggregateImplicitMultiRows(products)
      : products,
    collisions,
    issues,
  };
}

export function applyCatalogImport(
  existingProducts: ProductRecord[],
  importedProducts: ProductRecord[],
  mode: 'merge_update' | 'replace' | 'review_collisions',
  skipIds: Set<string> = new Set()
): { products: ProductRecord[]; toPersist: ProductRecord[] } {
  const uniqueImported = new Map<string, ProductRecord>();
  importedProducts.forEach((incoming) => {
    if (!incoming.id) return;
    uniqueImported.set(incoming.id, incoming);
  });

  if (mode === 'replace') {
    return { products: Array.from(uniqueImported.values()), toPersist: Array.from(uniqueImported.values()) };
  }

  const productsById = new Map(existingProducts.map((product) => [product.id, product]));
  const toPersist: ProductRecord[] = [];
  uniqueImported.forEach((incoming) => {
    if (skipIds.has(incoming.id)) return;
    const existing = productsById.get(incoming.id);
    const merged = existing
      ? Object.fromEntries(
          Object.entries({ ...existing, ...incoming }).filter(([, value]) => value !== undefined)
        ) as ProductRecord
      : incoming;
    productsById.set(merged.id, merged);
    toPersist.push(merged);
  });

  return { products: Array.from(productsById.values()), toPersist };
}