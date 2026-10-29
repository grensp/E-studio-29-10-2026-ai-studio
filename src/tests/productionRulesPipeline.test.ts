import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../rulesEngine/defaultRules';
import { Rule } from '../rulesEngine/types';
import {
  applyLayoutInstructions,
  createStoreContext,
  prepareRuleProcessedLabels,
  validateProductionRules,
} from '../rulesEngine/productionPipeline';
import { LabelTemplate, ProductRecord, TextItemProperties } from '../types';
import { renderImposedPdfJob } from '../utils/pdfJobRenderer';
import { ZplExporter } from '../utils/zplExporter';

const template: LabelTemplate = {
  id: 'production-template',
  revision: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  schema_version: 1,
  name: 'Production test',
  width_mm: 50,
  height_mm: 30,
  inner_margins_mm: { top: 0, right: 0, bottom: 0, left: 0 },
  outer_margins_mm: { top: 0, right: 0, bottom: 0, left: 0 },
  bg_color: '#FFFFFF',
  bg_opacity: 1,
  items: [{
    id: 'rule-output',
    type: 'text',
    x_mm: 2,
    y_mm: 2,
    w_mm: 45,
    h_mm: 8,
    rotation: 0,
    z_index: 1,
    locked: false,
    text: '',
    binding_key: 'RULE_OUTPUT',
    font_family: 'Arial',
    font_size_pt: 12,
    font_weight: 'normal',
    font_style: 'normal',
    text_decoration: 'none',
    text_color: '#000000',
    alignment: 'left',
    valign: 'top',
    wrap: false,
    overflow: 'clip',
  } as TextItemProperties, {
    id: 'price_block',
    type: 'price_block',
    x_mm: 2,
    y_mm: 12,
    w_mm: 30,
    h_mm: 14,
    rotation: 0,
    z_index: 2,
    locked: false,
    binding_key: 'SELLING_PRICE',
    integer_style: { font_size_pt: 18 },
    decimal_style: { font_size_pt: 10 },
  }],
};

const product: ProductRecord = {
  id: 'product-1',
  ITEMNAME: 'Coffee',
  SELLING_PRICE: 12.5,
};

const enrichOnRenderRule: Rule = {
  id: 'production-rule',
  name: 'Production enrichment',
  description: 'Add production-bound field',
  enabled: true,
  priority: 10,
  trigger: 'on_device_render',
  condition_group: { id: 'all', logical_operator: 'AND', conditions: [] },
  actions: [{
    id: 'set-rule-output',
    type: 'enrich_data',
    parameters: { field_name: 'RULE_OUTPUT', field_value: 'RULE-ACTIVE' },
  }],
};

describe('production rules-to-export processing', () => {
  it('evaluates rule results against product data and uses the enriched result in both real exporters', () => {
    const prepared = prepareRuleProcessedLabels(
      template,
      [product],
      [enrichOnRenderRule],
      'pdf',
      300,
      '2026-10-20T12:00:00.000Z'
    );
    expect(prepared[0].product.RULE_OUTPUT).toBe('RULE-ACTIVE');
    expect(prepared[0].auditTrail.rules_applied).toEqual(['production-rule']);

    const config = { page_size: 'A4' as const, orientation: 'portrait' as const, gap_mm: 0, show_cut_marks: false };
    const pdf = renderImposedPdfJob(template, [prepared[0].product], config, [prepared[0].template]);
    expect(pdf.output()).toContain('RULE-ACTIVE');

    const zplPrepared = prepareRuleProcessedLabels(
      template,
      [product],
      [enrichOnRenderRule],
      'zpl',
      203,
      '2026-10-20T12:00:00.000Z'
    );
    const zpl = ZplExporter.generateBatchZpl(
      template,
      [zplPrepared[0].product],
      { dpi: 203, quantity: 1, includeComments: false },
      [zplPrepared[0].template]
    );
    expect(zpl).toContain('RULE-ACTIVE');
  });

  it('fires promo rules only when actual product data indicates an active promotion', () => {
    const promoRule = DEFAULT_RULES[0];
    const result = prepareRuleProcessedLabels(
      template,
      [{ ...product, DISCOUNT_PCT: 35 }],
      [promoRule],
      'pdf',
      300,
      '2026-10-20T12:00:00.000Z'
    )[0];

    expect(result.product.PROMO_BANNER_TEXT).toBe('MEGA PROMO -30%');
    expect(result.template.items.find((item) => item.type === 'price_block')).toMatchObject({
      fill_color: '#dc2626',
      integer_style: { text_color: '#ffffff' },
    });
    expect(result.auditTrail.rules_applied).toContain(promoRule.id);
    expect(result.auditTrail.rule_logs.find((log) => log.rule_id === promoRule.id)?.details)
      .toContain("Action inject_animation was skipped for unsupported device type 'print'.");
  });

  it('rejects visual rule operations that the selected physical format cannot faithfully represent', () => {
    expect(() => prepareRuleProcessedLabels(
      template,
      [{ ...product, DISCOUNT_PCT: 35 }],
      [DEFAULT_RULES[0]],
      'zpl',
      203,
      '2026-10-20T12:00:00.000Z'
    )).toThrow(/monochrome/i);

    const assetRule: Rule = {
      ...enrichOnRenderRule,
      id: 'asset-rule',
      actions: [{
        id: 'asset',
        type: 'inject_asset',
        parameters: { asset_url: 'https://example.invalid/asset.png' },
      }],
    };
    expect(() => prepareRuleProcessedLabels(
      template,
      [product],
      [assetRule],
      'pdf',
      300,
      '2026-10-20T12:00:00.000Z'
    )).toThrow(/asset injection/i);
  });

  it('applies hide and show actions to the bound production elements', () => {
    const hiddenRule: Rule = {
      ...enrichOnRenderRule,
      id: 'hide-rule',
      actions: [{ id: 'hide', type: 'hide_element', target_element_id: 'RULE_OUTPUT', parameters: {} }],
    };
    const hidden = prepareRuleProcessedLabels(template, [product], [hiddenRule], 'pdf', 300)[0];
    expect(hidden.template.items.some((item) => item.binding_key === 'RULE_OUTPUT')).toBe(false);

    const shownTemplate = {
      ...template,
      items: [{
        ...template.items[0],
        conditional_display: { enabled: true, rule: 'has_promo' as const },
      }],
    };
    const showRule: Rule = {
      ...enrichOnRenderRule,
      id: 'show-rule',
      actions: [{ id: 'show', type: 'show_element', target_element_id: 'RULE_OUTPUT', parameters: {} }],
    };
    const shown = prepareRuleProcessedLabels(shownTemplate, [product], [showRule], 'pdf', 300)[0];
    expect(shown.template.items[0].conditional_display).toBeUndefined();
  });

  it('applies rule font weight to the generated price block', () => {
    const weightRule: Rule = {
      ...enrichOnRenderRule,
      id: 'weight-rule',
      actions: [{
        id: 'weight-price',
        type: 'override_style',
        target_element_id: 'price_block',
        parameters: { font_weight: 'bold' },
      }],
    };
    const result = prepareRuleProcessedLabels(template, [product], [weightRule], 'pdf', 300)[0];
    expect(result.template.items.find((item) => item.type === 'price_block')).toMatchObject({
      integer_style: { font_weight: 'bold' },
    });
    expect(() => prepareRuleProcessedLabels(template, [product], [weightRule], 'zpl', 203))
      .toThrow(/font-weight styling cannot be represented/i);
  });

  it('rejects rule effects that would not be visible in the selected template', () => {
    const truncateRule: Rule = {
      ...enrichOnRenderRule,
      id: 'truncate-rule',
      actions: [{
        id: 'truncate-field',
        type: 'truncate_text',
        target_element_id: 'UNRENDERED_FIELD',
        parameters: { max_chars: 4 },
      }],
    };
    expect(() => prepareRuleProcessedLabels(
      template,
      [{ ...product, UNRENDERED_FIELD: 'A long value' }],
      [truncateRule],
      'pdf',
      300
    )).toThrow(/no matching template element or data binding/i);
  });

  it('does not invent store identifiers or campaigns when the product has no store metadata', () => {
    expect(createStoreContext(product)).toMatchObject({
      store_id: '',
      store_name: '',
      active_campaigns: [],
      currency: '',
    });
  });

  it('rejects malformed rules and protected product identifiers before production evaluation', () => {
    expect(() => validateProductionRules([{ ...enrichOnRenderRule, trigger: 'unknown' }])).toThrow(/trigger/);
    expect(() => validateProductionRules([{
      ...enrichOnRenderRule,
      actions: [{
        id: 'overwrite-scan',
        type: 'enrich_data',
        parameters: { field_name: 'PRODUCT_SCAN', field_value: '0000000000000' },
      }],
    }])).toThrow(/protected product identity/);
  });

  it('requires at least one valid time boundary for scheduled production rules', () => {
    expect(() => validateProductionRules([{
      ...enrichOnRenderRule,
      trigger: 'schedule_event',
      time_bound: { enabled: true },
    }])).toThrow(/valid, ordered start and\/or end time/);
    expect(() => validateProductionRules([{
      ...enrichOnRenderRule,
      trigger: 'schedule_event',
      time_bound: { enabled: false, start_time: '2026-01-01T00:00:00Z' },
    }])).toThrow(/must have an enabled time bound/);
    expect(() => validateProductionRules([
      enrichOnRenderRule,
      { ...enrichOnRenderRule },
    ])).toThrow(/duplicated/);
  });
});
