import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { TooltipSettings } from '../types';
import {
  DEFAULT_RULER_SETTINGS,
  DEFAULT_TOOLTIP_SETTINGS,
  DEFAULT_UI_PREFERENCES,
  usePreferencesStore,
  type RulerSettings,
  type UIPreferences,
} from '../store/preferencesStore';
import { applyCustomThemeTokens, applyThemeTokens, type CustomTheme, type DensityMode, type ThemeMode } from '../theme/themeEngine';

interface TooltipContextType {
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
  setGridSnapSensitivityMm: (val: number) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setCustomTheme: (theme: CustomTheme) => void;
  removeCustomTheme: (id: string) => void;
  setDensityMode: (mode: DensityMode) => void;
}

const TooltipContext = createContext<TooltipContextType | undefined>(undefined);

export const TooltipProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const state = usePreferencesStore();
  const initialize = usePreferencesStore((store) => store.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const customTheme = state.customThemes.find((theme) => theme.id === state.activeCustomThemeId);
    if (customTheme) {
      applyCustomThemeTokens(document.documentElement, customTheme, state.densityMode);
    } else {
      applyThemeTokens(document.documentElement, state.themeMode, state.densityMode);
    }
  }, [state.themeMode, state.customThemes, state.activeCustomThemeId, state.densityMode]);

  return (
    <TooltipContext.Provider
      value={{
        tooltipSettings: state.tooltipSettings,
        gridSnapSensitivityMm: state.gridSnapSensitivityMm,
        themeMode: state.themeMode,
        customThemes: state.customThemes,
        activeCustomThemeId: state.activeCustomThemeId,
        densityMode: state.densityMode,
        uiPreferences: state.uiPreferences,
        rulerSettings: state.rulerSettings,
        isPreferencesModalOpen: state.isPreferencesModalOpen,
        openPreferencesModal: state.openPreferencesModal,
        closePreferencesModal: state.closePreferencesModal,
        updateTooltipSettings: state.updateTooltipSettings,
        updateUIPreferences: state.updateUIPreferences,
        updateRulerSettings: state.updateRulerSettings,
        setGridSnapSensitivityMm: state.setGridSnapSensitivityMm,
        setThemeMode: state.setThemeMode,
        setCustomTheme: state.setCustomTheme,
        removeCustomTheme: state.removeCustomTheme,
        setDensityMode: state.setDensityMode,
      }}
    >
      {children}
    </TooltipContext.Provider>
  );
};

export function useTooltip() {
  const context = useContext(TooltipContext);
  if (!context) {
    return {
      tooltipSettings: DEFAULT_TOOLTIP_SETTINGS,
      gridSnapSensitivityMm: 1.0,
      themeMode: 'graphite' as const,
      customThemes: [] as CustomTheme[],
      activeCustomThemeId: null,
      densityMode: 'standard' as const,
      uiPreferences: DEFAULT_UI_PREFERENCES,
      rulerSettings: DEFAULT_RULER_SETTINGS,
      isPreferencesModalOpen: false,
      openPreferencesModal: () => {},
      closePreferencesModal: () => {},
      updateTooltipSettings: () => {},
      updateUIPreferences: () => {},
      updateRulerSettings: () => {},
      setGridSnapSensitivityMm: () => {},
      setThemeMode: () => {},
      setCustomTheme: () => {},
      removeCustomTheme: () => {},
      setDensityMode: () => {},
    };
  }
  return context;
}

interface ContextTooltipProps {
  title: string;
  content?: string;
  category?: string;
  shortcut?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactElement;
}

export const ContextTooltip: React.FC<ContextTooltipProps> = ({
  title,
  content,
  category,
  shortcut,
  placement,
  position,
  children,
}) => {
  const { tooltipSettings } = useTooltip();
  const [isVisible, setIsVisible] = useState(false);
  const [timerId, setTimerId] = useState<any>(null);
  const [dismissTimerId, setDismissTimerId] = useState<any>(null);

  if (!tooltipSettings.enabled) {
    return children;
  }

  const handleMouseEnter = () => {
    if (timerId) clearTimeout(timerId);
    if (dismissTimerId) clearTimeout(dismissTimerId);

    const id = setTimeout(() => {
      setIsVisible(true);
      if (tooltipSettings.autoDismissSec > 0) {
        const autoId = setTimeout(() => {
          setIsVisible(false);
        }, tooltipSettings.autoDismissSec * 1000);
        setDismissTimerId(autoId);
      }
    }, tooltipSettings.hoverDelayMs);

    setTimerId(id);
  };

  const handleMouseLeave = () => {
    if (timerId) clearTimeout(timerId);
    if (dismissTimerId) clearTimeout(dismissTimerId);
    setIsVisible(false);
  };

  const effectivePosition = placement || position || 'top';

  const posClass =
    effectivePosition === 'top'
      ? 'bottom-full mb-2 left-1/2 -translate-x-1/2'
      : effectivePosition === 'bottom'
      ? 'top-full mt-2 left-1/2 -translate-x-1/2'
      : effectivePosition === 'left'
      ? 'right-full mr-2 top-1/2 -translate-y-1/2'
      : 'left-full ml-2 top-1/2 -translate-y-1/2';

  return (
    <div className="relative inline-block" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {isVisible && (
        <div
          style={{ opacity: tooltipSettings.opacityPercent / 100 }}
          className={`absolute z-50 ${posClass} pointer-events-none w-max max-w-xs bg-slate-900 text-white rounded-lg p-2 shadow-xl border border-slate-700 text-xs animate-in fade-in zoom-in-95 duration-150`}
        >
          <div className="font-bold flex items-center justify-between gap-2">
            <span>{title}</span>
            <div className="flex items-center gap-1">
              {shortcut && (
                <span className="text-[9px] font-mono px-1 py-0.2 bg-indigo-900/80 text-indigo-200 border border-indigo-700/60 rounded">
                  {shortcut}
                </span>
              )}
              {category && (
                <span className="text-[9px] uppercase px-1 py-0.2 bg-slate-800 text-indigo-300 rounded font-semibold">
                  {category}
                </span>
              )}
            </div>
          </div>
          {content && <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{content}</p>}
        </div>
      )}
    </div>
  );
};
