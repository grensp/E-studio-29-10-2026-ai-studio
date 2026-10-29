import { getContrastRatio } from '../utils/colorContrastEngine';

export type ThemeId =
  | 'graphite'
  | 'precision-light'
  | 'midnight-teal'
  | 'engineering-blue'
  | 'light'
  | 'dark'
  | 'eink_high_contrast';

export type ThemeMode = ThemeId;
export type DensityMode = 'compact' | 'standard' | 'comfortable';

export interface SemanticColorTokens {
  surface: {
    app: string;
    panel: string;
    raised: string;
    hover: string;
    input: string;
  };
  content: {
    primary: string;
    secondary: string;
    muted: string;
    disabled: string;
  };
  border: {
    subtle: string;
    default: string;
    strong: string;
  };
  action: {
    primary: string;
    primaryHover: string;
    primaryPressed: string;
    primaryForeground: string;
  };
  state: {
    focus: string;
    selection: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  canvas: {
    pasteboard: string;
    page: string;
    gridMinor: string;
    gridMajor: string;
  };
  overlay: {
    selectionStroke: string;
    selectionHandleFill: string;
    selectionHandleStroke: string;
    guideAlignment: string;
    guideSnap: string;
    printBleed: string;
    printTrim: string;
    printSafeArea: string;
  };
  viz: {
    series1: string;
    series2: string;
    series3: string;
    series4: string;
    series5: string;
    series6: string;
  };
}

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  description: string;
  colorScheme: 'light' | 'dark';
  semantic: SemanticColorTokens;
}

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
  colorScheme: 'light' | 'dark';
}

export type ThemeColorKey =
  | 'shell'
  | 'paper'
  | 'paperAlt'
  | 'workbench'
  | 'surface'
  | 'surfaceStrong'
  | 'line'
  | 'ink'
  | 'muted'
  | 'accent'
  | 'appBg';

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

export const THEME_DEFINITIONS: Record<ThemeId, ThemeDefinition> = {
  // A. Graphite Studio — Primary Dark Theme (Recommended Default)
  graphite: {
    id: 'graphite',
    label: 'Graphite Studio',
    description: 'Primary dark studio palette for creative editing and long sessions',
    colorScheme: 'dark',
    semantic: {
      surface: {
        app: '#111318',
        panel: '#191C23',
        raised: '#232833',
        hover: '#2B3444',
        input: '#111318',
      },
      content: {
        primary: '#F0F3F8',
        secondary: '#AAB3C2',
        muted: '#8C96A6',
        disabled: '#737D8C',
      },
      border: {
        subtle: '#2B3039',
        default: '#343B49',
        strong: '#596578',
      },
      action: {
        primary: '#6EA8FE',
        primaryHover: '#8BB9FF',
        primaryPressed: '#4D8DEB',
        primaryForeground: '#111827',
      },
      state: {
        focus: '#9CC2FF',
        selection: '#78A9FF',
        success: '#4ADE80',
        warning: '#FBBF24',
        error: '#F87171',
        info: '#7DB7FF',
      },
      canvas: {
        pasteboard: '#282D37',
        page: '#FFFFFF',
        gridMinor: '#687385',
        gridMajor: '#8792A5',
      },
      overlay: {
        selectionStroke: '#78A9FF',
        selectionHandleFill: '#FFFFFF',
        selectionHandleStroke: '#245FD6',
        guideAlignment: '#FF7A59',
        guideSnap: '#36CFC9',
        printBleed: '#D946EF',
        printTrim: '#F97316',
        printSafeArea: '#22C55E',
      },
      viz: {
        series1: '#6EA8FE',
        series2: '#36CFC9',
        series3: '#C4A7FF',
        series4: '#FFB454',
        series5: '#F08CA8',
        series6: '#8ED081',
      },
    },
  },

  // B. Precision Light — Professional Light Theme
  'precision-light': {
    id: 'precision-light',
    label: 'Precision Light',
    description: 'High-clarity light theme for print preparation, spreadsheets and daylight environments',
    colorScheme: 'light',
    semantic: {
      surface: {
        app: '#F5F6F8',
        panel: '#FFFFFF',
        raised: '#EDF0F4',
        hover: '#E6ECF7',
        input: '#FFFFFF',
      },
      content: {
        primary: '#202631',
        secondary: '#505A69',
        muted: '#626D7D',
        disabled: '#767F8C',
      },
      border: {
        subtle: '#E4E7ED',
        default: '#D5DAE2',
        strong: '#AEB7C5',
      },
      action: {
        primary: '#245FD6',
        primaryHover: '#1E4FB8',
        primaryPressed: '#183F96',
        primaryForeground: '#FFFFFF',
      },
      state: {
        focus: '#245FD6',
        selection: '#BBD4FF',
        success: '#16733A',
        warning: '#8A5300',
        error: '#B4232F',
        info: '#245FD6',
      },
      canvas: {
        pasteboard: '#E6E9EF',
        page: '#FFFFFF',
        gridMinor: '#CBD2DD',
        gridMajor: '#AEB8C8',
      },
      overlay: {
        selectionStroke: '#245FD6',
        selectionHandleFill: '#FFFFFF',
        selectionHandleStroke: '#1748A5',
        guideAlignment: '#C24124',
        guideSnap: '#087F8C',
        printBleed: '#A21CAF',
        printTrim: '#C2410C',
        printSafeArea: '#16733A',
      },
      viz: {
        series1: '#245FD6',
        series2: '#087F8C',
        series3: '#7C3AED',
        series4: '#D97706',
        series5: '#DB2777',
        series6: '#16A34A',
      },
    },
  },

  // C. Midnight Teal — Restrained Premium Theme
  'midnight-teal': {
    id: 'midnight-teal',
    label: 'Midnight Teal',
    description: 'Restrained premium creative atmosphere where artwork dominates',
    colorScheme: 'dark',
    semantic: {
      surface: {
        app: '#101719',
        panel: '#182225',
        raised: '#223034',
        hover: '#263B3B',
        input: '#101719',
      },
      content: {
        primary: '#E8F0EF',
        secondary: '#A2B5B3',
        muted: '#7E9391',
        disabled: '#556866',
      },
      border: {
        subtle: '#253438',
        default: '#394A4E',
        strong: '#526A70',
      },
      action: {
        primary: '#5CC8B0',
        primaryHover: '#72D9C2',
        primaryPressed: '#47AC96',
        primaryForeground: '#0A1C1A',
      },
      state: {
        focus: '#8BE3D0',
        selection: '#316F69',
        success: '#34D399',
        warning: '#FBBF24',
        error: '#F87171',
        info: '#5CC8B0',
      },
      canvas: {
        pasteboard: '#1F292B',
        page: '#FFFFFF',
        gridMinor: '#485C60',
        gridMajor: '#647E84',
      },
      overlay: {
        selectionStroke: '#5CC8B0',
        selectionHandleFill: '#FFFFFF',
        selectionHandleStroke: '#1B524A',
        guideAlignment: '#FF7A59',
        guideSnap: '#36CFC9',
        printBleed: '#D946EF',
        printTrim: '#F97316',
        printSafeArea: '#10B981',
      },
      viz: {
        series1: '#5CC8B0',
        series2: '#38BDF8',
        series3: '#A78BFA',
        series4: '#FBBF24',
        series5: '#FB7185',
        series6: '#4ADE80',
      },
    },
  },

  // D. Engineering Blue — Technical Workspace
  'engineering-blue': {
    id: 'engineering-blue',
    label: 'Engineering Blue',
    description: 'Technical CAD-like workspace for measurement, barcode configuration and print diagnostics',
    colorScheme: 'dark',
    semantic: {
      surface: {
        app: '#151A22',
        panel: '#1D2531',
        raised: '#293444',
        hover: '#2B3A50',
        input: '#151A22',
      },
      content: {
        primary: '#E8EDF5',
        secondary: '#A4B3C6',
        muted: '#7C8DA3',
        disabled: '#5A6A80',
      },
      border: {
        subtle: '#263242',
        default: '#3D4A5D',
        strong: '#5A6B82',
      },
      action: {
        primary: '#65A8FF',
        primaryHover: '#87BCFF',
        primaryPressed: '#478EE8',
        primaryForeground: '#0B1626',
      },
      state: {
        focus: '#91C1FF',
        selection: '#305D91',
        success: '#38BDF8',
        warning: '#FBBF24',
        error: '#F87171',
        info: '#65A8FF',
      },
      canvas: {
        pasteboard: '#222B38',
        page: '#FFFFFF',
        gridMinor: '#47576E',
        gridMajor: '#6B7F9E',
      },
      overlay: {
        selectionStroke: '#65A8FF',
        selectionHandleFill: '#FFFFFF',
        selectionHandleStroke: '#1E4E8C',
        guideAlignment: '#FF7A59',
        guideSnap: '#38BDF8',
        printBleed: '#D946EF',
        printTrim: '#F97316',
        printSafeArea: '#34D399',
      },
      viz: {
        series1: '#65A8FF',
        series2: '#38BDF8',
        series3: '#818CF8',
        series4: '#FCD34D',
        series5: '#F472B6',
        series6: '#4ADE80',
      },
    },
  },

  // Light Mode mapping
  light: {
    id: 'light',
    label: 'Precision Light',
    description: 'Clean workshop palette with high-contrast surfaces',
    colorScheme: 'light',
    semantic: {
      surface: {
        app: '#F5F6F8',
        panel: '#FFFFFF',
        raised: '#EDF0F4',
        hover: '#E6ECF7',
        input: '#FFFFFF',
      },
      content: {
        primary: '#202631',
        secondary: '#505A69',
        muted: '#626D7D',
        disabled: '#767F8C',
      },
      border: {
        subtle: '#E4E7ED',
        default: '#D5DAE2',
        strong: '#AEB7C5',
      },
      action: {
        primary: '#245FD6',
        primaryHover: '#1E4FB8',
        primaryPressed: '#183F96',
        primaryForeground: '#FFFFFF',
      },
      state: {
        focus: '#245FD6',
        selection: '#BBD4FF',
        success: '#16733A',
        warning: '#8A5300',
        error: '#B4232F',
        info: '#245FD6',
      },
      canvas: {
        pasteboard: '#E6E9EF',
        page: '#FFFFFF',
        gridMinor: '#CBD2DD',
        gridMajor: '#AEB8C8',
      },
      overlay: {
        selectionStroke: '#245FD6',
        selectionHandleFill: '#FFFFFF',
        selectionHandleStroke: '#1748A5',
        guideAlignment: '#C24124',
        guideSnap: '#087F8C',
        printBleed: '#A21CAF',
        printTrim: '#C2410C',
        printSafeArea: '#16733A',
      },
      viz: {
        series1: '#245FD6',
        series2: '#087F8C',
        series3: '#7C3AED',
        series4: '#D97706',
        series5: '#DB2777',
        series6: '#16A34A',
      },
    },
  },

  // Dark Engineering Mode mapping
  dark: {
    id: 'dark',
    label: 'Dark Engineering',
    description: 'High contrast engineering dark mode',
    colorScheme: 'dark',
    semantic: {
      surface: {
        app: '#0B1220',
        panel: '#111C2D',
        raised: '#1A2A3D',
        hover: '#172236',
        input: '#0F172A',
      },
      content: {
        primary: '#E2E8F0',
        secondary: '#CBD5E1',
        muted: '#9AA9B8',
        disabled: '#64748B',
      },
      border: {
        subtle: '#1E293B',
        default: '#2D3C52',
        strong: '#475569',
      },
      action: {
        primary: '#5EA5FF',
        primaryHover: '#82B7FF',
        primaryPressed: '#3B82F6',
        primaryForeground: '#0B1220',
      },
      state: {
        focus: '#60A5FA',
        selection: '#2563EB',
        success: '#4ADE80',
        warning: '#FBBF24',
        error: '#F87171',
        info: '#5EA5FF',
      },
      canvas: {
        pasteboard: '#172236',
        page: '#FFFFFF',
        gridMinor: '#334155',
        gridMajor: '#475569',
      },
      overlay: {
        selectionStroke: '#5EA5FF',
        selectionHandleFill: '#FFFFFF',
        selectionHandleStroke: '#2563EB',
        guideAlignment: '#FF7A59',
        guideSnap: '#38BDF8',
        printBleed: '#D946EF',
        printTrim: '#F97316',
        printSafeArea: '#22C55E',
      },
      viz: {
        series1: '#5EA5FF',
        series2: '#38BDF8',
        series3: '#A78BFA',
        series4: '#FCD34D',
        series5: '#F472B6',
        series6: '#4ADE80',
      },
    },
  },

  // E Ink High Contrast Mode
  eink_high_contrast: {
    id: 'eink_high_contrast',
    label: 'E Ink',
    description: 'Maximum clarity monochrome print review',
    colorScheme: 'light',
    semantic: {
      surface: {
        app: '#FFFFFF',
        panel: '#FFFFFF',
        raised: '#FFFFFF',
        hover: '#F0F0F0',
        input: '#FFFFFF',
      },
      content: {
        primary: '#000000',
        secondary: '#000000',
        muted: '#000000',
        disabled: '#444444',
      },
      border: {
        subtle: '#000000',
        default: '#000000',
        strong: '#000000',
      },
      action: {
        primary: '#000000',
        primaryHover: '#333333',
        primaryPressed: '#111111',
        primaryForeground: '#FFFFFF',
      },
      state: {
        focus: '#000000',
        selection: '#000000',
        success: '#000000',
        warning: '#000000',
        error: '#000000',
        info: '#000000',
      },
      canvas: {
        pasteboard: '#FFFFFF',
        page: '#FFFFFF',
        gridMinor: '#CCCCCC',
        gridMajor: '#999999',
      },
      overlay: {
        selectionStroke: '#000000',
        selectionHandleFill: '#FFFFFF',
        selectionHandleStroke: '#000000',
        guideAlignment: '#000000',
        guideSnap: '#000000',
        printBleed: '#000000',
        printTrim: '#000000',
        printSafeArea: '#000000',
      },
      viz: {
        series1: '#000000',
        series2: '#333333',
        series3: '#666666',
        series4: '#888888',
        series5: '#AAAAAA',
        series6: '#CCCCCC',
      },
    },
  },
};

export const THEME_PRESETS: Record<ThemeMode, ThemePreset> = {
  graphite: {
    id: 'graphite',
    label: 'Graphite Studio',
    description: 'Primary dark studio palette for creative editing',
    shell: '#111318',
    paper: '#191c23',
    paperAlt: '#1d212a',
    workbench: '#282d37',
    surface: '#191c23',
    surfaceStrong: '#232833',
    line: '#343b49',
    ink: '#f0f3f8',
    muted: '#aab3c2',
    accent: '#6ea8fe',
    appBg: '#111318',
    accentSoft: 'rgba(110, 168, 254, 0.14)',
    colorScheme: 'dark',
  },
  'precision-light': {
    id: 'precision-light',
    label: 'Precision Light',
    description: 'High-clarity light theme for print and inspection',
    shell: '#f5f6f8',
    paper: '#ffffff',
    paperAlt: '#edf0f4',
    workbench: '#e6e9ef',
    surface: '#ffffff',
    surfaceStrong: '#edf0f4',
    line: '#d5dae2',
    ink: '#202631',
    muted: '#505a69',
    accent: '#245fd6',
    appBg: '#f5f6f8',
    accentSoft: 'rgba(36, 95, 214, 0.12)',
    colorScheme: 'light',
  },
  'midnight-teal': {
    id: 'midnight-teal',
    label: 'Midnight Teal',
    description: 'Restrained premium creative atmosphere',
    shell: '#101719',
    paper: '#182225',
    paperAlt: '#1c282c',
    workbench: '#1f292b',
    surface: '#182225',
    surfaceStrong: '#223034',
    line: '#394a4e',
    ink: '#e8f0ef',
    muted: '#a2b5b3',
    accent: '#5cc8b0',
    appBg: '#101719',
    accentSoft: 'rgba(92, 200, 176, 0.14)',
    colorScheme: 'dark',
  },
  'engineering-blue': {
    id: 'engineering-blue',
    label: 'Engineering Blue',
    description: 'Technical CAD-like workspace for measurement and barcode accuracy',
    shell: '#151a22',
    paper: '#1d2531',
    paperAlt: '#232d3b',
    workbench: '#222b38',
    surface: '#1d2531',
    surfaceStrong: '#293444',
    line: '#3d4a5d',
    ink: '#e8edf5',
    muted: '#a4b3c6',
    accent: '#65a8ff',
    appBg: '#151a22',
    accentSoft: 'rgba(101, 168, 255, 0.14)',
    colorScheme: 'dark',
  },
  light: {
    id: 'light',
    label: 'Precision Light',
    description: 'Clean workshop palette',
    shell: '#f5f6f8',
    paper: '#ffffff',
    paperAlt: '#edf0f4',
    workbench: '#e6e9ef',
    surface: '#ffffff',
    surfaceStrong: '#edf0f4',
    line: '#d5dae2',
    ink: '#202631',
    muted: '#505a69',
    accent: '#245fd6',
    appBg: '#f5f6f8',
    accentSoft: 'rgba(36, 95, 214, 0.12)',
    colorScheme: 'light',
  },
  dark: {
    id: 'dark',
    label: 'Dark Engineering',
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
    colorScheme: 'dark',
  },
  eink_high_contrast: {
    id: 'eink_high_contrast',
    label: 'E Ink',
    description: 'Maximum clarity monochrome print review',
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
    colorScheme: 'light',
  },
};

export const DENSITY_PRESETS: Record<
  DensityMode,
  {
    radiusSm: string;
    radiusMd: string;
    radiusLg: string;
    spacing: string;
    panelPadding: string;
    inputHeight: string;
    fontScale: number;
  }
> = {
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
  return (
    value === 'graphite' ||
    value === 'precision-light' ||
    value === 'midnight-teal' ||
    value === 'engineering-blue' ||
    value === 'light' ||
    value === 'dark' ||
    value === 'eink_high_contrast'
  );
}

export function validDensity(value: unknown): value is DensityMode {
  return value === 'compact' || value === 'standard' || value === 'comfortable';
}

const THEME_COLOR_KEYS: ThemeColorKey[] = [
  'shell',
  'paper',
  'paperAlt',
  'workbench',
  'surface',
  'surfaceStrong',
  'line',
  'ink',
  'muted',
  'accent',
  'appBg',
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
    typeof theme.id !== 'string' ||
    !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(theme.id) ||
    typeof theme.name !== 'string' ||
    theme.name.trim().length < 1 ||
    theme.name.length > 60 ||
    typeof theme.description !== 'string' ||
    theme.description.length > 160 ||
    !validThemeMode(theme.baseMode) ||
    !theme.colors ||
    typeof theme.colors !== 'object' ||
    Array.isArray(theme.colors)
  )
    return false;

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
  return paperRatio >= inkRatio ? { key: 'paper', color: colors.paper } : { key: 'ink', color: colors.ink };
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
    throw new Error(
      'Theme file must use e-studio-theme version 1 with a name, base mode, and 11 six-digit hex colors.',
    );
  }
  return parsed;
}

export function serializeCustomTheme(theme: CustomTheme): string {
  if (!validateCustomTheme(theme)) throw new Error('Cannot export an invalid theme.');
  return `${JSON.stringify(theme, null, 2)}\n`;
}

export function createCustomTheme(name: string, baseMode: ThemeMode = 'graphite'): CustomTheme {
  const normalizedName = name.trim().slice(0, 60) || 'My Theme';
  const id = `custom-${
    normalizedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'theme'
  }`;
  const preset = THEME_PRESETS[baseMode] || THEME_PRESETS.graphite;
  const colors = Object.fromEntries(THEME_COLOR_KEYS.map((key) => [key, preset[key]])) as ThemeColors;
  return {
    format: 'e-studio-theme',
    version: 1,
    id,
    name: normalizedName,
    description: 'User-created custom studio theme',
    baseMode,
    colors,
  };
}

export function resolveSemanticTokens(
  mode: ThemeMode,
  accentOverride?: string,
): Record<string, string> {
  const def = THEME_DEFINITIONS[mode] || THEME_DEFINITIONS.graphite;
  const s = def.semantic;
  const actionPrimary = accentOverride || s.action.primary;

  return {
    '--surface-app': s.surface.app,
    '--surface-panel': s.surface.panel,
    '--surface-raised': s.surface.raised,
    '--surface-hover': s.surface.hover,
    '--surface-input': s.surface.input,

    '--content-primary': s.content.primary,
    '--content-secondary': s.content.secondary,
    '--content-muted': s.content.muted,
    '--content-disabled': s.content.disabled,

    '--border-subtle': s.border.subtle,
    '--border-default': s.border.default,
    '--border-strong': s.border.strong,

    '--action-primary-bg': actionPrimary,
    '--action-primary-hover': s.action.primaryHover,
    '--action-primary-pressed': s.action.primaryPressed,
    '--action-primary-fg': s.action.primaryForeground,
    '--focus-ring': s.state.focus,

    '--status-success': s.state.success,
    '--status-warning': s.state.warning,
    '--status-error': s.state.error,
    '--status-info': s.state.info,

    '--canvas-pasteboard': s.canvas.pasteboard,
    '--canvas-page': s.canvas.page,
    '--canvas-page-border': s.border.default,
    '--canvas-grid-minor': s.canvas.gridMinor,
    '--canvas-grid-major': s.canvas.gridMajor,

    '--selection-stroke': s.overlay.selectionStroke,
    '--selection-handle-fill': s.overlay.selectionHandleFill,
    '--selection-handle-stroke': s.overlay.selectionHandleStroke,
    '--guide-alignment': s.overlay.guideAlignment,
    '--guide-snap': s.overlay.guideSnap,

    '--print-bleed': s.overlay.printBleed,
    '--print-trim': s.overlay.printTrim,
    '--print-safe-area': s.overlay.printSafeArea,

    '--viz-series-1': s.viz.series1,
    '--viz-series-2': s.viz.series2,
    '--viz-series-3': s.viz.series3,
    '--viz-series-4': s.viz.series4,
    '--viz-series-5': s.viz.series5,
    '--viz-series-6': s.viz.series6,

    // Aliases to bridge desktop-canvas tokens
    '--app-bg': s.surface.app,
    '--surface-1': s.surface.panel,
    '--surface-2': s.surface.raised,
    '--surface-3': s.surface.hover,
    '--surface-inset': s.surface.input,
    '--text-primary': s.content.primary,
    '--text-secondary': s.content.secondary,
    '--text-muted': s.content.muted,
    '--border': s.border.default,
    '--accent': actionPrimary,
    '--selection': s.state.selection,
  };
}

export function resolveThemeTokens(
  mode: ThemeMode,
  density: DensityMode = 'standard',
  accentOverride?: string,
): Record<string, string> {
  const preset = THEME_PRESETS[mode] || THEME_PRESETS.graphite;
  const accent = accentOverride || preset.accent;
  const densityScale = DENSITY_PRESETS[density] || DENSITY_PRESETS.standard;
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

export function resolveCustomThemeTokens(
  theme: CustomTheme,
  density: DensityMode = 'standard',
): Record<string, string> {
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

export function resolveCustomSemanticTokens(theme: CustomTheme): Record<string, string> {
  if (!validateCustomTheme(theme)) throw new Error('Cannot resolve an invalid theme.');
  const baseSemantic = resolveSemanticTokens(theme.baseMode, theme.colors.accent);

  return {
    ...baseSemantic,
    '--surface-app': theme.colors.appBg,
    '--surface-panel': theme.colors.paper,
    '--surface-raised': theme.colors.surfaceStrong,
    '--surface-hover': theme.colors.workbench,
    '--surface-input': theme.colors.paperAlt,
    '--content-primary': theme.colors.ink,
    '--content-secondary': theme.colors.muted,
    '--border-subtle': theme.colors.line,
    '--border-default': theme.colors.line,
    '--action-primary-bg': theme.colors.accent,
    '--canvas-pasteboard': theme.colors.workbench,
    '--app-bg': theme.colors.appBg,
    '--surface-1': theme.colors.paper,
    '--surface-2': theme.colors.surface,
    '--surface-3': theme.colors.surfaceStrong,
    '--text-primary': theme.colors.ink,
    '--text-secondary': theme.colors.muted,
    '--border': theme.colors.line,
    '--accent': theme.colors.accent,
  };
}

export function resolveAllThemeTokens(
  mode: ThemeMode,
  density: DensityMode = 'standard',
  accentOverride?: string,
): Record<string, string> {
  const studioTokens = resolveThemeTokens(mode, density, accentOverride);
  const semanticTokens = resolveSemanticTokens(mode, accentOverride);
  return { ...studioTokens, ...semanticTokens };
}

function applyTokens(
  element: HTMLElement,
  tokens: Record<string, string>,
  mode: ThemeMode,
  density: DensityMode,
  themeId?: string,
): void {
  Object.entries(tokens).forEach(([key, value]) => element.style.setProperty(key, value));
  element.dataset.theme = mode;
  element.dataset.density = density;
  if (themeId) element.dataset.themeId = themeId;
  else delete element.dataset.themeId;

  const preset = THEME_PRESETS[mode] || THEME_PRESETS.graphite;
  element.style.colorScheme = preset.colorScheme;
}

export function applyThemeTokens(
  element: HTMLElement,
  mode: ThemeMode,
  density: DensityMode = 'standard',
  accentOverride?: string,
): void {
  const allTokens = resolveAllThemeTokens(mode, density, accentOverride);
  applyTokens(element, allTokens, mode, density);
}

export function applyCustomThemeTokens(
  element: HTMLElement,
  theme: CustomTheme,
  density: DensityMode = 'standard',
): void {
  const studioTokens = resolveCustomThemeTokens(theme, density);
  const semanticTokens = resolveCustomSemanticTokens(theme);
  const allTokens = { ...studioTokens, ...semanticTokens };
  applyTokens(element, allTokens, theme.baseMode, density, theme.id);
}
