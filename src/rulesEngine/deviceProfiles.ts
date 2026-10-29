import { DeviceProfile, StoreContext } from './types';

export const DEVICE_PROFILES: Record<string, DeviceProfile> = {
  EINK_2_1_INCH: {
    id: 'EINK_2_1_INCH',
    name: 'ESL E-Ink 2.1" (BWR 3-Couleurs)',
    type: 'eink',
    screen_size_inches: 2.1,
    dimensions: {
      width_mm: 48.0,
      height_mm: 24.0,
      width_px: 250,
      height_px: 122,
    },
    resolution_dpi: 130,
    color_palette: 'bwr',
    refresh_latency_ms: 3200,
    capabilities: {
      allows_animation: false,
      allows_video: false,
      allows_high_res_assets: false,
      requires_1bit_raster: true,
      max_colors: 3, // Noir, Blanc, Rouge
    },
  },

  EINK_2_9_INCH: {
    id: 'EINK_2_9_INCH',
    name: 'ESL E-Ink 2.9" (BWR Haute Densité)',
    type: 'eink',
    screen_size_inches: 2.9,
    dimensions: {
      width_mm: 66.9,
      height_mm: 29.1,
      width_px: 296,
      height_px: 128,
    },
    resolution_dpi: 112,
    color_palette: 'bwr',
    refresh_latency_ms: 2800,
    capabilities: {
      allows_animation: false,
      allows_video: false,
      allows_high_res_assets: false,
      requires_1bit_raster: true,
      max_colors: 3,
    },
  },

  EINK_4_2_INCH: {
    id: 'EINK_4_2_INCH',
    name: 'ESL E-Ink 4.2" (BWR Tête de Gondole)',
    type: 'eink',
    screen_size_inches: 4.2,
    dimensions: {
      width_mm: 84.8,
      height_mm: 63.6,
      width_px: 400,
      height_px: 300,
    },
    resolution_dpi: 120,
    color_palette: 'bwr',
    refresh_latency_ms: 3500,
    capabilities: {
      allows_animation: false,
      allows_video: false,
      allows_high_res_assets: false,
      requires_1bit_raster: true,
      max_colors: 3,
    },
  },

  PRINT_HIGH_RES_A4: {
    id: 'PRINT_HIGH_RES_A4',
    name: 'Impression Haute Définition (Papier / Affiche A4)',
    type: 'print',
    dimensions: {
      width_mm: 210.0,
      height_mm: 297.0,
      width_px: 2480,
      height_px: 3508,
    },
    resolution_dpi: 300,
    color_palette: 'cmyk',
    refresh_latency_ms: 0,
    capabilities: {
      allows_animation: false,
      allows_video: false,
      allows_high_res_assets: true,
      requires_1bit_raster: false,
    },
  },

  PRINT_SHELF_LABEL: {
    id: 'PRINT_SHELF_LABEL',
    name: 'Impression Étiquette Rayon Papier (70x35mm)',
    type: 'print',
    dimensions: {
      width_mm: 70.0,
      height_mm: 35.0,
      width_px: 827,
      height_px: 413,
    },
    resolution_dpi: 300,
    color_palette: 'cmyk',
    refresh_latency_ms: 0,
    capabilities: {
      allows_animation: false,
      allows_video: false,
      allows_high_res_assets: true,
      requires_1bit_raster: false,
    },
  },

  DIGITAL_SIGNAGE_32_LCD: {
    id: 'DIGITAL_SIGNAGE_32_LCD',
    name: 'Écran Numérique LCD 32" (Full HD 60Hz Dynamique)',
    type: 'lcd',
    screen_size_inches: 32.0,
    dimensions: {
      width_mm: 708.0,
      height_mm: 398.0,
      width_px: 1920,
      height_px: 1080,
    },
    resolution_dpi: 70,
    color_palette: 'full_color',
    refresh_latency_ms: 16,
    capabilities: {
      allows_animation: true,
      allows_video: true,
      allows_high_res_assets: true,
      requires_1bit_raster: false,
    },
  },
};

export const SAMPLE_STORES: StoreContext[] = [
  {
    store_id: 'STORE-FR-042',
    store_name: 'Hypermarché Paris Nation',
    location: 'Paris, France',
    region: 'Île-de-France',
    currency: 'EUR',
    tax_rate: 20.0,
    active_campaigns: ['NATIONAL_SUMMER_PROMO', 'BIO_FESTIVAL'],
    is_franchise: false,
  },
  {
    store_id: 'STORE-FR-099',
    store_name: 'Supermarché Lyon Part-Dieu',
    location: 'Lyon, France',
    region: 'Auvergne-Rhône-Alpes',
    currency: 'EUR',
    tax_rate: 20.0,
    active_campaigns: ['NATIONAL_SUMMER_PROMO', 'LOCAL_MARGIN_DEFENSE'],
    is_franchise: true,
  },
  {
    store_id: 'STORE-CI-001',
    store_name: 'Supermarché Abidjan Cocody',
    location: 'Abidjan, Côte d\'Ivoire',
    region: 'Lagunes',
    currency: 'FCFA',
    tax_rate: 18.0,
    active_campaigns: ['PROMO_CASH_CARRY'],
    is_franchise: false,
  },
];
