import { Rule } from './types';

export const DEFAULT_RULES: Rule[] = [
  // 1. Core Acceptance Criteria Rule: 30%+ Promo Omni-Channel Adaptation
  {
    id: 'RULE_PROMO_30_OMNICHANNEL',
    name: 'Promo Exceptionnelle ≥ 30% (Adaptation Omni-Canal)',
    description: 'Sur remise ≥ 30% : enrichit les données promotionnelles et applique un style prix compatible avec la cible sélectionnée.',
    enabled: true,
    priority: 800, // High Priority
    trigger: 'on_promo_active',
    condition_group: {
      id: 'grp_promo_30',
      logical_operator: 'AND',
      conditions: [
        {
          id: 'c_discount_gte_30',
          field_path: 'product.DISCOUNT_PCT',
          operator: 'gte',
          value: 30,
        },
      ],
    },
    actions: [
      {
        id: 'act_enrich_promo_badge',
        type: 'enrich_data',
        conflict_key: 'promo_badge',
        parameters: {
          field_name: 'PROMO_BANNER_TEXT',
          field_value: 'MEGA PROMO -30%',
          description: 'Calcul du libellé percutant méga promo',
        },
      },
      {
        id: 'act_eink_invert_on_promo',
        type: 'invert_colors',
        conflict_key: 'promo_styling',
        target_element_id: 'price_block',
        parameters: {
          bg_color: '#dc2626', // Rouge bloc E-Ink BWR
          text_color: '#ffffff', // Texte blanc inversé
          description: 'Inversion de contraste blanc sur bloc rouge/noir pour E-ink',
        },
      },
      {
        id: 'act_lcd_animation',
        type: 'inject_animation',
        conflict_key: 'screen_fx',
        target_element_id: 'price_block',
        parameters: {
          animation_type: 'pulse',
          animation_duration_ms: 1200,
          asset_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          description: 'Pulsation dynamique du prix et bandeau vidéo promotionnel pour écran LCD',
        },
      },
    ],
  },

  // 2. Conflicting Rule to test Priority Conflict Resolution
  // (e.g. Local Margin Rule with priority 400 that also tries to set promo_styling to subtle neutral)
  {
    id: 'RULE_LOCAL_STORE_MARGIN',
    name: 'Marge Magasin Locale (Atténuation Promotionnelle)',
    description: 'Règle locale franchisée visant à conserver un style de prix sobre et neutre (priorité modérée 400).',
    enabled: true,
    priority: 400, // Lower priority than RULE_PROMO_30_OMNICHANNEL (800)
    trigger: 'on_promo_active',
    condition_group: {
      id: 'grp_local_margin',
      logical_operator: 'AND',
      conditions: [
        {
          id: 'c_has_discount',
          field_path: 'product.DISCOUNT_PCT',
          operator: 'gt',
          value: 0,
        },
      ],
    },
    actions: [
      {
        id: 'act_subtle_promo_styling',
        type: 'override_style',
        conflict_key: 'promo_styling', // Collides with promo_styling from RULE_PROMO_30_OMNICHANNEL
        target_element_id: 'price_block',
        parameters: {
          bg_color: '#f1f5f9', // Gris très pâle discret
          text_color: '#0f172a',
          description: 'Style neutre discret sans bloc rouge vif',
        },
      },
      {
        id: 'act_local_margin_enrich',
        type: 'enrich_data',
        conflict_key: 'margin_flag',
        parameters: {
          field_name: 'LOCAL_MARGIN_PROTECTED',
          field_value: true,
          description: 'Marquage d audit de protection de marge locale',
        },
      },
    ],
  },

  // 3. E-Ink Physical Constraints & Minimalist Template Fallback
  {
    id: 'RULE_EINK_PHYSICAL_GUARD',
    name: 'Garde Physique E-Ink (Écrans Compacts ≤ 2.5")',
    description: 'Tronque le nom du produit à 24 caractères et active le gabarit minimaliste si la taille écran est restreinte.',
    enabled: true,
    priority: 600,
    trigger: 'on_device_render',
    device_types: ['eink'],
    condition_group: {
      id: 'grp_eink_size',
      logical_operator: 'AND',
      conditions: [
        {
          id: 'c_device_is_eink',
          field_path: 'device.type',
          operator: 'eq',
          value: 'eink',
        },
        {
          id: 'c_screen_size_small',
          field_path: 'device.screen_size_inches',
          operator: 'lte',
          value: 2.5,
        },
      ],
    },
    actions: [
      {
        id: 'act_truncate_itemname',
        type: 'truncate_text',
        conflict_key: 'name_truncation',
        target_element_id: 'ITEMNAME',
        parameters: {
          max_chars: 26,
          scale_factor: 0.9,
          description: 'Troncature dynamique à 26 caractères avec points de suspension',
        },
      },
      {
        id: 'act_eink_hide_description',
        type: 'hide_element',
        conflict_key: 'long_desc_visibility',
        target_element_id: 'ITEMDESCRIPTION',
        parameters: {
          description: 'Masquage de la description longue sur écran compact <= 2.5"',
        },
      },
      {
        id: 'act_template_fallback',
        type: 'template_fallback',
        conflict_key: 'layout_template',
        parameters: {
          fallback_template_id: 'MINIMALIST_ESL_2INCH',
          description: 'Bascule vers le gabarit d étiquette épuré haute lisibilité',
        },
      },
    ],
  },

  // 4. Digital Screen Signage Rule (Animations & Video)
  {
    id: 'RULE_DIGITAL_SIGNAGE_ANIMATION',
    name: 'Affichage Dynamique LCD / Vidéo & Flash',
    description: 'Injecte des indicateurs clignotants et un flux vidéo sur les écrans numériques.',
    enabled: true,
    priority: 500,
    trigger: 'on_device_render',
    device_types: ['lcd'],
    condition_group: {
      id: 'grp_lcd',
      logical_operator: 'AND',
      conditions: [
        {
          id: 'c_device_is_lcd',
          field_path: 'device.type',
          operator: 'eq',
          value: 'lcd',
        },
      ],
    },
    actions: [
      {
        id: 'act_lcd_marquee',
        type: 'inject_animation',
        conflict_key: 'title_animation',
        target_element_id: 'ITEMNAME',
        parameters: {
          animation_type: 'marquee',
          animation_duration_ms: 6000,
          description: 'Défilement horizontal élégant du titre du produit',
        },
      },
      {
        id: 'act_lcd_badge_flash',
        type: 'inject_animation',
        conflict_key: 'flash_badge',
        target_element_id: 'PROMO_LABEL',
        parameters: {
          animation_type: 'flash',
          animation_duration_ms: 1500,
          description: 'Clignotement doux de l étiquette promotionnelle',
        },
      },
    ],
  },

  // 5. Time-Bound Marketing Campaign (Happy Hour / Weekend Flash)
  {
    id: 'RULE_WEEKEND_FLASH_CAMPAIGN',
    name: 'Campagne Flash Week-End (Validité Temporelle Programmée)',
    description: 'Règle horodatée automatique active uniquement pendant la fenêtre de vente flash.',
    enabled: true,
    priority: 750,
    trigger: 'schedule_event',
    time_bound: {
      enabled: true,
      start_time: '2026-01-01T00:00:00Z',
      end_time: '2027-12-31T23:59:59Z',
    },
    condition_group: {
      id: 'grp_flash_campaign',
      logical_operator: 'AND',
      conditions: [
        {
          id: 'c_store_campaign',
          field_path: 'store.active_campaigns',
          operator: 'contains',
          value: 'NATIONAL_SUMMER_PROMO',
        },
      ],
    },
    actions: [
      {
        id: 'act_flash_campaign_tag',
        type: 'enrich_data',
        conflict_key: 'campaign_tag',
        parameters: {
          field_name: 'CAMPAIGN_STATUS',
          field_value: 'VENTE FLASH ACTIVE',
          description: 'Injection du statut de campagne nationale vérifiée',
        },
      },
    ],
  },

  // 6. Bio / Eco-Score Regulatory Tagging
  {
    id: 'RULE_BIO_ORIGIN_TAG',
    name: 'Valorisation Bio & Origine France',
    description: 'Enrichit le produit et injecte le macaron Éco-Score A / Bio si certifié ou Origine France.',
    enabled: true,
    priority: 350,
    trigger: 'on_price_update',
    condition_group: {
      id: 'grp_origin_bio',
      logical_operator: 'OR',
      conditions: [
        {
          id: 'c_origin_france',
          field_path: 'product.ORIGIN_COUNTRY',
          operator: 'eq',
          value: 'France',
        },
        {
          id: 'c_category_bio',
          field_path: 'product.ITEMNAME',
          operator: 'contains',
          value: 'Bio',
        },
      ],
    },
    actions: [
      {
        id: 'act_inject_eco_badge',
        type: 'inject_asset',
        conflict_key: 'eco_badge',
        target_element_id: 'badge_area',
        parameters: {
          asset_role: 'eco_score',
          asset_type: 'badge_vector',
          asset_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&q=80',
          description: 'Macaron filière locale et engagement responsable',
        },
      },
    ],
  },
];
