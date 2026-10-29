import React from 'react';

interface CanvasRulersProps {
  width_mm: number;
  height_mm: number;
  zoom: number;
  mousePosMm: { x_mm: number; y_mm: number } | null;
  rulerMode?: 'sheet_margins' | 'window_frame' | 'floating' | 'hidden';
  rulerOffsetPx?: number;
  canvasOffsetPx?: { left: number; top: number };
  showTopRuler?: boolean;
  showLeftRuler?: boolean;
}

export const CanvasRulers: React.FC<CanvasRulersProps> = ({
  width_mm,
  height_mm,
  zoom,
  mousePosMm,
  rulerMode = 'sheet_margins',
  rulerOffsetPx = 40,
  canvasOffsetPx = { left: 0, top: 0 },
  showTopRuler = true,
  showLeftRuler = true,
}) => {
  if (rulerMode === 'hidden') return null;

  const scalePxPerMm = 3.78 * zoom;
  const totalW = width_mm * scalePxPerMm;
  const totalH = height_mm * scalePxPerMm;

  if (rulerMode === 'window_frame') {
    // Physical Viewport Frame Rulers: Anchored at top and left of viewport container
    const originX = canvasOffsetPx.left;
    const originY = canvasOffsetPx.top;

    const hTicks: number[] = [];
    for (let mm = -100; mm <= width_mm + 100; mm += 5) {
      hTicks.push(mm);
    }

    const vTicks: number[] = [];
    for (let mm = -100; mm <= height_mm + 100; mm += 5) {
      vTicks.push(mm);
    }

    return (
      <>
        {/* Top Viewport Ruler (Anchored under top ribbon) */}
        {showTopRuler && (
          <div className="absolute top-0 left-0 right-0 h-6 bg-slate-900/95 border-b border-slate-700/90 text-[9px] font-mono font-semibold text-slate-300 pointer-events-none select-none z-30 overflow-hidden shadow-md">
            <div className="relative w-full h-full">
              {hTicks.map((mm) => {
                const leftPx = originX + mm * scalePxPerMm;
                const isMajor = mm % 10 === 0;
                const isOrigin = mm === 0;
                return (
                  <div
                    key={`vh_${mm}`}
                    className={`absolute bottom-0 border-l ${isOrigin ? 'border-indigo-400 border-l-2' : 'border-slate-500'}`}
                    style={{
                      left: `${leftPx}px`,
                      height: isMajor ? '14px' : '7px',
                    }}
                  >
                    {isMajor && (
                      <span className={`absolute bottom-3.5 -left-3 text-[8px] font-bold ${isOrigin ? 'text-indigo-400' : 'text-slate-200'}`}>
                        {mm}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Live mouse cursor indicator */}
              {mousePosMm && (
                <div
                  className="absolute top-0 bottom-0 border-l border-amber-400 z-20"
                  style={{ left: `${originX + mousePosMm.x_mm * scalePxPerMm}px` }}
                >
                  <span className="absolute -top-1 -left-3 text-[7px] bg-amber-500 text-slate-950 font-bold px-0.5 rounded shadow-2xs">
                    {Math.round(mousePosMm.x_mm)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Left Viewport Ruler (Anchored on viewport left edge) */}
        {showLeftRuler && (
          <div className="absolute top-0 left-0 bottom-0 w-6 bg-slate-900/95 border-r border-slate-700/90 text-[9px] font-mono font-semibold text-slate-300 pointer-events-none select-none z-30 overflow-hidden shadow-md">
            <div className="relative w-full h-full">
              {vTicks.map((mm) => {
                const topPx = originY + mm * scalePxPerMm;
                const isMajor = mm % 10 === 0;
                const isOrigin = mm === 0;
                return (
                  <div
                    key={`vv_${mm}`}
                    className={`absolute right-0 border-t ${isOrigin ? 'border-indigo-400 border-t-2' : 'border-slate-500'}`}
                    style={{
                      top: `${topPx}px`,
                      width: isMajor ? '14px' : '7px',
                    }}
                  >
                    {isMajor && (
                      <span className={`absolute right-3.5 -top-2 text-[8px] font-bold ${isOrigin ? 'text-indigo-400' : 'text-slate-200'}`}>
                        {mm}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Live mouse cursor indicator */}
              {mousePosMm && (
                <div
                  className="absolute left-0 right-0 border-t border-amber-400 z-20"
                  style={{ top: `${originY + mousePosMm.y_mm * scalePxPerMm}px` }}
                >
                  <span className="absolute -left-1 -top-2.5 text-[7px] bg-amber-500 text-slate-950 font-bold px-0.5 rounded shadow-2xs">
                    {Math.round(mousePosMm.y_mm)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // SHEET MARGINS MODE: Positioned around canvas sheet with clearance offset
  const hTicks: number[] = [];
  for (let mm = 0; mm <= width_mm; mm += 5) {
    hTicks.push(mm);
  }

  const vTicks: number[] = [];
  for (let mm = 0; mm <= height_mm; mm += 5) {
    vTicks.push(mm);
  }

  const topOffsetPx = -rulerOffsetPx;
  const leftOffsetPx = -rulerOffsetPx;

  return (
    <>
      {/* Top Decoupled Sheet Ruler */}
      {showTopRuler && (
        <div
          className="absolute h-6 bg-slate-900/95 border border-slate-700/80 text-[9px] font-mono font-semibold text-slate-300 pointer-events-none select-none z-30 overflow-hidden rounded-t-sm shadow-md"
          style={{
            top: `${topOffsetPx}px`,
            left: '0px',
            width: `${totalW}px`,
          }}
        >
          <div className="relative w-full h-full">
            <div className="absolute left-0.5 top-0.5 text-[8px] text-indigo-400 font-bold">
              0mm
            </div>

            {hTicks.map((mm) => {
              const leftPx = mm * scalePxPerMm;
              const isMajor = mm % 10 === 0;
              return (
                <div
                  key={`h_${mm}`}
                  className="absolute bottom-0 border-l border-slate-500"
                  style={{
                    left: `${leftPx}px`,
                    height: isMajor ? '14px' : '7px',
                  }}
                >
                  {isMajor && mm > 0 && (
                    <span className="absolute bottom-3.5 -left-2 text-[8px] text-slate-200 font-bold">
                      {mm}
                    </span>
                  )}
                </div>
              );
            })}

            {mousePosMm && mousePosMm.x_mm >= 0 && mousePosMm.x_mm <= width_mm && (
              <div
                className="absolute top-0 bottom-0 border-l border-amber-400 z-20"
                style={{ left: `${mousePosMm.x_mm * scalePxPerMm}px` }}
              >
                <span className="absolute -top-1 -left-3 text-[7px] bg-amber-500 text-slate-950 font-bold px-0.5 rounded shadow-2xs">
                  {Math.round(mousePosMm.x_mm)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Left Decoupled Sheet Ruler */}
      {showLeftRuler && (
        <div
          className="absolute w-6 bg-slate-900/95 border border-slate-700/80 text-[9px] font-mono font-semibold text-slate-300 pointer-events-none select-none z-30 overflow-hidden rounded-l-sm shadow-md"
          style={{
            top: '0px',
            left: `${leftOffsetPx}px`,
            height: `${totalH}px`,
          }}
        >
          <div className="relative w-full h-full">
            {vTicks.map((mm) => {
              const topPx = mm * scalePxPerMm;
              const isMajor = mm % 10 === 0;
              return (
                <div
                  key={`v_${mm}`}
                  className="absolute right-0 border-t border-slate-500"
                  style={{
                    top: `${topPx}px`,
                    width: isMajor ? '14px' : '7px',
                  }}
                >
                  {isMajor && mm > 0 && (
                    <span className="absolute right-3.5 -top-2 text-[8px] text-slate-200 font-bold">
                      {mm}
                    </span>
                  )}
                </div>
              );
            })}

            {mousePosMm && mousePosMm.y_mm >= 0 && mousePosMm.y_mm <= height_mm && (
              <div
                className="absolute left-0 right-0 border-t border-amber-400 z-20"
                style={{ top: `${mousePosMm.y_mm * scalePxPerMm}px` }}
              >
                <span className="absolute -left-1 -top-2.5 text-[7px] bg-amber-500 text-slate-950 font-bold px-0.5 rounded shadow-2xs">
                  {Math.round(mousePosMm.y_mm)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
