import { ProductRecord, PriceTierBreak, StructureValidationError } from '../types';
import { resolveCanonicalKey } from './mappingDictionary';
import { parsePriceValue } from './priceParser';

export class TierDetectionEngine {
  /**
   * Normalizes a product record or raw database row that might contain:
   * 1. Explicit structure (single-row with tier_1_qty, tier_1_price, etc. or TIERS array)
   * 2. Already populated price_tiers
   */
  static normalizeSingleRow(row: any, fieldMap?: Record<string, string>): ProductRecord {
    const product: ProductRecord = { ...row };

    const detectedTiers: PriceTierBreak[] = [];

    // Check if explicit tier fields exist: tier_1_qty, tier_1_price, tier_2_qty...
    // or tier_qty_1, tier_price_1, etc.
    let index = 1;
    let previousMaximum = 0;
    while (index <= 10) {
      const q =
        (fieldMap?.[`tier_${index}_qty`] ? row[fieldMap[`tier_${index}_qty`]] : undefined) ??
        row[`tier_${index}_qty`] ??
        row[`tier_qty_${index}`] ??
        row[`qty_tier_${index}`] ??
        row[`palier_${index}_qte`];
      const p =
        (fieldMap?.[`tier_${index}_price`] ? row[fieldMap[`tier_${index}_price`]] : undefined) ??
        row[`tier_${index}_price`] ??
        row[`tier_price_${index}`] ??
        row[`price_tier_${index}`] ??
        row[`palier_${index}_prix`];
      const mappedMinimum = fieldMap?.[`tier_${index}_min_qty`]
        ? row[fieldMap[`tier_${index}_min_qty`]]
        : undefined;
      const mappedMaximum = fieldMap?.[`tier_${index}_up_to_qty`]
        ? row[fieldMap[`tier_${index}_up_to_qty`]]
        : undefined;
      const canonicalFields = Object.keys(row).reduce<Record<string, unknown>>((acc, key) => {
        const canonical = resolveCanonicalKey(key);
        const match = canonical?.match(/(?:^|_)(?:TIER|PALIER)_?(\d+)_(QTY|QUANTITY|PRICE|PRIX)$/i);
        if (match && Number(match[1]) === index) {
          acc[match[2].toUpperCase()] = row[key];
        }
        const threshold = canonical?.match(/(?:^|_)(?:TIER|PALIER)_?(\d+)_(MIN_QTY|UP_TO_QTY|MAX_QTY)$/i);
        if (threshold && Number(threshold[1]) === index) acc[threshold[2].toUpperCase()] = row[key];
        return acc;
      }, {});
      const resolvedMinimum = mappedMinimum ?? canonicalFields.MIN_QTY;
      const resolvedMaximum = mappedMaximum ?? canonicalFields.UP_TO_QTY ?? canonicalFields.MAX_QTY;
      const resolvedQty = q ?? canonicalFields.QTY ?? canonicalFields.QUANTITY ?? resolvedMinimum ??
        (resolvedMaximum !== undefined ? previousMaximum + 1 : undefined);
      const resolvedPrice = p ?? canonicalFields.PRICE ?? canonicalFields.PRIX;

      if (resolvedQty !== undefined && resolvedPrice !== undefined && resolvedQty !== null && resolvedPrice !== null) {
        const minQtyResult = parsePriceValue(resolvedQty);
        const priceResult = parsePriceValue(resolvedPrice);
        const maxQtyResult = resolvedMaximum === undefined || resolvedMaximum === null
          ? { status: 'missing' as const }
          : parsePriceValue(resolvedMaximum);
        const minQty = minQtyResult.amount;
        const unitPrice = priceResult.amount;
        const maxQty = maxQtyResult.amount;
        if (minQtyResult.status === 'valid' && priceResult.status === 'valid' &&
            minQty !== undefined && unitPrice !== undefined &&
            maxQtyResult.status !== 'invalid') {
          detectedTiers.push({
            min_qty: minQty,
            max_qty: maxQtyResult.status === 'valid' ? maxQty : undefined,
            unit_price: unitPrice,
            label: maxQtyResult.status === 'valid' && maxQty !== undefined
              ? `${minQty}-${maxQty} Units`
              : minQty === 1 ? 'Base Price' : `${minQty}+ Units`,
            is_base: minQty === 1,
          });
          if (maxQtyResult.status === 'valid' && maxQty !== undefined) previousMaximum = maxQty;
        }
      }
      index++;
    }

    // If explicit tier columns were found, use them
    if (detectedTiers.length > 0) {
      product.price_tiers = detectedTiers;
    } else if (Array.isArray(product.price_tiers) && product.price_tiers.length > 0) {
      // Already has price_tiers
    } else if (Array.isArray(product.TIERS) && product.TIERS.length > 0) {
      // Convert legacy TIERS array
      const tiersConverted: PriceTierBreak[] = product.TIERS.map((t) => ({
        min_qty: t.qty,
        unit_price: t.unit_price,
        label: t.qty === 1 ? 'Base Price' : `${t.qty}+ Units`,
        is_base: t.qty === 1,
      }));

      // Add base price if not present
      if (typeof product.SELLING_PRICE === 'number' && !tiersConverted.some((t) => t.min_qty === 1)) {
        tiersConverted.unshift({
          min_qty: 1,
          unit_price: product.SELLING_PRICE,
          label: 'Base Price',
          is_base: true,
        });
      }
      product.price_tiers = tiersConverted;
    }

    // Sort tiers by quantity
    if (product.price_tiers && product.price_tiers.length > 0) {
      product.price_tiers.sort((a, b) => a.min_qty - b.min_qty);
      
      // Ensure lowest quantity entry is flagged as Base Price
      if (product.price_tiers[0]) {
        product.price_tiers[0].is_base = true;
        if (!product.price_tiers[0].label) {
          product.price_tiers[0].label = 'Base Price';
        }
        if (typeof product.SELLING_PRICE !== 'number' || isNaN(product.SELLING_PRICE)) {
          product.SELLING_PRICE = product.price_tiers[0].unit_price;
        }
      }

      // Sync legacy TIERS
      product.TIERS = product.price_tiers.map((t) => ({
        qty: t.min_qty,
        unit_price: t.unit_price,
      }));
    }

    // Validate structure and anomalies
    product.tier_anomaly = this.validateTierAnomalies(product);

    return product;
  }

  /**
   * Aggregation Pipeline for Implicit Multi-Row Structures:
   * Takes multiple independent rows with the same SKU / EAN, groups them,
   * sorts ascending by quantity, flags Quantity=1 as Base Retail Price,
   * and creates a vector pivot attached to the master product.
   */
  static aggregateImplicitMultiRows(rawRows: any[]): ProductRecord[] {
    const groups: Map<string, any[]> = new Map();
    const mappedValue = (row: any, canonicalKeys: string[], fallbackKeys: string[]): unknown => {
      for (const key of fallbackKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
      }
      for (const key of Object.keys(row)) {
        if (canonicalKeys.includes(resolveCanonicalKey(key) || '') &&
            row[key] !== undefined && row[key] !== null && row[key] !== '') {
          return row[key];
        }
      }
      return undefined;
    };

    // Grouping by SKU/EAN/PARTNO/ID
    for (const row of rawRows) {
      const groupKey = String(mappedValue(
        row,
        ['PRODUCT_SCAN', 'PARTNO'],
        ['PRODUCT_SCAN', 'PARTNO', 'EAN', 'SKU', 'id', 'ITEMNAME']
      ) ?? row.ITEMNAME ?? '').trim();

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(row);
    }

    const aggregatedProducts: ProductRecord[] = [];

    for (const [key, rows] of groups.entries()) {
      if (rows.length === 1) {
        // Single row - normalize directly
        aggregatedProducts.push(this.normalizeSingleRow(rows[0]));
        continue;
      }

      // Multi-row structure detected!
      // Pick first row as master base
      const masterRow = { ...rows[0] };
      const tierMap: Map<number, number[]> = new Map();

      // Collect all quantity-price pairs
      for (const r of rows) {
        const qRaw = mappedValue(r, ['MIN_QTY', 'TIER_QTY'], ['QTY', 'min_qty', 'QUANTITY', 'QTE', 'tier_qty']) ?? 1;
        const pRaw = mappedValue(r, ['SELLING_PRICE', 'TIER_PRICE'], ['SELLING_PRICE', 'UNIT_PRICE', 'PRICE', 'unit_price', 'PRIX']);

        const qResult = parsePriceValue(qRaw);
        const pResult = parsePriceValue(pRaw);
        const q = qResult.status === 'valid' ? qResult.amount : undefined;
        const p = pResult.status === 'valid' ? pResult.amount : undefined;

        if (q !== undefined && p !== undefined && q > 0 && p >= 0) {
          if (!tierMap.has(q)) {
            tierMap.set(q, []);
          }
          tierMap.get(q)!.push(p);
        }
      }

      // Build Vector Pivot
      const priceTiers: PriceTierBreak[] = [];
      const duplicateErrors: string[] = [];

      const sortedQuantities = Array.from(tierMap.keys()).sort((a, b) => a - b);

      for (const qty of sortedQuantities) {
        const prices = tierMap.get(qty)!;
        if (new Set(prices).size > 1) {
          duplicateErrors.push(
            `Quantité ${qty} présente plusieurs prix différents: ${prices.join(', ')}`
          );
        }
        const effectivePrice = prices[0];
        priceTiers.push({
          min_qty: qty,
          unit_price: effectivePrice,
          label: qty === 1 ? 'Base Price' : `${qty}+ Units`,
          is_base: qty === 1,
        });
      }

      // Base price is lowest quantity entry
      if (priceTiers.length > 0) {
        const baseTier = priceTiers[0];
        baseTier.is_base = true;
        baseTier.label = 'Base Price';
        masterRow.SELLING_PRICE = baseTier.unit_price;
      }

      masterRow.price_tiers = priceTiers;
      masterRow.TIERS = priceTiers.map((t) => ({ qty: t.min_qty, unit_price: t.unit_price }));

      const validation = this.validateTierAnomalies(masterRow);
      if (duplicateErrors.length > 0) {
        validation.has_error = true;
        validation.issues.push(...duplicateErrors);
      }
      masterRow.tier_anomaly = validation;

      aggregatedProducts.push(masterRow);
    }

    return aggregatedProducts;
  }

  /**
   * Structure Validation & Anomaly Detection:
   * - Missing quantities (null, 0 or negative)
   * - Overlapping tiers (duplicate quantities)
   * - Inverted tier pricing (higher quantity costs MORE per unit than lower quantity)
   */
  static validateTierAnomalies(product: ProductRecord): StructureValidationError {
    const issues: string[] = [];
    const tiers = product.price_tiers;

    if (!tiers || tiers.length === 0) {
      return { has_error: false, issues: [] };
    }

    const seenQuantities = new Set<number>();

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];

      // Missing or invalid quantity
      if (tier.min_qty === undefined || tier.min_qty === null || isNaN(tier.min_qty) || tier.min_qty <= 0) {
        issues.push(`Palier #${i + 1}: Quantité manquante ou invalide (<= 0).`);
      }
      if (tier.max_qty !== undefined && (
        isNaN(tier.max_qty) || tier.max_qty < tier.min_qty
      )) {
        issues.push(`Palier #${i + 1}: Quantité maximale invalide (${tier.max_qty}).`);
      }

      // Missing or invalid price
      if (tier.unit_price === undefined || tier.unit_price === null || isNaN(tier.unit_price) || tier.unit_price < 0) {
        issues.push(`Palier #${i + 1}: Prix unitaire manquant ou négatif.`);
      }

      // Overlapping / duplicate quantities
      if (seenQuantities.has(tier.min_qty)) {
        issues.push(`Palier #${i + 1}: Quantité en doublon (${tier.min_qty} unités).`);
      } else {
        seenQuantities.add(tier.min_qty);
      }

      // Step progression anomaly (price should decrease or stay equal as quantity increases)
      if (i > 0) {
        const prevTier = tiers[i - 1];
        if (prevTier.max_qty !== undefined && tier.min_qty <= prevTier.max_qty) {
          issues.push(`Palier #${i + 1}: Seuil chevauchant (${tier.min_qty} est inférieur ou égal à ${prevTier.max_qty}).`);
        }
        if (tier.min_qty > prevTier.min_qty && tier.unit_price > prevTier.unit_price) {
          issues.push(
            `Incohérence tarifaire : Le prix unitaire augmente à ${tier.min_qty} unités (${tier.unit_price}) par rapport à ${prevTier.min_qty} unités (${prevTier.unit_price}).`
          );
        }
      }
    }

    return {
      has_error: issues.length > 0,
      issues,
    };
  }

  /**
   * Helper to recalculate and fix anomalous tiers manually in overriding grid
   */
  static applyManualFixes(
    product: ProductRecord,
    updatedTiers: PriceTierBreak[]
  ): ProductRecord {
    const sorted = [...updatedTiers].sort((a, b) => a.min_qty - b.min_qty);
    if (sorted.length > 0) {
      sorted[0].is_base = true;
      sorted[0].label = 'Base Price';
    }

    const updated: ProductRecord = {
      ...product,
      price_tiers: sorted,
      TIERS: sorted.map((t) => ({ qty: t.min_qty, unit_price: t.unit_price })),
      SELLING_PRICE: sorted.length > 0 && sorted[0].min_qty === 1 ? sorted[0].unit_price : product.SELLING_PRICE,
    };

    updated.tier_anomaly = this.validateTierAnomalies(updated);
    return updated;
  }
}
