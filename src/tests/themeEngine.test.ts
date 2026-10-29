import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { getContrastRatio } from '../utils/colorContrastEngine';
import {
  applyCustomThemeTokens,
  applyThemeTokens,
  createCustomTheme,
  getCustomThemeContrastWarnings,
  DENSITY_PRESETS,
  resolveThemeTokens,
  resolveCustomThemeTokens,
  resolveSemanticTokens,
  resolveAllThemeTokens,
  parseCustomThemeJson,
  serializeCustomTheme,
  THEME_PRESETS,
  THEME_DEFINITIONS,
  type DensityMode,
  type ThemeMode,
} from '../theme/themeEngine';

describe('theme engine', () => {
  it('keeps the CSS pre-hydration fallback aligned with the graphite theme preset', () => {
    const css = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8');
    const root = css.match(/:root\s*\{([^}]*)\}/)?.[1];
    expect(root).toBeDefined();
    const fallbackTokens = Object.fromEntries(
      [...root!.matchAll(/(--studio-[\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value?.trim()]),
    );

    expect(fallbackTokens).toMatchObject(resolveThemeTokens('graphite'));
  });

  it('resolves the semantic colors for every theme preset', () => {
    (Object.keys(THEME_PRESETS) as ThemeMode[]).forEach((mode) => {
      const tokens = resolveThemeTokens(mode);
      const preset = THEME_PRESETS[mode];

      expect(tokens).toMatchObject({
        '--studio-chrome': preset.shell,
        '--studio-paper': preset.paper,
        '--studio-workbench': preset.workbench,
        '--studio-ink': preset.ink,
        '--studio-accent': preset.accent,
      });
      expect(getContrastRatio(tokens['--studio-shell-ink']!, preset.shell)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('resolves spacing and control sizes for every density preset', () => {
    (Object.keys(DENSITY_PRESETS) as DensityMode[]).forEach((density) => {
      const tokens = resolveThemeTokens('graphite', density);
      const preset = DENSITY_PRESETS[density];

      expect(tokens).toMatchObject({
        '--studio-spacing': preset.spacing,
        '--studio-panel-padding': preset.panelPadding,
        '--studio-input-height': preset.inputHeight,
        '--studio-font-scale': String(preset.fontScale),
      });
    });
  });

  it('resolves the full multi-layered semantic tokens for professional palettes', () => {
    // 1. Graphite Studio
    const graphiteSemantic = resolveSemanticTokens('graphite');
    expect(graphiteSemantic).toMatchObject({
      '--surface-app': '#111318',
      '--surface-panel': '#191C23',
      '--surface-raised': '#232833',
      '--border-default': '#343B49',
      '--content-primary': '#F0F3F8',
      '--action-primary-bg': '#6EA8FE',
      '--focus-ring': '#9CC2FF',
      '--canvas-pasteboard': '#282D37',
      '--canvas-page': '#FFFFFF',
    });

    // 2. Precision Light
    const precisionLightSemantic = resolveSemanticTokens('precision-light');
    expect(precisionLightSemantic).toMatchObject({
      '--surface-app': '#F5F6F8',
      '--surface-panel': '#FFFFFF',
      '--surface-raised': '#EDF0F4',
      '--border-default': '#D5DAE2',
      '--content-primary': '#202631',
      '--action-primary-bg': '#245FD6',
      '--focus-ring': '#245FD6',
    });

    // 3. Midnight Teal
    const midnightTealSemantic = resolveSemanticTokens('midnight-teal');
    expect(midnightTealSemantic).toMatchObject({
      '--surface-app': '#101719',
      '--surface-panel': '#182225',
      '--action-primary-bg': '#5CC8B0',
    });

    // 4. Engineering Blue
    const engineeringBlueSemantic = resolveSemanticTokens('engineering-blue');
    expect(engineeringBlueSemantic).toMatchObject({
      '--surface-app': '#151A22',
      '--surface-panel': '#1D2531',
      '--action-primary-bg': '#65A8FF',
    });
  });

  it('keeps canvas and artwork colors independent of the UI theme', () => {
    const modes: ThemeMode[] = ['graphite', 'precision-light', 'midnight-teal', 'engineering-blue', 'eink_high_contrast'];
    modes.forEach((mode) => {
      const semantic = resolveSemanticTokens(mode);
      expect(semantic['--canvas-page']).toBe('#FFFFFF');
    });
  });

  it('applies E Ink as a light browser color scheme with the selected density', () => {
    const setProperty = vi.fn();
    const element = {
      style: { setProperty, colorScheme: '' },
      dataset: {} as Record<string, string>,
    } as unknown as HTMLElement;

    applyThemeTokens(element, 'eink_high_contrast', 'compact');

    expect(element.dataset).toMatchObject({ theme: 'eink_high_contrast', density: 'compact' });
    expect(element.style.colorScheme).toBe('light');
    expect(setProperty).toHaveBeenCalledWith('--studio-input-height', '30px');
  });

  it('round-trips a custom theme through the versioned JSON format', () => {
    const theme = createCustomTheme('Workshop', 'dark');
    theme.colors.accent = '#c65038';

    expect(parseCustomThemeJson(serializeCustomTheme(theme))).toEqual(theme);
    expect(resolveCustomThemeTokens(theme, 'comfortable')).toMatchObject({
      '--studio-accent': '#c65038',
      '--studio-input-height': '38px',
      '--studio-paper': theme.colors.paper,
    });
  });

  it('rejects malformed or unsafe custom theme colors', () => {
    const theme = createCustomTheme('Invalid');
    theme.colors.paper = 'url(javascript:alert(1))';

    expect(() => parseCustomThemeJson(JSON.stringify(theme))).toThrow(/version 1/);
  });

  it('rejects oversized theme JSON before parsing', () => {
    expect(() => parseCustomThemeJson(' '.repeat(65537))).toThrow(/smaller than 64 KB/);
  });

  it('warns when custom theme text colors miss WCAG AA contrast', () => {
    const theme = createCustomTheme('Low contrast');
    theme.colors.paper = '#f2f2ee';
    theme.colors.surface = '#f2f2ee';
    theme.colors.workbench = '#f2f2ee';
    theme.colors.appBg = '#f2f2ee';
    theme.colors.ink = '#f2f2ee';
    theme.colors.muted = '#f2f2ee';

    expect(getCustomThemeContrastWarnings(theme)).toContainEqual({
      foreground: 'ink',
      background: 'paper',
      ratio: 1,
    });
  });

  it('uses a readable foreground for the dark theme shell', () => {
    const tokens = resolveThemeTokens('dark');
    expect(tokens['--studio-shell-ink']).toBe(THEME_PRESETS.dark.ink);
    expect(getContrastRatio(tokens['--studio-shell-ink']!, THEME_PRESETS.dark.shell)).toBeGreaterThanOrEqual(4.5);
  });

  it('applies custom tokens while retaining the base mode and theme identity', () => {
    const theme = createCustomTheme('Custom graphite', 'graphite');
    const element = {
      style: { setProperty: vi.fn(), colorScheme: '' },
      dataset: {} as Record<string, string>,
    } as unknown as HTMLElement;

    applyCustomThemeTokens(element, theme, 'compact');

    expect(element.dataset).toMatchObject({ theme: 'graphite', themeId: theme.id, density: 'compact' });
    expect(element.style.colorScheme).toBe('dark');
  });
});