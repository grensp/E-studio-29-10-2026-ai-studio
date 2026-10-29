import { ProductRecord, LabelTemplate } from '../types';

export interface TemplateAssignmentRule {
  id: string;
  name: string;
  description: string;
  condition: (product: ProductRecord) => boolean;
  targetTemplateName: string;
  priority: number; // Higher number = evaluated first
}

export const BUILTIN_ASSIGNMENT_RULES: TemplateAssignmentRule[] = [
  {
    id: 'rule_promo_red',
    name: 'Règle Promotion Flash (Rouge Vif)',
    description: 'Applique le gabarit promotionnel rouge si le produit a un prix promo ou un pourcentage de réduction.',
    priority: 800,
    condition: (p: ProductRecord) => {
      const hasPromoPrice = typeof p.PROMOPRICE === 'number' && p.PROMOPRICE > 0 && p.PROMOPRICE < p.SELLING_PRICE;
      const hasDiscount = typeof p.DISCOUNT_PCT === 'number' && p.DISCOUNT_PCT > 0;
      const hasPromoLabel = !!p.PROMO_LABEL && p.PROMO_LABEL.trim() !== '';
      return hasPromoPrice || hasDiscount || hasPromoLabel;
    },
    targetTemplateName: 'Étiquette Promo Impact Flash (100 x 60 mm)',
  },
  {
    id: 'rule_tiered_pricing',
    name: 'Règle Tarifs Paliers Dégressifs',
    description: 'Applique le gabarit matrice dégressive si le produit dispose de paliers de quantité (Cash & Carry).',
    priority: 700,
    condition: (p: ProductRecord) => {
      const hasPriceTiers = Array.isArray(p.price_tiers) && p.price_tiers.length > 1;
      const hasLegacyTiers = Array.isArray(p.TIERS) && p.TIERS.length > 0;
      return hasPriceTiers || hasLegacyTiers;
    },
    targetTemplateName: 'Étiquette Cash & Carry Paliers (105 x 74 mm - A7)',
  },
  {
    id: 'rule_seafood_regulatory',
    name: 'Règle Réglementaire Marée & Poissonnerie',
    description: 'Applique le gabarit réglementaire Marée si le rayon est Marée / Poissonnerie / Seafood.',
    priority: 600,
    condition: (p: ProductRecord) => {
      const text = `${p.DIV_NAME || ''} ${p.DEPT_NAME || ''} ${p.CATEGORY_NAME || ''} ${p.ITEMNAME || ''}`.toLowerCase();
      return (
        text.includes('seafood') ||
        text.includes('marée') ||
        text.includes('maree') ||
        text.includes('poisson') ||
        text.includes('crustacé') ||
        text.includes('saumon') ||
        text.includes('thon')
      );
    },
    targetTemplateName: 'Étiquette Réglementaire Marée & Pêche (105 x 70 mm)',
  },
  {
    id: 'rule_default_retail',
    name: 'Gabarit Standard Rayon Supermarché',
    description: 'Gabarit par défaut pour tous les autres articles de grande distribution.',
    priority: 100,
    condition: () => true,
    targetTemplateName: 'Étiquette Rayon Supermarché (100 x 50 mm)',
  },
];

export class DataDrivenTemplateEngine {
  /**
   * Resolves the template to use for a specific product, taking into account:
   * 1. Manual override on the product (assigned_template)
   * 2. Business rules evaluated by priority
   */
  static resolveTemplateForProduct(
    product: ProductRecord,
    availableTemplates: LabelTemplate[],
    rules: TemplateAssignmentRule[] = BUILTIN_ASSIGNMENT_RULES
  ): {
    matchedTemplate: LabelTemplate;
    appliedRuleName: string;
    isManualOverride: boolean;
  } {
    // 1. Manual Override
    if (product.assigned_template) {
      const manual = availableTemplates.find(
        (t) => t.name.toLowerCase() === product.assigned_template?.toLowerCase()
      );
      if (manual) {
        return {
          matchedTemplate: manual,
          appliedRuleName: `Forcé manuellement : ${manual.name}`,
          isManualOverride: true,
        };
      }
    }

    // 2. Evaluate rules sorted by priority descending
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      try {
        if (rule.condition(product)) {
          const tpl = availableTemplates.find(
            (t) => t.name.toLowerCase().includes(rule.targetTemplateName.toLowerCase()) ||
                   rule.targetTemplateName.toLowerCase().includes(t.name.toLowerCase())
          );
          if (tpl) {
            return {
              matchedTemplate: tpl,
              appliedRuleName: rule.name,
              isManualOverride: false,
            };
          }
        }
      } catch (err) {
        console.warn(`Rule ${rule.id} failed:`, err);
      }
    }

    // Fallback: first available template
    return {
      matchedTemplate: availableTemplates[0],
      appliedRuleName: 'Gabarit standard (Fallback)',
      isManualOverride: false,
    };
  }
}

/**
 * Brand Deduplication Helper
 * Strips brand name string from ITEMNAME / ITEMDESCRIPTION if a Brand Logo asset is present on the tag template
 * (e.g. stripping "Logitech" from "Logitech MX Master 3" -> "MX Master 3")
 */
export function applyBrandDeduplication(
  productName: string,
  brandName?: string,
  enabled: boolean = true
): string {
  if (!enabled || !brandName || !brandName.trim() || !productName) {
    return productName;
  }

  const trimmedBrand = brandName.trim();
  if (trimmedBrand.length < 2) return productName;

  const escapedBrand = trimmedBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escapedBrand}\\b`, 'gi');

  const cleaned = productName.replace(regex, '').replace(/\s+/g, ' ').trim();
  return cleaned || productName;
}
