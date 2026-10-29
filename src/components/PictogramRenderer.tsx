import React from 'react';
import { PictogramItemProperties } from '../types';

export interface PictogramRendererProps {
  item: PictogramItemProperties;
  pxPerMm: number;
}

export const PictogramRenderer: React.FC<PictogramRendererProps> = ({ item, pxPerMm }) => {
  const w = item.w_mm * pxPerMm;
  const h = item.h_mm * pxPerMm;
  const type = item.pictogram_type;

  // Render Nutri-Score (Official 5-color block with active letter highlighted)
  if (type.startsWith('nutriscore_')) {
    const activeLetter = type.replace('nutriscore_', '').toUpperCase();
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const colors = ['#038141', '#85bb2f', '#fecb02', '#ee8100', '#e63e11'];

    return (
      <div
        className="w-full h-full flex flex-col items-center justify-between p-1 bg-white rounded shadow-xs border border-slate-200 select-none overflow-hidden"
        style={{ width: `${w}px`, height: `${h}px` }}
      >
        <span className="text-[9px] font-black uppercase tracking-wider text-slate-800 leading-none">
          NUTRI-SCORE
        </span>
        <div className="flex items-end justify-center w-full gap-0.5 flex-1 py-0.5">
          {letters.map((letter, idx) => {
            const isActive = letter === activeLetter;
            return (
              <div
                key={letter}
                className={`flex items-center justify-center font-black transition-all ${
                  isActive
                    ? 'rounded-md shadow-md transform -translate-y-0.5 text-white scale-110 z-10'
                    : 'rounded-xs text-white/80 opacity-70'
                }`}
                style={{
                  backgroundColor: colors[idx],
                  width: isActive ? '24%' : '17%',
                  height: isActive ? '90%' : '65%',
                  fontSize: isActive ? `${Math.max(10, Math.round(h * 0.35))}px` : `${Math.max(7, Math.round(h * 0.22))}px`,
                }}
              >
                {letter}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Render Éco-Score
  if (type.startsWith('ecoscore_')) {
    const activeLetter = type.replace('ecoscore_', '').toUpperCase();
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const colors = ['#1e824c', '#2ecc71', '#f39c12', '#e67e22', '#d35400'];

    return (
      <div
        className="w-full h-full flex flex-col items-center justify-between p-1 bg-white rounded shadow-xs border border-slate-200 select-none overflow-hidden"
        style={{ width: `${w}px`, height: `${h}px` }}
      >
        <div className="flex items-center gap-1">
          <svg className="w-2.5 h-2.5 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
          </svg>
          <span className="text-[8px] font-black uppercase tracking-wider text-emerald-900 leading-none">
            ÉCO-SCORE
          </span>
        </div>
        <div className="flex items-end justify-center w-full gap-0.5 flex-1 py-0.5">
          {letters.map((letter, idx) => {
            const isActive = letter === activeLetter;
            return (
              <div
                key={letter}
                className={`flex items-center justify-center font-black ${
                  isActive
                    ? 'rounded-md shadow-md text-white scale-110 z-10'
                    : 'rounded-xs text-white/80 opacity-60'
                }`}
                style={{
                  backgroundColor: colors[idx],
                  width: isActive ? '24%' : '17%',
                  height: isActive ? '85%' : '60%',
                  fontSize: isActive ? `${Math.max(10, Math.round(h * 0.32))}px` : `${Math.max(7, Math.round(h * 0.2))}px`,
                }}
              >
                {letter}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Render Origine France / Locale
  if (type === 'origin_france' || type === 'origin_local') {
    return (
      <div
        className="w-full h-full flex items-center gap-1.5 p-1 bg-white border border-slate-300 rounded shadow-xs overflow-hidden select-none"
        style={{ width: `${w}px`, height: `${h}px` }}
      >
        {/* French Flag mini badge */}
        <div className="h-full aspect-[3/2] flex rounded-xs overflow-hidden border border-slate-300 shrink-0">
          <div className="w-1/3 bg-[#002395] h-full" />
          <div className="w-1/3 bg-[#FFFFFF] h-full" />
          <div className="w-1/3 bg-[#ED2939] h-full" />
        </div>
        <div className="flex flex-col justify-center leading-tight">
          <span className="text-[7px] font-bold text-slate-500 uppercase">ORIGINE</span>
          <span className="text-[10px] font-extrabold text-slate-900 whitespace-nowrap">
            {type === 'origin_france' ? 'FRANCE' : 'LOCALE'}
          </span>
        </div>
      </div>
    );
  }

  // Render Bio AB (Agriculture Biologique)
  if (type === 'bio_ab') {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center bg-[#15803d] text-white rounded p-1 font-bold select-none border border-emerald-800"
        style={{ width: `${w}px`, height: `${h}px` }}
      >
        <span className="text-[14px] font-black tracking-tighter leading-none">AB</span>
        <span className="text-[6px] uppercase tracking-wider font-semibold opacity-90 leading-none mt-0.5">
          AGRICULTURE BIOLOGIQUE
        </span>
      </div>
    );
  }

  // Render Bio Europe
  if (type === 'bio_europe') {
    return (
      <div
        className="w-full h-full flex items-center justify-center bg-[#16a34a] text-white rounded p-1 select-none border border-emerald-700"
        style={{ width: `${w}px`, height: `${h}px` }}
      >
        <svg className="w-full h-full max-h-8" viewBox="0 0 100 60" fill="none">
          <path
            d="M50 10 C 25 15, 20 40, 50 50 C 80 40, 75 15, 50 10 Z"
            fill="#ffffff"
          />
          <circle cx="50" cy="18" r="2.5" fill="#16a34a" />
          <circle cx="42" cy="22" r="2.2" fill="#16a34a" />
          <circle cx="58" cy="22" r="2.2" fill="#16a34a" />
          <circle cx="36" cy="30" r="2.2" fill="#16a34a" />
          <circle cx="64" cy="30" r="2.2" fill="#16a34a" />
        </svg>
      </div>
    );
  }

  // Render Triman / Recycling Symbol
  if (type === 'triman_recycling') {
    return (
      <div
        className="w-full h-full flex items-center justify-center bg-white border border-slate-300 rounded p-1 text-slate-800 select-none gap-1"
        style={{ width: `${w}px`, height: `${h}px` }}
      >
        <svg className="w-6 h-6 text-slate-900 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
          <path d="M7 16l5-9 5 9H7z" stroke="none" fill="currentColor" />
        </svg>
        <div className="flex flex-col text-[7px] font-bold uppercase leading-none">
          <span>TRI</span>
          <span className="text-emerald-700 font-extrabold">BAC JAUNE</span>
        </div>
      </div>
    );
  }

  // Render Allergens (Gluten, Lait, Arachide, Oeuf, etc.)
  if (type.startsWith('allergen_')) {
    const allergenName = type.replace('allergen_', '').toUpperCase();
    return (
      <div
        className="w-full h-full flex items-center gap-1 bg-amber-50 border border-amber-300 rounded p-1 text-amber-900 select-none"
        style={{ width: `${w}px`, height: `${h}px` }}
      >
        <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[9px] shrink-0">
          !
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[6px] uppercase text-amber-700 font-bold">ALLERGÈNE</span>
          <span className="text-[8px] font-extrabold text-amber-950">{allergenName}</span>
        </div>
      </div>
    );
  }

  // Fallback generic badge
  return (
    <div
      className="w-full h-full flex items-center justify-center bg-slate-100 border border-slate-300 rounded text-slate-700 text-xs font-bold"
      style={{ width: `${w}px`, height: `${h}px` }}
    >
      {item.custom_label || type}
    </div>
  );
};
