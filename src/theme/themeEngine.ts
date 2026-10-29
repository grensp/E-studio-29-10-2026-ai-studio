import { getContrastRatio } from '../utils/colorContrastEngine';

export type ThemeMode = 'light' | 'dark' | 'graphite' | 'eink_high_contrast';
export type DensityMode = 'compact' | 'standard' | 'comfortable';

export interface ThemePreset {
  id: ThemeMode;
  label: string;
  description: string;
  shell: string;
  paper: string;
  paperAlt: string;
  workbench: string;
  surface: string;
  surfaceStrong: string;
  line: string;
  ink: string;
  muted: string;
  accent: string;
  appBg: string;
  accentSoft: string;
}

export type ThemeColorKey = 'shell' | 'paper' | 'paperAlt' | 'workbench' | 'surface' | 'surfaceStrong' | 'line' | 'ink' | 'muted' | 'accent' | 'appBg';
export type ThemeColors = Pick<ThemePreset, ThemeColorKey>;

export interface CustomTheme {
  format: 'e-studio-theme';
  version: 1;
  id: string;
  name: string;
  description: string;
  baseMode: ThemeMode;
  colors: ThemeColors;
}

export const THEME_PRESETS: Record<ThemeMode, ThemePreset> = {
  light: {
    id: 'light',
    label: 'Light',
    description: 'Clean workshop palette',
    shell: '#1f2d34',
    paper: '#f8f5f0',
    paperAlt: '#efece5',
    workbench: '#e4e9e1',
    surface: '#f6f4ef',
    surfaceStrong: '#ebefe8',
    line: '#cfd7d1',
    ink: '#1f2d34',
    muted: '#5d6a6d',
    accent: '#b64b31',
    appBg: '#edf2ed',
    accentSoft: 'rgba(182, 75, 49, 0.12)',
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    description: 'High contrast engineering mode',
    shell: '#0b1220',
    paper: '#111c2d',
    paperAlt: '#0f172a',
    workbench: '#172236',
    surface: '#111c2d',
    surfaceStrong: '#1a2a3d',
    line: '#2d3c52',
    ink: '#e2e8f0',
    muted: '#9aa9b8',
    accent: '#5ea5ff',
    appBg: '#0b1220',
    accentSoft: 'rgba(94, 165, 255, 0.14)',
  },
  graphite: {
    id: 'graphite',
    label: 'Graphite',
    description: 'Balanced desktop studio tone',
    shell: '#171d22',
    paper: '#f2f2ee',
    paperAlt: '#eceae4',
    workbench: '#dfe4dc',
    surface: '#f4f3f0',
    surfaceStrong: '#eaeee7',
    line: '#bcc6c0',
    ink: '#1d252b',
    muted: '#5d686e',
    accent: '#b64b31',
    appBg: '#e7ebe4',
    accentSoft: 'rgba(182, 75, 49, 0.12)',
  },
  eink_high_contrast: {
    id: 'eink_high_contrast',
    label: 'E Ink',
    description: 'Maximum clarity print review',
    shell: '#000000',
    paper: '#ffffff',
    paperAlt: '#ffffff',
    workbench: '#ffffff',
    surface: '#ffffff',
    surfaceStrong: '#ffffff',
    line: '#000000',
    ink: '#000000',
    muted: '#000000',
    accent: '#000000',
    appBg: '#ffffff',
    accentSoft: 'rgba(0, 0, 0, 0.08)',
  },
};

export const DENSITY_PRESETS: Record<DensityMode, {
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  spacing: string;
  panelPadding: string;
  inputHeight: string;
  fontScale: number;
}> = {
  compact: {
    radiusSm: '6px',
    radiusMd: '8px',
    radiusLg: '12px',
    spacing: '8px',
    panelPadding: '10px',
    inputHeight: '30px',
    fontScale: 0.92,
  },
  standard: {
    radiusSm: '8px',
    radiusMd: '10px',
    radiusLg: '14px',
    spacing: '10px',
    panelPadding: '12px',
    inputHeight: '34px',
    fontScale: 1,
  },
  comfortable: {
    radiusSm: '10px',
    radiusMd: '12px',
    radiusLg: '16px',
    spacing: '12px',
    panelPadding: '14px',
    inputHeight: '38px',
    fontScale: 1.08,
  },
};

export function validThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'graphite' || value === 'eink_high_contrast';
}

export function validDensity(value: unknown): value is DensityMode {
  return value === 'compact' || value === 'standard' || value === 'comfortable';
}

const THEME_COLOR_KEYS: ThemeColorKey[] = [
  'shell', 'paper', 'paperAlt', 'workbench', 'surface', 'surfaceStrong',
  'line', 'ink', 'muted', 'accent', 'appBg',
];

const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i;
const MAX_THEME_JSON_LENGTH = 65536;
const CUSTOM_THEME_TEXT_CONTRAST_MINIMUM = 4.5;

export interface CustomThemeContrastWarning {
  foreground: ThemeColorKey;
  background: ThemeColorKey;
  ratio: number;
}

export function validateCustomTheme(value: unknown): value is CustomTheme {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const theme = value as Partial<CustomTheme>;
  if (
    theme.format !== 'e-studio-theme' ||
    theme.version !== 1 ||
    typeof theme.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(theme.id) ||
    typeof theme.name !== 'string' || theme.name.trim().length < 1 || theme.name.length > 60 ||
    typeof theme.description !== 'string' || theme.description.length > 160 ||
    !validThemeMode(theme.baseMode) ||
    !theme.colors || typeof theme.colors !== 'object' || Array.isArray(theme.colors)
  ) return false;

  return THEME_COLOR_KEYS.every((key) => {
    const color = (theme.colors as Record<string, unknown>)[key];
    return typeof color === 'string' && HEX_COLOR_PATTERN.test(color);
  });
}

export function getCustomThemeContrastWarnings(theme: CustomTheme): CustomThemeContrastWarning[] {
  if (!validateCustomTheme(theme)) throw new Error('Cannot audit an invalid theme.');
  const pairs: Array<[ThemeColorKey, ThemeColorKey]> = [
    ['ink', 'paper'],
    ['ink', 'surface'],
    ['ink', 'workbench'],
    ['ink', 'appBg'],
    ['muted', 'paper'],
    ['muted', 'surface'],
    ['muted', 'workbench'],
    ['muted', 'appBg'],
  ];
  const warnings = pairs.flatMap(([foreground, background]) => {
    const ratio = getContrastRatio(theme.colors[foreground], theme.colors[background]);
    return ratio < CUSTOM_THEME_TEXT_CONTRAST_MINIMUM ? [{ foreground, background, ratio }] : [];
  });
  const shellForeground = getShellTextColor(theme.colors);
  const shellRatio = getContrastRatio(shellForeground.color, theme.colors.shell);
  if (shellRatio < CUSTOM_THEME_TEXT_CONTRAST_MINIMUM) {
    warnings.push({ foreground: shellForeground.key, background: 'shell', ratio: shellRatio });
  }
  return warnings;
}

function getShellTextColor(colors: ThemeColors): { key: 'paper' | 'ink'; color: string } {
  const paperRatio = getContrastRatio(colors.paper, colors.shell);
  const inkRatio = getContrastRatio(colors.ink, colors.shell);
  return paperRatio >= inkRatio
    ? { key: 'paper', color: colors.paper }
    : { key: 'ink', color: colors.ink };
}

export function parseCustomThemeJson(serialized: string): CustomTheme {
  if (serialized.length > MAX_THEME_JSON_LENGTH) {
    throw new Error('Theme JSON must be smaller than 64 KB.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('Theme file is not valid JSON.');
  }
  if (!validateCustomTheme(parsed)) {
    throw new Error('Theme file must use e-studio-theme version 1 with a name, base mode, and 11 six-digit hex colors.');
  }
  return parsed;
}

export function serializeCustomTheme(theme: CustomTheme): string {
  if (!validateCustomTheme(theme)) throw new Error('Cannot export an invalid theme.');
  return `${JSON.stringify(theme, null, 2)}\n`;
}

export function createCustomTheme(name: string, baseMode: ThemeMode = 'light'): CustomTheme {
  const normalizedName = name.trim().slice(0, 60) || 'My Theme';
  const id = `custom-${normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'theme'}`;
  const preset = THEME_PRESETS[baseMode];
  const colors = Object.fromEntries(THEME_COLOR_KEYS.map((key) => [key, preset[key]])) as ThemeColors;
  return {
    format: 'e-studio-theme',
    version: 1,
    id,
    name: normalizedName,
    description: 'User-created theme',
    baseMode,
    colors,
  };
}

export function resolveThemeTokens(
  mode: ThemeMode,
  density: DensityMode = 'standard',
  accentOverride?: string,
): Record<string, string> {
  const preset = THEME_PRESETS[mode];
  const accent = accentOverride || preset.accent;
  const densityScale = DENSITY_PRESETS[density];
  const shellText = getShellTextColor(preset);

  return {
    '--studio-chrome': preset.shell,
    '--studio-shell-ink': shellText.color,
    '--studio-paper': preset.paper,
    '--studio-paper-alt': preset.paperAlt,
    '--studio-workbench': preset.workbench,
    '--studio-surface': preset.surface,
    '--studio-surface-strong': preset.surfaceStrong,
    '--studio-line': preset.line,
    '--studio-ink': preset.ink,
    '--studio-muted': preset.muted,
    '--studio-accent': accent,
    '--studio-accent-soft': preset.accentSoft,
    '--studio-app-bg': preset.appBg,
    '--studio-radius-sm': densityScale.radiusSm,
    '--studio-radius-md': densityScale.radiusMd,
    '--studio-radius-lg': densityScale.radiusLg,
    '--studio-spacing': densityScale.spacing,
    '--studio-panel-padding': densityScale.panelPadding,
    '--studio-input-height': densityScale.inputHeight,
    '--studio-font-scale': String(densityScale.fontScale),
  };
}

export function resolveCustomThemeTokens(theme: CustomTheme, density: DensityMode = 'standard'): Record<string, string> {
  if (!validateCustomTheme(theme)) throw new Error('Cannot resolve an invalid theme.');
  const color = theme.colors.accent;
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  const tokens = resolveThemeTokens(theme.baseMode, density);
  const colorTokenMap: Record<ThemeColorKey, string> = {
    shell: '--studio-chrome',
    paper: '--studio-paper',
    paperAlt: '--studio-paper-alt',
    workbench: '--studio-workbench',
    surface: '--studio-surface',
    surfaceStrong: '--studio-surface-strong',
    line: '--studio-line',
    ink: '--studio-ink',
    muted: '--studio-muted',
    accent: '--studio-accent',
    appBg: '--studio-app-bg',
  };
  THEME_COLOR_KEYS.forEach((key) => {
    tokens[colorTokenMap[key]] = theme.colors[key];
  });
  tokens['--studio-shell-ink'] = getShellTextColor(theme.colors).color;
  tokens['--studio-accent-soft'] = `rgba(${red}, ${green}, ${blue}, 0.12)`;
  return tokens;
}

function applyTokens(element: HTMLElement, tokens: Record<string, string>, mode: ThemeMode, density: DensityMode, themeId?: string): void {
  Object.entries(tokens).forEach(([key, value]) => element.style.setProperty(key, value));
  element.dataset.theme = mode;
  element.dataset.density = density;
  if (themeId) element.dataset.themeId = themeId;
  else delete element.dataset.themeId;
  element.style.colorScheme = mode === 'dark' ? 'dark' : 'light';
}

export function applyThemeTokens(element: HTMLElement, mode: ThemeMode, density: DensityMode = 'standard', accentOverride?: string): void {
  const tokens = resolveThemeTokens(mode, density, accentOverride);
  applyTokens(element, tokens, mode, density);
}

export function applyCustomThemeTokens(element: HTMLElement, theme: CustomTheme, density: DensityMode = 'standard'): void {
  applyTokens(element, resolveCustomThemeTokens(theme, density), theme.baseMode, density, theme.id);
}
