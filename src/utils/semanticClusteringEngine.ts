import { ProductRecord } from '../types';

export interface ClusterCandidate {
  rootName: string;
  clusterType: 'flavor' | 'size' | 'scent' | 'mixed';
  items: ProductRecord[];
  discriminators: string[];
  sharedPrice: number;
  isPromoPrice: boolean;
}

// Common discriminators for flavors, scents, sizes, and variants
const FLAVOR_TOKENS = new Set([
  'VANILLE', 'FRAISE', 'CHOCOLAT', 'CITRON', 'ORANGE', 'POMME', 'PECHE', 'PÊCHE',
  'CARAMEL', 'MENTHE', 'NATURE', 'FRAMBOISE', 'BANANE', 'ANANAS', 'MANGUE', 'CERISE',
  'CAFE', 'CAFÉ', 'NOISETTE', 'PISTACHE', 'COCO', 'FRUITS ROUGES', 'BIANCO', 'ROSATO',
  'ROSSO', 'DRY', 'EXTRA DRY', 'BRUT', 'DEMI-SEC', 'SWEET', 'ORIGINAL', 'CLASSIC'
]);

const SCENT_TOKENS = new Set([
  'LAVANDE', 'ALOE VERA', 'AMANDE', 'ROSE', 'JASMIN', 'EUCALYPTUS', 'MUSC',
  'FLEUR D\'ORANGER', 'MONOI', 'ARGAN', 'KARITE', 'KARITÉ', 'MIEL', 'SAVON DE MARSEILLE',
  'OCEAN', 'FRAICHEUR', 'CALENDULA', 'THE VERT', 'THÉ VERT'
]);

const SIZE_TOKENS = new Set([
  '250G', '500G', '750G', '1KG', '2KG', '5KG', '10KG', '25CL', '33CL', '50CL', '75CL',
  '1L', '1.5L', '2L', '5L', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'T1', 'T2', 'T3', 'T4'
]);

export class SemanticClusteringEngine {
  /**
   * Tokenizes a product title and extracts candidate root and discriminator
   */
  static analyzeTitle(title: string): {
    normalizedTokens: string[];
    potentialDiscriminators: { word: string; type: 'flavor' | 'size' | 'scent' }[];
    cleanedRoot: string;
  } {
    const rawUpper = title
      .toUpperCase()
      .replace(/[,;:\(\)\[\]\-\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const tokens = rawUpper.split(' ').filter(Boolean);
    const potentialDiscriminators: { word: string; type: 'flavor' | 'size' | 'scent' }[] = [];
    const rootTokens: string[] = [];

    for (const token of tokens) {
      if (FLAVOR_TOKENS.has(token)) {
        potentialDiscriminators.push({ word: token, type: 'flavor' });
      } else if (SCENT_TOKENS.has(token)) {
        potentialDiscriminators.push({ word: token, type: 'scent' });
      } else if (SIZE_TOKENS.has(token) || /^\d+(\.\d+)?(G|KG|CL|ML|L)$/i.test(token)) {
        potentialDiscriminators.push({ word: token, type: 'size' });
      } else {
        rootTokens.push(token);
      }
    }

    const cleanedRoot = rootTokens.join(' ').trim();
    return {
      normalizedTokens: tokens,
      potentialDiscriminators,
      cleanedRoot: cleanedRoot || rawUpper,
    };
  }

  /**
   * Semantic Clustering Pipeline (Automated)
   * 1. Textual Root Extraction (Tokenization & N-gram)
   * 2. Financial Validation (Exact same base retail price OR exact same promo price)
   */
  static detectAssortmentClusters(products: ProductRecord[]): ClusterCandidate[] {
    const rootMap: Map<string, ProductRecord[]> = new Map();

    for (const p of products) {
      if (p.is_virtual_assortment) continue;
      const { cleanedRoot } = this.analyzeTitle(p.ITEMNAME);

      if (!rootMap.has(cleanedRoot)) {
        rootMap.set(cleanedRoot, []);
      }
      rootMap.get(cleanedRoot)!.push(p);
    }

    const validClusters: ClusterCandidate[] = [];

    for (const [root, items] of rootMap.entries()) {
      if (items.length < 2) continue; // Needs at least 2 items to form a cluster

      // Financial Validation Gate:
      // Check if all items share the exact same SELLING_PRICE or exact same PROMOPRICE
      const firstBasePrice = items[0].SELLING_PRICE;
      const allSameBasePrice = items.every(
        (it) => typeof it.SELLING_PRICE === 'number' && it.SELLING_PRICE === firstBasePrice
      );

      const firstPromoPrice = items[0].PROMOPRICE;
      const allSamePromoPrice =
        firstPromoPrice !== undefined &&
        items.every((it) => it.PROMOPRICE !== undefined && it.PROMOPRICE === firstPromoPrice);

      if (!allSameBasePrice && !allSamePromoPrice) {
        // Failed financial validation
        continue;
      }

      // Determine cluster type and discriminators
      const discriminators: string[] = [];
      let flavorCount = 0;
      let sizeCount = 0;
      let scentCount = 0;

      for (const item of items) {
        const { potentialDiscriminators } = this.analyzeTitle(item.ITEMNAME);
        for (const disc of potentialDiscriminators) {
          discriminators.push(disc.word);
          if (disc.type === 'flavor') flavorCount++;
          if (disc.type === 'size') sizeCount++;
          if (disc.type === 'scent') scentCount++;
        }
      }

      let clusterType: 'flavor' | 'size' | 'scent' | 'mixed' = 'flavor';
      if (sizeCount > flavorCount && sizeCount > scentCount) {
        clusterType = 'size';
      } else if (scentCount > flavorCount) {
        clusterType = 'scent';
      } else if (flavorCount === 0 && sizeCount === 0 && scentCount === 0) {
        clusterType = 'mixed';
      }

      validClusters.push({
        rootName: root,
        clusterType,
        items,
        discriminators: Array.from(new Set(discriminators)),
        sharedPrice: allSamePromoPrice && firstPromoPrice ? firstPromoPrice : firstBasePrice,
        isPromoPrice: allSamePromoPrice && !!firstPromoPrice,
      });
    }

    return validClusters;
  }

  /**
   * Instantiates a Virtual Assortment Item from a detected or manual cluster
   */
  static createVirtualAssortmentItem(
    candidate: ClusterCandidate,
    language: 'fr' | 'en' = 'fr',
    customOverrideName?: string
  ): ProductRecord {
    const master = candidate.items[0];
    if (!master || candidate.items.length < 2) {
      throw new Error('An assortment requires at least two member products.');
    }
    const {
      PRODUCT_SCAN: _productScan,
      scan: _scan,
      barcode: _barcode,
      PROMOPRICE: _promoPrice,
      PROMO_LABEL: _promoLabel,
      price_tiers: _priceTiers,
      TIERS: _tiers,
      ...masterFields
    } = master;

    // Dynamic Text Substitution phrase
    let substitutionPhrase = '';
    if (language === 'en') {
      if (candidate.clusterType === 'flavor') substitutionPhrase = 'All Flavors Available';
      else if (candidate.clusterType === 'scent') substitutionPhrase = 'All Scents Available';
      else if (candidate.clusterType === 'size') substitutionPhrase = 'All Sizes Included';
      else substitutionPhrase = 'All Varieties Available';
    } else {
      if (candidate.clusterType === 'flavor') substitutionPhrase = 'Tous Parfums Disponibles';
      else if (candidate.clusterType === 'scent') substitutionPhrase = 'Toutes Senteurs Disponibles';
      else if (candidate.clusterType === 'size') substitutionPhrase = 'Toutes Tailles Incluses';
      else substitutionPhrase = 'Toutes Variétés Disponibles';
    }

    const defaultAssortmentName = `${candidate.rootName} — ${substitutionPhrase}`;
    const effectiveName = customOverrideName?.trim() || defaultAssortmentName;

    const virtualItem: ProductRecord = {
      ...masterFields,
      id: `ASSORT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ITEMNAME: effectiveName,
      ITEMDESCRIPTION: `Assortiment groupé de ${candidate.items.length} références : ${candidate.discriminators.join(', ') || 'Multiples'}`,
      is_virtual_assortment: true,
      cluster_root_name: candidate.rootName,
      cluster_discriminators: candidate.discriminators,
      cluster_type: candidate.clusterType === 'scent' ? 'flavor' : candidate.clusterType,
      cluster_count: candidate.items.length,
      cluster_member_ids: candidate.items.map((i) => i.id),
      custom_name_override: customOverrideName,
      PARTNO: `ASSORT-${master.PARTNO || 'GRP'}`,
      SELLING_PRICE: candidate.sharedPrice,
      PROMOPRICE: undefined,
      PROMO_LABEL: candidate.items.length > 2 ? `LOT ASSORTI (${candidate.items.length} RÉF.)` : undefined,
    };

    return virtualItem;
  }

  /**
   * Manual Grouping and Tagging Workspace Helper
   * Allows users to select independent products and group them with a custom Assortment ID,
   * Shared Tag, and Overarching Title.
   */
  static createManualAssortment(
    selectedItems: ProductRecord[],
    assortmentId: string,
    overarchingName: string,
    sharedTag: string = 'ASSORTIMENT_MANUEL'
  ): ProductRecord {
    const master = selectedItems[0];
    if (selectedItems.length < 2) {
      throw new Error('A manual assortment requires at least two member products.');
    }
    const {
      PRODUCT_SCAN: _productScan,
      scan: _scan,
      barcode: _barcode,
      SELLING_PRICE: _sellingPrice,
      PROMOPRICE: _promoPrice,
      price_tiers: _priceTiers,
      TIERS: _tiers,
      ...masterFields
    } = master;
    const sameBasePrice = selectedItems.every(
      (item) => typeof item.SELLING_PRICE === 'number' && item.SELLING_PRICE === master.SELLING_PRICE
    );
    const samePromoPrice = selectedItems.every(
      (item) => typeof item.PROMOPRICE === 'number' && item.PROMOPRICE === master.PROMOPRICE
    );

    const virtualItem: ProductRecord = {
      ...masterFields,
      id: `MANUAL-ASSORT-${Date.now()}`,
      assortment_id: assortmentId,
      assortment_tag: sharedTag,
      ITEMNAME: overarchingName,
      ITEMDESCRIPTION: `Gamme groupée manuellement (${selectedItems.length} articles) : ${selectedItems.map((i) => i.ITEMNAME).join(' / ')}`,
      is_virtual_assortment: true,
      cluster_root_name: overarchingName,
      cluster_count: selectedItems.length,
      cluster_member_ids: selectedItems.map((i) => i.id),
      custom_name_override: overarchingName,
      PARTNO: `GRP-${assortmentId}`,
      SELLING_PRICE: sameBasePrice ? master.SELLING_PRICE : undefined,
      PROMOPRICE: samePromoPrice ? master.PROMOPRICE : undefined,
      PROMO_LABEL: `GAMME GROUPÉE`,
    };

    return virtualItem;
  }
}
