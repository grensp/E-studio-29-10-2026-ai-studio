import React from 'react';
import { CurvedTextItemProperties } from '../types';

export interface CurvedTextRendererProps {
  item: CurvedTextItemProperties;
  pxPerMm: number;
}

export const CurvedTextRenderer: React.FC<CurvedTextRendererProps> = ({ item, pxPerMm }) => {
  const w = item.w_mm * pxPerMm;
  const h = item.h_mm * pxPerMm;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(cx, cy) * 0.85;

  const pathId = `curved-path-${item.id}`;

  // Build arc path
  const startAngleRad = ((item.start_angle_deg || 0) * Math.PI) / 180;
  const sweepAngleRad = ((item.sweep_angle_deg || 180) * Math.PI) / 180;
  const endAngleRad = startAngleRad + (item.clockwise !== false ? sweepAngleRad : -sweepAngleRad);

  const x1 = cx + radius * Math.cos(startAngleRad);
  const y1 = cy + radius * Math.sin(startAngleRad);
  const x2 = cx + radius * Math.cos(endAngleRad);
  const y2 = cy + radius * Math.sin(endAngleRad);

  const largeArcFlag = sweepAngleRad > Math.PI ? 1 : 0;
  const sweepFlag = item.clockwise !== false ? 1 : 0;

  const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${x2} ${y2}`;

  const fontSizePx = item.font_size_pt * 1.333 * (pxPerMm / 3.78);

  return (
    <div
      className="w-full h-full relative flex items-center justify-center select-none overflow-visible"
      style={{ width: `${w}px`, height: `${h}px` }}
    >
      <svg
        className="w-full h-full overflow-visible"
        viewBox={`0 0 ${w} ${h}`}
      >
        <defs>
          <path id={pathId} d={d} fill="none" />
        </defs>

        {/* Text on curved path */}
        <text
          fill={item.text_color || '#000000'}
          fontFamily={item.font_family || 'Plus Jakarta Sans'}
          fontSize={`${fontSizePx}px`}
          fontWeight={item.font_weight || 'normal'}
          fontStyle={item.font_style || 'normal'}
          letterSpacing={item.letter_spacing_pt ? `${item.letter_spacing_pt}pt` : undefined}
          textAnchor="middle"
        >
          <textPath href={`#${pathId}`} startOffset="50%">
            {item.text || 'Texte Courbé'}
          </textPath>
        </text>
      </svg>
    </div>
  );
};
