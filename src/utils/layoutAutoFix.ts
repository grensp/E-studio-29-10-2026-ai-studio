import { LabelTemplate, TemplateItem, TextItemProperties } from '../types';
import { auditColorContrast } from './colorContrastEngine';

export interface LayoutIssue {
  id: string;
  type: 'overflow' | 'collision' | 'boundary' | 'contrast' | 'empty_field';
  severity: 'error' | 'warning' | 'info';
  itemId: string;
  itemType: string;
  message: string;
  autoFixAvailable: boolean;
  fixDescription?: string;
  applyFix?: (template: LabelTemplate) => LabelTemplate;
}

export function analyzeLayoutIssues(template: LabelTemplate): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const items = template.items || [];
  const labelW = template.width_mm;
  const labelH = template.height_mm;
  const marginTop = template.inner_margins_mm?.top || 0;
  const marginBottom = template.inner_margins_mm?.bottom || 0;
  const marginLeft = template.inner_margins_mm?.left || 0;
  const marginRight = template.inner_margins_mm?.right || 0;

  const printableW = labelW - (marginLeft + marginRight);
  const printableH = labelH - (marginTop + marginBottom);

  items.forEach((item, idx) => {
    // 1. Boundary Check
    const rightEdge = item.x_mm + item.w_mm;
    const bottomEdge = item.y_mm + item.h_mm;

    if (item.x_mm < marginLeft || rightEdge > (labelW - marginRight) || item.y_mm < marginTop || bottomEdge > (labelH - marginBottom)) {
      issues.push({
        id: `boundary-${item.id}`,
        type: 'boundary',
        severity: 'warning',
        itemId: item.id,
        itemType: item.type,
        message: `L'élément dépasse de la zone d'impression (${item.w_mm.toFixed(1)}×${item.h_mm.toFixed(1)} mm)`,
        autoFixAvailable: true,
        fixDescription: `Recadrer dans les marges (${marginLeft.toFixed(1)}mm / ${marginTop.toFixed(1)}mm)`,
        applyFix: (tpl) => {
          const newItems = tpl.items.map((it) => {
            if (it.id !== item.id) return it;
            const newX = Math.max(marginLeft, Math.min(it.x_mm, labelW - marginRight - it.w_mm));
            const newY = Math.max(marginTop, Math.min(it.y_mm, labelH - marginBottom - it.h_mm));
            const newW = Math.min(it.w_mm, printableW);
            const newH = Math.min(it.h_mm, printableH);
            return { ...it, x_mm: newX, y_mm: newY, w_mm: newW, h_mm: newH };
          });
          return { ...tpl, items: newItems };
        },
      });
    }

    // 2. Text Item Specific Checks (Font Size vs Dimensions, Contrast)
    if (item.type === 'text') {
      const textItem = item as TextItemProperties;
      const textLength = (textItem.text || '').length;
      const approxCharWidthMm = (textItem.font_size_pt * 0.352778) * 0.55;
      const approxTextWidthMm = textLength * approxCharWidthMm;

      // Overflow heuristic for single line without wrap
      if (!textItem.wrap && textLength > 4 && approxTextWidthMm > item.w_mm * 1.15) {
        issues.push({
          id: `overflow-${item.id}`,
          type: 'overflow',
          severity: 'warning',
          itemId: item.id,
          itemType: 'text',
          message: `Texte long (${textLength} car.) risque de déborder du cadre`,
          autoFixAvailable: true,
          fixDescription: 'Activer le retour à la ligne ou réduire la taille de police',
          applyFix: (tpl) => {
            const newItems = tpl.items.map((it) => {
              if (it.id !== item.id) return it;
              const targetSize = Math.max(6, Math.round(textItem.font_size_pt * (item.w_mm / Math.max(approxTextWidthMm, 1)) * 0.95));
              return {
                ...it,
                wrap: true,
                overflow: 'autofit_shrink',
                font_size_pt: targetSize,
              } as TextItemProperties;
            });
            return { ...tpl, items: newItems };
          },
        });
      }

      // Contrast Check
      const effectiveBg = textItem.fill_color && textItem.fill_color !== 'transparent'
        ? textItem.fill_color
        : template.bg_color || '#ffffff';
      const contrast = auditColorContrast(
        textItem.text_color || '#000000',
        effectiveBg,
        textItem.font_size_pt,
        textItem.font_weight === 'bold' || textItem.font_weight === '800'
      );

      if (!contrast.isAccessible) {
        issues.push({
          id: `contrast-${item.id}`,
          type: 'contrast',
          severity: 'error',
          itemId: item.id,
          itemType: 'text',
          message: `Contraste insuffisant (${contrast.ratio}:1) entre texte et fond (${contrast.scoreText})`,
          autoFixAvailable: true,
          fixDescription: `Appliquer la couleur contrastée ${contrast.recommendedTextColor}`,
          applyFix: (tpl) => {
            const newItems = tpl.items.map((it) => {
              if (it.id !== item.id) return it;
              return {
                ...it,
                text_color: contrast.recommendedTextColor || '#000000',
              } as TextItemProperties;
            });
            return { ...tpl, items: newItems };
          },
        });
      }
    }

    // 3. Collision / Overlap Check with subsequent items
    for (let j = idx + 1; j < items.length; j++) {
      const other = items[j];
      // Skip shapes/backgrounds that are meant to be layers
      if (item.type === 'shape' || other.type === 'shape' || item.type === 'restricted_area' || other.type === 'restricted_area') {
        continue;
      }

      const overlapX = Math.max(0, Math.min(item.x_mm + item.w_mm, other.x_mm + other.w_mm) - Math.max(item.x_mm, other.x_mm));
      const overlapY = Math.max(0, Math.min(item.y_mm + item.h_mm, other.y_mm + other.h_mm) - Math.max(item.y_mm, other.y_mm));
      const overlapArea = overlapX * overlapY;

      if (overlapArea > 4 && overlapX > 2 && overlapY > 2) {
        issues.push({
          id: `collision-${item.id}-${other.id}`,
          type: 'collision',
          severity: 'warning',
          itemId: item.id,
          itemType: item.type,
          message: `Chevauchement détecté entre "${(item as any).text || item.type}" et "${(other as any).text || other.type}"`,
          autoFixAvailable: true,
          fixDescription: 'Décaler automatiquement pour supprimer la superposition',
          applyFix: (tpl) => {
            const newItems = tpl.items.map((it) => {
              if (it.id === other.id) {
                // Nudge 'other' below 'item' with 1.5mm gap
                const newY = Math.min(labelH - marginBottom - other.h_mm, item.y_mm + item.h_mm + 1.5);
                return { ...it, y_mm: newY };
              }
              return it;
            });
            return { ...tpl, items: newItems };
          },
        });
      }
    }
  });

  return issues;
}

export function autoFixAllLayoutIssues(template: LabelTemplate): LabelTemplate {
  let current = { ...template };
  const issues = analyzeLayoutIssues(current);
  issues.forEach((issue) => {
    if (issue.autoFixAvailable && issue.applyFix) {
      current = issue.applyFix(current);
    }
  });
  return current;
}
