# 09 — Authoritative References and Tooling

Use official documentation first for current APIs. Verify version compatibility against the package lockfile and installed types. Community tutorials are useful for examples, but should not overrule API docs, accessibility patterns, or repository behavior.

## React, TypeScript, Vite, and Next.js

- React Learn: https://react.dev/learn
- React API reference: https://react.dev/reference/react
- Vite guide: https://vite.dev/guide/
- Next.js App Router: https://nextjs.org/docs/app
- Next.js Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/intro.html

**Implementation notes:** use functional React components and strict TypeScript; keep interactive editor components on the client; verify React/Next/Vite versions before relying on features. Effects are for synchronizing with external systems, not as a default replacement for derived state or direct event handlers.

## State management

- Zustand: https://zustand.docs.pmnd.rs/
- Zustand TypeScript guidance: https://zustand.docs.pmnd.rs/learn/guides/advanced-typescript
- Zustand `persist` middleware: https://zustand.docs.pmnd.rs/reference/middlewares/persist

**Implementation notes:** subscribe narrowly; treat persisted UI state as versioned data; handle SSR/client hydration correctly; do not store rendering-engine instances or large binary assets in JSON state.

## UI primitives and design system

- shadcn/ui docs: https://ui.shadcn.com/docs
- shadcn/ui theming: https://ui.shadcn.com/docs/theming
- shadcn/ui Sidebar: https://ui.shadcn.com/docs/components/base/sidebar
- shadcn/ui Resizable: https://ui.shadcn.com/docs/components/base/resizable
- Radix Primitives: https://www.radix-ui.com/primitives
- Radix accessibility overview: https://www.radix-ui.com/primitives/docs/overview/accessibility
- React Aria Components: https://react-spectrum.adobe.com/react-aria/components.html

**Implementation notes:** shadcn/ui is source-owned UI built with accessible primitives and tokens, not a monolithic visual framework. Inspect which primitive backend the project uses (Radix, Base UI, or React Aria) and do not mix APIs. Use accessible library behavior as a foundation, and still test product-specific focus and keyboard semantics.

## Icons

- Lucide React: https://lucide.dev/guide/packages/lucide-react
- Phosphor React: https://github.com/phosphor-icons/react

**Implementation notes:** import only icons used; keep a consistent icon family and stroke/weight; use accessible names for icon-only controls; verify exact component names in the installed version.

## Canvas/rendering engines

- Konva: https://konvajs.org/docs/
- react-konva: https://konvajs.org/docs/react/Intro.html
- Konva selection/transformer example: https://konvajs.org/docs/react/Transformer.html
- Fabric.js concepts: https://www.fabricjs.com/docs/core-concepts/
- MDN Canvas API: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- MDN SVG: https://developer.mozilla.org/en-US/docs/Web/SVG

**Implementation notes:** verify how the chosen engine models transforms, scale, hit-testing, layers, selection, serialization, export, and text. For example, some canvas transformers scale an engine node rather than updating the application’s canonical width/height; normalize transforms at the correct boundary. Export fidelity needs real tests.

## Desktop shells

- Electron documentation: https://www.electronjs.org/docs/latest/
- Electron keyboard shortcuts: https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts
- Electron menus: https://www.electronjs.org/docs/latest/tutorial/menus
- Tauri v2: https://v2.tauri.app/
- Tauri window state plugin: https://v2.tauri.app/plugin/window-state/

**Implementation notes:** native menus, keyboard accelerators, filesystem access and window state depend on the selected shell and operating system. Verify permission/capability requirements, security boundaries, and packaged-app behavior. Do not rely only on development mode.

## Accessibility and browser APIs

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI-ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
- WAI keyboard interface practices: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- WCAG contrast minimum: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum
- MDN Pointer Events: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- MDN `setPointerCapture`: https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture
- MDN container queries: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_size_and_style_queries
- MDN reduced motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- MDN color scheme preference: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme

**Implementation notes:** use APG patterns for composite controls and visible focus/focus order; test dragging alternatives, not only keyboard navigation around the edges. Contrast and target-size requirements apply to actual colors and hit areas, not names in a design token file.

## Large collections and lists

- TanStack Virtual: https://tanstack.com/virtual/latest/docs/introduction

Use virtualization for large layer trees, tables, asset libraries or lists when profiling and expected data size justify it. Preserve keyboard and screen-reader behavior; virtualization can introduce accessibility and focus complexity.

## General use of references

- Use the **official source** for API shape/version behavior.
- Use W3C and MDN for web interaction/accessibility standards and browser APIs.
- Use the codebase’s installed components as the source of truth for its real interface.
- When a referenced API has changed, update the example rather than preserving a stale snippet.
- Do not add citations into the application UI. Record useful references in engineering documentation or the implementation summary when relevant.
