import { create } from 'zustand';
import { emit, listen } from '@tauri-apps/api/event';
import type { TooltipSettings, ZoomMethod, RotationHandleType, ElementPlacementStrategy } from '../types';
import { api, isTauriEnvironment } from '../services/api';
import {
  applyCustomThemeTokens,
  applyThemeTokens,
  validateCustomTheme,
  validDensity,
  validThemeMode,
  type CustomTheme,
  type DensityMode,
  type ThemeMode,
} from '../theme/themeEngine';

export { THEME_PRESETS, type DensityMode, type ThemeMode, validDensity, validThemeMode, resolveThemeTokens, applyThemeTokens } from '../theme/themeEngine';

export interface RulerSettings {
  showHorizontal: boolean;
  showVertical: boolean;
  showSheet: boolean;
  showHud: boolean;
}

export interface UIPreferences {
  defaultZoom: number;
  zoomMethod: ZoomMethod;
  autoSaveIntervalSec: number;
  rulerMode: 'sheet_margins' | 'window_frame' | 'floating' | 'hidden';
  rulerOffsetPx: number;
  showTopRuler: boolean;
  showLeftRuler: boolean;
  showSheetRulers: boolean;
  showFloatingHud: boolean;
  hudPosition: { x: number; y: number } | null;
  lockPropertyInspector: boolean;
  inspectorWidthPx: number;
  lockInspectorWidth: boolean;
  lockLeftSidebar: boolean;
  rotationHandleType?: RotationHandleType;
  rotationSnapEnabled?: boolean;
  rotationSnapAngle?: number;
  elementPlacementStrategy?: ElementPlacementStrategy;
}

export const DEFAULT_TOOLTIP_SETTINGS: TooltipSettings = {
  enabled: true,
  hoverDelayMs: 300,
  opacityPercent: 95,
  autoDismissSec: 6,
};

export const DEFAULT_RULER_SETTINGS: RulerSettings = {
  showHorizontal: true,
  showVertical: true,
  showSheet: true,
  showHud: true,
};

export const DEFAULT_UI_PREFERENCES: UIPreferences = {
  defaultZoom: 1.25,
  zoomMethod: 'pointer',
  autoSaveIntervalSec: 30,
  rulerMode: 'window_frame',
  rulerOffsetPx: 40,
  showTopRuler: true,
  showLeftRuler: true,
  showSheetRulers: true,
  showFloatingHud: true,
  hudPosition: null,
  lockPropertyInspector: true,
  inspectorWidthPx: 320,
  lockInspectorWidth: false,
  lockLeftSidebar: true,
  rotationHandleType: 'top_stem',
  rotationSnapEnabled: true,
  rotationSnapAngle: 15,
  elementPlacementStrategy: 'ergonomic_smart',
};

const DEFAULT_GRID_SNAP_SENSITIVITY_MM = 1;
const PREFS_SYNC_EVENT = 'estudio://preferences-updated';
const CUSTOM_THEMES_KEY = 'estudio_custom_themes_v1';
const ACTIVE_CUSTOM_THEME_KEY = 'estudio_active_custom_theme_id';
let browserPreferenceChannel: BroadcastChannel | null = null;
const pendingPreferenceKeys = new Set<string>();

function decodeObject<T extends object>(serialized: string | null, defaults: T): T {
  if (!serialized) return defaults;
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults;
    return { ...defaults, ...parsed } as T;
  } catch {
    return defaults;
  }
}

function decodeCustomThemes(serialized: string | null): CustomTheme[] {
  if (!serialized) return [];
  try {
    const parsed: unknown = JSON.parse(serialized);
    return Array.isArray(parsed) ? parsed.filter(validateCustomTheme) : [];
  } catch {
    return [];
  }
}

function applyCurrentTheme(state: Pick<PreferencesState, 'themeMode' | 'densityMode' | 'customThemes' | 'activeCustomThemeId'>): void {
  if (typeof document === 'undefined') return;
  const customTheme = state.customThemes.find((theme) => theme.id === state.activeCustomThemeId);
  if (customTheme) {
    applyCustomThemeTokens(document.documentElement, customTheme, state.densityMode);
  } else {
    applyThemeTokens(document.documentElement, state.themeMode, state.densityMode);
  }
}

function applyPreferenceValue(key: string, value: string): void {
  const store = usePreferencesStore.getState();
  switch (key) {
    case 'estudio_tooltip_settings_v1':
      store.applyTooltipSettings(decodeObject(value, DEFAULT_TOOLTIP_SETTINGS));
      break;
    case 'estudio_ui_preferences_v1':
      store.applyUIPreferences(decodeObject(value, DEFAULT_UI_PREFERENCES));
      break;
    case 'estudio_ruler_settings_v1':
      store.applyRulerSettings(decodeObject(value, DEFAULT_RULER_SETTINGS));
      break;
    case 'estudio_grid_snap_mm': {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) store.applyGridSnapSensitivityMm(parsed);
      break;
    }
    case 'estudio_theme_mode':
      if (validThemeMode(value)) store.applyThemeMode(value);
      break;
    case 'estudio_density_mode':
      if (validDensity(value)) store.applyDensityMode(value);
      break;
    case CUSTOM_THEMES_KEY:
      store.applyCustomThemes(decodeCustomThemes(value));
      break;
    case ACTIVE_CUSTOM_THEME_KEY:
      store.applyActiveCustomThemeId(value || null);
      break;
  }
}

async function persistPreference(key: string, value: string): Promise<void> {
  try {
    await api.prefsSet(key, value);
    if (isTauriEnvironment()) {
      await emit(PREFS_SYNC_EVENT, { key, value });
    } else {
      if (key === 'estudio_theme_mode') {
        try {
          window.localStorage.setItem(key, value);
        } catch (error) {
          console.error('Unable to persist the browser theme preference', error);
        }
      }
      browserPreferenceChannel?.postMessage({ key, value });
    }
  } catch (error) {
    console.error(`Unable to persist preference ${key}`, error);
  }
}

interface PreferencesState {
  hydrated: boolean;
  tooltipSettings: TooltipSettings;
  gridSnapSensitivityMm: number;
  themeMode: ThemeMode;
  customThemes: CustomTheme[];
  activeCustomThemeId: string | null;
  densityMode: DensityMode;
  uiPreferences: UIPreferences;
  rulerSettings: RulerSettings;
  isPreferencesModalOpen: boolean;
  openPreferencesModal: () => void;
  closePreferencesModal: () => void;
  updateTooltipSettings: (settings: Partial<TooltipSettings>) => void;
  updateUIPreferences: (prefs: Partial<UIPreferences>) => void;
  updateRulerSettings: (settings: Partial<RulerSettings>) => void;
  setGridSnapSensitivityMm: (value: number) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setCustomTheme: (theme: CustomTheme) => void;
  removeCustomTheme: (id: string) => void;
  setDensityMode: (mode: DensityMode) => void;
  applyTooltipSettings: (settings: TooltipSettings) => void;
  applyUIPreferences: (prefs: UIPreferences) => void;
  applyRulerSettings: (settings: RulerSettings) => void;
  applyGridSnapSensitivityMm: (value: number) => void;
  applyThemeMode: (mode: ThemeMode) => void;
  applyCustomThemes: (themes: CustomTheme[]) => void;
  applyActiveCustomThemeId: (id: string | null) => void;
  applyDensityMode: (mode: DensityMode) => void;
  initialize: () => Promise<void>;
}

let initialization: Promise<void> | null = null;

function savePreferenceWhenReady(key: string, value: string): void {
  if (!usePreferencesStore.getState().hydrated) {
    pendingPreferenceKeys.add(key);
    return;
  }
  void persistPreference(key, value);
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  hydrated: false,
  tooltipSettings: DEFAULT_TOOLTIP_SETTINGS,
  gridSnapSensitivityMm: DEFAULT_GRID_SNAP_SENSITIVITY_MM,
  themeMode: 'graphite',
  customThemes: [],
  activeCustomThemeId: null,
  densityMode: 'standard',
  uiPreferences: DEFAULT_UI_PREFERENCES,
  rulerSettings: DEFAULT_RULER_SETTINGS,
  isPreferencesModalOpen: false,
  openPreferencesModal: () => set({ isPreferencesModalOpen: true }),
  closePreferencesModal: () => set({ isPreferencesModalOpen: false }),
  updateTooltipSettings: (partial) => {
    const next = { ...get().tooltipSettings, ...partial };
    set({ tooltipSettings: next });
    savePreferenceWhenReady('estudio_tooltip_settings_v1', JSON.stringify(next));
  },
  updateUIPreferences: (partial) => {
    const next = { ...get().uiPreferences, ...partial };
    set({ uiPreferences: next });
    savePreferenceWhenReady('estudio_ui_preferences_v1', JSON.stringify(next));
  },
  updateRulerSettings: (partial) => {
    const next = { ...get().rulerSettings, ...partial };
    set({ rulerSettings: next });
    savePreferenceWhenReady('estudio_ruler_settings_v1', JSON.stringify(next));
  },
  setGridSnapSensitivityMm: (value) => {
    if (!Number.isFinite(value) || value <= 0) return;
    set({ gridSnapSensitivityMm: value });
    savePreferenceWhenReady('estudio_grid_snap_mm', String(value));
  },
  setThemeMode: (mode) => {
    set({ themeMode: mode, activeCustomThemeId: null });
    savePreferenceWhenReady('estudio_theme_mode', mode);
    savePreferenceWhenReady(ACTIVE_CUSTOM_THEME_KEY, '');
    applyCurrentTheme(get());
  },
  setCustomTheme: (theme) => {
    if (!validateCustomTheme(theme)) return;
    const customThemes = [...get().customThemes.filter((item) => item.id !== theme.id), theme];
    set({ customThemes, activeCustomThemeId: theme.id, themeMode: theme.baseMode });
    savePreferenceWhenReady(CUSTOM_THEMES_KEY, JSON.stringify(customThemes));
    savePreferenceWhenReady(ACTIVE_CUSTOM_THEME_KEY, theme.id);
    savePreferenceWhenReady('estudio_theme_mode', theme.baseMode);
    applyCurrentTheme(get());
  },
  removeCustomTheme: (id) => {
    const state = get();
    const removedTheme = state.customThemes.find((theme) => theme.id === id);
    const customThemes = state.customThemes.filter((theme) => theme.id !== id);
    const isActive = state.activeCustomThemeId === id;
    const themeMode = isActive && removedTheme ? removedTheme.baseMode : state.themeMode;
    set({
      customThemes,
      activeCustomThemeId: isActive ? null : state.activeCustomThemeId,
      themeMode,
    });
    savePreferenceWhenReady(CUSTOM_THEMES_KEY, JSON.stringify(customThemes));
    if (isActive) {
      savePreferenceWhenReady(ACTIVE_CUSTOM_THEME_KEY, '');
      savePreferenceWhenReady('estudio_theme_mode', themeMode);
    }
    applyCurrentTheme(get());
  },
  setDensityMode: (mode) => {
    set({ densityMode: mode });
    savePreferenceWhenReady('estudio_density_mode', mode);
    applyCurrentTheme(get());
  },
  applyTooltipSettings: (tooltipSettings) => set({ tooltipSettings }),
  applyUIPreferences: (uiPreferences) => set({ uiPreferences }),
  applyRulerSettings: (rulerSettings) => set({ rulerSettings }),
  applyGridSnapSensitivityMm: (gridSnapSensitivityMm) => set({ gridSnapSensitivityMm }),
  applyThemeMode: (themeMode) => {
    set({ themeMode });
    applyCurrentTheme(get());
  },
  applyCustomThemes: (themes) => {
    const customThemes = themes.filter(validateCustomTheme);
    const current = get();
    const activeCustomThemeId = customThemes.some((theme) => theme.id === current.activeCustomThemeId)
      ? current.activeCustomThemeId
      : null;
    const activeTheme = customThemes.find((theme) => theme.id === activeCustomThemeId);
    set({
      customThemes,
      activeCustomThemeId,
      themeMode: activeTheme?.baseMode ?? current.themeMode,
    });
    applyCurrentTheme(get());
  },
  applyActiveCustomThemeId: (id) => {
    const theme = get().customThemes.find((item) => item.id === id);
    set({
      activeCustomThemeId: id && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id) ? id : null,
      ...(theme ? { themeMode: theme.baseMode } : {}),
    });
    applyCurrentTheme(get());
  },
  applyDensityMode: (densityMode) => set({ densityMode }),
  initialize: () => {
    if (!initialization) {
      initialization = (async () => {
        if (isTauriEnvironment()) {
          void listen<{ key: string; value: string }>(PREFS_SYNC_EVENT, ({ payload }) => {
            applyPreferenceValue(payload.key, payload.value);
          }).catch((error) => console.error('Unable to subscribe to preference updates', error));
        } else if (typeof BroadcastChannel !== 'undefined') {
          browserPreferenceChannel = new BroadcastChannel('estudio-preferences');
          browserPreferenceChannel.onmessage = ({ data }: MessageEvent<{ key?: string; value?: string }>) => {
            if (typeof data?.key === 'string' && typeof data.value === 'string') {
              applyPreferenceValue(data.key, data.value);
            }
          };
        }

        try {
          let browserTheme: string | null = null;
          if (!isTauriEnvironment() && typeof window !== 'undefined') {
            try {
              browserTheme = window.localStorage.getItem('estudio_theme_mode');
            } catch (error) {
              console.error('Unable to read the browser theme preference', error);
            }
          }
          const [tooltip, ui, ruler, grid, theme, density, customThemesValue, activeCustomThemeValue] = await Promise.all([
            api.prefsGet('estudio_tooltip_settings_v1'),
            api.prefsGet('estudio_ui_preferences_v1'),
            api.prefsGet('estudio_ruler_settings_v1'),
            api.prefsGet('estudio_grid_snap_mm'),
            api.prefsGet('estudio_theme_mode'),
            api.prefsGet('estudio_density_mode'),
            api.prefsGet(CUSTOM_THEMES_KEY),
            api.prefsGet(ACTIVE_CUSTOM_THEME_KEY),
          ]);
          const gridValue = Number(grid);
          const themeValue = browserTheme || theme;
          const resolvedDensity = validDensity(density) ? density : 'standard';
          const customThemes = decodeCustomThemes(customThemesValue);
          const activeCustomThemeId = customThemes.some((item) => item.id === activeCustomThemeValue)
            ? activeCustomThemeValue
            : null;
          const activeCustomTheme = customThemes.find((item) => item.id === activeCustomThemeId);
          const current = get();
          set({
            tooltipSettings: pendingPreferenceKeys.has('estudio_tooltip_settings_v1')
              ? current.tooltipSettings
              : decodeObject(tooltip, DEFAULT_TOOLTIP_SETTINGS),
            uiPreferences: pendingPreferenceKeys.has('estudio_ui_preferences_v1')
              ? current.uiPreferences
              : decodeObject(ui, DEFAULT_UI_PREFERENCES),
            rulerSettings: pendingPreferenceKeys.has('estudio_ruler_settings_v1')
              ? current.rulerSettings
              : decodeObject(ruler, DEFAULT_RULER_SETTINGS),
            gridSnapSensitivityMm: pendingPreferenceKeys.has('estudio_grid_snap_mm')
              ? current.gridSnapSensitivityMm
              : Number.isFinite(gridValue) && gridValue > 0
                ? gridValue
                : DEFAULT_GRID_SNAP_SENSITIVITY_MM,
            themeMode: pendingPreferenceKeys.has('estudio_theme_mode')
              ? current.themeMode
              : activeCustomTheme ? activeCustomTheme.baseMode : validThemeMode(themeValue) ? themeValue : 'graphite',
            customThemes: pendingPreferenceKeys.has(CUSTOM_THEMES_KEY) ? current.customThemes : customThemes,
            activeCustomThemeId: pendingPreferenceKeys.has(ACTIVE_CUSTOM_THEME_KEY)
              ? current.activeCustomThemeId
              : activeCustomThemeId,
            densityMode: pendingPreferenceKeys.has('estudio_density_mode')
              ? current.densityMode
              : resolvedDensity,
            hydrated: true,
          });
          pendingPreferenceKeys.forEach((key) => {
            const state = get();
            const valueByKey: Record<string, string> = {
              estudio_tooltip_settings_v1: JSON.stringify(state.tooltipSettings),
              estudio_ui_preferences_v1: JSON.stringify(state.uiPreferences),
              estudio_ruler_settings_v1: JSON.stringify(state.rulerSettings),
              estudio_grid_snap_mm: String(state.gridSnapSensitivityMm),
              estudio_theme_mode: state.themeMode,
              estudio_density_mode: state.densityMode,
              [CUSTOM_THEMES_KEY]: JSON.stringify(state.customThemes),
              [ACTIVE_CUSTOM_THEME_KEY]: state.activeCustomThemeId ?? '',
            };
            const pendingValue = valueByKey[key];
            if (pendingValue !== undefined) void persistPreference(key, pendingValue);
          });
          pendingPreferenceKeys.clear();
          applyCurrentTheme(get());
        } catch (error) {
          console.error('Failed to load studio preferences', error);
        }
      })();
    }
    return initialization;
  },
}));