import { TemplateItem } from '../types';

/**
 * Applies semantic snapping to elements in a template.
 * If a child element has `semantic_snap` configured, its bounding box is linked
 * dynamically to the parent element's bounding box:
 * - 'bottom': child.y_mm = parent.y_mm + parent.h_mm + offset_mm
 * - 'top': child.y_mm = parent.y_mm - child.h_mm - offset_mm
 * - 'right': child.x_mm = parent.x_mm + parent.w_mm + offset_mm
 * - 'left': child.x_mm = parent.x_mm - child.w_mm - offset_mm
 *
 * Runs multi-pass topological propagation (A -> B -> C) while safely terminating
 * on circular references.
 */
export function applySemanticSnapping(items: TemplateItem[]): TemplateItem[] {
  if (!items || items.length === 0) return items;

  const itemMap = new Map<string, TemplateItem>();
  items.forEach((it) => itemMap.set(it.id, { ...it }));

  const maxPasses = 5;
  let hasChanged = true;
  let pass = 0;

  while (hasChanged && pass < maxPasses) {
    hasChanged = false;
    pass++;

    for (const [id, child] of itemMap.entries()) {
      if (!child.semantic_snap || !child.semantic_snap.parent_id) continue;

      const parent = itemMap.get(child.semantic_snap.parent_id);
      if (!parent || parent.id === child.id) continue;

      const { anchor_edge, offset_mm } = child.semantic_snap;
      let newX = child.x_mm;
      let newY = child.y_mm;

      switch (anchor_edge) {
        case 'bottom':
          newY = Number((parent.y_mm + parent.h_mm + offset_mm).toFixed(2));
          break;
        case 'top':
          newY = Number((parent.y_mm - child.h_mm - offset_mm).toFixed(2));
          break;
        case 'right':
          newX = Number((parent.x_mm + parent.w_mm + offset_mm).toFixed(2));
          break;
        case 'left':
          newX = Number((parent.x_mm - child.w_mm - offset_mm).toFixed(2));
          break;
      }

      if (Math.abs(newX - child.x_mm) > 0.01 || Math.abs(newY - child.y_mm) > 0.01) {
        itemMap.set(id, {
          ...child,
          x_mm: newX,
          y_mm: newY,
        });
        hasChanged = true;
      }
    }
  }

  return items.map((original) => itemMap.get(original.id) || original);
}
