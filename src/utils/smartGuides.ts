/**
 * Smart Guide types and computation logic for vector canvas alignment.
 * Dynamically computes alignment lines (horizontal, vertical, edges, centers, canvas margins)
 * between dragging/resizing elements and all other static elements on canvas.
 */

export interface SmartGuideLine {
  id: string;
  orientation: 'horizontal' | 'vertical';
  /** Position in mm along the orthogonal axis (y for horizontal guide, x for vertical guide) */
  position_mm: number;
  /** Start and end extent in mm to draw the visual dashed alignment line */
  start_mm: number;
  end_mm: number;
  /** Kind of alignment: 'edge' (left/right/top/bottom) | 'center' (midpoint) | 'canvas' (canvas center/margin) */
  type: 'edge' | 'center' | 'canvas';
  /** Text label to optionally display (e.g. 'Centré V', 'Aligné gauche', etc.) */
  label?: string;
}

export interface BoxBounds {
  id?: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export interface SnapResult {
  snappedX: number;
  snappedY: number;
  snappedW?: number;
  snappedH?: number;
  guides: SmartGuideLine[];
}

const SNAP_THRESHOLD_MM = 1.0; // Distance within which smart guide activates and snaps

/**
 * Calculates smart guides and magnetic snap for moving objects.
 */
export function computeSmartGuides(
  movingBounds: BoxBounds,
  otherBoxes: BoxBounds[],
  canvasWidthMm: number,
  canvasHeightMm: number,
  innerMarginsMm?: { top: number; bottom: number; left: number; right: number },
  enabled = true
): SnapResult {
  if (!enabled) {
    return {
      snappedX: movingBounds.left,
      snappedY: movingBounds.top,
      guides: [],
    };
  }

  let snappedX = movingBounds.left;
  let snappedY = movingBounds.top;
  const guides: SmartGuideLine[] = [];

  let minDeltaX = SNAP_THRESHOLD_MM + 1;
  let minDeltaY = SNAP_THRESHOLD_MM + 1;
  let bestGuideX: SmartGuideLine | null = null;
  let bestGuideY: SmartGuideLine | null = null;

  // Potential reference targets
  const targetsX: { x: number; type: 'edge' | 'center' | 'canvas'; label?: string; refBox?: BoxBounds }[] = [];
  const targetsY: { y: number; type: 'edge' | 'center' | 'canvas'; label?: string; refBox?: BoxBounds }[] = [];

  // Canvas bounds and center
  targetsX.push({ x: 0, type: 'canvas', label: 'Bord gauche gabarit' });
  targetsX.push({ x: canvasWidthMm / 2, type: 'canvas', label: 'Centre H gabarit' });
  targetsX.push({ x: canvasWidthMm, type: 'canvas', label: 'Bord droit gabarit' });

  targetsY.push({ y: 0, type: 'canvas', label: 'Bord haut gabarit' });
  targetsY.push({ y: canvasHeightMm / 2, type: 'canvas', label: 'Centre V gabarit' });
  targetsY.push({ y: canvasHeightMm, type: 'canvas', label: 'Bord bas gabarit' });

  // Canvas printable margins
  if (innerMarginsMm) {
    targetsX.push({ x: innerMarginsMm.left, type: 'canvas', label: 'Marge imprimable G' });
    targetsX.push({ x: canvasWidthMm - innerMarginsMm.right, type: 'canvas', label: 'Marge imprimable D' });
    targetsY.push({ y: innerMarginsMm.top, type: 'canvas', label: 'Marge imprimable H' });
    targetsY.push({ y: canvasHeightMm - innerMarginsMm.bottom, type: 'canvas', label: 'Marge imprimable B' });
  }

  // Other elements targets
  for (const box of otherBoxes) {
    targetsX.push({ x: box.left, type: 'edge', refBox: box, label: 'Aligné gauche' });
    targetsX.push({ x: box.centerX, type: 'center', refBox: box, label: 'Centré H' });
    targetsX.push({ x: box.right, type: 'edge', refBox: box, label: 'Aligné droite' });

    targetsY.push({ y: box.top, type: 'edge', refBox: box, label: 'Aligné haut' });
    targetsY.push({ y: box.centerY, type: 'center', refBox: box, label: 'Centré V' });
    targetsY.push({ y: box.bottom, type: 'edge', refBox: box, label: 'Aligné bas' });
  }

  // Current moving points
  const movingPointsX = [
    { offset: 0, kind: 'left' },
    { offset: movingBounds.width / 2, kind: 'center' },
    { offset: movingBounds.width, kind: 'right' },
  ];

  const movingPointsY = [
    { offset: 0, kind: 'top' },
    { offset: movingBounds.height / 2, kind: 'center' },
    { offset: movingBounds.height, kind: 'bottom' },
  ];

  // Test X alignments
  for (const mp of movingPointsX) {
    const currentX = movingBounds.left + mp.offset;
    for (const target of targetsX) {
      const delta = Math.abs(currentX - target.x);
      if (delta < SNAP_THRESHOLD_MM && delta < minDeltaX) {
        minDeltaX = delta;
        snappedX = target.x - mp.offset;

        const startY = target.refBox
          ? Math.min(movingBounds.top, target.refBox.top) - 5
          : Math.min(0, movingBounds.top - 5);
        const endY = target.refBox
          ? Math.max(movingBounds.bottom, target.refBox.bottom) + 5
          : Math.max(canvasHeightMm, movingBounds.bottom + 5);

        bestGuideX = {
          id: `guide-x-${target.x.toFixed(1)}`,
          orientation: 'vertical',
          position_mm: target.x,
          start_mm: Math.max(0, startY),
          end_mm: Math.min(canvasHeightMm, endY),
          type: target.type,
          label: target.label,
        };
      }
    }
  }

  // Test Y alignments
  for (const mp of movingPointsY) {
    const currentY = movingBounds.top + mp.offset;
    for (const target of targetsY) {
      const delta = Math.abs(currentY - target.y);
      if (delta < SNAP_THRESHOLD_MM && delta < minDeltaY) {
        minDeltaY = delta;
        snappedY = target.y - mp.offset;

        const startX = target.refBox
          ? Math.min(movingBounds.left, target.refBox.left) - 5
          : Math.min(0, movingBounds.left - 5);
        const endX = target.refBox
          ? Math.max(movingBounds.right, target.refBox.right) + 5
          : Math.max(canvasWidthMm, movingBounds.right + 5);

        bestGuideY = {
          id: `guide-y-${target.y.toFixed(1)}`,
          orientation: 'horizontal',
          position_mm: target.y,
          start_mm: Math.max(0, startX),
          end_mm: Math.min(canvasWidthMm, endX),
          type: target.type,
          label: target.label,
        };
      }
    }
  }

  if (bestGuideX) guides.push(bestGuideX);
  if (bestGuideY) guides.push(bestGuideY);

  return {
    snappedX,
    snappedY,
    guides,
  };
}

/**
 * Calculates smart guides for resizing an element from a specific handle (e.g. 'nw', 'se', etc.)
 */
export function computeResizeSmartGuides(
  resizingId: string,
  handle: string,
  rawBox: { x: number; y: number; w: number; h: number },
  otherBoxes: BoxBounds[],
  canvasWidthMm: number,
  canvasHeightMm: number,
  innerMarginsMm?: { top: number; bottom: number; left: number; right: number },
  enabled = true
): { snappedBox: { x: number; y: number; w: number; h: number }; guides: SmartGuideLine[] } {
  if (!enabled) {
    return {
      snappedBox: rawBox,
      guides: [],
    };
  }

  let { x, y, w, h } = rawBox;
  const guides: SmartGuideLine[] = [];

  const targetsX: { x: number; type: 'edge' | 'center' | 'canvas'; label?: string; refBox?: BoxBounds }[] = [
    { x: 0, type: 'canvas' },
    { x: canvasWidthMm / 2, type: 'canvas' },
    { x: canvasWidthMm, type: 'canvas' },
  ];

  const targetsY: { y: number; type: 'edge' | 'center' | 'canvas'; label?: string; refBox?: BoxBounds }[] = [
    { y: 0, type: 'canvas' },
    { y: canvasHeightMm / 2, type: 'canvas' },
    { y: canvasHeightMm, type: 'canvas' },
  ];

  if (innerMarginsMm) {
    targetsX.push({ x: innerMarginsMm.left, type: 'canvas' });
    targetsX.push({ x: canvasWidthMm - innerMarginsMm.right, type: 'canvas' });
    targetsY.push({ y: innerMarginsMm.top, type: 'canvas' });
    targetsY.push({ y: canvasHeightMm - innerMarginsMm.bottom, type: 'canvas' });
  }

  for (const b of otherBoxes) {
    targetsX.push({ x: b.left, type: 'edge', refBox: b });
    targetsX.push({ x: b.centerX, type: 'center', refBox: b });
    targetsX.push({ x: b.right, type: 'edge', refBox: b });

    targetsY.push({ y: b.top, type: 'edge', refBox: b });
    targetsY.push({ y: b.centerY, type: 'center', refBox: b });
    targetsY.push({ y: b.bottom, type: 'edge', refBox: b });
  }

  // Handle right/east edges
  if (handle.includes('e')) {
    const edgeX = x + w;
    for (const t of targetsX) {
      if (Math.abs(edgeX - t.x) < SNAP_THRESHOLD_MM) {
        w = Math.max(1, t.x - x);
        guides.push({
          id: `resize-guide-x-${t.x}`,
          orientation: 'vertical',
          position_mm: t.x,
          start_mm: 0,
          end_mm: canvasHeightMm,
          type: t.type,
          label: 'Alignement redimensionnement',
        });
        break;
      }
    }
  }

  // Handle left/west edges
  if (handle.includes('w')) {
    const edgeX = x;
    for (const t of targetsX) {
      if (Math.abs(edgeX - t.x) < SNAP_THRESHOLD_MM) {
        const rightEdge = x + w;
        x = t.x;
        w = Math.max(1, rightEdge - x);
        guides.push({
          id: `resize-guide-x-${t.x}`,
          orientation: 'vertical',
          position_mm: t.x,
          start_mm: 0,
          end_mm: canvasHeightMm,
          type: t.type,
          label: 'Alignement redimensionnement',
        });
        break;
      }
    }
  }

  // Handle bottom/south edges
  if (handle.includes('s')) {
    const edgeY = y + h;
    for (const t of targetsY) {
      if (Math.abs(edgeY - t.y) < SNAP_THRESHOLD_MM) {
        h = Math.max(1, t.y - y);
        guides.push({
          id: `resize-guide-y-${t.y}`,
          orientation: 'horizontal',
          position_mm: t.y,
          start_mm: 0,
          end_mm: canvasWidthMm,
          type: t.type,
          label: 'Alignement redimensionnement',
        });
        break;
      }
    }
  }

  // Handle top/north edges
  if (handle.includes('n')) {
    const edgeY = y;
    for (const t of targetsY) {
      if (Math.abs(edgeY - t.y) < SNAP_THRESHOLD_MM) {
        const bottomEdge = y + h;
        y = t.y;
        h = Math.max(1, bottomEdge - y);
        guides.push({
          id: `resize-guide-y-${t.y}`,
          orientation: 'horizontal',
          position_mm: t.y,
          start_mm: 0,
          end_mm: canvasWidthMm,
          type: t.type,
          label: 'Alignement redimensionnement',
        });
        break;
      }
    }
  }

  return {
    snappedBox: { x, y, w, h },
    guides,
  };
}
