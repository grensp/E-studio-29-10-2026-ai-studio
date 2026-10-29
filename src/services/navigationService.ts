import { create } from 'zustand';
import type { AppView } from '../types';
export type { AppView };

export interface RouteState {
  view: AppView;
  params: Record<string, string>;
  fullHash: string;
}

type RouteListener = (state: RouteState) => void;

export function parseRouteHash(rawHash: string): RouteState {
  const normalizedHash = rawHash || '#/start';
  const hashWithoutPrefix = normalizedHash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = hashWithoutPrefix.split('?');
  const cleanPath = (pathPart || 'start').toLowerCase();
  let view: AppView;

  if (cleanPath === 'start' || cleanPath === 'home') {
    view = cleanPath;
  } else if (cleanPath === 'editor' || cleanPath === 'studio') {
    view = 'editor';
  } else if (cleanPath === 'generation' || cleanPath === 'print' || cleanPath === 'imposition') {
    view = 'generation';
  } else if (cleanPath === 'catalog' || cleanPath === 'database' || cleanPath === 'articles') {
    view = 'catalog';
  } else {
    view = 'home';
  }

  const params: Record<string, string> = {};
  if (queryPart) {
    new URLSearchParams(queryPart).forEach((value, key) => {
      params[key] = value;
    });
  }
  return { view, params, fullHash: normalizedHash };
}

interface NavigationState {
  route: RouteState;
  setRoute: (route: RouteState) => void;
}

function currentHash(): string {
  return typeof window === 'undefined' ? '#/start' : window.location.hash || '#/start';
}

export const useNavigationStore = create<NavigationState>((set) => ({
  route: parseRouteHash(currentHash()),
  setRoute: (route) => set({ route }),
}));

function syncRouteFromLocation(): void {
  const route = parseRouteHash(currentHash());
  if (route.fullHash !== useNavigationStore.getState().route.fullHash) {
    useNavigationStore.getState().setRoute(route);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', syncRouteFromLocation);
  window.addEventListener('popstate', syncRouteFromLocation);
}

function makeHash(view: AppView, params: Record<string, string>): string {
  const queryEntries = Object.entries(params).filter(([, value]) => value !== undefined && value !== '');
  if (queryEntries.length === 0) return `#/${view}`;
  const searchParams = new URLSearchParams();
  queryEntries.forEach(([key, value]) => searchParams.set(key, String(value)));
  return `#/${view}?${searchParams.toString()}`;
}

export const navigationService = {
  getCurrentRoute(): RouteState {
    return useNavigationStore.getState().route;
  },
  navigateTo(view: AppView, params: Record<string, string> = {}, replace = false): void {
    if (typeof window === 'undefined') return;
    const hash = makeHash(view, params);
    if (replace) {
      window.history.replaceState(null, '', hash);
    } else if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
    syncRouteFromLocation();
  },
  subscribe(listener: RouteListener): () => void {
    listener(useNavigationStore.getState().route);
    return useNavigationStore.subscribe((state, previous) => {
      if (state.route !== previous.route) listener(state.route);
    });
  },
};
