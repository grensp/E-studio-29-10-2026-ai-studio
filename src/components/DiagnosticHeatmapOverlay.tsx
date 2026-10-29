import React from 'react';
import { LabelTemplate, TemplateItem } from '../types';
import { analyzeLayoutIssues } from '../utils/layoutAutoFix';

interface DiagnosticHeatmapOverlayProps {
  template: LabelTemplate;
  zoom: number;
}

function getItemDisplayLabel(item: TemplateItem): string {
  if (item.type === 'text') return item.text || 'Texte';
  if (item.type === 'barcode') return `Barcode: ${item.binding_key || item.code}`;
  if (item.type === 'qrcode') return `QR: ${item.binding_key || item.content}`;
  if (item.type === 'price_block') return `Prix: ${item.binding_key}`;
  if (item.binding_key) return `{{${item.binding_key}}}`;
  return item.type;
}

export const DiagnosticHeatmapOverlay: React.FC<DiagnosticHeatmapOverlayProps> = ({
  template,
  zoom,
}) => {
  const issues = analyzeLayoutIssues(template);
  const pxPerMm = 3.78 * zoom;

  const widthPx = template.width_mm * pxPerMm;
  const heightPx = template.height_mm * pxPerMm;
  const leftMarginPx = (template.inner_margins_mm?.left ?? 2) * pxPerMm;
  const topMarginPx = (template.inner_margins_mm?.top ?? 2) * pxPerMm;
  const rightMarginPx = (template.inner_margins_mm?.right ?? 2) * pxPerMm;
  const bottomMarginPx = (template.inner_margins_mm?.bottom ?? 2) * pxPerMm;

  // Find colliding and warning items
  const errorItemIds = new Set(
    issues.filter((i) => i.severity === 'error').map((i) => i.itemId)
  );
  const warningItemIds = new Set(
    issues.filter((i) => i.severity === 'warning').map((i) => i.itemId)
  );

  return (
    <div
      style={{
        width: `${widthPx}px`,
        height: `${heightPx}px`,
      }}
      className="absolute inset-0 pointer-events-none z-30 overflow-hidden font-mono select-none"
    >
      {/* Darkened diagnostic background backdrop */}
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[1px]" />

      {/* Safe Printable Zone Boundary */}
      <div
        style={{
          top: `${topMarginPx}px`,
          left: `${leftMarginPx}px`,
          width: `${widthPx - leftMarginPx - rightMarginPx}px`,
          height: `${heightPx - topMarginPx - bottomMarginPx}px`,
        }}
        className="absolute border border-dashed border-emerald-400/60 bg-emerald-500/5"
      >
        <span className="absolute top-1 left-1 text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-500/40">
          ZONE SÉCURISÉE ({template.inner_margins_mm?.left ?? 2}mm)
        </span>
      </div>

      {/* Clipping warning border on edges */}
      <div className="absolute inset-0 border-2 border-red-500/40 pointer-events-none" />

      {/* Component Bounding Boxes & Neon Diagnostic Outlines */}
      {(template.items || []).map((item) => {
        const isError = errorItemIds.has(item.id);
        const isWarning = warningItemIds.has(item.id);

        const itemX = item.x_mm * pxPerMm;
        const itemY = item.y_mm * pxPerMm;
        const itemW = item.w_mm * pxPerMm;
        const itemH = item.h_mm * pxPerMm;

        const borderColor = isError
          ? 'border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]'
          : isWarning
          ? 'border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.7)]'
          : 'border-cyan-400/80 shadow-[0_0_8px_rgba(34,211,238,0.5)]';

        const bgColor = isError
          ? 'bg-red-500/20'
          : isWarning
          ? 'bg-amber-500/15'
          : 'bg-cyan-500/10';

        const textColor = isError
          ? 'text-red-300 bg-red-950/90 border-red-500/60'
          : isWarning
          ? 'text-amber-300 bg-amber-950/90 border-amber-500/60'
          : 'text-cyan-300 bg-cyan-950/90 border-cyan-500/60';

        return (
          <div
            key={item.id}
            style={{
              top: `${itemY}px`,
              left: `${itemX}px`,
              width: `${itemW}px`,
              height: `${itemH}px`,
            }}
            className={`absolute border-2 ${borderColor} ${bgColor} transition-all duration-200 flex flex-col justify-between p-1`}
          >
            {/* Top diagnostic tag */}
            <div className="flex items-center justify-between">
              <span className={`text-[8px] font-bold px-1 rounded border ${textColor} truncate max-w-[120px]`}>
                {getItemDisplayLabel(item)}
              </span>
              {isError && (
                <span className="text-[8px] font-bold text-red-200 bg-red-600 px-1 rounded animate-pulse">
                  COLLISION / DÉBORD
                </span>
              )}
            </div>

            {/* Bottom dimension tag */}
            <div className="text-[8px] text-slate-300/80 self-end">
              {item.w_mm.toFixed(1)}×{item.h_mm.toFixed(1)}mm
            </div>
          </div>
        );
      })}
    </div>
  );
};
