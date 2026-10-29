import { TemplateItem, ProductRecord, TextItemProperties, PriceBlockItemProperties, TierPriceItemProperties, EllipseItemProperties } from '../types';
import { PricingEngine } from '../utils/pricingEngine';
import { TierEngine } from '../utils/tierEngine';
import { generateBarcodeBars, isZplBarcodeSupported, normalizeGs1Data, resolveBarcodeSymbology } from '../utils/barcodeGenerator';

export function mmToDots(mm: number, dpi: 203 | 300 | 600): number {
  const dotsPerMm = dpi === 203 ? 8 : dpi === 300 ? 11.811 : 23.622;
  return Math.round(mm * dotsPerMm);
}

export function zplOrientationToDegrees(orientation: string): number {
  return orientation === 'R' ? 90 : orientation === 'I' ? 180 : orientation === 'B' ? 270 : 0;
}

function zplFontOrientation(rotation: number): 'N' | 'R' | 'I' | 'B' {
  const safeRotation = Number.isFinite(rotation) ? rotation : 0;
  const normalized = ((safeRotation % 360) + 360) % 360;
  const orientations: Array<'N' | 'R' | 'I' | 'B'> = ['N', 'R', 'I', 'B'];
  const quarterTurns = Math.round(normalized / 90);
  if (Math.abs(normalized - quarterTurns * 90) > 0.001) return 'N';
  return orientations[quarterTurns % orientations.length];
}

export function escapeZplText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\^/g, '_5e')
    .replace(/~/g, '_7e')
    .replace(/[\r\n]+/g, ' ');
}

function isUnfilledColor(color: string | undefined): boolean {
  const normalized = String(color || '').trim().toLowerCase().replace(/\s+/g, '');
  if (['', 'transparent', '#fff', '#ffffff', 'white', 'rgb(255,255,255)'].includes(normalized)) return true;
  const rgba = normalized.match(/^rgba\(\d+,\d+,\d+,([.\d]+)\)$/);
  return rgba !== null && Number(rgba[1]) === 0;
}

/**
 * Generates ZPL II commands for a single label item.
 */
export function drawZplItem(
  item: TemplateItem,
  dpi: 203 | 300 | 600,
  record?: ProductRecord | null
): string[] {
  // Restricted areas are not physical print commands
  if (item.type === 'restricted_area') {
    return [];
  }

  // Conditional display check
  if (item.conditional_display && !PricingEngine.shouldDisplayItem(item, record)) {
    return [];
  }

  const lines: string[] = [];
  const x = mmToDots(item.x_mm, dpi);
  const y = mmToDots(item.y_mm, dpi);
  const w = mmToDots(item.w_mm, dpi);
  const h = mmToDots(item.h_mm, dpi);

  switch (item.type) {
    case 'text': {
      const textItem = item as TextItemProperties;
      const text = PricingEngine.resolveCalculatedText(textItem, record);
      if (!text) return [];

      let finalText = text;
      if (textItem.text_transform === 'uppercase') finalText = finalText.toLocaleUpperCase();
      else if (textItem.text_transform === 'lowercase') finalText = finalText.toLocaleLowerCase();
      else if (textItem.text_transform === 'capitalize') {
        finalText = finalText.replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_match, separator: string, letter: string) =>
          separator + letter.toLocaleUpperCase());
      }
      if (textItem.is_price && textItem.currency_symbol) {
        const pos = textItem.currency_position || 'after';
        if (pos === 'after') finalText = `${finalText} ${textItem.currency_symbol}`;
        else if (pos === 'before') finalText = `${textItem.currency_symbol} ${finalText}`;
      }

      const fontSizePt = Math.max(5, textItem.font_size_pt || 10);
      const fontHeightDots = Math.max(12, Math.round(fontSizePt * (dpi / 72) * 0.85));
      const fontWidthDots = Math.round(fontHeightDots * (textItem.zpl_font_width_ratio ?? 0.65));
      const maxLines = textItem.wrap ? Math.max(1, Math.floor(h / fontHeightDots)) : 1;
      const blockAlignment = textItem.alignment === 'center'
        ? 'C'
        : textItem.alignment === 'right'
          ? 'R'
          : textItem.alignment === 'justify'
            ? 'J'
            : 'L';
      const escaped = escapeZplText(finalText);

      const lineSpacing = textItem.zpl_field_block?.line_spacing ?? 0;
      const hangingIndent = textItem.zpl_field_block?.hanging_indent ?? 0;
      lines.push(`^FO${x},${y}^A0${zplFontOrientation(item.rotation)},${fontHeightDots},${fontWidthDots}^FB${w},${maxLines},${lineSpacing},${blockAlignment},${hangingIndent}^FH^FD${escaped}^FS`);
      return lines;
    }

    case 'price_block': {
      const priceItem = item as PriceBlockItemProperties;
      const resolvedPrice = PricingEngine.resolvePriceBlock(priceItem, record);
      if (resolvedPrice.heroAmount === undefined) return [];

      const currencySym = PricingEngine.getPriceBlockCurrency(priceItem);
      const decimals = PricingEngine.getPriceBlockDecimals(priceItem);
      const separator = priceItem.decimal_separator ?? ',';
      const { integerPart, decimalPart, hasDecimals } = PricingEngine.splitPrice(resolvedPrice.heroAmount, separator, decimals);

      let priceStr = integerPart;
      if (hasDecimals && decimalPart) {
        priceStr += `${separator}${decimalPart}`;
      }
      priceStr = `${priceItem.prefix_text || ''}${priceStr}${priceItem.suffix_text || ''}`;
      if (currencySym) {
        const currPos = priceItem.currency_position || 'after';
        if (currPos === 'before') {
          priceStr = `${currencySym} ${priceStr}`;
        } else {
          priceStr = `${priceStr} ${currencySym}`;
        }
      }

      const intFontSizePt = priceItem.integer_style?.font_size_pt || 24;
      const fontHeightDots = Math.max(16, Math.round(intFontSizePt * (dpi / 72) * 0.85));
      const fontWidthDots = Math.round(fontHeightDots * 0.65);
      const escaped = escapeZplText(priceStr);

      lines.push(`^FO${x},${y}^A0N,${fontHeightDots},${fontWidthDots}^FH^FD${escaped}^FS`);
      for (const extension of resolvedPrice.extensions) {
        const extHeight = Math.max(12, Math.round((extension.style?.font_size_pt || 8) * (dpi / 72) * 0.85));
        let extX = x;
        let extY = y;
        if (extension.anchor === 'after' || extension.anchor === 'beside' || extension.anchor === 'corner') {
          extX += w;
          if (extension.anchor === 'beside') extY += Math.round(h / 2);
        } else if (extension.anchor === 'above') {
          extY += extHeight;
        } else if (extension.anchor === 'below') {
          extY += h - extHeight;
        }
        if (extension.baselineShift === 'superscript') extY -= Math.round(extHeight * 0.35);
        if (extension.baselineShift === 'subscript') extY += Math.round(extHeight * 0.15);
        extX += mmToDots(extension.offset_x_mm, dpi);
        extY += mmToDots(extension.offset_y_mm, dpi);
        const extensionText = escapeZplText(extension.text);
        const fontWidth = Math.round(extHeight * 0.65);
        lines.push(`^FO${extX},${extY}^A0N,${extHeight},${fontWidth}^FH^FD${extensionText}^FS`);
        if (extension.strikethrough) {
          const strikeY = extY + Math.round(extHeight / 2);
          lines.push(`^FO${extX},${strikeY}^GB${Math.max(fontWidth, extension.text.length * fontWidth * 0.55)},1,1^FS`);
        }
      }
      return lines;
    }

    case 'tier_price': {
      const tierItem = item as TierPriceItemProperties;
      let tierSummary = 'Tarifs Dégressifs';
      if (record) {
        const resolved = TierEngine.resolve(
          {
            primary_index: tierItem.primary_tier ? tierItem.primary_tier - 1 : 0,
            keyword_prefix: tierItem.prefix_text,
            unit_label: tierItem.unit_label,
            strict_required: tierItem.strict_required,
            pricing_strategy: tierItem.pricing_strategy,
            cross_conditional: tierItem.cross_conditional,
          },
          record
        );
        if (resolved) {
          tierSummary = `${resolved.text_qty} : ${resolved.formatted_price}`;
        }
      }

      const fontSizePt = Math.max(5, tierItem.font_size_pt || 10);
      const fontHeightDots = Math.max(12, Math.round(fontSizePt * (dpi / 72) * 0.85));
      const fontWidthDots = Math.round(fontHeightDots * 0.65);
      const escaped = escapeZplText(tierSummary);

      lines.push(`^FO${x},${y}^A0N,${fontHeightDots},${fontWidthDots}^FH^FD${escaped}^FS`);
      return lines;
    }

    case 'barcode': {
      const rawBarcode = PricingEngine.resolveBarcodeValue(item, record, { sample: false });
      if (!rawBarcode || rawBarcode.trim() === '') return [];
      const barcodeType = resolveBarcodeSymbology(rawBarcode, (item as any).barcode_type || 'auto');
      const validation = generateBarcodeBars(rawBarcode, (item as any).barcode_type || 'auto');
      if (validation.error) throw new Error(`Invalid ${barcodeType} barcode: ${validation.error}`);
      if (!isZplBarcodeSupported((item as any).barcode_type || 'auto')) {
        throw new Error(`ZPL output does not support the selected barcode symbology: ${barcodeType}.`);
      }

      const cleanCode = rawBarcode.replace(/\D/g, '');
      const showText = Boolean((item as any).show_text);
      const barcodeH = Math.max(20, h - (showText ? 20 : 0));

      if (barcodeType === 'code93') {
        lines.push(`^FO${x},${y}^BY2,3,${barcodeH}^BAN,${barcodeH},${showText ? 'Y' : 'N'},N^FH^FD${escapeZplText(rawBarcode)}^FS`);
      } else if (barcodeType === 'code11') {
        lines.push(`^FO${x},${y}^BY2,3,${barcodeH}^B1N,${barcodeH},${showText ? 'Y' : 'N'}^FH^FD${escapeZplText(rawBarcode)}^FS`);
      } else if (barcodeType === 'codabar') {
        lines.push(`^FO${x},${y}^BY2,3,${barcodeH}^BKN,${barcodeH},${showText ? 'Y' : 'N'},N^FH^FD${escapeZplText(rawBarcode)}^FS`);
      } else if (barcodeType === 'interleaved2of5') {
        lines.push(`^FO${x},${y}^BY2,3,${barcodeH}^B2N,${barcodeH},${showText ? 'Y' : 'N'},N,N^FD${cleanCode}^FS`);
      } else if (barcodeType === 'upce') {
        lines.push(`^FO${x},${y}^B9N,${barcodeH},${showText ? 'Y' : 'N'},N^FD${cleanCode}^FS`);
      } else if (barcodeType === 'upca') {
        lines.push(`^FO${x},${y}^BUN,${barcodeH},${showText ? 'Y' : 'N'},N^FD${cleanCode}^FS`);
      } else if (barcodeType === 'ean13') {
        // Preflight already guarantees valid 12 or 13 digit EAN-13 code
        lines.push(`^FO${x},${y}^BEN,${barcodeH},${showText ? 'Y' : 'N'},N^FD${cleanCode}^FS`);
      } else if (barcodeType === 'ean8') {
        lines.push(`^FO${x},${y}^B8N,${barcodeH},${showText ? 'Y' : 'N'},N,N^FD${cleanCode}^FS`);
      } else if (barcodeType === 'gtin14' || barcodeType === 'itf14') {
        lines.push(`^FO${x},${y}^B2N,${barcodeH},${showText ? 'Y' : 'N'},N,N^FD${cleanCode}^FS`);
      } else if (barcodeType === 'gs1_128') {
        const payload = normalizeGs1Data(rawBarcode);
        if (!payload) return [];
        const gs1Payload = escapeZplText(payload).replace(/\x1d/g, '_1D');
        lines.push(`^FO${x},${y}^BCN,${barcodeH},${showText ? 'Y' : 'N'},N,N^FH_^FD>;${gs1Payload}^FS`);
      } else if (barcodeType === 'code39') {
        lines.push(`^FO${x},${y}^BY2,3,${barcodeH}^B3N,N,${barcodeH},${showText ? 'Y' : 'N'},N^FD${validation.formattedCode}^FS`);
      } else if (barcodeType === 'datamatrix') {
        lines.push(`^FO${x},${y}^BXN,6,200,,,,,^FH^FD${escapeZplText(rawBarcode)}^FS`);
      } else if (barcodeType === 'pdf417') {
        lines.push(`^FO${x},${y}^B7N,${barcodeH},3,${Math.max(1, Math.floor(w / 3))},7,N^FD${escapeZplText(rawBarcode)}^FS`);
      } else if (barcodeType === 'micropdf417') {
        lines.push(`^FO${x},${y}^BFN,${barcodeH},0,0,0^FD${escapeZplText(rawBarcode)}^FS`);
      } else if (barcodeType === 'azteccode') {
        lines.push(`^FO${x},${y}^B0N,${Math.max(1, Math.min(10, Math.round(w / 35)))},0,0,0^FD${escapeZplText(rawBarcode)}^FS`);
      } else if (barcodeType === 'maxicode') {
        lines.push(`^FO${x},${y}^BDN,${Math.max(1, Math.min(6, Math.round(w / 35)))},,,,^FD${escapeZplText(rawBarcode)}^FS`);
      } else if (barcodeType === 'postnet') {
        lines.push(`^FO${x},${y}^BZN,${Math.max(1, Math.round(barcodeH / 3))},,Y^FD${cleanCode}^FS`);
      } else if (barcodeType === 'databar') {
        lines.push(`^FO${x},${y}^BRN,${barcodeH},2,1,1^FD${cleanCode}^FS`);
      } else {
        const escapedCode = escapeZplText(rawBarcode);
        lines.push(`^FO${x},${y}^BY2,3,${barcodeH}^BCN,${barcodeH},${showText ? 'Y' : 'N'},N,N^FH^FD>:${escapedCode}^FS`);
      }
      return lines;
    }

    case 'qrcode': {
      const qrContent = PricingEngine.resolveQrContent(item, record, { sample: false });
      if (!qrContent) return [];
      const mag = Math.max(2, Math.min(10, Math.round(w / 35)));
      const escapedQr = escapeZplText(qrContent);
      lines.push(`^FO${x},${y}^BQN,2,${mag}^FH^FDLA,${escapedQr}^FS`);
      return lines;
    }

    case 'shape': {
      const shape = item as any;
      const borderThick = Math.max(1, mmToDots(shape.border_width || 1, dpi));
      const radiusDots = Math.round(mmToDots(shape.corner_radius || 0, dpi) / 2);
      const isFilled = !isUnfilledColor(shape.fill_color);
      lines.push(`^FO${x},${y}^GB${w},${h},${isFilled ? h : borderThick},B,${Math.min(8, radiusDots)}^FS`);
      return lines;
    }

    case 'line': {
      const rawLine = item as any;
      const thick = Math.max(1, mmToDots(rawLine.thickness || 1, dpi));
      lines.push(`^FO${x},${y}^GB${w},${thick},${thick},B,0^FS`);
      return lines;
    }

    case 'ellipse': {
      const ellipse = item as EllipseItemProperties;
      const isFilled = !isUnfilledColor(ellipse.fill_color);
      const thickness = isFilled
        ? Math.min(w, h)
        : Math.max(1, mmToDots(ellipse.border_width || 1, dpi));
      lines.push(`^FO${x},${y}^GE${w},${h},${thickness},B^FS`);
      return lines;
    }

    default:
      throw new Error(`[drawZplItem] Élément non représentable sur cible thermique ZPL : ${(item as any).type} (id: ${item.id})`);
  }
}
