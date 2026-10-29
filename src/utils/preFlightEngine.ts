import { ImpositionConfig, LabelTemplate, TemplateItem, ProductRecord } from '../types';
import { PricingEngine, isPriceRelatedElement } from './pricingEngine';
import { generateBarcodeBars, getBarcodeQuietZone, isZplBarcodeSupported, resolveBarcodeSymbology } from './barcodeGenerator';
import { ImpositionCalculator } from './impositionCalculator';
import { TierEngine } from './tierEngine';

export type PreFlightSeverity = 'error' | 'warning' | 'info';
export type PreFlightCategory = 'geometry' | 'data' | 'barcode' | 'typography' | 'compatibility';
export type PreFlightTarget = 'screen' | 'pdf' | 'zpl' | 'pptx';

export interface PreFlightIssue {
  id: string;
  severity: PreFlightSeverity;
  category: PreFlightCategory;
  message: string;
  itemId?: string;
  field?: string;
}

export type ComputedTemplateStatus = 'ready' | 'warning' | 'draft';

export interface PreFlightReport {
  status: ComputedTemplateStatus;
  errorsCount: number;
  warningsCount: number;
  infosCount: number;
  issues: PreFlightIssue[];
  passed: boolean;
}

export interface BatchPreFlightReport extends PreFlightReport {
  totalProductsChecked: number;
  defectiveProductsCount: number;
}

export class PreFlightEngine {
  static analyzeBatch(
    template: LabelTemplate,
    products: ProductRecord[],
    target: PreFlightTarget,
    activeImpositionConfig?: ImpositionConfig
  ): BatchPreFlightReport {
    const sampleReport = PreFlightEngine.analyzeTemplate(template, products[0], target, activeImpositionConfig);
    const isProductIssue = (id: string) =>
      id === 'product_missing_price' ||
      id === 'invalid_promo_start_date' ||
      id === 'invalid_promo_end_date' ||
      id.startsWith('empty_barcode_') ||
      id.startsWith('ean_invalid_') ||
      id.startsWith('barcode_invalid_') ||
      id.startsWith('strict_tier_missing_');
    const issues = sampleReport.issues.filter((issue) => !isProductIssue(issue.id));
    const uniqueProducts = new Map<string, ProductRecord>();

    products.forEach((product, index) => {
      const key = product.id || product.PRODUCT_SCAN || product.PARTNO || `row-${index}`;
      if (!uniqueProducts.has(key)) uniqueProducts.set(key, product);
    });

    const defectiveProducts = new Set<string>();
    uniqueProducts.forEach((product, key) => {
      const productReport = PreFlightEngine.analyzeTemplate(template, product, target, activeImpositionConfig);
      productReport.issues
        .filter((issue) => isProductIssue(issue.id))
        .forEach((issue) => {
          issues.push({
            ...issue,
            id: `${issue.id}_${key}`,
            message: `${product.ITEMNAME || product.PARTNO || product.id || key}: ${issue.message}`,
          });
          if (issue.severity === 'error') defectiveProducts.add(key);
        });
    });

    if (uniqueProducts.size === 0) {
      issues.push({
        id: 'empty_batch',
        severity: 'error',
        category: 'data',
        message: 'Aucun produit sélectionné pour cet export.',
      });
    }

    const errorsCount = issues.filter((issue) => issue.severity === 'error').length;
    const warningsCount = issues.filter((issue) => issue.severity === 'warning').length;
    const infosCount = issues.filter((issue) => issue.severity === 'info').length;

    return {
      status: errorsCount > 0 ? 'draft' : warningsCount > 0 ? 'warning' : 'ready',
      errorsCount,
      warningsCount,
      infosCount,
      issues,
      passed: errorsCount === 0,
      totalProductsChecked: uniqueProducts.size,
      defectiveProductsCount: defectiveProducts.size,
    };
  }

  /**
   * Evaluates template geometric integrity, required retail bindings,
   * barcode encodability, minimum font sizing, and export target compatibility.
   */
  static analyzeTemplate(
    template: LabelTemplate,
    sampleProduct?: ProductRecord,
    target: PreFlightTarget = 'screen',
    activeImpositionConfig?: ImpositionConfig
  ): PreFlightReport {
    const issues: PreFlightIssue[] = [];

    // 1. Geometric bounds validation
    const width = template.width_mm || 100;
    const height = template.height_mm || 50;
    const margins = template.inner_margins_mm || { top: 0, bottom: 0, left: 0, right: 0 };

    if (template.width_mm <= 0 || template.height_mm <= 0) {
      issues.push({
        id: 'invalid_template_dimensions',
        severity: 'error',
        category: 'geometry',
        message: 'Les dimensions du gabarit sont nulles ou négatives.',
      });
    }

    const minX = margins.left;
    const minY = margins.top;
    const maxX = width - margins.right;
    const maxY = height - margins.bottom;

    if (!template.items || template.items.length === 0) {
      issues.push({
        id: 'no_elements',
        severity: 'error',
        category: 'geometry',
        message: 'Le gabarit ne contient aucun élément graphique ou textuel.',
      });
    }

    // Check if label fits on imposition sheet if default_imposition is configured
    const impositionConfig = activeImpositionConfig || template.default_imposition;
    if (impositionConfig && (target === 'pdf' || target === 'pptx')) {
      try {
        const calc = ImpositionCalculator.calculate(
          width,
          height,
          template.outer_margins_mm || { top: 0, bottom: 0, left: 0, right: 0 },
          impositionConfig
        );
        if (calc.cols === 0 || calc.rows === 0 || !calc.fits_on_page) {
          issues.push({
            id: 'imposition_page_overflow',
            severity: 'error',
            category: 'geometry',
            message: `Étiquette (${width}×${height} mm) plus grande que la page utile de la planche d'imposition (${calc.page_w_mm}×${calc.page_h_mm} mm).`,
          });
        }
      } catch (err: any) {
        issues.push({
          id: 'imposition_calc_error',
          severity: 'error',
          category: 'geometry',
          message: `Erreur d'imposition : ${err.message}`,
        });
      }
    }

    let hasPriceElement = false;
    let hasNameElement = false;

    template.items?.forEach((item: TemplateItem) => {
      const label = item.type;

      if (target === 'zpl' && [
        item.opacity,
        item.background_opacity,
        item.foreground_opacity,
        item.text_opacity,
      ].some((opacity) => opacity !== undefined && opacity < 1)) {
        issues.push({
          id: `zpl_transparency_${item.id}`,
          severity: 'warning',
          category: 'compatibility',
          message: 'ZPL ne représente pas la transparence ; cet élément sera imprimé opaque.',
          itemId: item.id,
        });
      }

      // Check zero or negative dimensions
      if (item.w_mm <= 0 || item.h_mm <= 0) {
        issues.push({
          id: `zero_dim_${item.id}`,
          severity: 'error',
          category: 'geometry',
          message: `L'élément "${label}" possède une dimension nulle ou négative (${item.w_mm}x${item.h_mm} mm).`,
          itemId: item.id,
        });
      }

      // Compute bounding box after rotation around center
      const deg = item.rotation || 0;
      const rad = (deg * Math.PI) / 180;
      const rotW = Math.abs(item.w_mm * Math.cos(rad)) + Math.abs(item.h_mm * Math.sin(rad));
      const rotH = Math.abs(item.w_mm * Math.sin(rad)) + Math.abs(item.h_mm * Math.cos(rad));
      const centerX = item.x_mm + item.w_mm / 2;
      const centerY = item.y_mm + item.h_mm / 2;
      const bbLeft = centerX - rotW / 2;
      const bbRight = centerX + rotW / 2;
      const bbTop = centerY - rotH / 2;
      const bbBottom = centerY + rotH / 2;

      // Outer label boundary overflow (critical error)
      if (bbLeft < -0.05 || bbTop < -0.05 || bbRight > width + 0.05 || bbBottom > height + 0.05) {
        issues.push({
          id: `boundary_overflow_${item.id}`,
          severity: 'error',
          category: 'geometry',
          message: `L'élément "${label}" dépasse la zone physique de l'étiquette (${bbRight.toFixed(1)}x${bbBottom.toFixed(1)} mm pour ${width}x${height} mm).`,
          itemId: item.id,
        });
      } else if (bbLeft < minX - 0.05 || bbTop < minY - 0.05 || bbRight > maxX + 0.05 || bbBottom > maxY + 0.05) {
        // Safe inner printable margin overflow
        issues.push({
          id: `margin_overflow_${item.id}`,
          severity: target === 'screen' ? 'warning' : 'error',
          category: 'geometry',
          message: `L'élément "${label}" dépasse les marges intérieures sécurisées (${bbRight.toFixed(1)}x${bbBottom.toFixed(1)} mm).`,
          itemId: item.id,
        });
      }

      // Check restricted_area overlap with other non-restricted elements
      if (item.type === 'restricted_area' && (item as any).warn_on_overlap) {
        template.items?.forEach((other) => {
          if (other.id === item.id || other.type === 'restricted_area') return;
          const overlap = !(
            other.x_mm >= item.x_mm + item.w_mm ||
            other.x_mm + other.w_mm <= item.x_mm ||
            other.y_mm >= item.y_mm + item.h_mm ||
            other.y_mm + other.h_mm <= item.y_mm
          );
          if (overlap) {
            issues.push({
              id: `restricted_area_overlap_${item.id}_${other.id}`,
              severity: target === 'screen' ? 'warning' : 'error',
              category: 'geometry',
              message: `L'élément "${other.type}" (${other.id}) chevauche la zone réservée "${(item as any).label || 'Zone restreinte'}".`,
              itemId: other.id,
            });
          }
        });
      }

      // Font size < 6 pt checks and configuration checks
      if (item.type === 'text') {
        const textItem = item as any;
        const fontSize = textItem.font_size_pt || 12;
        if (fontSize < 6) {
          issues.push({
            id: `font_too_small_${item.id}`,
            severity: 'error',
            category: 'typography',
            message: `Corps de police inférieur à 6 pt (${fontSize} pt) sur l'élément texte. Refusé pour lisibilité légale.`,
            itemId: item.id,
          });
        }
        if (textItem.calculation_mode === 'secondary_currency' && textItem.secondary_currency_config?.enabled) {
          const rate = textItem.secondary_currency_config.exchange_rate;
          if (!rate || rate <= 0) {
            issues.push({
              id: `missing_exchange_rate_${item.id}`,
              severity: 'warning',
              category: 'data',
              message: `Taux de change non configuré ou nul pour la conversion en devise secondaire.`,
              itemId: item.id,
            });
          }
        }
      } else if (item.type === 'rich_text') {
        const defaultPt = (item as any).default_font_size_pt || 10;
        if (defaultPt < 6) {
          issues.push({
            id: `font_too_small_${item.id}`,
            severity: 'error',
            category: 'typography',
            message: `Corps de police inférieur à 6 pt (${defaultPt} pt) sur le texte enrichi.`,
            itemId: item.id,
          });
        }
        (item as any).runs?.forEach((r: any, rIdx: number) => {
          if (r.font_size_pt && r.font_size_pt < 6) {
            issues.push({
              id: `font_too_small_run_${item.id}_${rIdx}`,
              severity: 'error',
              category: 'typography',
              message: `Segment de texte enrichi avec corps inférieur à 6 pt (${r.font_size_pt} pt).`,
              itemId: item.id,
            });
          }
        });
      } else if (item.type === 'curved_text') {
        const fontSize = (item as any).font_size_pt || 12;
        if (fontSize < 6) {
          issues.push({
            id: `font_too_small_${item.id}`,
            severity: 'error',
            category: 'typography',
            message: `Corps de police inférieur à 6 pt (${fontSize} pt) sur le texte courbé.`,
            itemId: item.id,
          });
        }
      } else if (item.type === 'tier_price') {
        const fontSize = (item as any).font_size_pt || 10;
        if (fontSize < 6) {
          issues.push({
            id: `font_too_small_${item.id}`,
            severity: 'error',
            category: 'typography',
            message: `Corps de police inférieur à 6 pt (${fontSize} pt) sur le bloc de paliers.`,
            itemId: item.id,
          });
        }
      } else if (item.type === 'price_block') {
        const intPt = (item as any).integer_style?.font_size_pt;
        if (intPt !== undefined && intPt < 6) {
          issues.push({
            id: `font_too_small_${item.id}`,
            severity: 'error',
            category: 'typography',
            message: `Corps de la partie entière du prix inférieur à 6 pt (${intPt} pt).`,
            itemId: item.id,
          });
        }
        if (sampleProduct) {
          const resolved = PricingEngine.resolvePriceBlock(item, sampleProduct);
          if (resolved.status === 'invalid') {
            issues.push({
              id: `price_invalid_${item.id}`,
              severity: 'error',
              category: 'data',
              message: `Prix principal invalide pour l'élément ${item.id}.`,
              itemId: item.id,
            });
          }
          resolved.diagnostics.forEach((diagnostic, index) => {
            issues.push({
              id: `price_diagnostic_${item.id}_${index}`,
              severity: 'error',
              category: 'data',
              message: diagnostic,
              itemId: item.id,
            });
          });
        }
      }

      // Barcode checks: contrast, width, and valid checksum
      if (item.type === 'barcode') {
        const requestedType = (item as any).barcode_type || 'auto';
        const isSample = target === 'screen';
        const rawBarcode = PricingEngine.resolveBarcodeValue(item, sampleProduct, { sample: isSample });
        const barcodeType = resolveBarcodeSymbology(rawBarcode, requestedType);

        // Barcode contrast: bars must be strictly black
        const barColor = String((item as any).bar_color || '#000000').toLowerCase().trim();
        const isBlack = ['#000000', '#000', 'black', 'rgb(0,0,0)', 'rgb(0, 0, 0)'].includes(barColor);
        if (!isBlack) {
          issues.push({
            id: `barcode_contrast_bars_${item.id}`,
            severity: 'error',
            category: 'barcode',
            message: `Contraste code-barres insuffisant : les barres doivent être strictement noires (actuel: "${barColor}").`,
            itemId: item.id,
          });
        }

        // Keep retail EAN symbologies above their minimum module-width thresholds.
        if ((barcodeType === 'ean13' || barcodeType === 'upca') && item.w_mm < 29.83) {
          issues.push({
            id: `barcode_min_width_${item.id}`,
            severity: 'error',
            category: 'barcode',
            message: `Largeur EAN-13 insuffisante (${item.w_mm.toFixed(1)} mm < 29.83 mm). Risque de rejet aux caisses optiques.`,
            itemId: item.id,
          });
        }

        if (!rawBarcode || rawBarcode.trim().length === 0) {
          if (target !== 'screen') {
            issues.push({
              id: `empty_barcode_${item.id}`,
              severity: 'error',
              category: 'barcode',
              message: `Code-barres vide sur l'élément (${item.binding_key || 'code statique'}). Aucun code de démonstration n'est utilisé à l'export.`,
              itemId: item.id,
            });
          }
        } else {
          const validation = generateBarcodeBars(rawBarcode, requestedType);
          if (validation.error) {
            const invalidBarcodePrefix = barcodeType === 'ean8' || barcodeType === 'ean13'
              ? 'ean_invalid_'
              : 'barcode_invalid_';
            issues.push({
              id: `${invalidBarcodePrefix}${item.id}`,
              severity: 'error',
              category: 'barcode',
              message: `Code-barres invalide (${barcodeType}) : ${validation.error}`,
              itemId: item.id,
            });
          }
          if (target !== 'zpl' && validation.bars.length > 0) {
            const quietZone = getBarcodeQuietZone(barcodeType);
            const moduleWidthMm = item.w_mm /
              (validation.bars.length + quietZone.leftModules + quietZone.rightModules);
            if (moduleWidthMm < 0.19) {
              issues.push({
                id: `barcode_min_module_${item.id}`,
                severity: 'warning',
                category: 'barcode',
                message: `Module de code-barres étroit (${moduleWidthMm.toFixed(3)} mm < 0.19 mm). Augmentez la largeur ou vérifiez l’impression et la lecture sur le matériel cible.`,
                itemId: item.id,
              });
            }
          }
          if (target === 'zpl' && !isZplBarcodeSupported(requestedType)) {
            issues.push({
              id: `barcode_zpl_unsupported_${item.id}`,
              severity: 'error',
              category: 'compatibility',
              message: `La sortie ZPL ne prend pas en charge ${barcodeType} dans cette application.`,
              itemId: item.id,
            });
          }
        }
      }

      // Target compatibility checks
      if (target === 'zpl') {
        const normalizedColor = (value: unknown) => String(value || '').trim().toLowerCase().replace(/\s+/g, '');
        const isBlack = (value: unknown) => ['#000', '#000000', 'black', 'rgb(0,0,0)'].includes(normalizedColor(value));
        const isWhite = (value: unknown) => ['#fff', '#ffffff', 'white', 'rgb(255,255,255)'].includes(normalizedColor(value));
        const zplUnsupported = ['rich_text', 'curved_text', 'image', 'pictogram', 'restricted_area'];
        if (zplUnsupported.includes(item.type)) {
          issues.push({
            id: `zpl_unsupported_${item.id}`,
            severity: 'error',
            category: 'compatibility',
            message: `L'élément de type "${item.type}" n'est pas représentable en impression thermique directe ZPL.`,
            itemId: item.id,
          });
        }

        if (item.type === 'text' && !isBlack(item.text_color)) {
          issues.push({
            id: `zpl_text_color_${item.id}`,
            severity: 'warning',
            category: 'compatibility',
            message: 'Le texte ZPL est imprimé en noir ; sa couleur de texte ne sera pas conservée.',
            itemId: item.id,
          });
        }
        if (item.type === 'text' && item.font_family && !['0', 'a'].includes(item.font_family.trim().toLowerCase())) {
          issues.push({
            id: `zpl_text_font_${item.id}`,
            severity: 'warning',
            category: 'compatibility',
            message: 'L’export ZPL utilise la police résidente Zebra A0 ; la police configurée dans le concepteur ne sera pas conservée.',
            itemId: item.id,
          });
        }
        if (item.type === 'text' && item.font_weight !== 'normal') {
          issues.push({
            id: `zpl_text_weight_${item.id}`,
            severity: 'warning',
            category: 'compatibility',
            message: 'La graisse typographique configurée n’est pas reproduite par la police ZPL A0.',
            itemId: item.id,
          });
        }
        if (item.type === 'text' && item.font_style !== 'normal') {
          issues.push({
            id: `zpl_text_style_${item.id}`,
            severity: 'warning',
            category: 'compatibility',
            message: 'Le style italique configuré n’est pas reproduit par la police ZPL A0.',
            itemId: item.id,
          });
        }
        if (item.type === 'text' && (item.text_decoration || 'none') !== 'none') {
          issues.push({
            id: `zpl_text_decoration_${item.id}`,
            severity: 'warning',
            category: 'compatibility',
            message: 'Le soulignement ou le barré configuré n’est pas reproduit par l’export ZPL actuel.',
            itemId: item.id,
          });
        }
        if (item.type === 'text' && item.valign !== 'top') {
          issues.push({
            id: `zpl_text_valign_${item.id}`,
            severity: 'warning',
            category: 'compatibility',
            message: 'L’alignement vertical du texte n’est pas reproduit par l’export ZPL actuel.',
            itemId: item.id,
          });
        }
        if (item.type === 'text' && item.letter_spacing_pt) {
          issues.push({
            id: `zpl_text_letter_spacing_${item.id}`,
            severity: 'warning',
            category: 'compatibility',
            message: 'L’espacement de lettres configuré n’est pas reproduit par l’export ZPL actuel.',
            itemId: item.id,
          });
        }
        if ((item.type === 'shape' || item.type === 'ellipse') &&
          ((!isBlack(item.fill_color) && !isWhite(item.fill_color) && normalizedColor(item.fill_color) !== 'transparent') ||
            !isBlack(item.border_color))) {
          issues.push({
            id: `zpl_shape_color_${item.id}`,
            severity: 'warning',
            category: 'compatibility',
            message: 'ZPL imprime en monochrome ; les couleurs de remplissage ou de contour non prises en charge seront converties ou ignorées.',
            itemId: item.id,
          });
        }
        if (item.type === 'line') {
          if (!isBlack(item.color)) {
            issues.push({
              id: `zpl_line_color_${item.id}`,
              severity: 'warning',
              category: 'compatibility',
              message: 'La ligne ZPL est imprimée en noir ; sa couleur ne sera pas conservée.',
              itemId: item.id,
            });
          }
          if (item.style !== 'solid') {
            issues.push({
              id: `zpl_line_style_${item.id}`,
              severity: 'warning',
              category: 'compatibility',
              message: 'Les styles de ligne pointillés et tiretés sont imprimés en trait plein en ZPL.',
              itemId: item.id,
            });
          }
        }
        if (item.type === 'qrcode' && (!isBlack(item.module_color) || !isWhite(item.background_color))) {
          issues.push({
            id: `zpl_qrcode_color_${item.id}`,
            severity: 'warning',
            category: 'compatibility',
            message: 'Le QR code ZPL est monochrome noir sur blanc ; ses couleurs configurées ne seront pas conservées.',
            itemId: item.id,
          });
        }

        const zplPositionedTypes = ['text', 'price_block', 'tier_price', 'barcode', 'qrcode', 'shape', 'ellipse', 'line'];
        const normalizedRotation = ((item.rotation % 360) + 360) % 360;
        const quarterTurnText = item.type === 'text' && [90, 180, 270].includes(normalizedRotation);
        if (zplPositionedTypes.includes(item.type) && normalizedRotation !== 0 && !quarterTurnText) {
          issues.push({
            id: `zpl_unsupported_rotation_${item.id}`,
            severity: 'error',
            category: 'compatibility',
            message: `La rotation de l'élément "${item.id}" n'est pas prise en charge par l'export ZPL.`,
            itemId: item.id,
          });
        }

        // ZPL price_block check: decimal baseline shift must be normal
        if (item.type === 'price_block') {
          const shift = (item as any).decimal_style?.baseline_shift;
          if (shift && shift !== 'normal') {
            issues.push({
              id: `zpl_price_superscript_${item.id}`,
              severity: 'error',
              category: 'compatibility',
              message: `Le bloc de prix avec décimales en exposant/indice n'est pas géré en ZPL simple sans matrice bitmap.`,
              itemId: item.id,
            });
          }
        }

        // Advanced styling unrepresentable in ZPL
        if ((item as any).text_shadow?.enabled) {
          issues.push({
            id: `zpl_unsupported_shadow_${item.id}`,
            severity: 'error',
            category: 'compatibility',
            message: `L'effet d'ombre portée n'est pas représentable en impression thermique ZPL.`,
            itemId: item.id,
          });
        }
        if ((item as any).highlight_color && (item as any).highlight_color !== 'transparent') {
          issues.push({
            id: `zpl_unsupported_highlight_${item.id}`,
            severity: 'error',
            category: 'compatibility',
            message: `Le surlignage couleur n'est pas représentable en impression thermique monochrome ZPL.`,
            itemId: item.id,
          });
        }
        if ((item as any).finish_effect && (item as any).finish_effect !== 'none') {
          issues.push({
            id: `zpl_unsupported_finish_${item.id}`,
            severity: 'error',
            category: 'compatibility',
            message: `Les finitions d'impression (${(item as any).finish_effect}) ne sont pas gérées en thermique ZPL.`,
            itemId: item.id,
          });
        }
      } else if (target === 'pdf') {
        if (item.type === 'curved_text') {
          issues.push({
            id: `pdf_unsupported_curved_${item.id}`,
            severity: 'error',
            category: 'compatibility',
            message: `Le texte courbé n'est pas supporté en export PDF vectoriel dans cette version.`,
            itemId: item.id,
          });
        }
        if (item.type === 'image') {
          const src = (item as any).source;
          if (!src || typeof src !== 'string' || !src.startsWith('data:image/')) {
            issues.push({
              id: `pdf_unsupported_image_${item.id}`,
              severity: 'error',
              category: 'compatibility',
              message: `L'image n'est pas une data-URL valide (requis: data:image/...).`,
              itemId: item.id,
            });
          }
        }
      } else if (target === 'pptx') {
        const pptxUnsupported = ['rich_text', 'curved_text', 'restricted_area'];
        if (pptxUnsupported.includes(item.type)) {
          issues.push({
            id: `pptx_unsupported_${item.id}`,
            severity: 'error',
            category: 'compatibility',
            message: `L'élément de type "${item.type}" n'est pas représentable en export PowerPoint (.pptx).`,
            itemId: item.id,
          });
        }

      }

      if ((target === 'pdf' || target === 'pptx') && item.finish_effect && item.finish_effect !== 'none') {
        issues.push({
          id: `unsupported_finish_${target}_${item.id}`,
          severity: 'error',
          category: 'compatibility',
          message: `La finition "${item.finish_effect}" est une annotation visuelle uniquement ; aucun tracé ou calque de production n'est exporté en ${target.toUpperCase()}.`,
          itemId: item.id,
        });
      }

      // Price field identification
      if (
        item.type === 'price_block' ||
        item.type === 'tier_price' ||
        isPriceRelatedElement(item)
      ) {
        hasPriceElement = true;
      }

      // Designation identification
      if (
        item.binding_key === 'ITEMNAME' ||
        (item.type === 'text' && (item as any).text && (item as any).text.toLowerCase().includes('designation'))
      ) {
        hasNameElement = true;
      }
    });

    // Mandatory retail price check
    if (!hasPriceElement) {
      issues.push({
        id: 'missing_price',
        severity: target === 'screen' ? 'warning' : 'error',
        category: 'data',
        message: 'Aucun champ de prix (SELLING_PRICE, bloc prix ou palier) lié dans ce gabarit étiquette.',
      });
    }

    // Designation warning
    if (!hasNameElement) {
      issues.push({
        id: 'missing_name',
        severity: 'info',
        category: 'data',
        message: 'Aucun champ de désignation article (ITEMNAME) identifié.',
      });
    }

    // Product record validations
    if (sampleProduct) {
      if (hasPriceElement && target !== 'screen') {
        const sp = PricingEngine.getSellingPrice(sampleProduct);
        if (!sp || sp <= 0) {
          issues.push({
            id: 'product_missing_price',
            severity: 'error',
            category: 'data',
            message: `L'article "${sampleProduct.ITEMNAME || sampleProduct.PARTNO || sampleProduct.id || 'sélectionné'}" n'a aucun prix de vente valide (SELLING_PRICE).`,
          });
        }
      }

      const parseDate = (dStr: any): boolean => {
        if (!dStr) return true;
        const s = String(dStr).trim();
        return /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{2}\/\d{2}\/\d{4}/.test(s);
      };

      if (sampleProduct.PROMO_START_DATE && !parseDate(sampleProduct.PROMO_START_DATE)) {
        issues.push({
          id: 'invalid_promo_start_date',
          severity: 'warning',
          category: 'data',
          message: `Date de début de promotion non reconnue ("${sampleProduct.PROMO_START_DATE}", attendu YYYY-MM-DD ou DD/MM/YYYY).`,
        });
      }

      if (sampleProduct.PROMO_END_DATE && !parseDate(sampleProduct.PROMO_END_DATE)) {
        issues.push({
          id: 'invalid_promo_end_date',
          severity: 'warning',
          category: 'data',
          message: `Date de fin de promotion non reconnue ("${sampleProduct.PROMO_END_DATE}", attendu YYYY-MM-DD ou DD/MM/YYYY).`,
        });
      }

      template.items.filter((item) => item.type === 'tier_price' && item.strict_required).forEach((item) => {
        if (item.type !== 'tier_price') return;
        const resolved = TierEngine.resolve({
          primary_index: Math.max(0, item.primary_tier - 1),
          keyword_prefix: item.prefix_text,
          unit_label: item.unit_label,
          strict_required: true,
          pricing_strategy: item.pricing_strategy,
          cross_conditional: item.cross_conditional,
        }, sampleProduct);
        if (resolved?.error) {
          issues.push({
            id: `strict_tier_missing_${item.id}`,
            severity: target === 'screen' ? 'warning' : 'error',
            category: 'data',
            message: `L'article "${sampleProduct.ITEMNAME || sampleProduct.id}" : ${resolved.error}`,
            itemId: item.id,
          });
        }
      });
    }

    const errorsCount = issues.filter((i) => i.severity === 'error').length;
    const warningsCount = issues.filter((i) => i.severity === 'warning').length;
    const infosCount = issues.filter((i) => i.severity === 'info').length;

    let status: ComputedTemplateStatus = 'ready';
    if (errorsCount > 0) {
      status = 'draft';
    } else if (warningsCount > 0) {
      status = 'warning';
    }

    return {
      status,
      errorsCount,
      warningsCount,
      infosCount,
      issues,
      passed: errorsCount === 0,
    };
  }

  static computeTemplateStatus(
    template: LabelTemplate,
    sampleProduct?: ProductRecord,
    target: PreFlightTarget = 'screen'
  ): ComputedTemplateStatus {
    const report = PreFlightEngine.analyzeTemplate(template, sampleProduct, target);
    return report.status;
  }
}
