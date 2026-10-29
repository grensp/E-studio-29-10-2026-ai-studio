import {
  ExecutionContext,
  Rule,
  EvaluationResult,
  EnrichedPayload,
  RuleCondition,
  RuleConditionGroup,
  ConflictLog,
  RuleEvaluationLog,
  RuleAction,
  DeviceType,
} from './types';
import { DEFAULT_RULES } from './defaultRules';

/**
 * Resolves a dotted path (e.g., "product.DISCOUNT_PCT", "device.type") against context.
 */
export function resolveFieldPath(context: ExecutionContext, path: string): any {
  if (!path) return undefined;
  const parts = path.split('.');
  let current: any = context;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (part === '__proto__' || part === 'prototype' || part === 'constructor') return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, part)) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Evaluates a single condition against the execution context.
 */
export function evaluateCondition(condition: RuleCondition, context: ExecutionContext): boolean {
  const actualValue = resolveFieldPath(context, condition.field_path);
  const targetValue = condition.value;

  switch (condition.operator) {
    case 'eq':
      return actualValue === targetValue || (
        typeof actualValue === 'string' &&
        typeof targetValue === 'string' &&
        actualValue.toLowerCase() === targetValue.toLowerCase()
      );
    case 'neq':
      return !(actualValue === targetValue || (
        typeof actualValue === 'string' &&
        typeof targetValue === 'string' &&
        actualValue.toLowerCase() === targetValue.toLowerCase()
      ));
    case 'gt':
      return numericValue(actualValue) !== undefined &&
        numericValue(targetValue) !== undefined &&
        numericValue(actualValue)! > numericValue(targetValue)!;
    case 'gte':
      return numericValue(actualValue) !== undefined &&
        numericValue(targetValue) !== undefined &&
        numericValue(actualValue)! >= numericValue(targetValue)!;
    case 'lt':
      return numericValue(actualValue) !== undefined &&
        numericValue(targetValue) !== undefined &&
        numericValue(actualValue)! < numericValue(targetValue)!;
    case 'lte':
      return numericValue(actualValue) !== undefined &&
        numericValue(targetValue) !== undefined &&
        numericValue(actualValue)! <= numericValue(targetValue)!;
    case 'contains':
      if (Array.isArray(actualValue)) {
        return actualValue.some((item) => String(item).toLowerCase().includes(String(targetValue).toLowerCase()));
      }
      return String(actualValue || '').toLowerCase().includes(String(targetValue || '').toLowerCase());
    case 'not_contains':
      if (Array.isArray(actualValue)) {
        return !actualValue.some((item) => String(item).toLowerCase().includes(String(targetValue).toLowerCase()));
      }
      return !String(actualValue || '').toLowerCase().includes(String(targetValue || '').toLowerCase());
    case 'in':
      if (Array.isArray(targetValue)) {
        return targetValue.includes(actualValue);
      }
      return String(targetValue || '').split(',').map((s) => s.trim().toLowerCase()).includes(String(actualValue).toLowerCase());
    case 'not_in':
      if (Array.isArray(targetValue)) {
        return !targetValue.includes(actualValue);
      }
      return !String(targetValue || '').split(',').map((s) => s.trim().toLowerCase()).includes(String(actualValue).toLowerCase());
    case 'in_range':
      const num = numericValue(actualValue);
      const lower = numericValue(condition.value);
      const upper = numericValue(condition.value_to);
      return num !== undefined && lower !== undefined && upper !== undefined &&
        lower <= upper && num >= lower && num <= upper;
    case 'is_empty':
      return actualValue === undefined || actualValue === null || actualValue === '' || (Array.isArray(actualValue) && actualValue.length === 0);
    case 'is_not_empty':
      return actualValue !== undefined && actualValue !== null && actualValue !== '' && (!Array.isArray(actualValue) || actualValue.length > 0);
    default:
      return false;
  }
}

function numericValue(value: unknown): number | undefined {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

/**
 * Recursively evaluates condition groups with AND, OR, NOT operators.
 */
export function evaluateConditionGroup(group: RuleConditionGroup, context: ExecutionContext): boolean {
  if (!group || !group.conditions || group.conditions.length === 0) {
    return group?.logical_operator !== 'OR';
  }

  const results = group.conditions.map((item) => {
    if ('logical_operator' in item) {
      return evaluateConditionGroup(item as RuleConditionGroup, context);
    }
    return evaluateCondition(item as RuleCondition, context);
  });

  switch (group.logical_operator) {
    case 'AND':
      return results.every(Boolean);
    case 'OR':
      return results.some(Boolean);
    case 'NOT':
      return !results.some(Boolean);
    default:
      return results.every(Boolean);
  }
}

/**
 * Core Headless Rules Engine.
 */
export class RulesEngine {
  private rules: Rule[];

  constructor(initialRules: Rule[] = DEFAULT_RULES) {
    this.rules = [...initialRules];
  }

  public getRules(): Rule[] {
    return [...this.rules];
  }

  public setRules(newRules: Rule[]): void {
    this.rules = [...newRules];
  }

  public addRule(rule: Rule): void {
    this.rules.push(rule);
  }

  public updateRule(ruleId: string, updated: Partial<Rule>): void {
    this.rules = this.rules.map((r) => (r.id === ruleId ? { ...r, ...updated } : r));
  }

  public deleteRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }

  /**
   * Evaluates rules against the execution context and returns an enriched payload.
   * Execution is benchmarked to guarantee the < 50ms SLA.
   */
  public evaluate(context: ExecutionContext, overrideRules?: Rule[]): EvaluationResult {
    const startTime = performance.now();
    const rulesToEvaluate = overrideRules || this.rules;

    try {
      const timestamp = context.timestamp || new Date().toISOString();
      const currentEvalTime = new Date(timestamp).getTime();
      if (!Number.isFinite(currentEvalTime)) throw new Error('Rule evaluation timestamp must be a valid ISO date.');

      // Deep clone product data to prevent side-effects
      const enrichedProduct: Record<string, any> = JSON.parse(JSON.stringify(context.product || {}));

      // Base Layout Instructions
      const layoutInstructions: EnrichedPayload['layout_instructions'] = {
        color_mode: 'standard',
        style_overrides: {},
        hidden_elements: [],
        visible_elements: [],
        text_truncations: {},
        assets_to_inject: [],
        animation_triggers: [],
        fallback_template_applied: false,
      };

      const auditTrail: EnrichedPayload['audit_trail'] = {
        total_rules_in_system: rulesToEvaluate.length,
        rules_evaluated: 0,
        rules_matched: [],
        rules_applied: [],
        conflicts_resolved: [],
        rule_logs: [],
        execution_time_ms: 0,
        sla_respected: true,
      };

      // Conflict tracking table: key -> { action, rule, priority }
      interface ActionCandidate {
        action: RuleAction;
        rule: Rule;
        priority: number;
      }
      const candidatesByKey = new Map<string, ActionCandidate>();

      // Sort rules descending by priority so higher priorities are evaluated first,
      // but evaluate all to log conflicts accurately!
      const sortedRules = [...rulesToEvaluate].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

      for (const rule of sortedRules) {
        auditTrail.rules_evaluated++;

        // 1. Enabled check
        if (!rule.enabled) {
          auditTrail.rule_logs.push({
            rule_id: rule.id,
            rule_name: rule.name,
            priority: rule.priority,
            trigger_matched: !context.trigger || (Array.isArray(context.trigger)
              ? context.trigger.includes(rule.trigger)
              : context.trigger === rule.trigger),
            time_valid: true,
            conditions_matched: false,
            applied: false,
            actions_count: rule.actions.length,
            details: 'Règle désactivée',
          });
          continue;
        }

        const triggerMatches = !context.trigger || (Array.isArray(context.trigger)
          ? context.trigger.includes(rule.trigger)
          : context.trigger === rule.trigger);
        if (!triggerMatches) {
          auditTrail.rule_logs.push({
            rule_id: rule.id,
            rule_name: rule.name,
            priority: rule.priority,
            trigger_matched: false,
            time_valid: true,
            conditions_matched: false,
            applied: false,
            actions_count: rule.actions.length,
            details: `Trigger non correspondant (attendu: ${rule.trigger}, reçu: ${context.trigger})`,
          });
          continue;
        }

        // 2. Device type filter check
        if (rule.device_types && rule.device_types.length > 0) {
          if (!rule.device_types.includes(context.device.type)) {
            auditTrail.rule_logs.push({
              rule_id: rule.id,
              rule_name: rule.name,
              priority: rule.priority,
              trigger_matched: true,
              time_valid: true,
              conditions_matched: false,
              applied: false,
              actions_count: rule.actions.length,
              details: `Ignorée car réservée aux périphériques: ${rule.device_types.join(', ')}`,
            });
            continue;
          }
        }

        // 3. Time-bound validity check
        let timeValid = true;
        if (rule.time_bound?.enabled) {
          if (rule.time_bound.start_time) {
            const startMs = new Date(rule.time_bound.start_time).getTime();
            if (!Number.isFinite(startMs) || currentEvalTime < startMs) timeValid = false;
          }
          if (rule.time_bound.end_time) {
            const endMs = new Date(rule.time_bound.end_time).getTime();
            if (!Number.isFinite(endMs) || currentEvalTime > endMs) timeValid = false;
          }
        }

        if (!timeValid) {
          auditTrail.rule_logs.push({
            rule_id: rule.id,
            rule_name: rule.name,
            priority: rule.priority,
            trigger_matched: true,
            time_valid: false,
            conditions_matched: false,
            applied: false,
            actions_count: rule.actions.length,
            details: 'Hors période de validité horaire',
          });
          continue;
        }

        // 4. Condition tree evaluation
        const conditionsPassed = evaluateConditionGroup(rule.condition_group, context);
        if (!conditionsPassed) {
          auditTrail.rule_logs.push({
            rule_id: rule.id,
            rule_name: rule.name,
            priority: rule.priority,
            trigger_matched: true,
            time_valid: true,
            conditions_matched: false,
            applied: false,
            actions_count: rule.actions.length,
            details: 'Conditions logiques non satisfaites',
          });
          continue;
        }

        // Rule Matched!
        auditTrail.rules_matched.push(rule.id);

        auditTrail.rule_logs.push({
          rule_id: rule.id,
          rule_name: rule.name,
          priority: rule.priority,
          trigger_matched: true,
          time_valid: true,
          conditions_matched: true,
          applied: false,
          actions_count: rule.actions.length,
          details: 'Conditions validées avec succès',
        });

        // 5. Register actions with deterministic conflict resolution
        for (const action of rule.actions) {
          const conflictKey = action.conflict_key || `${action.type}_${action.target_element_id || 'global'}`;

          if (candidatesByKey.has(conflictKey)) {
            const existing = candidatesByKey.get(conflictKey)!;
            // Existing is higher or equal priority because sorted descending
            if (existing.priority >= rule.priority) {
              // Log the conflict resolution!
              auditTrail.conflicts_resolved.push({
                conflict_key: conflictKey,
                target_element_id: action.target_element_id,
                action_type: action.type,
                winning_rule_id: existing.rule.id,
                winning_rule_name: existing.rule.name,
                winning_priority: existing.priority,
                superseded_rule_id: rule.id,
                superseded_rule_name: rule.name,
                superseded_priority: rule.priority,
                rationale: `Priorité ${existing.priority} (${existing.rule.name}) prévaut sur Priorité ${rule.priority} (${rule.name}) pour la cible '${conflictKey}'.`,
              });
              continue; // Do not apply lower priority action
            }
          }

          // Higher priority candidate recorded
          candidatesByKey.set(conflictKey, {
            action,
            rule,
            priority: rule.priority,
          });
        }
      }

      // 6. Execute winning actions
      for (const [conflictKey, candidate] of candidatesByKey.entries()) {
        const { action, rule } = candidate;
        const params = action.parameters || {};
        let actionApplied = true;

        switch (action.type) {
          case 'enrich_data': {
            if (params.field_name) {
              enrichedProduct[params.field_name] = params.field_value;
            }
            break;
          }

          case 'invert_colors': {
            // Check device capabilities adapter
            if (context.device.type === 'eink') {
              layoutInstructions.color_mode = 'inverted';
              const target = action.target_element_id || 'price_block';
              layoutInstructions.style_overrides[target] = {
                bg_color: params.bg_color || '#dc2626', // High contrast red for 3-color e-ink
                text_color: params.text_color || '#ffffff',
                font_weight: 'bold',
                visibility: 'visible',
              };
            } else {
              // On high-res print or lcd, invert colors is applied as a bold theme override
              const target = action.target_element_id || 'price_block';
              layoutInstructions.style_overrides[target] = {
                bg_color: params.bg_color || '#dc2626',
                text_color: params.text_color || '#ffffff',
              };
            }
            break;
          }

          case 'override_style': {
            const target = action.target_element_id || 'global';
            layoutInstructions.style_overrides[target] = {
              ...(layoutInstructions.style_overrides[target] || {}),
              bg_color: params.bg_color,
              text_color: params.text_color,
              font_scale: params.scale_factor,
              font_weight: params.font_weight,
            };
            break;
          }

          case 'hide_element': {
            // Multi-Device Adapter:
            // Acceptance Criteria: on 2-inch E-ink display, hide long description.
            // On high-res paper print, do NOT hide long description!
            if (context.device.type === 'eink') {
              const screenSize = context.device.screen_size_inches || 2.1;
              if (screenSize <= 2.5) {
                const target = action.target_element_id || 'ITEMDESCRIPTION';
                if (!layoutInstructions.hidden_elements.includes(target)) {
                  layoutInstructions.hidden_elements.push(target);
                }
                layoutInstructions.style_overrides[target] = {
                  ...(layoutInstructions.style_overrides[target] || {}),
                  visibility: 'hidden',
                };
              }
            } else {
                const target = action.target_element_id || 'ITEMDESCRIPTION';
                if (target && !layoutInstructions.hidden_elements.includes(target)) {
                  layoutInstructions.hidden_elements.push(target);
              }
            }
            break;
          }

          case 'show_element': {
            const target = action.target_element_id;
            if (target) {
              if (!layoutInstructions.visible_elements.includes(target)) {
                layoutInstructions.visible_elements.push(target);
              }
              layoutInstructions.hidden_elements = layoutInstructions.hidden_elements.filter((h) => h !== target);
            }
            break;
          }

          case 'truncate_text': {
            const target = action.target_element_id || 'ITEMNAME';
            const originalText = String(enrichedProduct[target] || '');
            const maxChars = params.max_chars || 25;
            if (originalText.length > maxChars) {
              const truncated = originalText.slice(0, maxChars - 1).trim() + '…';
              layoutInstructions.text_truncations[target] = {
                max_chars: maxChars,
                ellipsis: true,
                original_text: originalText,
                truncated_text: truncated,
              };
              enrichedProduct[target] = truncated;
            }
            if (params.scale_factor) {
              layoutInstructions.style_overrides[target] = {
                ...(layoutInstructions.style_overrides[target] || {}),
                font_scale: params.scale_factor,
              };
            }
            break;
          }

          case 'auto_scale_font': {
            const target = action.target_element_id || 'ITEMNAME';
            layoutInstructions.style_overrides[target] = {
              ...(layoutInstructions.style_overrides[target] || {}),
              font_scale: params.scale_factor || 0.85,
            };
            break;
          }

          case 'inject_asset': {
            // Capability Mapping:
            // Print: allows CMYK high-res asset
            // E-ink: forces 1-bit raster or skips heavy photos
            // LCD: allows full color asset
            const isHighResPrint = context.device.type === 'print' && context.device.capabilities.allows_high_res_assets;
            const isEink = context.device.type === 'eink';

            if (isEink && params.asset_type === 'image_cmyk') {
              // E-ink adapter rejects CMYK photo and injects 1-bit vector pictogram
              layoutInstructions.assets_to_inject.push({
                target_id: action.target_element_id,
                role: params.asset_role || 'promo_stamp',
                url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40"><rect width="100" height="40" fill="%23dc2626"/><text x="50" y="25" fill="%23ffffff" font-size="14" font-weight="bold" text-anchor="middle">PROMO</text></svg>',
                type: 'image_1bit',
                one_bit_ready: true,
              });
            } else {
              layoutInstructions.assets_to_inject.push({
                target_id: action.target_element_id,
                role: params.asset_role || 'promo_stamp',
                url: params.asset_url || '',
                type: params.asset_type || 'badge_vector',
                cmyk_ready: isHighResPrint,
              });
            }
            break;
          }

          case 'inject_animation': {
            // Multi-Device Adapter: Only LCD/Digital devices allow animations
            if (context.device.type === 'lcd' && context.device.capabilities.allows_animation) {
              layoutInstructions.animation_triggers.push({
                target_id: action.target_element_id,
                type: params.animation_type || 'pulse',
                duration_ms: params.animation_duration_ms || 1500,
                repeat: 'infinite',
                video_url: params.asset_url,
              });
            } else {
              actionApplied = false;
              const log = auditTrail.rule_logs.find((entry) => entry.rule_id === rule.id);
              if (log) {
                const skipped = `Action inject_animation was skipped for unsupported device type '${context.device.type}'.`;
                log.details = log.details ? `${log.details} ${skipped}` : skipped;
              }
            }
            break;
          }

          case 'template_fallback': {
            // Triggers minimalist template fallback when screen is compact
            layoutInstructions.fallback_template_applied = true;
            layoutInstructions.recommended_template_id = params.fallback_template_id || 'MINIMALIST_ESL_2INCH';
            break;
          }
        }
        if (actionApplied) {
          if (!auditTrail.rules_applied.includes(rule.id)) auditTrail.rules_applied.push(rule.id);
          const log = auditTrail.rule_logs.find((entry) => entry.rule_id === rule.id);
          if (log) log.applied = true;
        }
      }

      // 7. Multi-Device Adapter Final Normalization Pass
      const endTime = performance.now();
      const executionTime = Number((endTime - startTime).toFixed(3));
      auditTrail.execution_time_ms = executionTime;
      auditTrail.sla_respected = executionTime < 50.0;

      const payload: EnrichedPayload = {
        context: {
          product_id: String(enrichedProduct.id || enrichedProduct.PARTNO || 'UNKNOWN'),
          product_sku: String(enrichedProduct.PRODUCT_SCAN || enrichedProduct.PARTNO || ''),
          store_id: context.store.store_id,
          device_id: context.device.id,
          device_type: context.device.type,
          device_screen_size: context.device.screen_size_inches,
          evaluated_at: timestamp,
          execution_time_ms: executionTime,
        },
        enriched_product: enrichedProduct,
        layout_instructions: layoutInstructions,
        audit_trail: auditTrail,
      };

      return {
        success: true,
        payload,
      };
    } catch (err: any) {
      const endTime = performance.now();
      return {
        success: false,
        error: String(err?.message || err),
        payload: {
          context: {
            product_id: String(context.product?.id || ''),
            product_sku: '',
            store_id: context.store?.store_id || '',
            device_id: context.device?.id || '',
            device_type: context.device?.type || 'print',
            evaluated_at: new Date().toISOString(),
            execution_time_ms: Number((endTime - startTime).toFixed(3)),
          },
          enriched_product: context.product || {},
          layout_instructions: {
            color_mode: 'standard',
            style_overrides: {},
            hidden_elements: [],
            visible_elements: [],
            text_truncations: {},
            assets_to_inject: [],
            animation_triggers: [],
          },
          audit_trail: {
            total_rules_in_system: rulesToEvaluate.length,
            rules_evaluated: 0,
            rules_matched: [],
            rules_applied: [],
            conflicts_resolved: [],
            rule_logs: [],
            execution_time_ms: Number((endTime - startTime).toFixed(3)),
            sla_respected: true,
          },
        },
      };
    }
  }
}

export const defaultRulesEngine = new RulesEngine(DEFAULT_RULES);
