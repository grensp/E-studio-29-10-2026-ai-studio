import { create } from 'zustand';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { LabelProject, LabelTemplate, ProductRecord } from '../types';
import { api, isTauriEnvironment } from '../services/api';

type StateUpdate<T> = T | ((previous: T) => T);

export interface WorkspaceSession {
  activeProjectId: string | null;
  activeTemplateId: string | null;
}

function sessionKey(): string {
  if (isTauriEnvironment()) {
    try {
      const label = getCurrentWindow().label;
      return `estudio_workspace_session_v1:${label}`;
    } catch {
      return 'estudio_workspace_session_v1:desktop';
    }
  }
  try {
    let tabId = window.sessionStorage.getItem('estudio_workspace_tab_id');
    if (!tabId) {
      tabId = crypto.randomUUID();
      window.sessionStorage.setItem('estudio_workspace_tab_id', tabId);
    }
    return `estudio_workspace_session_v1:${tabId}`;
  } catch {
    return 'estudio_workspace_session_v1:browser';
  }
}

export async function loadWorkspaceSession(): Promise<WorkspaceSession | null> {
  try {
    const serialized = await api.prefsGet(sessionKey());
    if (!serialized) return null;
    const value: unknown = JSON.parse(serialized);
    if (!value || typeof value !== 'object') return null;
    const session = value as Partial<WorkspaceSession>;
    return {
      activeProjectId: typeof session.activeProjectId === 'string' ? session.activeProjectId : null,
      activeTemplateId: typeof session.activeTemplateId === 'string' ? session.activeTemplateId : null,
    };
  } catch (error) {
    console.warn('Unable to restore the workspace session', error);
    return null;
  }
}

let sessionWriteQueue: Promise<void> = Promise.resolve();

function persistWorkspaceSession(session: WorkspaceSession): Promise<void> {
  const key = sessionKey();
  const serialized = JSON.stringify(session);
  sessionWriteQueue = sessionWriteQueue
    .catch(() => undefined)
    .then(() => api.prefsSet(key, serialized))
    .catch((error) => console.warn('Unable to save the workspace session', error));
  return sessionWriteQueue;
}

interface WorkspaceState {
  projects: LabelProject[];
  templates: LabelTemplate[];
  activeProject: LabelProject | null;
  activeTemplate: LabelTemplate | null;
  generationProducts: ProductRecord[] | undefined;
  generationBatchName: string | undefined;
  productsCount: number;
  setProjects: (value: StateUpdate<LabelProject[]>) => void;
  setTemplates: (value: StateUpdate<LabelTemplate[]>) => void;
  setActiveProject: (value: StateUpdate<LabelProject | null>) => void;
  setActiveTemplate: (value: StateUpdate<LabelTemplate | null>) => void;
  setGenerationProducts: (value: ProductRecord[] | undefined) => void;
  setGenerationBatchName: (value: string | undefined) => void;
  setProductsCount: (value: number) => void;
  restoreSession: (projects: LabelProject[], session: WorkspaceSession | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  projects: [],
  templates: [],
  activeProject: null,
  activeTemplate: null,
  generationProducts: undefined,
  generationBatchName: undefined,
  productsCount: 0,
  setProjects: (value) => set((state) => ({
    projects: typeof value === 'function' ? value(state.projects) : value,
  })),
  setTemplates: (value) => set((state) => ({
    templates: typeof value === 'function' ? value(state.templates) : value,
  })),
  setActiveProject: (value) => {
    const activeProject = typeof value === 'function' ? value(get().activeProject) : value;
    set({ activeProject });
    void persistWorkspaceSession({
      activeProjectId: activeProject?.id ?? null,
      activeTemplateId: get().activeTemplate?.id ?? null,
    });
  },
  setActiveTemplate: (value) => {
    const activeTemplate = typeof value === 'function' ? value(get().activeTemplate) : value;
    set({ activeTemplate });
    void persistWorkspaceSession({
      activeProjectId: get().activeProject?.id ?? null,
      activeTemplateId: activeTemplate?.id ?? null,
    });
  },
  setGenerationProducts: (generationProducts) => set({ generationProducts }),
  setGenerationBatchName: (generationBatchName) => set({ generationBatchName }),
  setProductsCount: (productsCount) => set({ productsCount }),
  restoreSession: (projects, session) => {
    const activeProject = projects.find((project) => project.id === session?.activeProjectId) ?? projects[0] ?? null;
    const templates = activeProject?.templates ?? [];
    const activeTemplate = templates.find((template) => template.id === session?.activeTemplateId) ?? templates[0] ?? null;
    set({ projects, activeProject, templates, activeTemplate });
    void persistWorkspaceSession({
      activeProjectId: activeProject?.id ?? null,
      activeTemplateId: activeTemplate?.id ?? null,
    });
  },
}));