import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../rulesEngine/defaultRules';
import { DEVICE_PROFILES, SAMPLE_STORES } from '../rulesEngine/deviceProfiles';
import { RulesEngine } from '../rulesEngine/engine';

describe('RulesEngine event filtering', () => {
  const promoRule = DEFAULT_RULES[0];
  const context = {
    product: { id: 'product-1', ITEMNAME: 'Coffee', DISCOUNT_PCT: 35 },
    store: SAMPLE_STORES[0],
    device: DEVICE_PROFILES.EINK_2_1_INCH,
    timestamp: '2026-10-20T12:00:00.000Z',
  };

  it('does not apply a rule when the incoming trigger differs', () => {
    const result = new RulesEngine([promoRule]).evaluate({
      ...context,
      trigger: 'on_device_render',
    });

    expect(result.success).toBe(true);
    expect(result.payload.audit_trail.rules_matched).toEqual([]);
    expect(result.payload.audit_trail.rule_logs[0].trigger_matched).toBe(false);
  });

  it('applies a rule only for its matching trigger', () => {
    const result = new RulesEngine([promoRule]).evaluate({
      ...context,
      trigger: 'on_promo_active',
    });

    expect(result.success).toBe(true);
    expect(result.payload.audit_trail.rules_matched).toEqual([promoRule.id]);
    expect(result.payload.enriched_product.PROMO_BANNER_TEXT).toBe('MEGA PROMO -30%');
  });
});
