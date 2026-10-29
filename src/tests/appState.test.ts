import { beforeEach, describe, expect, it } from 'vitest';
import { parseRouteHash } from '../services/navigationService';
import { usePreferencesStore } from '../store/preferencesStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { createCustomTheme } from '../theme/themeEngine';
import type { LabelProject, LabelTemplate } from '../types';

const template = (id: string): LabelTemplate => ({
  id,
  name: id,
  revision: 1,
  schema_version: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  width_mm: 80,
  height_mm: 40,
  inner_margins_mm: { top: 1, bottom: 1, left: 1, right: 1 },
  outer_margins_mm: { top: 0, bottom: 0, left: 0, right: 0 },
  bg_color: '#ffffff',
  bg_opacity: 1,
  items: [],
});

const project = (id: string, templates: LabelTemplate[]): LabelProject => ({
  id,
  name: id,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  templates,
  data_sources: [],
});

describe('application state', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      projects: [],
      templates: [],
      activeProject: null,
      activeTemplate: null,
      generationProducts: undefined,
      generationBatchName: undefined,
      productsCount: 0,
    });
    usePreferencesStore.setState({
      hydrated: false,
      tooltipSettings: { enabled: true, hoverDelayMs: 300, opacityPercent: 95, autoDismissSec: 6 },
      gridSnapSensitivityMm: 1,
      themeMode: 'light',
      customThemes: [],
      activeCustomThemeId: null,
      densityMode: 'standard',
      uiPreferences: usePreferencesStore.getState().uiPreferences,
      rulerSettings: usePreferencesStore.getState().rulerSettings,
      isPreferencesModalOpen: false,
    });
  });

  it('parses workspace routes and query parameters from a window hash', () => {
    expect(parseRouteHash('#/studio?template=promo-1&project=store')).toEqual({
      view: 'editor',
      params: { template: 'promo-1', project: 'store' },
      fullHash: '#/studio?template=promo-1&project=store',
    });
  });

  it('restores the last active project and template, falling back safely when unavailable', () => {
    const first = project('first', [template('first-template')]);
    const second = project('second', [template('second-template'), template('second-template-2')]);
    const store = useWorkspaceStore.getState();

    store.restoreSession([first, second], {
      activeProjectId: second.id,
      activeTemplateId: 'second-template-2',
    });

    expect(useWorkspaceStore.getState()).toMatchObject({
      activeProject: { id: 'second' },
      activeTemplate: { id: 'second-template-2' },
      templates: second.templates,
    });

    store.restoreSession([first, second], {
      activeProjectId: 'missing',
      activeTemplateId: 'missing',
    });

    expect(useWorkspaceStore.getState()).toMatchObject({
      activeProject: { id: 'first' },
      activeTemplate: { id: 'first-template' },
    });
  });

  it('accepts the advanced graphite theme preset for desktop styling', () => {
    const store = usePreferencesStore.getState();
    store.setThemeMode('graphite');

    expect(usePreferencesStore.getState().themeMode).toBe('graphite');
  });

  it('activates and removes a custom theme without losing its base mode', () => {
    const theme = createCustomTheme('Workshop', 'dark');
    usePreferencesStore.setState({ hydrated: true });
    const store = usePreferencesStore.getState();

    store.setCustomTheme(theme);
    expect(usePreferencesStore.getState()).toMatchObject({
      themeMode: 'dark',
      activeCustomThemeId: theme.id,
      customThemes: [theme],
    });

    usePreferencesStore.getState().removeCustomTheme(theme.id);
    expect(usePreferencesStore.getState()).toMatchObject({
      themeMode: 'dark',
      activeCustomThemeId: null,
      customThemes: [],
    });
  });

  it('rejects invalid numeric preference updates without changing state', () => {
    const store = usePreferencesStore.getState();
    store.setGridSnapSensitivityMm(0);
    store.setGridSnapSensitivityMm(Number.NaN);

    expect(usePreferencesStore.getState().gridSnapSensitivityMm).toBe(1);
  });
});
