import { emit, listen } from '@tauri-apps/api/event';

export type WorkspaceResource = 'projects' | 'templates' | 'catalog';

export interface WorkspaceChange {
  resource: WorkspaceResource;
  recordId?: string;
}

const EVENT_NAME = 'estudio://workspace-data-changed';
const CHANNEL_NAME = 'estudio-workspace-data';

function isNativeWindow(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function publishWorkspaceChange(change: WorkspaceChange): Promise<void> {
  if (isNativeWindow()) {
    await emit(EVENT_NAME, change);
    return;
  }
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(change);
    channel.close();
  }
}

export async function subscribeWorkspaceChanges(
  listener: (change: WorkspaceChange) => void,
): Promise<() => void> {
  if (isNativeWindow()) {
    return await listen<WorkspaceChange>(EVENT_NAME, ({ payload }) => listener(payload));
  }
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = ({ data }: MessageEvent<WorkspaceChange>) => {
    if (data && (data.resource === 'projects' || data.resource === 'templates' || data.resource === 'catalog')) {
      listener(data);
    }
  };
  return () => channel.close();
}