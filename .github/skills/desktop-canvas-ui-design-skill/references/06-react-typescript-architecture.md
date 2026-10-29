# 06 — React, TypeScript, State, and Application Architecture

## 1. Inspect first and follow the repo

Before proposing architecture, inspect `package.json`, lockfiles, `tsconfig`, routing, styles, component primitives, state stores, document schema, canvas engine, tests, linting, and build scripts. Verify installed versions and APIs. This skill provides principles; it is not a reason to impose a new toolchain over a working product.

## 2. Technology choice matrix

| Need | Default direction | Avoid |
|---|---|---|
| Client-heavy canvas editor, local document workflows | React + TypeScript + Vite | Adding server rendering with no user benefit |
| Product/site with routes, server data, auth, collaboration or SEO plus interactive editor | Next.js App Router; isolate the interactive editor into client components | Treating every component as client-only without reason |
| Shared state across toolbar, inspector, layers, dialogs and canvas | Zustand with focused selectors | A single giant store object subscribed to by every component |
| Form-heavy settings and validation | Controlled/uncontrolled form primitives plus a dedicated form/validation approach already used by the project | Duplicating form state in several stores and component layers |
| Menus/dialogs/tooltips/splitters | shadcn/ui wrappers backed by one accessible primitive system | Custom `div` widgets with incomplete keyboard semantics |
| Simple small document canvas | SVG or DOM if it fits the document model | A complex GPU engine introduced for a handful of objects |
| Object-heavy interactive 2D canvas | Evaluate Konva/Fabric.js against actual transform and export needs | Choosing based solely on a tutorial demo |
| Desktop shell/native file access | Electron or Tauri when required | Claiming a Vite browser app has native menus/filesystem access |

### Vite vs Next.js

- **Vite:** appropriate for a local-first editor, a desktop renderer, or a client-first SPA. It offers development server/build tooling and framework plugins; it does not prescribe your application architecture.
- **Next.js App Router:** useful when the product benefits from server components/data access, route-level rendering, authentication, shared web UI, or server actions. Canvas interaction, browser APIs, pointer events, and interactive stores belong on the client side. Declare a deliberate client boundary around the editor rather than making every top-level route a Client Component automatically.
- A Next.js app may host an editor, but persistent local desktop work should not depend on server rendering in the hot pointer/paint path.

## 3. Layered architecture

Recommended conceptual layers; choose folder organization that fits the current repository:

```text
src/
  app/                     # composition, routes, application providers
  components/ui/            # generic UI primitives, themed wrappers
  components/workspace/     # toolbars, panels, menus, status bar
  features/<feature>/       # feature-specific UI, commands, hooks, tests
  document/
    model/                  # typed document nodes and schema/versioning
    commands/               # mutations and undo/redo commands
    serialization/          # import/export to app's native document format
    validation/             # document invariants and preflight
  editor/
    canvas/                 # renderer adapter, transforms, hit testing
    interaction/            # selection, pointer gesture state machine
    tools/                  # select, text, shape, hand, etc.
  state/                    # cross-feature UI state slices, if appropriate
  services/                 # filesystem/export/font/image/print adapters
  styles/                   # theme tokens and global styles
```

The key idea is ownership. A command should not be implemented once in a toolbar, again in a context menu, and a third time in a keyboard listener. A document mutation should not live in a presentational inspector component.

## 4. State taxonomy

Keep these state categories conceptually separate:

### A. Persistent document state

- pages/artboards and their dimensions;
- objects/nodes, stable IDs, content and style;
- document metadata and versioned schema;
- document-level guides/bleed/print settings when these affect the saved project;
- links to assets and data sources.

Persist through the document format and a deliberate serialization/service layer. Do not persist raw React component state as the document format.

### B. Workspace/view state

- panel visibility and sizes;
- selected workspace preset and theme/density preference;
- active document tab;
- zoom/pan, visible guides/grid, ruler display, current page;
- left/right dock open/collapsed state;
- optional recent files/preferences.

Persist only where it helps the user and keep workspace state separate from content history. Decide explicitly which view settings should be shared with a document versus local to a user/workspace.

### C. Selection and UI state

- selected object IDs;
- active tool;
- active inspector section/tab;
- opened menu/dialog/popover;
- search/filter state;
- context menu coordinates;
- selected object tree node;
- command palette query.

Usually ephemeral; some may persist locally, but should not be serialized into the document accidentally.

### D. Transient interaction state

- pointer position, active pointer ID, drag start/current position;
- current resize/rotate preview;
- marquee rectangle;
- temporary snapping guides;
- current gesture and cancellation state;
- text composition/caret state if managed by the text editor.

Do not dispatch a global Zustand update for every pointer move unless profiling shows the design remains performant. Use refs or renderer-native transient state where appropriate; commit one document mutation on gesture completion.

### E. Derived state

- bounding box of selected objects;
- inspector fields common to a multi-selection;
- whether selection can group/delete/align;
- dirty/save state from revision tracking;
- preflight warnings from document/model data;
- enabled/disabled state of commands.

Calculate derived state from a source of truth or cache it with invalidation. Avoid duplicated booleans that can contradict each other, e.g. `isSaved=true` while `dirty=true`.

## 5. Zustand usage rules

- Use typed stores, small focused selectors, and immutable update patterns.
- Prefer one stable action for each semantic operation; do not expose arbitrary `setState` calls throughout UI files.
- Subscribe to scalar values, IDs, or memoized selections rather than the entire object graph.
- Avoid recreating array/object selectors on each render without a shallow comparison or appropriate memoization when that causes repeated rendering.
- Keep high-frequency pointer coordinates and engine node references out of persistent JSON state.
- Use `persist` only for genuinely persistent UI/workspace preferences; use `partialize`, versioning, and migration where appropriate.
- Do not put large image/base64 blobs, font binaries, canvas nodes, DOM nodes, or class instances into default JSON/localStorage persistence.
- If using slices, define ownership boundaries such as `selection`, `workspace`, `commands`, `documentSession`, and `preferences`; do not split simply to achieve many files.
- Be careful with SSR: browser-only storage must be accessed lazily and hydration differences must be handled; Next.js server code must not share mutable per-user global stores.
- Use devtools middleware only when it is in the project’s established development workflow; do not expose sensitive document data to unnecessary debugging persistence.

### Store boundary example

```ts
export type SelectionState = {
  selectedIds: string[];
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  toggleSelected: (id: string) => void;
};

export type WorkspaceState = {
  activeTool: 'select' | 'hand' | 'text' | 'shape';
  showGrid: boolean;
  showRulers: boolean;
  setActiveTool: (tool: WorkspaceState['activeTool']) => void;
  toggleGrid: () => void;
  toggleRulers: () => void;
};
```

This is a shape example, not a complete editor store. In a real repository, preserve existing naming and type conventions.

## 6. Document model and TypeScript contracts

Use stable IDs and discriminated unions for supported node types. Validate loaded data at runtime; TypeScript types do not validate untrusted files.

```ts
export type NodeId = string;
export type Geometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type BaseNode = {
  id: NodeId;
  name: string;
  geometry: Geometry;
  visible: boolean;
  locked: boolean;
  opacity: number;
};

export type TextNode = BaseNode & {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number | 'normal' | 'bold';
  color: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
};

export type ShapeNode = BaseNode & {
  type: 'shape';
  shape: 'rect' | 'ellipse' | 'line';
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
};

export type ImageNode = BaseNode & {
  type: 'image';
  assetId: string;
  fit: 'contain' | 'cover' | 'stretch';
};

export type DocumentNode = TextNode | ShapeNode | ImageNode;
```

The exact fields differ by product. Production models may need rich text runs, font fallback, accessibility labels, blend modes, crop/transform matrices, print units, data bindings, constraints, table/page structures, masks, effect stacks and capability/version metadata.

### Data rules

- A node ID must be stable across save/load and independent of rendering-engine internals.
- Validate bounds, numbers, enums, and references on import.
- Store asset references separately from rendered image data. Maintain correct relinking/missing-asset behavior.
- Version the document schema and provide migrations when saved formats evolve.
- Unknown future node types should be handled intentionally (preserve, warn, or reject safely); do not silently drop content on save.
- Never treat user-provided document text, file metadata, SVG markup, or import payload as trusted application code.

## 7. Commands and undo/redo

Represent document modifications as commands/transactions or equivalent well-defined mutations. A command can define `execute`, `undo`, label, affected IDs, and grouping/coalescing policy. A library can be used if it matches the project, but do not couple the document format directly to a UI component library.

- Drag movement: capture initial geometry, preview transient updates, commit one movement command on pointer-up.
- Numeric field: coalesce changes while typing or commit once on Enter/blur; avoid a history entry per keystroke if that produces poor behavior.
- Grouping: decide how child geometry transforms and what “ungroup” restores.
- Multi-select align: record all before/after geometry in one transaction.
- Undo/redo must preserve object identity/selection where practical and must not update the wrong document if the active tab changes.
- Undo/redo in a text editor should obey text-editor history first when the text input owns focus.
- Avoid serializing the entire document on every pointer movement just to implement undo.

## 8. Canvas engine adapter

Create an explicit adapter/bridge between the editor model and rendering engine. It should own or define:

- rendering of model nodes;
- model ID ↔ renderer node lookup;
- coordinate conversion;
- selection bounds and hit testing;
- transform preview and commit events;
- renderer invalidation/redraw;
- asset/font loading and failure states;
- serialization/export mapping where the engine is part of that pipeline.

Do not allow engine node instances, DOM elements, or mutable engine state to become the permanent source of document truth. A renderer adapter helps test core command behavior without mounting the entire React app.

## 9. Next.js client/server boundaries

- Server Components can render route shells, metadata, and data-driven views; interactive canvas code using hooks, browser APIs, event handlers, or Zustand must execute on the client.
- Put `'use client'` at the appropriate module boundary. Do not add it to every file unnecessarily, because imports below the boundary become part of the client module graph.
- Avoid accessing `window`, `document`, `localStorage`, canvas engines, or desktop bridges at module evaluation time in server-rendered routes.
- Load browser-only rendering engines in the intended client lifecycle; where necessary, use dynamic import/client-only patterns and cleanup.
- Do not share mutable module-singleton stores across server requests. Create state with correct per-session ownership.
- Keep document data transport serializable where it crosses server/client component boundaries.

## 10. Persistence and window state

Separate persistence targets:

- **Document persistence:** native file format or managed database, with schema versioning and atomic-safe writes when possible.
- **Preferences:** theme, density, shortcuts, default units, autosave preferences.
- **Workspace:** dock widths, panel visibility, active tools, recent view state.
- **Recent files:** metadata/path, not the entire document.
- **Transient state:** generally not persisted unless there is a compelling recovery use case.

Validate all stored preferences before applying them. Version local storage/database schemas and migrate safely. Avoid keeping only one fragile copy of user work. If the app claims autosave, define the commit frequency, recovery behavior, and dirty indicator semantics.

For native desktop, use the shell’s supported window-state and filesystem APIs where appropriate. Test restored bounds across disconnected monitors, changed DPI, and maximized/fullscreen states.

## 11. Performance practices

- Profile before broad optimization, but design state boundaries to prevent obvious global rerenders.
- Use Zustand selectors and memoization intentionally.
- Avoid giant React trees inside each canvas frame and avoid changing keys in ways that remount the editor on selection changes.
- Use requestAnimationFrame or the rendering engine’s update loop for high-frequency transient rendering where appropriate; cancel the frame on unmount.
- Avoid synchronous full-document serialization on every drag tick.
- Use Web Workers for truly expensive, separable computations only when the extra state transfer and lifecycle complexity is justified.
- Virtualize large lists/tables/layer trees while preserving accessibility and stable row identity.
- Use image thumbnails and resource caches; revoke object URLs when no longer needed.
- Test cold open, repeated edits, large document, undo/redo depth, save/export, and long-session memory behavior.

## 12. Error handling and resilience

- Catch file parse and validation errors at the import boundary; show the user a useful message and preserve the existing document.
- Handle missing images/fonts/data sources explicitly; never substitute silently when fidelity matters.
- Avoid `catch {}` and silent fallback to unrelated data.
- Keep last known valid geometry if a transform becomes invalid.
- If export fails, keep the editor state intact and show the failing stage/reason when known.
- If persistence fails, do not show “Saved”; preserve dirty state and provide retry/recovery options.
- Avoid swallowing errors in effects and event handlers merely to silence logs.
