import type { LabelTemplate, ProductRecord } from '../types';
import { prepareRuleProcessedLabels, type RuleProcessedLabel } from '../rulesEngine/productionPipeline';
import type { Rule } from '../rulesEngine/types';
import { sanitizeRenderProduct } from '../utils/pricingEngine';

export interface ProductionBatch {
  products: ProductRecord[];
  templates: LabelTemplate[];
  audits: RuleProcessedLabel['auditTrail'][];
  rules: Rule[];
}

export function prepareProductionBatchWithRules(
  template: LabelTemplate,
  products: ProductRecord[],
  rules: Rule[],
  target: 'pdf' | 'zpl' | 'pptx',
  dpi: number,
  timestamp = new Date().toISOString(),
): ProductionBatch {
  const prepared = prepareRuleProcessedLabels(
    template,
    products.map(sanitizeRenderProduct),
    rules,
    target,
    dpi,
    timestamp,
  );
  return {
    products: prepared.map((label) => label.product),
    templates: prepared.map((label) => label.template),
    audits: prepared.map((label) => label.auditTrail),
    rules,
  };
}
