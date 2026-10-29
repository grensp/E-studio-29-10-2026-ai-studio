/**
 * Object Model Hierarchy & Typography Extensions for E-Studio
 * Provides BaseTemplateItem class and specific typed subclasses,
 * plus helper functions for unified property mutations and multi-selection merging.
 */

import {
  ItemType,
  TemplateItem,
  TextItemProperties,
  ShapeItemProperties,
  EllipseItemProperties,
  LineItemProperties,
  ImageItemProperties,
  QRCodeItemProperties,
  BarcodeItemProperties,
  TierPriceItemProperties,
  RestrictedAreaItemProperties,
  BaseItemProperties,
} from '../types';
import { isPriceRelatedElement, sanitizeNonPriceElement } from '../utils/pricingEngine';

// Standard available fonts in browser and export engines
export const AVAILABLE_FONTS = [
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans (Moderne)' },
  { value: 'Helvetica', label: 'Helvetica / Arial (Standard)' },
  { value: 'Oswald', label: 'Oswald (Condensé & Impact)' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono (Monospace)' },
  { value: 'Impact', label: 'Impact (Grand Prix / Promo)' },
  { value: 'Georgia', label: 'Georgia (Sérif Classique)' },
  { value: 'Courier New', label: 'Courier New (Code-barres text)' },
];

export const FONT_WEIGHTS = [
  { value: 'normal', label: 'Normal (400)' },
  { value: '500', label: 'Medium (500)' },
  { value: '600', label: 'Semi-Bold (600)' },
  { value: 'bold', label: 'Gras / Bold (700)' },
  { value: '800', label: 'Extra-Bold (800)' },
] as const;

export const TEXT_ALIGNMENTS = [
  { value: 'left', label: 'Gauche' },
  { value: 'center', label: 'Centré' },
  { value: 'right', label: 'Droite' },
  { value: 'justify', label: 'Justifié' },
] as const;

export const VERTICAL_ALIGNMENTS = [
  { value: 'top', label: 'Haut' },
  { value: 'middle', label: 'Milieu' },
  { value: 'bottom', label: 'Bas' },
] as const;

export const TEXT_TRANSFORMS = [
  { value: 'none', label: 'Normal' },
  { value: 'uppercase', label: 'MAJUSCULE' },
  { value: 'lowercase', label: 'minuscule' },
  { value: 'capitalize', label: 'Première Lettre' },
] as const;

export const CURRENCY_SYMBOLS = [
  { value: '€', label: '€ (Euro - Zone Euro)' },
  { value: '$', label: '$ (Dollar - US / CA / AU)' },
  { value: '£', label: '£ (Livre Sterling - UK)' },
  { value: '¥', label: '¥ (Yen / Yuan - JP / CN)' },
  { value: 'CHF', label: 'CHF (Franc Suisse)' },
  { value: '₹', label: '₹ (Roupie Indienne)' },
  { value: 'R$', label: 'R$ (Real Brésilien)' },
  { value: 'zł', label: 'zł (Zloty Polonais)' },
  { value: 'kr', label: 'kr (Couronne Suédoise / Danoise)' },
  { value: '₺', label: '₺ (Livre Turque)' },
  { value: 'AED', label: 'AED (Dirham Émirats)' },
  { value: 'SAR', label: 'SAR (Riyal Saoudien)' },
  { value: '₫', label: '₫ (Dong Vietnamien)' },
  { value: '฿', label: '฿ (Baht Thaïlandais)' },
  { value: '₩', label: '₩ (Won Sud-Coréen)' },
  { value: '₱', label: '₱ (Peso Philippin)' },
  { value: '₪', label: '₪ (Shekel Israélien)' },
  { value: 'FCFA', label: 'FCFA (Franc CFA Afrique)' },
  { value: 'MAD', label: 'MAD (Dirham Marocain)' },
  { value: 'DZD', label: 'DZD (Dinar Algérien)' },
  { value: 'TND', label: 'TND (Dinar Tunisien)' },
  { value: 'GNF', label: 'GNF (Franc Guinéen)' },
] as const;

export const FONT_SIZE_PRESETS = [
  6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 84, 96,
];

/**
 * Base Object Class representing any canvas template element
 */
export abstract class BaseTemplateObject<T extends TemplateItem = TemplateItem> {
  protected props: T;

  constructor(props: T) {
    this.props = { ...props };
  }

  public get id(): string {
    return this.props.id;
  }

  public get type(): ItemType {
    return this.props.type;
  }

  public get properties(): T {
    return { ...this.props };
  }

  public update(patch: Partial<T>): T {
    this.props = { ...this.props, ...patch };
    return this.properties;
  }

  public setPosition(x_mm: number, y_mm: number): void {
    this.props.x_mm = Math.round(x_mm * 10) / 10;
    this.props.y_mm = Math.round(y_mm * 10) / 10;
  }

  public setSize(w_mm: number, h_mm: number): void {
    this.props.w_mm = Math.max(1, Math.round(w_mm * 10) / 10);
    this.props.h_mm = Math.max(1, Math.round(h_mm * 10) / 10);
  }

  public setLocked(locked: boolean): void {
    this.props.locked = locked;
  }

  public setRotation(rotation: number): void {
    this.props.rotation = (rotation % 360 + 360) % 360;
  }

  public abstract clone(newId?: string, offsetMm?: number): TemplateItem;
}

/**
 * Text Element Subclass
 */
export class TextTemplateObject extends BaseTemplateObject<TextItemProperties> {
  public clone(newId?: string, offsetMm: number = 3): TextItemProperties {
    return {
      ...this.properties,
      id: newId || `text_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      x_mm: this.properties.x_mm + offsetMm,
      y_mm: this.properties.y_mm + offsetMm,
      z_index: this.properties.z_index + 1,
    };
  }
}

/**
 * Shape Element Subclass
 */
export class ShapeTemplateObject extends BaseTemplateObject<ShapeItemProperties> {
  public clone(newId?: string, offsetMm: number = 3): ShapeItemProperties {
    return {
      ...this.properties,
      id: newId || `shape_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      x_mm: this.properties.x_mm + offsetMm,
      y_mm: this.properties.y_mm + offsetMm,
      z_index: this.properties.z_index + 1,
    };
  }
}

/**
 * Barcode Element Subclass
 */
export class BarcodeTemplateObject extends BaseTemplateObject<BarcodeItemProperties> {
  public clone(newId?: string, offsetMm: number = 3): BarcodeItemProperties {
    return {
      ...this.properties,
      id: newId || `barcode_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      x_mm: this.properties.x_mm + offsetMm,
      y_mm: this.properties.y_mm + offsetMm,
      z_index: this.properties.z_index + 1,
    };
  }
}

/**
 * Tier Price Element Subclass
 */
export class TierPriceTemplateObject extends BaseTemplateObject<TierPriceItemProperties> {
  public clone(newId?: string, offsetMm: number = 3): TierPriceItemProperties {
    return {
      ...this.properties,
      id: newId || `tier_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      x_mm: this.properties.x_mm + offsetMm,
      y_mm: this.properties.y_mm + offsetMm,
      z_index: this.properties.z_index + 1,
    };
  }
}

/**
 * Restricted Area / Constraint Element Subclass
 */
export class RestrictedAreaTemplateObject extends BaseTemplateObject<RestrictedAreaItemProperties> {
  public clone(newId?: string, offsetMm: number = 3): RestrictedAreaItemProperties {
    return {
      ...this.properties,
      id: newId || `restricted_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      x_mm: this.properties.x_mm + offsetMm,
      y_mm: this.properties.y_mm + offsetMm,
      z_index: this.properties.z_index + 1,
    };
  }
}

/**
 * Factory creating object wrapper instance
 */
export function createObjectInstance(item: TemplateItem): BaseTemplateObject {
  switch (item.type) {
    case 'text':
      return new TextTemplateObject(item);
    case 'shape':
      return new ShapeTemplateObject(item);
    case 'barcode':
      return new BarcodeTemplateObject(item);
    case 'tier_price':
      return new TierPriceTemplateObject(item);
    case 'restricted_area':
      return new RestrictedAreaTemplateObject(item);
    default:
      return new (class extends BaseTemplateObject {
        clone(newId?: string, offsetMm = 3) {
          return {
            ...this.properties,
            id: newId || `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            x_mm: this.properties.x_mm + offsetMm,
            y_mm: this.properties.y_mm + offsetMm,
            z_index: this.properties.z_index + 1,
          };
        }
      })(item);
  }
}

export const PRESET_FONT_SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72];

/**
 * Multi-selection helper:
 * Returns the intersection of shared values for given properties across multiple items.
 * If values differ, returns undefined or special 'mixed' sentinel.
 */
export interface CommonProperties {
  // Geometry & Positioning
  x_mm?: number;
  y_mm?: number;
  w_mm?: number;
  h_mm?: number;
  rotation?: number;
  locked?: boolean;

  // Typography (for text & items supporting typography)
  font_family?: string;
  font_size_pt?: number;
  font_weight?: string;
  font_style?: string;
  text_decoration?: string;
  text_color?: string;
  alignment?: string;
  valign?: string;
  letter_spacing_pt?: number;
  line_height_multiplier?: number;
  text_transform?: string;
  highlight_color?: string;
  subscript_superscript?: string;

  // Colors & Borders
  fill_color?: string;
  border_color?: string;
  border_width?: number;
  corner_radius?: number;

  // Currency properties
  is_price?: boolean;
  currency_symbol?: string;
  currency_position?: 'after' | 'before' | 'superscript' | 'subscript';
  currency_font_family?: string;
  currency_font_size_pt?: number;
  currency_font_weight?: string;
  currency_font_style?: string;
  currency_color?: string;
  currency_spacing_pt?: number;

  // Barcode / Elements
  bar_color?: string;
  barcode_type?: string;
  show_text?: boolean;

  // Restricted Area
  zone_color?: string;
  pattern?: string;
  opacity?: number;
  warn_on_overlap?: boolean;
}

export function extractCommonProperties(items: TemplateItem[]): CommonProperties {
  if (!items || items.length === 0) return {};
  if (items.length === 1) {
    const it = items[0] as any;
    return {
      x_mm: it.x_mm,
      y_mm: it.y_mm,
      w_mm: it.w_mm,
      h_mm: it.h_mm,
      rotation: it.rotation,
      locked: it.locked,
      font_family: it.font_family,
      font_size_pt: it.font_size_pt,
      font_weight: it.font_weight,
      font_style: it.font_style,
      text_decoration: it.text_decoration,
      text_color: it.text_color,
      alignment: it.alignment,
      valign: it.valign,
      letter_spacing_pt: it.letter_spacing_pt,
      line_height_multiplier: it.line_height_multiplier,
      text_transform: it.text_transform,
      highlight_color: it.highlight_color,
      subscript_superscript: it.subscript_superscript,
      fill_color: it.fill_color,
      border_color: it.border_color,
      border_width: it.border_width,
      corner_radius: it.corner_radius,
      ...(isPriceRelatedElement(items[0])
        ? {
            is_price: it.is_price,
            currency_symbol: it.currency_symbol,
            currency_position: it.currency_position,
            currency_font_family: it.currency_font_family,
            currency_font_size_pt: it.currency_font_size_pt,
            currency_font_weight: it.currency_font_weight,
            currency_font_style: it.currency_font_style,
            currency_color: it.currency_color,
            currency_spacing_pt: it.currency_spacing_pt,
          }
        : {}),
      bar_color: it.bar_color,
      barcode_type: it.barcode_type,
      show_text: it.show_text,
      zone_color: it.zone_color,
      pattern: it.pattern,
      opacity: it.opacity,
      warn_on_overlap: it.warn_on_overlap,
    };
  }

  const first = items[0] as any;
  const common: CommonProperties = {};

  const keys: (keyof CommonProperties)[] = [
    'w_mm',
    'h_mm',
    'rotation',
    'locked',
    'font_family',
    'font_size_pt',
    'font_weight',
    'font_style',
    'text_decoration',
    'text_color',
    'alignment',
    'valign',
    'letter_spacing_pt',
    'line_height_multiplier',
    'text_transform',
    'highlight_color',
    'subscript_superscript',
    'fill_color',
    'border_color',
    'border_width',
    'corner_radius',
    'is_price',
    'currency_symbol',
    'currency_position',
    'currency_font_family',
    'currency_font_size_pt',
    'currency_font_weight',
    'currency_font_style',
    'currency_color',
    'currency_spacing_pt',
    'bar_color',
    'barcode_type',
    'show_text',
    'zone_color',
    'pattern',
    'opacity',
    'warn_on_overlap',
  ];

  const priceKeys: (keyof CommonProperties)[] = [
    'is_price',
    'currency_symbol',
    'currency_position',
    'currency_font_family',
    'currency_font_size_pt',
    'currency_font_weight',
    'currency_font_style',
    'currency_color',
    'currency_spacing_pt',
  ];

  const allArePriceRelated = items.every((it) => isPriceRelatedElement(it));

  for (const key of keys) {
    if (priceKeys.includes(key) && !allArePriceRelated) {
      continue;
    }
    const allHaveIt = items.every((it: any) => it[key] !== undefined);
    if (allHaveIt) {
      const allEqual = items.every((it: any) => it[key] === first[key]);
      if (allEqual) {
        (common as any)[key] = first[key];
      }
    }
  }

  return common;
}

/**
 * Style payload for Copy Style / Paste Style actions
 */
export interface ElementStylePayload {
  // Typography
  font_family?: string;
  font_size_pt?: number;
  font_weight?: string;
  font_style?: string;
  text_decoration?: string;
  text_color?: string;
  alignment?: string;
  valign?: string;
  letter_spacing_pt?: number;
  line_height_multiplier?: number;
  text_transform?: string;
  highlight_color?: string;
  subscript_superscript?: string;
  
  // Fill & Colors
  fill_color?: string;
  bg_color?: string;
  
  // Borders & Outlines
  border_color?: string;
  border_width?: number;
  corner_radius?: number;
  color?: string; // for line
  thickness?: number; // for line
  style?: string; // for line

  // Price & Currency styling
  is_price?: boolean;
  currency_symbol?: string;
  currency_position?: 'after' | 'before' | 'superscript' | 'subscript';
  currency_font_family?: string;
  currency_font_size_pt?: number;
  currency_font_weight?: 'normal' | '500' | '600' | 'bold' | '800';
  currency_font_style?: 'normal' | 'italic';
  currency_color?: string;
  currency_spacing_pt?: number;

  // Barcode styling
  bar_color?: string;
  module_color?: string;
  background_color?: string;

  // Restricted Area
  zone_color?: string;
  pattern?: string;
  opacity?: number;
}

/**
 * Extracts all transferable styling properties from an element
 */
export function extractElementStyle(item: TemplateItem): ElementStylePayload {
  const it = item as any;
  const style: ElementStylePayload = {};

  if (it.font_family !== undefined) style.font_family = it.font_family;
  if (it.font_size_pt !== undefined) style.font_size_pt = it.font_size_pt;
  if (it.font_weight !== undefined) style.font_weight = it.font_weight;
  if (it.font_style !== undefined) style.font_style = it.font_style;
  if (it.text_decoration !== undefined) style.text_decoration = it.text_decoration;
  if (it.text_color !== undefined) style.text_color = it.text_color;
  if (it.alignment !== undefined) style.alignment = it.alignment;
  if (it.valign !== undefined) style.valign = it.valign;
  if (it.letter_spacing_pt !== undefined) style.letter_spacing_pt = it.letter_spacing_pt;
  if (it.line_height_multiplier !== undefined) style.line_height_multiplier = it.line_height_multiplier;
  if (it.text_transform !== undefined) style.text_transform = it.text_transform;
  if (it.highlight_color !== undefined) style.highlight_color = it.highlight_color;
  if (it.subscript_superscript !== undefined) style.subscript_superscript = it.subscript_superscript;

  if (it.fill_color !== undefined) style.fill_color = it.fill_color;
  if (it.border_color !== undefined) style.border_color = it.border_color;
  if (it.border_width !== undefined) style.border_width = it.border_width;
  if (it.corner_radius !== undefined) style.corner_radius = it.corner_radius;

  if (it.color !== undefined) style.color = it.color;
  if (it.thickness !== undefined) style.thickness = it.thickness;
  if (it.style !== undefined) style.style = it.style;

  // Currency & price properties are only extracted if the element is price-related
  if (isPriceRelatedElement(item)) {
    if (it.is_price !== undefined) style.is_price = it.is_price;
    if (it.currency_symbol !== undefined) style.currency_symbol = it.currency_symbol;
    if (it.currency_position !== undefined) style.currency_position = it.currency_position;
    if (it.currency_font_family !== undefined) style.currency_font_family = it.currency_font_family;
    if (it.currency_font_size_pt !== undefined) style.currency_font_size_pt = it.currency_font_size_pt;
    if (it.currency_font_weight !== undefined) style.currency_font_weight = it.currency_font_weight;
    if (it.currency_font_style !== undefined) style.currency_font_style = it.currency_font_style;
    if (it.currency_color !== undefined) style.currency_color = it.currency_color;
    if (it.currency_spacing_pt !== undefined) style.currency_spacing_pt = it.currency_spacing_pt;
  }

  if (it.bar_color !== undefined) style.bar_color = it.bar_color;
  if (it.module_color !== undefined) style.module_color = it.module_color;
  if (it.background_color !== undefined) style.background_color = it.background_color;

  if (it.zone_color !== undefined) style.zone_color = it.zone_color;
  if (it.pattern !== undefined) style.pattern = it.pattern;
  if (it.opacity !== undefined) style.opacity = it.opacity;

  return style;
}

/**
 * Applies a copied style payload to a target element safely depending on its type
 */
export function applyElementStyle(target: TemplateItem, style: ElementStylePayload): TemplateItem {
  const result: any = { ...target };

  if (target.type === 'text') {
    if (style.font_family !== undefined) result.font_family = style.font_family;
    if (style.font_size_pt !== undefined) result.font_size_pt = style.font_size_pt;
    if (style.font_weight !== undefined) result.font_weight = style.font_weight;
    if (style.font_style !== undefined) result.font_style = style.font_style;
    if (style.text_decoration !== undefined) result.text_decoration = style.text_decoration;
    if (style.text_color !== undefined) result.text_color = style.text_color;
    if (style.alignment !== undefined) result.alignment = style.alignment;
    if (style.valign !== undefined) result.valign = style.valign;
    if (style.letter_spacing_pt !== undefined) result.letter_spacing_pt = style.letter_spacing_pt;
    if (style.line_height_multiplier !== undefined) result.line_height_multiplier = style.line_height_multiplier;
    if (style.text_transform !== undefined) result.text_transform = style.text_transform;
    if (style.highlight_color !== undefined) result.highlight_color = style.highlight_color;
    if (style.subscript_superscript !== undefined) result.subscript_superscript = style.subscript_superscript;

    if (style.fill_color !== undefined) result.fill_color = style.fill_color;
    if (style.border_color !== undefined) result.border_color = style.border_color;
    if (style.border_width !== undefined) result.border_width = style.border_width;
    if (style.corner_radius !== undefined) result.corner_radius = style.corner_radius;

    // Price & currency styling is ONLY applied to price-related elements
    if (isPriceRelatedElement(target)) {
      if (style.is_price !== undefined) result.is_price = style.is_price;
      if (style.currency_symbol !== undefined) result.currency_symbol = style.currency_symbol;
      if (style.currency_position !== undefined) result.currency_position = style.currency_position;
      if (style.currency_font_family !== undefined) result.currency_font_family = style.currency_font_family;
      if (style.currency_font_size_pt !== undefined) result.currency_font_size_pt = style.currency_font_size_pt;
      if (style.currency_font_weight !== undefined) result.currency_font_weight = style.currency_font_weight;
      if (style.currency_font_style !== undefined) result.currency_font_style = style.currency_font_style;
      if (style.currency_color !== undefined) result.currency_color = style.currency_color;
      if (style.currency_spacing_pt !== undefined) result.currency_spacing_pt = style.currency_spacing_pt;
    }
  } else if (target.type === 'shape' || target.type === 'ellipse') {
    if (style.fill_color !== undefined) result.fill_color = style.fill_color;
    if (style.border_color !== undefined) result.border_color = style.border_color;
    if (style.border_width !== undefined) result.border_width = style.border_width;
    if (target.type === 'shape' && style.corner_radius !== undefined) {
      result.corner_radius = style.corner_radius;
    }
  } else if (target.type === 'line') {
    if (style.color !== undefined) result.color = style.color;
    if (style.text_color !== undefined) result.color = style.text_color;
    if (style.border_color !== undefined) result.color = style.border_color;
    if (style.thickness !== undefined) result.thickness = style.thickness;
    if (style.border_width !== undefined) result.thickness = style.border_width;
    if (style.style !== undefined) result.style = style.style;
  } else if (target.type === 'barcode') {
    if (style.bar_color !== undefined) result.bar_color = style.bar_color;
    if (style.text_color !== undefined) result.bar_color = style.text_color;
  } else if (target.type === 'qrcode') {
    if (style.module_color !== undefined) result.module_color = style.module_color;
    if (style.text_color !== undefined) result.module_color = style.text_color;
    if (style.fill_color !== undefined) result.background_color = style.fill_color;
  } else if (target.type === 'restricted_area') {
    if (style.zone_color !== undefined) result.zone_color = style.zone_color;
    if (style.pattern !== undefined) result.pattern = style.pattern;
    if (style.opacity !== undefined) result.opacity = style.opacity;
  }

  if (!isPriceRelatedElement(result)) {
    return sanitizeNonPriceElement(result) as TemplateItem;
  }

  return result as TemplateItem;
}
