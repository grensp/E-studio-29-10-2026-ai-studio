import React from 'react';
import { PriceTierBreak } from '../types';
import { TrendingDown, Plus, Trash2, ArrowRight } from 'lucide-react';

interface PriceTierVisualizerProps {
  basePrice: number;
  tiers: PriceTierBreak[];
  currencySymbol?: string;
  onChangeTiers: (updatedTiers: PriceTierBreak[]) => void;
  onAddTier?: () => void;
}

export const PriceTierVisualizer: React.FC<PriceTierVisualizerProps> = ({
  basePrice,
  tiers,
  currencySymbol = '€',
  onChangeTiers,
  onAddTier,
}) => {
  // Sort tiers by min_qty
  const sortedTiers = [...tiers].sort((a, b) => a.min_qty - b.min_qty);

  const handleUpdateQty = (index: number, newQty: number) => {
    const updated = [...sortedTiers];
    updated[index] = { ...updated[index], min_qty: Math.max(1, newQty) };
    onChangeTiers(updated);
  };

  const handleUpdatePrice = (index: number, newPrice: number) => {
    const updated = [...sortedTiers];
    updated[index] = { ...updated[index], unit_price: Math.max(0, newPrice) };
    onChangeTiers(updated);
  };

  const handleDeleteTier = (index: number) => {
    const updated = sortedTiers.filter((_, idx) => idx !== index);
    onChangeTiers(updated);
  };

  const maxQty = Math.max(10, ...sortedTiers.map(t => t.min_qty * 1.3));
  const maxPrice = Math.max(basePrice, ...sortedTiers.map(t => t.unit_price));

  return (
    <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl border border-slate-800 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
          <TrendingDown className="w-3.5 h-3.5" />
          <span>Visualiseur Graphique des Paliers Prix (Step-Graph)</span>
        </div>
        {onAddTier && (
          <button
            onClick={onAddTier}
            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium rounded flex items-center gap-1 transition"
          >
            <Plus className="w-3 h-3" />
            <span>Nouveau Palier</span>
          </button>
        )}
      </div>

      {/* Interactive Step Graph SVG */}
      <div className="relative w-full h-28 bg-slate-950 rounded-lg p-2 border border-slate-800/80 overflow-hidden">
        <svg className="w-full h-full" viewBox="0 0 300 80" preserveAspectRatio="none">
          {/* Background Grid Lines */}
          <line x1="0" y1="20" x2="300" y2="20" stroke="#1e293b" strokeDasharray="3 3" />
          <line x1="0" y1="50" x2="300" y2="50" stroke="#1e293b" strokeDasharray="3 3" />

          {/* Base Price level */}
          {(() => {
            const baseNormY = 70 - ((basePrice / (maxPrice || 1)) * 55);
            return (
              <line
                x1="0"
                y1={baseNormY}
                x2="300"
                y2={baseNormY}
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
            );
          })()}

          {/* Stepped stair graph for tiers */}
          {sortedTiers.map((tier, idx) => {
            const prevQty = idx === 0 ? 1 : sortedTiers[idx - 1].min_qty;
            const prevPrice = idx === 0 ? basePrice : sortedTiers[idx - 1].unit_price;

            const xStart = (prevQty / maxQty) * 280 + 10;
            const xEnd = (tier.min_qty / maxQty) * 280 + 10;
            const yLevel = 70 - ((tier.unit_price / (maxPrice || 1)) * 55);
            const prevYLevel = 70 - ((prevPrice / (maxPrice || 1)) * 55);

            return (
              <g key={idx}>
                {/* Vertical drop line */}
                <line
                  x1={xEnd}
                  y1={prevYLevel}
                  x2={xEnd}
                  y2={yLevel}
                  stroke="#3b82f6"
                  strokeWidth="2"
                />
                {/* Horizontal tier plateau */}
                <line
                  x1={xEnd}
                  y1={yLevel}
                  x2={idx === sortedTiers.length - 1 ? 290 : (sortedTiers[idx + 1].min_qty / maxQty) * 280 + 10}
                  y2={yLevel}
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                />
                {/* Interactive Anchor Point */}
                <circle
                  cx={xEnd}
                  cy={yLevel}
                  r="4.5"
                  className="fill-blue-400 stroke-slate-950 hover:fill-amber-400 cursor-pointer transition-colors"
                />
              </g>
            );
          })}
        </svg>

        <div className="absolute top-1 right-2 text-[10px] text-slate-400 font-mono">
          Base: {basePrice.toFixed(2)} {currencySymbol}
        </div>
      </div>

      {/* Editable Tiers List with quick adjusters */}
      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
        {sortedTiers.length === 0 ? (
          <div className="text-[11px] text-slate-400 italic text-center py-2">
            Aucun palier défini. Le prix de base ({basePrice.toFixed(2)} {currencySymbol}) s'applique dès la 1ère unité.
          </div>
        ) : (
          sortedTiers.map((tier, idx) => {
            const discountPct = basePrice > 0 ? Math.round(((basePrice - tier.unit_price) / basePrice) * 100) : 0;
            return (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 p-1.5 bg-slate-800/80 rounded-lg text-xs border border-slate-700/60"
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-[10px] font-bold">
                    T{idx + 1}
                  </span>
                  <span className="text-slate-400 text-[11px]">Dès</span>
                  <input
                    type="number"
                    value={tier.min_qty}
                    min={1}
                    onChange={(e) => handleUpdateQty(idx, parseInt(e.target.value, 10) || 1)}
                    className="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-slate-200 text-xs font-semibold focus:border-blue-500 outline-none"
                  />
                  <span className="text-slate-400 text-[11px]">u.</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <input
                    type="number"
                    step="0.01"
                    value={tier.unit_price}
                    onChange={(e) => handleUpdatePrice(idx, parseFloat(e.target.value) || 0)}
                    className="w-16 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-right text-amber-300 text-xs font-bold focus:border-blue-500 outline-none"
                  />
                  <span className="text-slate-400 text-[11px]">{currencySymbol}</span>
                  {discountPct > 0 && (
                    <span className="px-1 py-0.5 bg-emerald-500/20 text-emerald-400 font-bold text-[10px] rounded">
                      -{discountPct}%
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteTier(idx)}
                    className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
