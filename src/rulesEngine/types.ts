export type DeviceType = 'print' | 'eink' | 'lcd';

export type ColorPalette = 'bw' | 'bwr' | 'bwry' | 'cmyk' | 'full_color';

export interface DeviceProfile {
  id: string;
  name: string;
  type: DeviceType;
  screen_size_inches?: number; // e.g. 2.1, 2.9, 4.2, 7.5, 32.0
  dimensions: {
    width_mm: number;
    height_mm: number;
    width_px?: number;
    height_px?: number;
  };
  resolution_dpi: number; // e.g. 110-150 for ESL, 300 for Print, 72-96 for LCD
  color_palette: ColorPalette;
  refresh_latency_ms: number; // e.g. 3000ms for E-ink, 16ms for 60Hz LCD, 0ms for Print
  capabilities: {
    allows_animation: boolean;
    allows_video: boolean;
    allows_high_res_assets: boolean;
    requires_1bit_raster: boolean;
    max_colors?: number;
  };
}

export interface StoreContext {
  store_id: string;
  store_name: string;
  location: string;
  region: string;
  currency: string; // e.g. "EUR", "USD", "FCFA"
  tax_rate: number;
  active_campaigns: string[]; // e.g. ["NATIONAL_SUMMER_PROMO", "BIO_FESTIVAL"]
  is_franchise?: boolean;
}

export interface ExecutionContext {
  product: Record<string, any>;
  store: StoreContext;
  device: DeviceProfile;
  trigger?: TriggerType | TriggerType[];
  timestamp?: string; // ISO 8601 string, defaults to current time
}

export type TriggerType =
  | 'on_price_update'
  | 'on_stock_drop'
  | 'on_promo_active'
  | 'schedule_event'
  | 'on_device_render'
  | 'manual_simulation';

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'in_range'
  | 'is_empty'
  | 'is_not_empty';

export interface RuleCondition {
  id: string;
  field_path: string; // e.g. "product.DISCOUNT_PCT", "device.type", "device.screen_size_inches", "store.region"
  operator: ConditionOperator;
  value?: any;
  value_to?: any; // for 'in_range'
}

export interface RuleConditionGroup {
  id: string;
  logical_operator: 'AND' | 'OR' | 'NOT';
  conditions: (RuleCondition | RuleConditionGroup)[];
}

export type ActionType =
  | 'enrich_data'
  | 'invert_colors'
  | 'hide_element'
  | 'show_element'
  | 'truncate_text'
  | 'auto_scale_font'
  | 'inject_asset'
  | 'inject_animation'
  | 'template_fallback'
  | 'override_style';

export interface RuleAction {
  id: string;
  type: ActionType;
  conflict_key?: string; // Target key used for deterministic priority resolution (e.g. "promo_styling", "layout_mode", "price_display")
  target_element_id?: string; // Optional element ID or role (e.g. "price_block", "long_description", "badge_area")
  parameters: {
    field_name?: string;
    field_value?: any;
    expression?: string; // e.g. "product.SELLING_PRICE * (1 - product.DISCOUNT_PCT / 100)"
    bg_color?: string;
    text_color?: string;
    asset_url?: string;
    asset_type?: 'image_cmyk' | 'image_1bit' | 'video_mp4' | 'badge_vector';
    asset_role?: 'promo_stamp' | 'eco_score' | 'origin_flag';
    animation_type?: 'pulse' | 'marquee' | 'flash' | 'price_bounce';
    animation_duration_ms?: number;
    max_chars?: number;
    scale_factor?: number;
    font_weight?: 'normal' | '500' | '600' | 'bold' | '800';
    fallback_template_id?: string;
    description?: string;
  };
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number; // 1 to 1000 (higher number wins in conflict resolution)
  trigger: TriggerType;
  condition_group: RuleConditionGroup;
  actions: RuleAction[];
  time_bound?: {
    enabled: boolean;
    start_time?: string; // ISO string
    end_time?: string; // ISO string
  };
  device_types?: DeviceType[]; // Optional filter, if empty applies to all
}

export interface ConflictLog {
  conflict_key: string;
  target_element_id?: string;
  action_type: ActionType;
  winning_rule_id: string;
  winning_rule_name: string;
  winning_priority: number;
  superseded_rule_id: string;
  superseded_rule_name: string;
  superseded_priority: number;
  rationale: string;
}

export interface RuleEvaluationLog {
  rule_id: string;
  rule_name: string;
  priority: number;
  trigger_matched: boolean;
  time_valid: boolean;
  conditions_matched: boolean;
  applied: boolean;
  actions_count: number;
  details?: string;
}

export interface EnrichedPayload {
  context: {
    product_id: string;
    product_sku: string;
    store_id: string;
    device_id: string;
    device_type: DeviceType;
    device_screen_size?: number;
    evaluated_at: string;
    execution_time_ms: number;
  };
  enriched_product: Record<string, any>;
  layout_instructions: {
    color_mode: 'standard' | 'inverted' | 'monochrome_bwr' | 'grayscale';
    style_overrides: Record<string, {
      bg_color?: string;
      text_color?: string;
      border_color?: string;
      font_scale?: number;
      font_weight?: string;
      visibility?: 'visible' | 'hidden';
    }>;
    hidden_elements: string[];
    visible_elements: string[];
    text_truncations: Record<string, {
      max_chars: number;
      ellipsis: boolean;
      original_text: string;
      truncated_text: string;
    }>;
    assets_to_inject: {
      target_id?: string;
      role: string;
      url: string;
      type: string;
      cmyk_ready?: boolean;
      one_bit_ready?: boolean;
    }[];
    animation_triggers: {
      target_id?: string;
      type: 'pulse' | 'marquee' | 'flash' | 'price_bounce';
      duration_ms: number;
      repeat: 'infinite' | number;
      video_url?: string;
    }[];
    fallback_template_applied?: boolean;
    recommended_template_id?: string;
  };
  audit_trail: {
    total_rules_in_system: number;
    rules_evaluated: number;
    rules_matched: string[];
    rules_applied: string[];
    conflicts_resolved: ConflictLog[];
    rule_logs: RuleEvaluationLog[];
    execution_time_ms: number;
    sla_respected: boolean; // under 50ms per item
  };
}

export interface EvaluationResult {
  success: boolean;
  payload: EnrichedPayload;
  error?: string;
}
