import React from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Sliders,
  Settings,
  MousePointer,
  Hand,
  Maximize,
  HelpCircle,
  Ruler,
} from 'lucide-react';
import { ContextTooltip, useTooltip } from '../context/TooltipContext';
import { ZoomMethod } from '../types';

interface ViewportZoomToolbarProps {
  zoom: number;
  onZoomChange: (newZoom: number, anchorPoint?: { clientX: number; clientY: number }) => void;
  onFitToSheet: () => void;
  onFitToWidth: () => void;
  activeTool: 'select' | 'marquee' | 'pan';
  onToolChange: (tool: 'select' | 'marquee' | 'pan') => void;
  zoomMethod: ZoomMethod;
}

export const ViewportZoomToolbar: React.FC<ViewportZoomToolbarProps> = ({
  zoom,
  onZoomChange,
  onFitToSheet,
  onFitToWidth,
  activeTool,
  onToolChange,
  zoomMethod,
}) => {
  const { uiPreferences, updateUIPreferences, openPreferencesModal } = useTooltip();

  const handleCycleRulerMode = () => {
    const current = uiPreferences?.rulerMode || 'sheet_margins';
    const modes: Array<'sheet_margins' | 'window_frame' | 'floating' | 'hidden'> = [
      'sheet_margins',
      'window_frame',
      'floating',
      'hidden',
    ];
    const nextIndex = (modes.indexOf(current) + 1) % modes.length;
    updateUIPreferences({ rulerMode: modes[nextIndex] });
  };

  const presets = [
    { label: '10%', value: 0.1 },
    { label: '25%', value: 0.25 },
    { label: '50%', value: 0.5 },
    { label: '75%', value: 0.75 },
    { label: '100% (Réel)', value: 1.0 },
    { label: '125%', value: 1.25 },
    { label: '150%', value: 1.5 },
    { label: '200%', value: 2.0 },
    { label: '300%', value: 3.0 },
    { label: '400%', value: 4.0 },
    { label: '600%', value: 6.0 },
    { label: '800%', value: 8.0 },
  ];

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div
      id="viewport-zoom-sticky-toolbar"
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md border border-slate-300/90 rounded-2xl shadow-xl px-2.5 py-1.5 flex items-center gap-2 text-xs select-none transition-all hover:shadow-2xl"
    >
      {/* Tool Mode Toggles */}
      <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 gap-0.5">
        <ContextTooltip
          title="Outil Sélection Directe"
          category="Outils de Navigation"
          shortcut="V"
          content="Mode pointeur normal : déplacez, redimensionnez et alignez les éléments sur l'étiquette."
          placement="top"
        >
          <button
            onClick={() => onToolChange('select')}
            className={`p-1.5 rounded-lg transition ${
              activeTool === 'select'
                ? 'bg-white text-blue-600 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            aria-label="Outil Sélection"
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>
        </ContextTooltip>

        <ContextTooltip
          title="Outil Zoom Cadre Rectangulaire (Marquee)"
          category="Moteur de Zoom"
          shortcut="Z"
          content="Tracez un rectangle avec la souris sur une zone précise (ex. un code-barres ou bloc prix) pour l'agrandir instantanément en plein écran."
          placement="top"
        >
          <button
            onClick={() => onToolChange('marquee')}
            className={`p-1.5 rounded-lg transition ${
              activeTool === 'marquee'
                ? 'bg-blue-600 text-white shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            aria-label="Outil Zoom Cadre"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </ContextTooltip>

        <ContextTooltip
          title="Outil Défilement Manuel (Main / Pan)"
          category="Outils de Navigation"
          shortcut="H / Espace"
          content="Maintenez le clic pour faire glisser le plan de travail dans toutes les directions."
          placement="top"
        >
          <button
            onClick={() => onToolChange('pan')}
            className={`p-1.5 rounded-lg transition ${
              activeTool === 'pan'
                ? 'bg-blue-600 text-white shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            aria-label="Outil Pan"
          >
            <Hand className="w-3.5 h-3.5" />
          </button>
        </ContextTooltip>
      </div>

      <div className="h-5 w-px bg-slate-200" />

      {/* Step Zoom Out Button */}
      <ContextTooltip
        title="Zoom Arrière"
        category="Navigation"
        shortcut="Ctrl + -"
        content="Diminue le niveau de zoom de 10%."
        placement="top"
      >
        <button
          onClick={() => onZoomChange(Math.max(0.1, zoom - 0.1))}
          className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
          aria-label="Zoom arrière"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
      </ContextTooltip>

      {/* Continuous Range Slider (10% to 800%) */}
      <ContextTooltip
        title="Curseur de Zoom Précis (10% à 800%)"
        category="Moteur de Zoom"
        content="Glissez pour ajuster continuellement l'échelle de rendu de 10% à 800% avec accélération matérielle."
        placement="top"
      >
        <div className="flex items-center gap-1.5 px-1">
          <input
            type="range"
            min="0.1"
            max="8.0"
            step="0.05"
            value={zoom}
            onChange={(e) => onZoomChange(parseFloat(e.target.value))}
            className="w-20 md:w-28 accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
            aria-label="Échelle de zoom"
          />
        </div>
      </ContextTooltip>

      {/* Step Zoom In Button */}
      <ContextTooltip
        title="Zoom Avant"
        category="Navigation"
        shortcut="Ctrl + +"
        content="Augmente le niveau de zoom de 10%."
        placement="top"
      >
        <button
          onClick={() => onZoomChange(Math.min(8.0, zoom + 0.1))}
          className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
          aria-label="Zoom avant"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </ContextTooltip>

      {/* Quick Preset Dropdown */}
      <ContextTooltip
        title="Préréglages d'Échelle & Ratios"
        category="Moteur de Zoom"
        content="Sélectionnez rapidement un ratio d'agrandissement étalonné ou ajustez à la zone visible."
        placement="top"
      >
        <select
          value={zoomPercent}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'fit_sheet') onFitToSheet();
            else if (val === 'fit_width') onFitToWidth();
            else onZoomChange(parseFloat(val) / 100);
          }}
          className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-slate-800 font-mono font-bold text-[11px] outline-none cursor-pointer hover:border-slate-400 transition"
          aria-label="Préréglages de zoom"
        >
          <option value="fit_sheet">Ajuster à l'écran</option>
          <option value="fit_width">Ajuster en largeur</option>
          {presets.map((p) => (
            <option key={p.label} value={Math.round(p.value * 100)}>
              {p.label}
            </option>
          ))}
          {/* Custom current value if not strictly matched */}
          {!presets.some((p) => Math.round(p.value * 100) === zoomPercent) && (
            <option value={zoomPercent}>{zoomPercent}%</option>
          )}
        </select>
      </ContextTooltip>

      {/* 100% Real Scale Button */}
      <ContextTooltip
        title="Taille Réelle (100% - 1:1)"
        category="Navigation"
        shortcut="Ctrl + 0"
        content="Rétablit l'étiquette à ses dimensions réelles 100% exactes en millimètres."
        placement="top"
      >
        <button
          onClick={() => onZoomChange(1.0)}
          className={`px-2 py-1 rounded-lg text-[11px] font-bold font-mono transition ${
            Math.abs(zoom - 1.0) < 0.02
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          1:1
        </button>
      </ContextTooltip>

      <div className="h-5 w-px bg-slate-200" />

      {/* Ruler Mode Toggle */}
      <ContextTooltip
        title="Mode de Règles Millimétriques"
        category="Affichage Studio"
        shortcut="Alt + R"
        content={`Mode actuel: ${
          uiPreferences?.rulerMode === 'sheet_margins'
            ? 'Marges de Feuille'
            : uiPreferences?.rulerMode === 'window_frame'
            ? 'Cadre Fenêtre'
            : uiPreferences?.rulerMode === 'floating'
            ? 'Règle Flottante'
            : 'Masqué'
        }. Cliquez pour basculer les règles.`}
        placement="top"
      >
        <button
          onClick={handleCycleRulerMode}
          className={`p-1.5 rounded-lg transition ${
            uiPreferences?.rulerMode && uiPreferences.rulerMode !== 'hidden'
              ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold'
              : 'text-slate-400 hover:text-slate-700'
          }`}
          aria-label="Mode de règles millimétriques"
        >
          <Ruler className="w-4 h-4" />
        </button>
      </ContextTooltip>

      {/* Preferences & Accessibility Modal Trigger */}
      <ContextTooltip
        title="Préférences d'Accessibilité & Zoom"
        category="Configuration Studio"
        shortcut="Alt + A"
        content="Ouvre le panneau de réglages pour activer/désactiver les infobulles, régler leur latence de survol, et choisir votre méthode de zoom favorite."
        placement="top"
      >
        <button
          onClick={openPreferencesModal}
          className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition"
          aria-label="Préférences d'accessibilité et zoom"
        >
          <Settings className="w-4 h-4" />
        </button>
      </ContextTooltip>
    </div>
  );
};
