import {
  DeviceProfile,
  EnrichedPayload,
  ExecutionContext,
  Rule,
  StoreContext,
  TriggerType,
} from './types';
import { RulesEngine } from './engine';
import { LabelTemplate, ProductRecord, TemplateItem, TextItemProperties } from '../types';

export interface RuleProcessedLabel {
  product: ProductRecord;
  template: LabelTemplate;
  auditTrail: EnrichedPayload['audit_trail'];
}

const FORBIDDEN_FIELDS = new Set(['__proto__', 'prototype', 'constructor']);
const KNOWN_TRIGGERS = new Set<TriggerType>([
  'on_price_update',
  'on_stock_drop',
  'on_promo_active',
  'schedule_event',
  'on_device_render',
  'manual_simulation',
]);
const KNOWN_ACTIONS = new Set([
  'enrich_data',
  'invert_colors',
  'hide_element',
  'show_element',
  'truncate_text',
  'auto_scale_font',
  'inject_asset',
  'inject_animation',
  'template_fallback',
  'override_style',
]);
const STYLE_FIELDS_BY_ITEM: Record<TemplateItem['type'], string[]> = {
  text: ['bg_color', 'text_color', 'border_color', 'font_scale', 'font_weight'],
  curved_text: ['text_color', 'font_scale', 'font_weight'],
  rich_text: ['bg_color', 'text_color', 'border_color', 'font_scale', 'font_weight'],
  price_block: ['bg_color', 'text_color', 'border_color', 'font_scale', 'font_weight'],
  tier_price: ['bg_color', 'text_color', 'border_color', 'font_scale', 'font_weight'],
  shape: ['bg_color', 'border_color'],
  ellipse: ['bg_color', 'border_color'],
  line: ['text_color'],
  barcode: ['text_color'],
  qrcode: ['bg_color', 'text_color'],
  image: [],
  pictogram: [],
  restricted_area: [],
};

function isSupportedFontWeight(value: string): value is TextItemProperties['font_weight'] {
  return ['normal', '500', '600', 'bold', '800'].includes(value);
}

export function createPrintDeviceProfile(
  template: LabelTemplate,
  target: 'pdf' | 'zpl' | 'pptx',
  dpi: number
): DeviceProfile {
  const widthPx = Math.max(1, Math.round((template.width_mm / 25.4) * dpi));
  const heightPx = Math.max(1, Math.round((template.height_mm / 25.4) * dpi));
  return {
    id: target === 'zpl' ? `RAW_ZPL_${dpi}DPI` : target === 'pdf' ? 'CUPS_PDF' : 'PPTX_EXPORT',
    name: target === 'zpl' ? `ZPL via raw TCP (${dpi} DPI)` : target === 'pdf' ? 'PDF via CUPS' : 'PowerPoint export',
    type: 'print',
    dimensions: {
      width_mm: template.width_mm,
      height_mm: template.height_mm,
      width_px: widthPx,
      height_px: heightPx,
    },
    resolution_dpi: dpi,
    color_palette: target === 'zpl' ? 'bw' : 'full_color',
    refresh_latency_ms: 0,
    capabilities: {
      allows_animation: false,
      allows_video: false,
      allows_high_res_assets: target !== 'zpl',
      requires_1bit_raster: target === 'zpl',
    },
  };
}

export function createStoreContext(product: ProductRecord): StoreContext {
  const activeCampaigns = product.ACTIVE_CAMPAIGNS;
  return {
    store_id: asString(product.STORE_ID),
    store_name: asString(product.STORE_NAME),
    location: asString(product.STORE_LOCATION),
    region: asString(product.STORE_REGION ?? product.REGION),
    currency: asString(product.CURRENCY ?? product.CURRENCY_CODE),
    tax_rate: finiteNumber(product.TAX_RATE) ?? 0,
    active_campaigns: Array.isArray(activeCampaigns)
      ? activeCampaigns.filter((campaign): campaign is string => typeof campaign === 'string')
      : [],
    ...(typeof product.IS_FRANCHISE === 'boolean' ? { is_franchise: product.IS_FRANCHISE } : {}),
  };
}

export function prepareRuleProcessedLabels(
  template: LabelTemplate,
  products: ProductRecord[],
  rules: Rule[],
  target: 'pdf' | 'zpl' | 'pptx',
  dpi: number,
  timestamp = new Date().toISOString()
): RuleProcessedLabel[] {
  validateProductionRules(rules);
  const engine = new RulesEngine(rules);
  const device = createPrintDeviceProfile(template, target, dpi);

  return products.map((product) => {
    const triggers = resolveProductionTriggers(product, rules, timestamp);
    const context: ExecutionContext = {
      product,
      store: createStoreContext(product),
      device,
      trigger: triggers,
      timestamp,
    };
    const result = engine.evaluate(context);
    if (!result.success) {
      throw new Error(`Rules could not be evaluated for product '${product.id}': ${result.error || 'unknown error'}`);
    }
    const payload = result.payload;
    const transformedTemplate = applyLayoutInstructions(template, payload, target);
    return {
      product: payload.enriched_product as ProductRecord,
      template: transformedTemplate,
      auditTrail: payload.audit_trail,
    };
  });
}

export function applyLayoutInstructions(
  template: LabelTemplate,
  payload: EnrichedPayload,
  target: 'pdf' | 'zpl' | 'pptx'
): LabelTemplate {
  const layout = payload.layout_instructions;
  if (layout.fallback_template_applied) {
    throw new Error(
      `Rule fallback '${layout.recommended_template_id || '(unspecified)'}' cannot be deployed: fallback template lookup is not connected.`
    );
  }
  if (layout.assets_to_inject.length > 0) {
    throw new Error('A matched rule requests asset injection, which is not supported by the production print renderer.');
  }
  if (layout.animation_triggers.length > 0) {
    throw new Error('A matched rule requests animation; physical print targets cannot render animated content.');
  }
  if (target === 'zpl' && layout.color_mode !== 'standard') {
    throw new Error(`ZPL target cannot represent the '${layout.color_mode}' rule color mode.`);
  }
  if (target === 'zpl' && Object.values(layout.style_overrides).some(
    (style) => style.bg_color || style.text_color || style.border_color
  )) {
    throw new Error('ZPL output is monochrome; matched color-style rules cannot be represented faithfully.');
  }

  const hiddenTargets = new Set(layout.hidden_elements);
  const visibleTargets = new Set(layout.visible_elements);
  for (const targetId of Object.keys(layout.text_truncations)) {
    if (!template.items.some((item) => matchesTarget(item, targetId))) {
      throw new Error(`Rule truncated '${targetId}', but no matching template element or data binding renders that field.`);
    }
  }
  for (const [targetId, style] of Object.entries(layout.style_overrides)) {
    if (style.visibility === 'hidden') hiddenTargets.add(targetId);
    if (style.visibility === 'visible') visibleTargets.add(targetId);
  }
  const items = template.items.flatMap((item) => {
    const hidden = Array.from(hiddenTargets).some((targetId) => matchesTarget(item, targetId));
    const visible = Array.from(visibleTargets).some((targetId) => matchesTarget(item, targetId));
    if (hidden && !visible) return [];
    const styled = applyItemStyles(item, layout.style_overrides, target);
    return [visible ? { ...styled, conditional_display: undefined } as TemplateItem : styled];
  });

  for (const targetId of hiddenTargets) {
    if (!template.items.some((item) => matchesTarget(item, targetId))) {
      throw new Error(`Rule attempted to hide '${targetId}', but no matching template element or data binding exists.`);
    }
  }
  for (const targetId of visibleTargets) {
    if (!template.items.some((item) => matchesTarget(item, targetId))) {
      throw new Error(`Rule attempted to show '${targetId}', but no matching template element or data binding exists.`);
    }
  }
  for (const targetId of Object.keys(layout.style_overrides)) {
    if (targetId !== 'global' && !template.items.some((item) => matchesTarget(item, targetId))) {
      throw new Error(`Rule attempted to style '${targetId}', but no matching template element or data binding exists.`);
    }
  }
  if (layout.style_overrides.global && template.items.length === 0) {
    throw new Error('A global rule style cannot be applied because the template contains no renderable elements.');
  }

  return { ...template, items };
}

function applyItemStyles(
  item: TemplateItem,
  overrides: EnrichedPayload['layout_instructions']['style_overrides'],
  target: 'pdf' | 'zpl' | 'pptx'
): TemplateItem {
  const matchingOverrides = Object.entries(overrides)
    .filter(([targetId]) => targetId === 'global' || matchesTarget(item, targetId))
    .map(([, style]) => style);
  if (matchingOverrides.length === 0) return item;

  let next: TemplateItem = { ...item } as TemplateItem;
  for (const style of matchingOverrides) {
    if (target === 'zpl' && (style.bg_color || style.text_color || style.border_color)) {
      throw new Error(`Rule color styling cannot be represented by ZPL element '${item.id}'.`);
    }
    if (target === 'zpl' && style.font_weight !== undefined) {
      throw new Error(`Rule font-weight styling cannot be represented by the ZPL renderer for element '${item.id}'.`);
    }
    const scale = style.font_scale;
    if (scale !== undefined && (!Number.isFinite(scale) || scale <= 0 || scale > 4)) {
      throw new Error(`Rule font scale for element '${item.id}' must be greater than 0 and no more than 4.`);
    }
    if (style.font_weight !== undefined && !isSupportedFontWeight(style.font_weight)) {
      throw new Error(`Rule font weight for element '${item.id}' is unsupported.`);
    }
    const unsupported = Object.entries(style).find(([field, value]) => (
      value !== undefined && field !== 'visibility' && !STYLE_FIELDS_BY_ITEM[item.type].includes(field)
    ));
    if (unsupported) {
      throw new Error(`Rule style '${unsupported[0]}' cannot be applied to ${item.type} element '${item.id}'.`);
    }
    if (Object.entries(style).some(([field, value]) => field !== 'visibility' && value !== undefined)) {
      next = applyItemStyle(next, style);
    }
  }
  return next;
}

function applyItemStyle(
  item: TemplateItem,
  style: EnrichedPayload['layout_instructions']['style_overrides'][string]
): TemplateItem {
  const scale = style.font_scale;
  const fontWeight = style.font_weight && isSupportedFontWeight(style.font_weight)
    ? style.font_weight
    : undefined;
  switch (item.type) {
    case 'text':
      return {
        ...item,
        ...(style.bg_color ? { fill_color: style.bg_color } : {}),
        ...(style.text_color ? { text_color: style.text_color } : {}),
        ...(style.border_color ? { border_color: style.border_color } : {}),
        ...(scale ? { font_size_pt: item.font_size_pt * scale } : {}),
        ...(fontWeight ? { font_weight: fontWeight } : {}),
      };
    case 'curved_text':
      return {
        ...item,
        ...(style.text_color ? { text_color: style.text_color } : {}),
        ...(scale ? { font_size_pt: item.font_size_pt * scale } : {}),
        ...(fontWeight ? { font_weight: fontWeight } : {}),
      };
    case 'rich_text':
      return {
        ...item,
        ...(style.bg_color ? { fill_color: style.bg_color } : {}),
        ...(style.text_color ? { default_text_color: style.text_color } : {}),
        ...(fontWeight ? { default_font_weight: fontWeight } : {}),
        ...(style.border_color ? { border_color: style.border_color } : {}),
        ...(scale ? { default_font_size_pt: (item.default_font_size_pt || 10) * scale } : {}),
        ...(style.text_color || scale || style.font_weight
          ? {
              runs: item.runs.map((run) => ({
                ...run,
                ...(style.text_color ? { text_color: style.text_color } : {}),
                ...(scale && run.font_size_pt ? { font_size_pt: run.font_size_pt * scale } : {}),
                ...(fontWeight ? { font_weight: fontWeight } : {}),
              })),
            }
          : {}),
      };
    case 'price_block':
      return {
        ...item,
        ...(style.bg_color ? { fill_color: style.bg_color } : {}),
        ...(style.border_color ? { border_color: style.border_color } : {}),
        integer_style: {
          ...item.integer_style,
          ...(style.text_color ? { text_color: style.text_color } : {}),
          ...(scale ? { font_size_pt: (item.integer_style.font_size_pt || 24) * scale } : {}),
          ...(fontWeight ? { font_weight: fontWeight } : {}),
        },
        decimal_style: {
          ...item.decimal_style,
          ...(style.text_color ? { text_color: style.text_color } : {}),
          ...(scale ? { font_size_pt: (item.decimal_style.font_size_pt || 12) * scale } : {}),
          ...(fontWeight ? { font_weight: fontWeight } : {}),
        },
        currency_style: {
          ...item.currency_style,
          ...(style.text_color ? { text_color: style.text_color } : {}),
          ...(scale ? { font_size_pt: (item.currency_style?.font_size_pt || 12) * scale } : {}),
          ...(fontWeight ? { font_weight: fontWeight } : {}),
        },
      };
    case 'tier_price':
      return {
        ...item,
        ...(style.bg_color ? { fill_color: style.bg_color } : {}),
        ...(style.text_color ? { text_color: style.text_color } : {}),
        ...(style.border_color ? { border_color: style.border_color } : {}),
        ...(scale ? { font_size_pt: (item.font_size_pt || 10) * scale } : {}),
        ...(fontWeight ? { font_weight: fontWeight } : {}),
      };
    case 'shape':
      return {
        ...item,
        ...(style.bg_color ? { fill_color: style.bg_color } : {}),
        ...(style.border_color ? { border_color: style.border_color } : {}),
      };
    case 'ellipse':
      return {
        ...item,
        ...(style.bg_color ? { fill_color: style.bg_color } : {}),
        ...(style.border_color ? { border_color: style.border_color } : {}),
      };
    case 'line':
      return {
        ...item,
        ...(style.text_color ? { color: style.text_color } : {}),
      };
    case 'barcode':
      return {
        ...item,
        ...(style.text_color ? { bar_color: style.text_color } : {}),
      };
    case 'qrcode':
      return {
        ...item,
        ...(style.text_color ? { module_color: style.text_color } : {}),
        ...(style.bg_color ? { background_color: style.bg_color } : {}),
      };
    default:
      throw new Error(`Rule styling is not supported for template element type '${item.type}' (element '${item.id}').`);
  }
}

function matchesTarget(item: TemplateItem, target: string): boolean {
  if (item.id === target || item.type === target || item.binding_key === target) return true;
  if (item.type === 'text' || item.type === 'curved_text') {
    return item.text.includes(`{{${target}}}`);
  }
  if (item.type === 'rich_text') {
    return item.runs.some((run) => run.binding_key === target || run.text?.includes(`{{${target}}}`));
  }
  return false;
}

function resolveProductionTriggers(
  product: ProductRecord,
  rules: Rule[],
  timestamp: string
): TriggerType[] {
  const triggers: TriggerType[] = ['on_device_render'];
  const currentPrice = finiteNumber(product.SELLING_PRICE);
  const previousPrice = finiteNumber(product.PREVIOUS_SELLING_PRICE);
  const promoPrice = finiteNumber(product.PROMOPRICE);
  const discount = finiteNumber(product.DISCOUNT_PCT);
  if ((discount !== undefined && discount > 0) || (
    currentPrice !== undefined && promoPrice !== undefined && promoPrice >= 0 && promoPrice < currentPrice
  )) {
    triggers.push('on_promo_active');
  }
  if (
    product.PRICE_CHANGED === true ||
    (currentPrice !== undefined && previousPrice !== undefined && currentPrice !== previousPrice)
  ) {
    triggers.push('on_price_update');
  }
  const currentStock = finiteNumber(product.SOH);
  const previousStock = finiteNumber(product.PREVIOUS_SOH ?? product.PREVIOUS_STOCK);
  if (
    product.STOCK_DROPPED === true ||
    (currentStock !== undefined && previousStock !== undefined && currentStock < previousStock)
  ) {
    triggers.push('on_stock_drop');
  }
  const now = new Date(timestamp).getTime();
  const hasActiveSchedule = Number.isFinite(now) && rules.some((rule) => (
    rule.enabled &&
    rule.trigger === 'schedule_event' &&
    rule.time_bound?.enabled === true &&
    isWithinTimeBound(rule, now)
  ));
  if (hasActiveSchedule) triggers.push('schedule_event');
  return triggers;
}

function isWithinTimeBound(rule: Rule, now: number): boolean {
  const start = rule.time_bound?.start_time ? new Date(rule.time_bound.start_time).getTime() : undefined;
  const end = rule.time_bound?.end_time ? new Date(rule.time_bound.end_time).getTime() : undefined;
  return (start === undefined || (Number.isFinite(start) && now >= start)) &&
    (end === undefined || (Number.isFinite(end) && now <= end));
}

export function validateProductionRules(value: unknown): asserts value is Rule[] {
  if (!Array.isArray(value)) throw new Error('Production rules must be an array.');
  const allowedOperators = new Set([
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_contains',
    'in', 'not_in', 'in_range', 'is_empty', 'is_not_empty',
  ]);
  const seenRuleIds = new Set<string>();
  const allowedDeviceTypes = new Set(['print', 'eink', 'lcd']);
  for (const rawRule of value) {
    if (!rawRule || typeof rawRule !== 'object') throw new Error('Every production rule must be an object.');
    const rule = rawRule as Record<string, unknown>;
    if (typeof rule.id !== 'string' || !rule.id.trim()) throw new Error('Every production rule must have a non-empty ID.');
    const ruleId = rule.id;
    if (seenRuleIds.has(ruleId)) throw new Error(`Production rule ID '${ruleId}' is duplicated.`);
    seenRuleIds.add(ruleId);
    if (typeof rule.name !== 'string' || typeof rule.enabled !== 'boolean' ||
      typeof rule.priority !== 'number' || !Number.isFinite(rule.priority) ||
      rule.priority < 1 || rule.priority > 1000) {
      throw new Error(`Rule '${ruleId}' has invalid identity, enabled, or priority values.`);
    }
    if (typeof rule.trigger !== 'string' || !KNOWN_TRIGGERS.has(rule.trigger as TriggerType)) {
      throw new Error(`Rule '${ruleId}' has an unsupported trigger.`);
    }
    if (rule.trigger === 'schedule_event' && (
      !rule.time_bound ||
      typeof rule.time_bound !== 'object' ||
      (rule.time_bound as Record<string, unknown>).enabled !== true
    )) {
      throw new Error(`Scheduled rule '${ruleId}' must have an enabled time bound.`);
    }
    if (rule.time_bound !== undefined) {
      if (!rule.time_bound || typeof rule.time_bound !== 'object') {
        throw new Error(`Rule '${ruleId}' has an invalid time bound.`);
      }
      const bound = rule.time_bound as Record<string, unknown>;
      if (bound.enabled === true) {
        const start = typeof bound.start_time === 'string' ? new Date(bound.start_time).getTime() : undefined;
        const end = typeof bound.end_time === 'string' ? new Date(bound.end_time).getTime() : undefined;
        if (
          (start === undefined && end === undefined) ||
          (start !== undefined && !Number.isFinite(start)) ||
          (end !== undefined && !Number.isFinite(end)) ||
          (start !== undefined && end !== undefined && start > end)
        ) {
          throw new Error(`Scheduled rule '${ruleId}' requires a valid, ordered start and/or end time.`);
        }
      }
    }
    if (!Array.isArray(rule.actions)) throw new Error(`Rule '${ruleId}' actions must be an array.`);
    if (rule.device_types !== undefined && (
      !Array.isArray(rule.device_types) ||
      rule.device_types.some((type) => typeof type !== 'string' || !allowedDeviceTypes.has(type))
    )) {
      throw new Error(`Rule '${ruleId}' has an unsupported device-type filter.`);
    }
    validateConditionGroupValue(rule.condition_group, ruleId, 0, allowedOperators);
    const seenActionIds = new Set<string>();
    for (const rawAction of rule.actions) {
      if (!rawAction || typeof rawAction !== 'object') throw new Error(`Rule '${ruleId}' contains an invalid action.`);
      const action = rawAction as Record<string, unknown>;
      if (typeof action.type !== 'string' || !KNOWN_ACTIONS.has(action.type)) {
        throw new Error(`Rule '${ruleId}' contains an unsupported action.`);
      }
      if (typeof action.id !== 'string' || !action.id.trim() || seenActionIds.has(action.id)) {
        throw new Error(`Rule '${ruleId}' contains a missing or duplicate action ID.`);
      }
      seenActionIds.add(action.id);
      if (action.target_element_id !== undefined && (
        typeof action.target_element_id !== 'string' || !action.target_element_id.trim()
      )) {
        throw new Error(`Rule '${ruleId}' has an invalid action target.`);
      }
      if (action.conflict_key !== undefined && (
        typeof action.conflict_key !== 'string' || !action.conflict_key.trim()
      )) {
        throw new Error(`Rule '${ruleId}' has an invalid action conflict key.`);
      }
      if (action.parameters !== undefined && (
        !action.parameters || typeof action.parameters !== 'object' || Array.isArray(action.parameters)
      )) {
        throw new Error(`Rule '${ruleId}' action parameters must be an object.`);
      }
      const parameters = action.parameters && typeof action.parameters === 'object'
        ? action.parameters as Record<string, unknown>
        : {};
      const field = parameters.field_name;
      if (typeof field === 'string' && (
        FORBIDDEN_FIELDS.has(field) || field === 'id' || field === 'PRODUCT_SCAN'
      )) {
        throw new Error(`Rule '${ruleId}' cannot overwrite protected product identity field '${field}'.`);
      }
      if (parameters.expression) {
        throw new Error(`Rule '${ruleId}' uses an expression action, which has no validated production evaluator.`);
      }
      if (action.type === 'enrich_data' && (
        typeof field !== 'string' || !Object.prototype.hasOwnProperty.call(parameters, 'field_value')
      )) {
        throw new Error(`Rule '${ruleId}' enrich_data actions require a field name and literal field value.`);
      }
      if (action.type === 'truncate_text' && (
        typeof parameters.max_chars !== 'number' ||
        !Number.isInteger(parameters.max_chars) ||
        parameters.max_chars < 1
      )) {
        throw new Error(`Rule '${ruleId}' truncate_text actions require a positive integer max_chars.`);
      }
      const scale = parameters.scale_factor;
      if (scale !== undefined && (
        typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0 || scale > 4
      )) {
        throw new Error(`Rule '${ruleId}' has an invalid font scale.`);
      }
      if (parameters.font_weight !== undefined && (
        typeof parameters.font_weight !== 'string' ||
        !isSupportedFontWeight(parameters.font_weight) ||
        action.type !== 'override_style'
      )) {
        throw new Error(`Rule '${ruleId}' has an unsupported font weight.`);
      }
      if (action.type === 'override_style' && ![
        parameters.bg_color,
        parameters.text_color,
        parameters.scale_factor,
        parameters.font_weight,
      ].some((parameter) => parameter !== undefined)) {
        throw new Error(`Rule '${ruleId}' override_style actions must define at least one supported style.`);
      }
      if (action.type === 'show_element' && typeof action.target_element_id !== 'string') {
        throw new Error(`Rule '${ruleId}' show_element actions require a target element ID.`);
      }
      for (const colorName of ['bg_color', 'text_color', 'border_color'] as const) {
        const color = parameters[colorName];
        if (color !== undefined && (
          typeof color !== 'string' || !/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(color)
        )) {
          throw new Error(`Rule '${ruleId}' has an invalid ${colorName}.`);
        }
      }
    }
  }
}

function validateConditionGroupValue(
  value: unknown,
  ruleId: string,
  depth: number,
  allowedOperators: Set<string>
): void {
  if (depth > 16 || !value || typeof value !== 'object') {
    throw new Error(`Rule '${ruleId}' has an invalid or excessively nested condition group.`);
  }
  const group = value as Record<string, unknown>;
  if (!['AND', 'OR', 'NOT'].includes(String(group.logical_operator)) || !Array.isArray(group.conditions)) {
    throw new Error(`Rule '${ruleId}' has an invalid condition group.`);
  }
  for (const child of group.conditions) {
    if (!child || typeof child !== 'object') throw new Error(`Rule '${ruleId}' has an invalid condition.`);
    const condition = child as Record<string, unknown>;
    if (Array.isArray(condition.conditions)) {
      validateConditionGroupValue(child, ruleId, depth + 1, allowedOperators);
      continue;
    }
    const path = condition.field_path;
    const segments = typeof path === 'string' ? path.split('.') : [];
    if (
      segments.length < 2 ||
      !['product', 'store', 'device'].includes(segments[0]) ||
      segments.some((segment) => !segment || FORBIDDEN_FIELDS.has(segment))
    ) {
      throw new Error(`Rule '${ruleId}' has an unsafe or unsupported condition field path.`);
    }
    if (typeof condition.operator !== 'string' || !allowedOperators.has(condition.operator)) {
      throw new Error(`Rule '${ruleId}' has an unsupported condition operator.`);
    }
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (String(value).trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
