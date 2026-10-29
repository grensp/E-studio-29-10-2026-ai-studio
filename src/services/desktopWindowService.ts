import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { AppView, ProductRecord } from '../types';
import { api, isTauriEnvironment } from './api';

export interface DetachedWorkspaceContext {
  generationProducts?: ProductRecord[];
  generationBatchName?: string;
}

export function supportsDetachedWorkspaces(): boolean {
  return isTauriEnvironment();
}

export async function setWorkspaceWindowTitle(
  view: AppView,
  projectName?: string,
  templateName?: string,
): Promise<void> {
  if (!supportsDetachedWorkspaces()) return;
  const viewName: Record<AppView, string> = {
    start: 'Projects',
    home: 'Templates',
    editor: 'Template Editor',
    generation: 'Production',
    catalog: 'Product Catalog',
  };
  const workspaceName = view === 'editor' && templateName ? templateName : viewName[view];
  const context = [projectName, workspaceName].filter(Boolean).join(' - ');
  await getCurrentWindow().setTitle(context ? `E-Studio - ${context}` : 'E-Studio');
}

function routeHash(view: AppView, params: Record<string, string>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return `#/${view}${query ? `?${query}` : ''}`;
}

function windowLabel(view: AppView, params: Record<string, string>): string {
  if (view === 'generation') return `workspace-generation-${Date.now()}`;
  const identity = view === 'editor'
    ? params.templateId || params.template || 'new'
    : view;
  const safeIdentity = identity.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 48) || 'workspace';
  return `workspace-${view}-${safeIdentity}`;
}

function windowTitle(view: AppView): string {
  switch (view) {
    case 'editor': return 'E-Studio | Template Editor';
    case 'generation': return 'E-Studio | Production';
    case 'catalog': return 'E-Studio | Product Catalog';
    case 'start': return 'E-Studio | Projects';
    default: return 'E-Studio | Workspace';
  }
}

export async function openWorkspaceWindow(
  view: AppView,
  params: Record<string, string> = {},
  context: DetachedWorkspaceContext = {},
): Promise<boolean> {
  if (!supportsDetachedWorkspaces()) return false;

  const label = windowLabel(view, params);
  const existingWindow = await WebviewWindow.getByLabel(label);
  if (existingWindow) {
    await existingWindow.show();
    await existingWindow.setFocus();
    return true;
  }

  if (view === 'generation') {
    await api.prefsSet(`estudio_detached_context_v1:${label}`, JSON.stringify(context));
  }

  const workspaceWindow = new WebviewWindow(label, {
    url: `${window.location.pathname}${window.location.search}${routeHash(view, params)}`,
    title: windowTitle(view),
    width: view === 'editor' ? 1440 : 1280,
    height: view === 'editor' ? 900 : 820,
    minWidth: 1024,
    minHeight: 680,
    resizable: true,
    decorations: true,
    center: true,
  });

  return await new Promise<boolean>((resolve, reject) => {
    void workspaceWindow.once('tauri://created', () => resolve(true));
    void workspaceWindow.once('tauri://error', (event) => reject(new Error(String(event.payload))));
  });
}

export async function loadDetachedWorkspaceContext(): Promise<DetachedWorkspaceContext | null> {
  if (!supportsDetachedWorkspaces()) return null;
  const key = `estudio_detached_context_v1:${getCurrentWindow().label}`;
  const serialized = await api.prefsGet(key);
  if (!serialized) return null;
  try {
    const value: unknown = JSON.parse(serialized);
    if (!value || typeof value !== 'object') return null;
    const context = value as DetachedWorkspaceContext;
    return {
      generationProducts: Array.isArray(context.generationProducts) ? context.generationProducts : undefined,
      generationBatchName: typeof context.generationBatchName === 'string' ? context.generationBatchName : undefined,
    };
  } catch (error) {
    console.warn('Unable to restore detached workspace context', error);
    return null;
  }
}