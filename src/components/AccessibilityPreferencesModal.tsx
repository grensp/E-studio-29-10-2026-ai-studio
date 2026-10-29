import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  createCustomTheme,
  getCustomThemeContrastWarnings,
  parseCustomThemeJson,
  serializeCustomTheme,
  THEME_PRESETS,
  type CustomTheme,
  type DensityMode,
  type ThemeColorKey,
  type ThemeMode,
} from '../theme/themeEngine';
import { useTooltip } from '../context/TooltipContext';
import {
  Sliders,
  Eye,
  Sun,
  Moon,
  ShieldAlert,
  X,
  MousePointer,
  Layers,
  Ruler,
  Lock,
  Unlock,
  RotateCw,
  Compass,
  Disc,
  CircleDot,
  CheckCircle2,
  Sparkles,
  LayoutGrid,
  ArrowDownRight,
  Crosshair,
  Box,
  Palette,
  Plus,
  Pencil,
  Download,
  Upload,
  Trash2,
  Code2,
  Save,
  Search,
  RotateCcw,
  ZoomIn,
  Move,
  AlertCircle,
  HelpCircle,
  Maximize2,
  Check,
} from 'lucide-react';
import { RotationHandleType, ElementPlacementStrategy, ZoomMethod } from '../types';
import { useLocalization } from '../context/LocalizationContext';
import { translateAccessibility } from '../i18n/localization';
import {
  DEFAULT_RULER_SETTINGS,
  DEFAULT_TOOLTIP_SETTINGS,
  DEFAULT_UI_PREFERENCES,
} from '../store/preferencesStore';

interface AccessibilityPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PreferenceCategory = 'theme' | 'canvas' | 'rulers' | 'accessibility' | 'workspace';

const THEME_COLOR_FIELDS: Array<{ key: ThemeColorKey; label: string; desc: string }> = [
  { key: 'shell', label: 'Barre & En-tête (Shell)', desc: 'Chrome principal de l\'application' },
  { key: 'appBg', label: 'Fond de fenêtre (AppBg)', desc: 'Arrière-plan global du studio' },
  { key: 'workbench', label: 'Plan de travail (Workbench)', desc: 'Zone entourant le canevas' },
  { key: 'paper', label: 'Surface principale (Paper)', desc: 'Cartes et panneaux principaux' },
  { key: 'paperAlt', label: 'Surface secondaire (PaperAlt)', desc: 'Barres d\'outils et volets' },
  { key: 'surface', label: 'Surfaces surélevées (Surface)', desc: 'Modales et menus déroulants' },
  { key: 'surfaceStrong', label: 'Surfaces d\'accent (SurfaceStrong)', desc: 'Conteneurs en surbrillance' },
  { key: 'line', label: 'Bordures & Séparateurs (Line)', desc: 'Contour des panneaux et séparateurs' },
  { key: 'ink', label: 'Texte principal (Ink)', desc: 'Titres et libellés à haut contraste' },
  { key: 'muted', label: 'Texte secondaire (Muted)', desc: 'Descriptions et légendes' },
  { key: 'accent', label: 'Couleur d\'accentuation (Accent)', desc: 'Boutons primaires et sélections' },
];

export const AccessibilityPreferencesModal: React.FC<AccessibilityPreferencesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    tooltipSettings,
    updateTooltipSettings,
    gridSnapSensitivityMm,
    setGridSnapSensitivityMm,
    themeMode,
    setThemeMode,
    customThemes,
    activeCustomThemeId,
    setCustomTheme,
    removeCustomTheme,
    densityMode,
    setDensityMode,
    uiPreferences,
    updateUIPreferences,
    rulerSettings,
    updateRulerSettings,
  } = useTooltip();

  const { locale } = useLocalization();
  const accessibilityText = (key: Parameters<typeof translateAccessibility>[1]) =>
    translateAccessibility(locale, key);

  const [activeCategory, setActiveCategory] = useState<PreferenceCategory>('theme');
  const [searchFilter, setSearchFilter] = useState('');
  const [previewAngle, setPreviewAngle] = useState(0);

  // Custom Theme Editor State
  const [themeDraft, setThemeDraft] = useState<CustomTheme | null>(null);
  const [themeJson, setThemeJson] = useState('');
  const [themeEditorMode, setThemeEditorMode] = useState<'visual' | 'json'>('visual');
  const [themeMessage, setThemeMessage] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);
  const themeFileInput = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset confirmation state
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Unique IDs for accessibility
  const titleId = useId();
  const descriptionId = useId();

  // Keyboard shortcut listener: Escape closes dialog, Ctrl+K focuses search
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus or focus search on open
  useEffect(() => {
    if (isOpen) {
      setShowResetConfirm(false);
    }
  }, [isOpen]);

  const setThemeDraftAndJson = (theme: CustomTheme) => {
    setThemeDraft(theme);
    setThemeJson(serializeCustomTheme(theme));
    setThemeMessage(null);
  };

  const updateThemeDraft = (theme: CustomTheme) => {
    setThemeDraft(theme);
    try {
      setThemeJson(serializeCustomTheme(theme));
    } catch {
      setThemeJson(JSON.stringify(theme, null, 2));
    }
  };

  const downloadThemeFile = (theme: CustomTheme) => {
    const url = URL.createObjectURL(new Blob([serializeCustomTheme(theme)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${theme.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const applyThemeJsonToDraft = () => {
    try {
      const parsed = parseCustomThemeJson(themeJson);
      setThemeDraftAndJson({ ...parsed, id: themeDraft?.id ?? parsed.id });
      setThemeMessage({ type: 'success', text: 'JSON syntaxiquement valide. Cliquez sur Sauvegarder pour appliquer.' });
    } catch (error) {
      setThemeMessage({ type: 'error', text: error instanceof Error ? error.message : 'Impossible de lire le JSON du thème.' });
    }
  };

  const importThemeFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      if (file.size > 65536) throw new Error('Le fichier de thème JSON doit faire moins de 64 Ko.');
      const parsed = parseCustomThemeJson(await file.text());
      setThemeDraftAndJson(parsed);
      setThemeEditorMode('visual');
      setThemeMessage({ type: 'success', text: `Thème "${parsed.name || file.name}" chargé. Cliquez sur Sauvegarder pour l'appliquer.` });
    } catch (error) {
      setThemeMessage({ type: 'error', text: error instanceof Error ? error.message : 'Échec de l\'import du thème.' });
    }
  };

  const saveThemeDraft = () => {
    if (!themeDraft) return;
    let themeToSave = themeDraft;
    if (themeEditorMode === 'json') {
      try {
        themeToSave = { ...parseCustomThemeJson(themeJson), id: themeDraft.id };
      } catch (error) {
        setThemeMessage({ type: 'error', text: error instanceof Error ? error.message : 'JSON invalide.' });
        return;
      }
    }
    setCustomTheme(themeToSave);
    setThemeDraft(null);
    setThemeMessage(null);
  };

  const handleResetSectionDefaults = () => {
    if (activeCategory === 'theme') {
      setThemeMode('graphite');
      setDensityMode('standard');
    } else if (activeCategory === 'canvas') {
      updateUIPreferences({
        rotationHandleType: DEFAULT_UI_PREFERENCES.rotationHandleType,
        rotationSnapEnabled: DEFAULT_UI_PREFERENCES.rotationSnapEnabled,
        rotationSnapAngle: DEFAULT_UI_PREFERENCES.rotationSnapAngle,
        elementPlacementStrategy: DEFAULT_UI_PREFERENCES.elementPlacementStrategy,
      });
    } else if (activeCategory === 'rulers') {
      setGridSnapSensitivityMm(1.0);
      updateRulerSettings(DEFAULT_RULER_SETTINGS);
      updateUIPreferences({
        rulerMode: DEFAULT_UI_PREFERENCES.rulerMode,
        rulerOffsetPx: DEFAULT_UI_PREFERENCES.rulerOffsetPx,
        hudPosition: null,
      });
    } else if (activeCategory === 'accessibility') {
      updateTooltipSettings(DEFAULT_TOOLTIP_SETTINGS);
    } else if (activeCategory === 'workspace') {
      updateUIPreferences({
        defaultZoom: DEFAULT_UI_PREFERENCES.defaultZoom,
        zoomMethod: DEFAULT_UI_PREFERENCES.zoomMethod,
        autoSaveIntervalSec: DEFAULT_UI_PREFERENCES.autoSaveIntervalSec,
        lockPropertyInspector: DEFAULT_UI_PREFERENCES.lockPropertyInspector,
        lockLeftSidebar: DEFAULT_UI_PREFERENCES.lockLeftSidebar,
        lockInspectorWidth: DEFAULT_UI_PREFERENCES.lockInspectorWidth,
        inspectorWidthPx: DEFAULT_UI_PREFERENCES.inspectorWidthPx,
      });
    }
    setShowResetConfirm(false);
  };

  const categories = useMemo(
    () => [
      {
        id: 'theme' as const,
        label: accessibilityText('themeSection') || 'Thème & Apparence',
        icon: Palette,
        badge: activeCustomThemeId ? 'Thème personnalisé' : THEME_PRESETS[themeMode]?.label,
        desc: 'Couleurs de l\'interface, thèmes personnalisés, contraste WCAG et densité',
        keywords: ['thème', 'couleur', 'contraste', 'sombre', 'clair', 'eink', 'palette', 'densité', 'json'],
      },
      {
        id: 'canvas' as const,
        label: 'Canevas & Manipulation',
        icon: RotateCw,
        badge: uiPreferences?.rotationHandleType === 'disabled' ? 'Rotation désactivée' : 'Interactif',
        desc: 'Styles de poignées de rotation, magnétisme angulaire et disposition intelligente',
        keywords: ['rotation', 'poignées', 'angle', 'aimantation', 'magnétisme', 'positionnement', 'cascade', 'canevas'],
      },
      {
        id: 'rulers' as const,
        label: 'Règles & Magnétisme',
        icon: Ruler,
        badge: `${gridSnapSensitivityMm} mm`,
        desc: 'Règles millimétrées, sensibilité de la grille, décalage et HUD flottant',
        keywords: ['règles', 'grille', 'magnétisme', 'snap', 'hud', 'flottant', 'sensibilité', 'mm', 'millimètre'],
      },
      {
        id: 'accessibility' as const,
        label: accessibilityText('tooltipSection') || 'Accessibilité & Info-bulles',
        icon: Eye,
        badge: tooltipSettings.enabled ? 'Actives' : 'Désactivées',
        desc: 'Info-bulles contextuelles, latence de survol, opacité et délais de fermeture',
        keywords: ['accessibilité', 'infobulle', 'survol', 'opacité', 'délai', 'aide', 'tooltip'],
      },
      {
        id: 'workspace' as const,
        label: 'Espace de Travail & Panneaux',
        icon: Sliders,
        badge: uiPreferences?.lockPropertyInspector ? 'Verrouillé' : 'Libre',
        desc: 'Comportement du zoom, sauvegarde automatique et verrouillage anti-repliement',
        keywords: ['zoom', 'sauvegarde', 'panneaux', 'inspecteur', 'verrouillage', 'largeur', 'palette'],
      },
    ],
    [themeMode, activeCustomThemeId, uiPreferences, gridSnapSensitivityMm, tooltipSettings, accessibilityText]
  );

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!searchFilter.trim()) return categories;
    const term = searchFilter.toLowerCase();
    return categories.filter(
      (c) =>
        c.label.toLowerCase().includes(term) ||
        c.desc.toLowerCase().includes(term) ||
        c.keywords.some((k) => k.includes(term))
    );
  }, [categories, searchFilter]);

  if (!isOpen) return null;

  const currentHandleType: RotationHandleType = uiPreferences?.rotationHandleType || 'top_stem';
  const rotationSnapEnabled = uiPreferences?.rotationSnapEnabled !== false;
  const rotationSnapAngle = uiPreferences?.rotationSnapAngle || 15;
  const currentPlacementStrategy: ElementPlacementStrategy =
    uiPreferences?.elementPlacementStrategy || 'ergonomic_smart';
  const themeContrastWarnings = themeDraft ? getCustomThemeContrastWarnings(themeDraft) : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs select-none transition-opacity duration-200"
    >
      <div
        ref={dialogRef}
        data-studio-theme-surface="true"
        className="w-full max-w-5xl h-[86vh] max-h-[820px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Top Header Bar */}
        <header className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight leading-tight truncate">
                {accessibilityText('title') || 'Préférences du Studio & Accessibilité'}
              </h2>
              <p id={descriptionId} className="text-xs text-slate-500 truncate">
                {accessibilityText('subtitle') || 'Personnalisation de l\'ergonomie, du canevas, de l\'affichage et des règles'}
              </p>
            </div>
          </div>

          {/* Quick Search in Settings */}
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Rechercher un réglage... (Ctrl+K)"
                aria-label="Rechercher un réglage"
                className="w-full bg-white border border-slate-300 rounded-lg pl-8.5 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  aria-label="Effacer la recherche"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={accessibilityText('close') || 'Fermer la fenêtre'}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
              title="Fermer (Échap)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Master-Detail Split View Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Navigation Master Sidebar */}
          <aside
            role="tablist"
            aria-orientation="vertical"
            aria-label="Catégories des préférences"
            className="w-64 bg-slate-50/80 border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto p-2.5 gap-1 select-none"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
              Catégories ({filteredCategories.length})
            </span>

            {filteredCategories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  role="tab"
                  id={`tab-${cat.id}`}
                  aria-selected={isSelected}
                  aria-controls={`panel-${cat.id}`}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full text-left p-2.5 rounded-xl transition flex items-start gap-2.5 border ${
                    isSelected
                      ? 'bg-white border-indigo-200 text-indigo-950 shadow-xs ring-1 ring-indigo-500/10'
                      : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                        {cat.label}
                      </span>
                    </div>
                    <span className="block text-[10px] text-slate-400 truncate mt-0.5 font-medium">
                      {cat.badge}
                    </span>
                  </div>
                </button>
              );
            })}

            {/* Quick Helper Badge */}
            <div className="mt-auto pt-3 border-t border-slate-200 px-2">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Les réglages sont appliqués immédiatement et sauvegardés localement.</span>
              </div>
            </div>
          </aside>

          {/* Right Main Detail Content Pane */}
          <main
            id={`panel-${activeCategory}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeCategory}`}
            className="flex-1 overflow-y-auto p-5 sm:p-6 bg-white space-y-6 text-xs text-slate-700"
          >
            {/* 1. SECTION: THÈME & APPARENCE */}
            {activeCategory === 'theme' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-indigo-600" />
                    <span>{accessibilityText('themeSection') || 'Thème & Apparence du Studio'}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sélectionnez un style visuel adapté à votre environnement d'éclairage et ajustez la densité des outils.
                  </p>
                </div>

                {/* Preset Themes Grid */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Palettes Officielles
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(Object.entries(THEME_PRESETS) as Array<[ThemeMode, (typeof THEME_PRESETS)[ThemeMode]]>).map(([mode, preset]) => {
                      const isActive = themeMode === mode && !activeCustomThemeId;
                      const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : mode === 'graphite' ? Layers : ShieldAlert;

                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            setThemeMode(mode);
                            setThemeDraft(null);
                          }}
                          className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between relative overflow-hidden group ${
                            isActive
                              ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                          style={{ backgroundColor: preset.paper, color: preset.ink }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center shadow-xs"
                                style={{ backgroundColor: preset.shell, color: preset.paper }}
                              >
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="font-bold text-xs block leading-tight">{preset.label}</span>
                                <span className="text-[10px] opacity-75">{preset.description}</span>
                              </div>
                            </div>
                            {isActive && (
                              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </span>
                            )}
                          </div>

                          {/* Color Palette Mini-Bar */}
                          <div className="flex items-center gap-1 mt-3 pt-2 border-t" style={{ borderColor: preset.line }}>
                            <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs" style={{ backgroundColor: preset.shell }} title="Shell" />
                            <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs" style={{ backgroundColor: preset.workbench }} title="Workbench" />
                            <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs" style={{ backgroundColor: preset.accent }} title="Accent" />
                            <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs" style={{ backgroundColor: preset.ink }} title="Ink" />
                            <span className="text-[10px] ml-auto font-mono opacity-60">Accent {preset.accent}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Density Selection */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                        Densité de l'interface (Density Mode)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Ajuste l'espacement et la taille des commandes pour les écrans tactiles ou les écrans haute résolution.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {(
                      [
                        { id: 'compact', label: 'Compact', desc: 'Outils serrés, hauteur 38px, idéal petits écrans' },
                        { id: 'standard', label: 'Standard', desc: 'Équilibre parfait bureautique et précision' },
                        { id: 'comfortable', label: 'Confortable', desc: 'Espacement aéré, cibles tactiles élargies' },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setDensityMode(item.id)}
                        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                          densityMode === item.id
                            ? 'border-indigo-600 bg-indigo-50/60 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-xs'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span className="text-xs font-bold capitalize">{item.label}</span>
                        <span className="text-[10px] font-normal text-slate-500 mt-1 leading-snug">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Themes Studio */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                        Atelier de Thèmes Personnalisés
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Créez, modifiez, exportez ou importez des schémas de couleurs conformes WCAG.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        ref={themeFileInput}
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={(event) => { void importThemeFile(event); }}
                      />
                      <button
                        type="button"
                        onClick={() => themeFileInput.current?.click()}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 font-semibold text-slate-700 text-xs flex items-center gap-1.5 transition shadow-2xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Importer JSON</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = createCustomTheme(`Mon Thème ${customThemes.length + 1}`, themeMode);
                          setThemeDraftAndJson(next);
                          setThemeEditorMode('visual');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-semibold text-white text-xs flex items-center gap-1.5 transition shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Créer un Thème</span>
                      </button>
                    </div>
                  </div>

                  {/* Custom Themes List */}
                  {customThemes.length > 0 ? (
                    <div className="space-y-2">
                      {customThemes.map((theme) => {
                        const isCurrentActive = activeCustomThemeId === theme.id;
                        return (
                          <div
                            key={theme.id}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                              isCurrentActive
                                ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500/20'
                                : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setCustomTheme(theme)}
                              className="flex items-center gap-3 min-w-0 flex-1 text-left"
                            >
                              <div className="flex rounded-md overflow-hidden border border-slate-300 shadow-2xs shrink-0">
                                {[theme.colors.paper, theme.colors.workbench, theme.colors.accent, theme.colors.ink].map((c, i) => (
                                  <span key={i} className="w-3.5 h-6 block" style={{ backgroundColor: c }} />
                                ))}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-xs text-slate-900 block truncate">{theme.name}</span>
                                <span className="text-[10px] text-slate-500 truncate block">{theme.description || 'Thème personnalisé'}</span>
                              </div>
                            </button>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setThemeDraftAndJson(theme);
                                  setThemeEditorMode('visual');
                                }}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-200 rounded-lg transition"
                                title="Modifier ce thème"
                                aria-label={`Modifier ${theme.name}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadThemeFile(theme)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-200 rounded-lg transition"
                                title="Télécharger le fichier JSON"
                                aria-label={`Télécharger ${theme.name}`}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  removeCustomTheme(theme.id);
                                  if (themeDraft?.id === theme.id) setThemeDraft(null);
                                }}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-100 rounded-lg transition"
                                title="Supprimer ce thème"
                                aria-label={`Supprimer ${theme.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-slate-500 text-xs">
                      Aucun thème personnalisé enregistré pour le moment.
                    </div>
                  )}

                  {/* Active Theme Draft Editor */}
                  {themeDraft && (
                    <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-4 animate-in fade-in">
                      <div className="flex items-center justify-between border-b border-indigo-200/60 pb-2">
                        <div className="flex items-center gap-2">
                          <Palette className="w-4 h-4 text-indigo-600" />
                          <span className="font-bold text-xs text-slate-900">
                            Édition du Thème : {themeDraft.name || 'Sans titre'}
                          </span>
                        </div>
                        <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() => setThemeEditorMode('visual')}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition ${
                              themeEditorMode === 'visual' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600'
                            }`}
                          >
                            Visuel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                setThemeJson(serializeCustomTheme(themeDraft));
                                setThemeEditorMode('json');
                              } catch {
                                setThemeMessage({ type: 'error', text: 'Entrez un nom de thème avant d\'éditer en JSON.' });
                              }
                            }}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition flex items-center gap-1 ${
                              themeEditorMode === 'json' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600'
                            }`}
                          >
                            <Code2 className="w-3 h-3" />
                            <span>JSON</span>
                          </button>
                        </div>
                      </div>

                      {/* Live Theme Preview Box */}
                      <div
                        className="rounded-xl border p-3 space-y-2 shadow-xs transition-colors"
                        style={{
                          backgroundColor: themeDraft.colors.workbench,
                          borderColor: themeDraft.colors.line,
                          color: themeDraft.colors.ink,
                        }}
                      >
                        <div
                          className="px-3 py-1.5 rounded-lg flex items-center justify-between text-[11px] font-bold"
                          style={{ backgroundColor: themeDraft.colors.shell, color: themeDraft.colors.paper }}
                        >
                          <span>{themeDraft.name || 'Aperçu du Thème'}</span>
                          <span style={{ color: themeDraft.colors.accent }}>E-STUDIO</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div
                            className="p-2 rounded-lg border text-[10px]"
                            style={{ backgroundColor: themeDraft.colors.surface, borderColor: themeDraft.colors.line }}
                          >
                            <span className="font-bold block">Panneau & Propriétés</span>
                            <span className="opacity-70 mt-0.5 block" style={{ color: themeDraft.colors.muted }}>
                              Texte descriptif secondaire
                            </span>
                          </div>
                          <div
                            className="p-2 rounded-lg border text-[10px] flex items-center justify-between"
                            style={{ backgroundColor: themeDraft.colors.paper, borderColor: themeDraft.colors.line }}
                          >
                            <span>Gabarit</span>
                            <span
                              className="px-2 py-0.5 rounded font-bold text-white shadow-2xs"
                              style={{ backgroundColor: themeDraft.colors.accent }}
                            >
                              Bouton
                            </span>
                          </div>
                        </div>
                      </div>

                      {themeEditorMode === 'visual' ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] font-bold text-slate-700 block mb-1">Nom du thème</label>
                              <input
                                type="text"
                                value={themeDraft.name}
                                maxLength={60}
                                onChange={(e) => updateThemeDraft({ ...themeDraft, name: e.target.value })}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-slate-700 block mb-1">Comportement de base</label>
                              <select
                                value={themeDraft.baseMode}
                                onChange={(e) => updateThemeDraft({ ...themeDraft, baseMode: e.target.value as ThemeMode })}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                              >
                                {(Object.entries(THEME_PRESETS) as Array<[ThemeMode, (typeof THEME_PRESETS)[ThemeMode]]>).map(([mode, preset]) => (
                                  <option key={mode} value={mode}>{preset.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">Description</label>
                            <input
                              type="text"
                              value={themeDraft.description}
                              maxLength={160}
                              onChange={(e) => updateThemeDraft({ ...themeDraft, description: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                            />
                          </div>

                          {/* Color Swatch Pickers Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                            {THEME_COLOR_FIELDS.map(({ key, label, desc }) => (
                              <div key={key} className="p-2 rounded-lg border border-slate-200 bg-white flex items-center gap-2">
                                <input
                                  type="color"
                                  value={themeDraft.colors[key]}
                                  onChange={(e) =>
                                    updateThemeDraft({
                                      ...themeDraft,
                                      colors: { ...themeDraft.colors, [key]: e.target.value },
                                    })
                                  }
                                  className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0 shrink-0"
                                  aria-label={`Couleur ${label}`}
                                />
                                <div className="min-w-0 flex-1">
                                  <span className="text-[11px] font-bold text-slate-800 block truncate">{label}</span>
                                  <span className="text-[9px] font-mono text-slate-500 block">{themeDraft.colors[key]}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <textarea
                            value={themeJson}
                            onChange={(e) => setThemeJson(e.target.value)}
                            spellCheck={false}
                            aria-label="Code JSON du thème"
                            className="w-full h-56 font-mono text-[11px] p-3 rounded-lg border border-slate-300 bg-white text-slate-900 leading-relaxed focus:outline-hidden focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={applyThemeJsonToDraft}
                            className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                          >
                            <Code2 className="w-3.5 h-3.5" />
                            <span>Valider le JSON</span>
                          </button>
                        </div>
                      )}

                      {/* Status / Contrast warnings */}
                      {themeMessage && (
                        <div
                          role="status"
                          className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                            themeMessage.type === 'error'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{themeMessage.text}</span>
                        </div>
                      )}

                      {themeContrastWarnings.length > 0 && (
                        <div role="status" className="p-2.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-xs space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Avertissement contraste WCAG AA :</span>
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            {themeContrastWarnings
                              .map(({ foreground, background, ratio }) => `${foreground}/${background} (${ratio}:1)`)
                              .join(', ')}
                            . Le standard WCAG AA requiert au moins 4.5:1 pour le texte normal.
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-200/60">
                        <button
                          type="button"
                          onClick={() => {
                            setThemeDraft(null);
                            setThemeMessage(null);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={saveThemeDraft}
                          disabled={!themeDraft.name.trim()}
                          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-40"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Sauvegarder & Appliquer</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. SECTION: CANEVAS & MANIPULATION */}
            {activeCategory === 'canvas' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <RotateCw className="w-4 h-4 text-indigo-600" />
                    <span>Poignées de Rotation & Placement Intelligent</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configurez le comportement direct des éléments sur le canevas d'étiquette.
                  </p>
                </div>

                {/* Handle Type Radio Options */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Style de la poignée de rotation
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        id: 'top_stem' as const,
                        title: 'Tige Supérieure ("Lollipop")',
                        suite: 'Figma / Illustrator',
                        icon: RotateCw,
                        color: 'bg-blue-100 text-blue-700',
                        desc: 'Tige verticale centrée au-dessus de l\'élément avec poignée circulaire. S\'inverse automatiquement si l\'élément touche le bord haut.',
                      },
                      {
                        id: 'corner_hover_orbit' as const,
                        title: 'Orbite aux 4 Coins (Invisible Radius)',
                        suite: 'Photoshop / InDesign',
                        icon: Compass,
                        color: 'bg-emerald-100 text-emerald-700',
                        desc: 'Survolez quelques pixels au-delà des coins pour faire pivoter librement. Laisse la boîte de sélection visuellement épurée.',
                      },
                      {
                        id: 'dual_stems' as const,
                        title: 'Double Tige (Haut & Bas)',
                        suite: 'Bi-directionnel',
                        icon: Layers,
                        color: 'bg-amber-100 text-amber-700',
                        desc: 'Deux tiges opposées permettant d\'attraper la poignée la plus accessible quel que soit le positionnement sur l\'étiquette.',
                      },
                      {
                        id: 'corner_satellites' as const,
                        title: 'Satellites & Rapporteur (4 Coins)',
                        suite: 'Haute Précision CAD',
                        icon: Disc,
                        color: 'bg-purple-100 text-purple-700',
                        desc: '4 boutons satellites en diagonale avec anneau rapporteur circulaire et indicateur d\'angle en temps réel.',
                      },
                    ].map((item) => {
                      const isSelected = currentHandleType === item.id;
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.id}
                          onClick={() => updateUIPreferences({ rotationHandleType: item.id })}
                          className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${item.color}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="font-bold text-xs text-slate-900 block">{item.title}</span>
                                <span className="text-[10px] font-semibold text-slate-500">{item.suite}</span>
                              </div>
                            </div>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">{item.desc}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Disable Handle Option */}
                  <div
                    onClick={() => updateUIPreferences({ rotationHandleType: 'disabled' })}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      currentHandleType === 'disabled'
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <CircleDot className="w-4 h-4 text-slate-400" />
                      <div>
                        <span className="font-bold text-xs text-slate-800">Désactiver les poignées de rotation directes sur le canevas</span>
                        <span className="text-[10px] text-slate-500 block">La rotation reste modifiable numériquement dans l'inspecteur latéral</span>
                      </div>
                    </div>
                    {currentHandleType === 'disabled' && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />}
                  </div>
                </div>

                {/* Angle Snapping Setting */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">
                        Magnétisme angulaire automatique (Angle Snap)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Aimante automatiquement la rotation sur des pas d'angles réguliers. (Astuce : maintenez <kbd className="px-1 py-0.5 bg-slate-200 rounded font-mono text-[10px]">Maj</kbd> pour forcer le magnétisme).
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={rotationSnapEnabled}
                      onClick={() => updateUIPreferences({ rotationSnapEnabled: !rotationSnapEnabled })}
                      className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                        rotationSnapEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                          rotationSnapEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {rotationSnapEnabled && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-600">Pas d'aimantation :</span>
                      <div className="flex items-center gap-1.5">
                        {[15, 30, 45, 90].map((deg) => (
                          <button
                            key={deg}
                            type="button"
                            onClick={() => updateUIPreferences({ rotationSnapAngle: deg })}
                            className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition ${
                              rotationSnapAngle === deg
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {deg}°
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Interactive Live Rotation Preview Box */}
                <div className="p-4 bg-slate-900 rounded-xl text-white space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-xs text-slate-200">Aperçu interactif de la poignée active</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-slate-800 text-indigo-300 px-2.5 py-0.5 rounded border border-slate-700">
                        {previewAngle}°
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewAngle((prev) => (prev + 90) % 360)}
                        className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold rounded transition"
                      >
                        +90°
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewAngle(0)}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] rounded transition text-slate-300"
                      >
                        0°
                      </button>
                    </div>
                  </div>

                  <div className="h-36 bg-slate-950/70 rounded-lg border border-slate-800 flex items-center justify-center relative overflow-hidden select-none">
                    <div
                      className="absolute inset-0 opacity-15"
                      style={{
                        backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
                        backgroundSize: '12px 12px',
                      }}
                    />

                    {/* Simulated Selected Label Element */}
                    <div
                      style={{
                        transform: `rotate(${previewAngle}deg)`,
                        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}
                      className="w-36 h-16 bg-white text-slate-900 rounded-lg border-2 border-indigo-500 shadow-xl relative flex flex-col justify-center items-center px-2 cursor-pointer"
                      onClick={() => setPreviewAngle((a) => (a + 15) % 360)}
                      title="Cliquez pour tourner de +15°"
                    >
                      <span className="text-[10px] font-bold text-slate-800 truncate">ÉTIQUETTE PRODUIT</span>
                      <span className="text-[9px] font-mono text-emerald-700 font-bold">4,99 €</span>

                      {/* Top Stem Handle Preview */}
                      {currentHandleType === 'top_stem' && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center">
                          <div className="w-4 h-4 rounded-full bg-white border-2 border-indigo-600 shadow flex items-center justify-center text-indigo-600 hover:scale-125 transition-transform">
                            <RotateCw className="w-2.5 h-2.5" />
                          </div>
                          <div className="w-0.5 h-2.5 bg-indigo-600" />
                        </div>
                      )}

                      {/* Dual Stems Preview */}
                      {currentHandleType === 'dual_stems' && (
                        <>
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
                            <div className="w-4 h-4 rounded-full bg-white border-2 border-indigo-600 shadow flex items-center justify-center text-indigo-600">
                              <RotateCw className="w-2 h-2" />
                            </div>
                            <div className="w-0.5 h-2 bg-indigo-600" />
                          </div>
                          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
                            <div className="w-0.5 h-2 bg-indigo-600" />
                            <div className="w-4 h-4 rounded-full bg-white border-2 border-indigo-600 shadow flex items-center justify-center text-indigo-600">
                              <RotateCw className="w-2 h-2" />
                            </div>
                          </div>
                        </>
                      )}

                      {/* Corner Satellites Preview */}
                      {currentHandleType === 'corner_satellites' && (
                        <>
                          <div className="absolute -top-2.5 -left-2.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-purple-500 shadow flex items-center justify-center">
                            <div className="w-1 h-1 rounded-full bg-purple-600" />
                          </div>
                          <div className="absolute -top-2.5 -right-2.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-purple-500 shadow flex items-center justify-center">
                            <div className="w-1 h-1 rounded-full bg-purple-600" />
                          </div>
                          <div className="absolute -bottom-2.5 -left-2.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-purple-500 shadow flex items-center justify-center">
                            <div className="w-1 h-1 rounded-full bg-purple-600" />
                          </div>
                          <div className="absolute -bottom-2.5 -right-2.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-purple-500 shadow flex items-center justify-center">
                            <div className="w-1 h-1 rounded-full bg-purple-600" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Placement Strategies */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Positionnement dynamique à l'insertion
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Détermine l'emplacement où apparaissent les nouveaux éléments (boutons d'ajout, catalogue ou raccourcis).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        id: 'ergonomic_smart' as const,
                        title: 'Placement Intelligent & Ergonomique',
                        badge: 'Recommandé',
                        desc: 'Détecte les zones libres pour éviter tout chevauchement en respectant les marges.',
                        icon: Sparkles,
                      },
                      {
                        id: 'smart_cascade' as const,
                        title: 'Cascade Décalée Échelonnée',
                        badge: '+4 mm',
                        desc: 'Décale chaque nouvel élément en diagonale par rapport au précédent.',
                        icon: ArrowDownRight,
                      },
                      {
                        id: 'zone_semantic' as const,
                        title: 'Zonage Standard Métier',
                        badge: 'Normé',
                        desc: 'Place automatiquement les textes en haut, codes-barres au centre, prix en bas à droite.',
                        icon: LayoutGrid,
                      },
                      {
                        id: 'canvas_center' as const,
                        title: 'Centre du Gabarit',
                        badge: 'Centrage',
                        desc: 'Positionne systématiquement l\'élément créé au centre exact du gabarit.',
                        icon: Crosshair,
                      },
                      {
                        id: 'fixed_classic' as const,
                        title: 'Position Fixe Haut-Gauche',
                        badge: 'Origine (0,0)',
                        desc: 'Place tous les éléments à la marge supérieure gauche d\'origine.',
                        icon: Box,
                      },
                    ].map((strat) => {
                      const isSelected = currentPlacementStrategy === strat.id;
                      const Icon = strat.icon;
                      return (
                        <div
                          key={strat.id}
                          onClick={() => updateUIPreferences({ elementPlacementStrategy: strat.id })}
                          className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <span className="font-bold text-xs text-slate-900 block">{strat.title}</span>
                                <span className="text-[10px] text-indigo-600 font-semibold">{strat.badge}</span>
                              </div>
                            </div>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{strat.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 3. SECTION: RÈGLES & MAGNÉTISME */}
            {activeCategory === 'rulers' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-indigo-600" />
                    <span>Règles Millimétriques & Magnétisme de Grille</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Contrôlez les repères physiques du document d'étiquette et le HUD d'information flottant.
                  </p>
                </div>

                {/* Grid Snap Sensitivity */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                    <span>{accessibilityText('gridSensitivity') || 'Sensibilité d\'aimantation de la grille'} :</span>
                    <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-md font-mono font-bold text-xs">
                      {gridSnapSensitivityMm} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="10.0"
                    step="0.1"
                    value={gridSnapSensitivityMm}
                    onChange={(e) => setGridSnapSensitivityMm(Number(e.target.value))}
                    aria-label="Sensibilité d'aimantation de la grille en millimètres"
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                    <span>0.1 mm (Ultra-Précis)</span>
                    <span>1.0 mm (Standard)</span>
                    <span>5.0 mm (Grossier)</span>
                    <span>10.0 mm (Grand format)</span>
                  </div>
                </div>

                {/* Ruler Mode Selection */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    Mode d'ancrage des règles
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        mode: 'window_frame' as const,
                        label: 'Cadre Fenêtre',
                        desc: 'Ancrées sous la barre d\'outils et au bord gauche de l\'écran.',
                      },
                      {
                        mode: 'sheet_margins' as const,
                        label: 'Marges Feuille',
                        desc: 'Ancrées directement autour du gabarit avec dégagement paramétrable.',
                      },
                      {
                        mode: 'hidden' as const,
                        label: 'Masquer les Règles',
                        desc: 'Cache les règles de bordure pour maximiser la surface du canevas.',
                      },
                    ].map((rm) => (
                      <button
                        key={rm.mode}
                        type="button"
                        onClick={() => updateUIPreferences({ rulerMode: rm.mode })}
                        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                          uiPreferences?.rulerMode === rm.mode
                            ? 'border-indigo-600 bg-indigo-50/60 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-xs'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span className="text-xs font-bold">{rm.label}</span>
                        <span className="text-[10px] text-slate-500 mt-1 font-normal leading-snug">{rm.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Individual Ruler Toggles */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-800 block border-b border-slate-200 pb-1.5">
                    Affichage individuel des règles
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      {
                        label: 'Règle Haut',
                        active: rulerSettings.showHorizontal,
                        toggle: () => updateRulerSettings({ showHorizontal: !rulerSettings.showHorizontal }),
                      },
                      {
                        label: 'Règle Gauche',
                        active: rulerSettings.showVertical,
                        toggle: () => updateRulerSettings({ showVertical: !rulerSettings.showVertical }),
                      },
                      {
                        label: 'Règles Feuille',
                        active: rulerSettings.showSheet,
                        toggle: () => updateRulerSettings({ showSheet: !rulerSettings.showSheet }),
                      },
                      {
                        label: 'HUD Flottant',
                        active: rulerSettings.showHud,
                        toggle: () => updateRulerSettings({ showHud: !rulerSettings.showHud }),
                      },
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={item.toggle}
                        className={`p-2.5 rounded-lg border text-xs font-bold transition flex items-center justify-between ${
                          item.active
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className="text-[10px] opacity-80">{item.active ? 'OUI' : 'NON'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ruler Clearance Offset Slider */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Dégagement des règles feuille (Clearance Offset)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Écart d'espacement entre le contour du gabarit et les règles millimétrées.
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded font-mono font-bold text-xs">
                      {uiPreferences?.rulerOffsetPx || 40} px (~{Math.round(((uiPreferences?.rulerOffsetPx || 40) / 3.78) * 10) / 10} mm)
                    </span>
                  </div>

                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="2"
                    value={uiPreferences?.rulerOffsetPx || 40}
                    onChange={(e) => updateUIPreferences({ rulerOffsetPx: Number(e.target.value) })}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Independent Floating HUD Card */}
                <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Move className="w-4 h-4 text-indigo-400" />
                      <div>
                        <span className="text-xs font-bold text-slate-100 block">HUD Flottant Déplaçable</span>
                        <span className="text-[10px] text-slate-400">Affiche la taille du gabarit et les coordonnées du curseur</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateRulerSettings({ showHud: !rulerSettings.showHud })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        rulerSettings.showHud
                          ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-2xs'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {rulerSettings.showHud ? 'Visible' : 'Masqué'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                    <span className="text-slate-400">Position enregistrée :</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-indigo-300 font-semibold text-[11px]">
                        {uiPreferences?.hudPosition
                          ? `X: ${uiPreferences.hudPosition.x}px, Y: ${uiPreferences.hudPosition.y}px`
                          : 'Par défaut (Haut)'}
                      </span>
                      {uiPreferences?.hudPosition && (
                        <button
                          type="button"
                          onClick={() => updateUIPreferences({ hudPosition: null })}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-[10px] rounded border border-slate-700"
                        >
                          Réinitialiser
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. SECTION: ACCESSIBILITÉ & INFO-BULLES */}
            {activeCategory === 'accessibility' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-indigo-600" />
                    <span>{accessibilityText('tooltipSection') || 'Accessibilité & Info-bulles Contextuelles'}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Adaptez le système d'aide contextuelle pour un confort de lecture optimal.
                  </p>
                </div>

                {/* Enable Tooltips Master Switch */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      {accessibilityText('enableTooltips') || 'Activer les info-bulles contextuelles enrichies'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {accessibilityText('tooltipHelp') || 'Affiche des explications détaillées et les raccourcis au survol'}
                    </span>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={tooltipSettings.enabled}
                    onClick={() => updateTooltipSettings({ enabled: !tooltipSettings.enabled })}
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                      tooltipSettings.enabled ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                        tooltipSettings.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {tooltipSettings.enabled && (
                  <div className="space-y-4">
                    {/* Hover Delay */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                        <span className="flex items-center gap-1.5">
                          <MousePointer className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{accessibilityText('hoverDelay') || 'Délai d\'apparition au survol'} :</span>
                        </span>
                        <span className="font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {tooltipSettings.hoverDelayMs} ms
                        </span>
                      </div>
                      <input
                        type="range"
                        min="100"
                        max="2000"
                        step="50"
                        value={tooltipSettings.hoverDelayMs}
                        onChange={(e) => updateTooltipSettings({ hoverDelayMs: Number(e.target.value) })}
                        aria-label="Délai d'apparition au survol en millisecondes"
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>100 ms (Immédiat)</span>
                        <span>300 ms (Standard)</span>
                        <span>2000 ms (Lent)</span>
                      </div>
                    </div>

                    {/* Tooltip Opacity */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                        <span>{accessibilityText('tooltipOpacity') || 'Opacité du fond des info-bulles'} :</span>
                        <span className="font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {tooltipSettings.opacityPercent} %
                        </span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="100"
                        step="5"
                        value={tooltipSettings.opacityPercent}
                        onChange={(e) => updateTooltipSettings({ opacityPercent: Number(e.target.value) })}
                        aria-label="Opacité des info-bulles en pourcentage"
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>50% (Semi-transparent)</span>
                        <span>95% (Standard)</span>
                        <span>100% (Opaque)</span>
                      </div>
                    </div>

                    {/* Auto Dismiss */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                        <span>{accessibilityText('autoDismiss') || 'Fermeture automatique (Auto-Dismiss)'} :</span>
                        <span className="font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {tooltipSettings.autoDismissSec === 0 ? 'Permanent' : `${tooltipSettings.autoDismissSec} s`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="15"
                        step="1"
                        value={tooltipSettings.autoDismissSec}
                        onChange={(e) => updateTooltipSettings({ autoDismissSec: Number(e.target.value) })}
                        aria-label="Délai de fermeture automatique en secondes"
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>0 s (Reste affiché tant que survolé)</span>
                        <span>6 s (Standard)</span>
                        <span>15 s (Longue lecture)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. SECTION: ESPACE DE TRAVAIL & PANNEAUX */}
            {activeCategory === 'workspace' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    <span>Espace de Travail, Zoom & Panneaux</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Réglez les comportements ergonomiques de zoom, la sauvegarde automatique et l'ancrage des panneaux.
                  </p>
                </div>

                {/* Zoom Options */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-900 block">
                    Mode de Zoom à la Molette (Wheel Zoom Method)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        method: 'pointer' as const,
                        label: 'Curseur & Molette (Pointer-Centric)',
                        desc: 'Zoome vers la position exacte du pointeur de souris sur le gabarit.',
                      },
                      {
                        method: 'marquee' as const,
                        label: 'Cadre Zoom (Marquee / Touche Z)',
                        desc: 'Glisser pour zoomer directement sur une région sélectionnée.',
                      },
                      {
                        method: 'keyboard' as const,
                        label: 'Raccourcis Clavier (Touches +/-)',
                        desc: 'Zoom incrémental centré par pas fixes de 25%.',
                      },
                      {
                        method: 'slider' as const,
                        label: 'Curseur Glissant HUD',
                        desc: 'Réglage continu via le curseur de la barre flottante de zoom.',
                      },
                    ].map((zm) => (
                      <button
                        key={zm.method}
                        type="button"
                        onClick={() => updateUIPreferences({ zoomMethod: zm.method })}
                        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                          (uiPreferences?.zoomMethod || 'pointer') === zm.method
                            ? 'border-indigo-600 bg-indigo-50/60 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span className="text-xs font-bold">{zm.label}</span>
                        <span className="text-[10px] text-slate-500 mt-1 font-normal leading-snug">{zm.desc}</span>
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Zoom par défaut à l'ouverture :</span>
                    <div className="flex items-center gap-1.5">
                      {[1.0, 1.25, 1.5, 2.0].map((scale) => (
                        <button
                          key={scale}
                          type="button"
                          onClick={() => updateUIPreferences({ defaultZoom: scale })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition ${
                            (uiPreferences?.defaultZoom || 1.25) === scale
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {Math.round(scale * 100)}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Auto-Save Interval */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Intervalle d'enregistrement automatique
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Fréquence de synchronisation en mémoire locale des modifications du gabarit.
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded font-mono font-bold text-xs">
                      {uiPreferences?.autoSaveIntervalSec || 30} secondes
                    </span>
                  </div>

                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="5"
                    value={uiPreferences?.autoSaveIntervalSec || 30}
                    onChange={(e) => updateUIPreferences({ autoSaveIntervalSec: Number(e.target.value) })}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>10 s (Fréquent)</span>
                    <span>30 s (Recommandé)</span>
                    <span>120 s (Économie)</span>
                  </div>
                </div>

                {/* Panel Anti-Collapsing Locks */}
                <div className="space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    Verrouillage persistant des panneaux
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Inspector Lock */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          {uiPreferences?.lockPropertyInspector ? (
                            <Lock className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          <span>Inspecteur de Propriétés</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Empêche le panneau de se fermer lors d'un clic en dehors d'un élément.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          updateUIPreferences({
                            lockPropertyInspector: !uiPreferences?.lockPropertyInspector,
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                          uiPreferences?.lockPropertyInspector
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {uiPreferences?.lockPropertyInspector ? 'Verrouillé' : 'Libre'}
                      </button>
                    </div>

                    {/* Left Sidebar Lock */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          {uiPreferences?.lockLeftSidebar ? (
                            <Lock className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          <span>Arborescence des Calques</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Garde la colonne des calques et données toujours dépliée.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          updateUIPreferences({
                            lockLeftSidebar: !uiPreferences?.lockLeftSidebar,
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                          uiPreferences?.lockLeftSidebar
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {uiPreferences?.lockLeftSidebar ? 'Verrouillé' : 'Libre'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Bottom Footer Bar */}
        <footer className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Rétablir les valeurs par défaut</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                <span className="text-[11px] text-amber-900 font-semibold">Réinitialiser cette section ?</span>
                <button
                  type="button"
                  onClick={handleResetSectionDefaults}
                  className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-[10px] transition"
                >
                  Confirmer
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-1.5 py-0.5 text-slate-600 hover:text-slate-900 text-[10px]"
                >
                  Annuler
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition"
            >
              Enregistrer & Fermer
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
