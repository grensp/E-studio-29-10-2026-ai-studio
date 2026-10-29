---
name: desktop-canvas-ui-design
version: 1.0.0
description: Design and implement production-grade desktop-first interfaces for canvas-based creative and productivity software—label/layout designers, image editors, document and word processors, presentation tools, diagramming apps, technical editors, and similar applications—using TypeScript, React, Vite or Next.js, Zustand, accessible component primitives, and optional Electron/Tauri shells.
license: CC0-1.0
---

# Desktop Canvas UI Design Skill

## Mission

Design, implement, refactor, and review professional desktop-first interfaces for applications in which users work for long sessions with documents, pages, artboards, objects, layers, structured content, or timelines. The skill applies to label and price-tag designers, image/layout tools, word processors, presentation editors, diagramming tools, technical authoring tools, and related software.

The outcome must be a **usable, coherent, responsive, accessible, high-density working interface**, not a static mockup or a generic dashboard dressed up with a canvas. A successful implementation includes meaningful control behavior, realistic empty/loading/error states, keyboard workflows, persistence where appropriate, clear selection/focus, and measurable validation.

## When to activate

Use this skill when asked to design, build, refactor, audit, style, theme, or improve any of the following:

- A desktop application shell, top-level navigation, menu bar, toolbar, ribbon, dock, sidebar, inspector, status bar, or command palette.
- A canvas, artboard, page, slide, label, diagram, timeline, layer stack, object tree, or multi-document workspace.
- Design tokens, theming, density modes, interaction states, component libraries, preferences, or design-system architecture.
- Selection, move/resize/rotate, snapping, rulers, grids, guides, zoom/pan, alignment, distribution, grouping, undo/redo, or object properties.
- TypeScript/React/Vite/Next.js/Zustand implementations of such features, including desktop packaging through Tauri or Electron.
- A UI review, visual-quality audit, accessibility audit, or production-readiness checklist for a canvas-based application.

## Operating procedure

1. **Inspect before changing.** Identify the current framework, routing model, styling system, component library, canvas/rendering engine, state management, persistence, keyboard handling, tests, naming conventions, and existing design tokens. Read adjacent components and reuse established patterns. Do not introduce a second system unnecessarily.
2. **Identify the product and task.** Determine whether the user is editing a document, managing data, choosing a file, configuring a tool, exporting, or reviewing output. Choose a workflow-specific layout rather than a generic admin template.
3. **Separate the planes.** Define (a) application chrome and workspace state, (b) document/model state, and (c) transient interaction/rendering state. See `references/06-react-typescript-architecture.md`.
4. **Establish tokens first.** Define or map semantic colors, typography, spacing, sizing, borders, elevation, motion, density, and focus styles before styling individual controls. Never scatter raw hex values throughout components.
5. **Design the information hierarchy.** Prioritize document content and the primary workflow. Put frequent commands in predictable places; keep advanced options discoverable without permanently exposing every control.
6. **Implement complete behavior.** Every visible interactive control must work, have a clear disabled/busy state when applicable, and preserve a coherent state model. Never fabricate functionality with inert buttons, fake progress, placeholder handlers, or decorative widgets presented as real features.
7. **Validate at realistic dimensions.** Check narrow, ordinary, and wide desktop windows; panel resizing/collapse; keyboard workflows; light/dark themes; long labels/data; empty/error states; and accessibility. Run the project’s actual checks and report any unverified work honestly.
8. **Summarize the delivered changes.** State what was implemented, the key interaction rules, files changed, checks run, remaining gaps, and assumptions. Do not claim that a feature works unless its behavior was verified.

## Non-negotiable principles

- **Desktop-native interaction model:** do not turn a mobile screen into a stretched desktop UI. Use persistent toolbars, panels, menus, keyboard accelerators, hover/focus affordances, precise pointer interaction, context menus, resizable panes, and multi-selection where the workflow benefits.
- **Content-first composition:** the document/canvas is the primary work surface. Application chrome must frame it rather than compete with it.
- **High information density, deliberate hierarchy:** present useful context in one workspace; group related controls; expose advanced options contextually; do not put every setting on screen at once.
- **Stable conventions:** File/Edit/View/Insert/Format/Arrange/Window/Help where relevant; consistent save, undo/redo, copy/paste, duplicate, delete, find, zoom, and export semantics.
- **Visible state:** distinguish hover, keyboard focus, selected, active, modified, disabled, loading, warning, error, and read-only states. Do not rely on color alone.
- **Predictable geometry:** spacing, controls, hit targets, alignment, type scale, icon size, panel behavior, and selection affordances must be systematic.
- **User control:** support undo/redo for meaningful document changes, reversible actions when practical, confirmation for destructive/irreversible operations, and persistence of user preferences/layout when appropriate.
- **Accessibility is baseline:** keyboard support, visible focus, semantic elements, accessible names, contrast, text scaling, screen-reader semantics, and alternatives to drag-only actions must be designed in from the start.
- **Performance is UX:** avoid rerendering every object on every pointer movement, loading giant lists all at once, or blocking the interface during import/export.
- **Preserve the source of truth:** document data—not the current rendered pixels, random DOM nodes, or a toolbar’s local state—must be authoritative for persisted edits.
- **Respect existing code:** do not replace a working architecture just to follow an example in this skill. Adapt the rules to the repository and explain meaningful trade-offs.
- **No design-by-reference copying:** learn from the conventions of Adobe, Affinity, JetBrains, Microsoft Office, Figma, and other mature tools, but do not blindly copy their branding, proprietary assets, or distinctive layouts. Use familiar patterns to improve usability and fit them to the product.

## Default implementation stack

Use these as defaults only when the repository has not already made the choice:

- **Language:** TypeScript with `strict` enabled.
- **UI:** React functional components and hooks.
- **Build/runtime:** Vite for a client-first SPA or desktop renderer; Next.js App Router for a product that needs route-level server rendering, server data access, or a broader web application. Do not choose Next.js solely to render a local editor canvas.
- **Client UI state:** Zustand with selector-based subscriptions; use slices only when they improve ownership and maintainability. Keep transient pointer motion out of a large global store.
- **Component foundation:** shadcn/ui plus one coherent accessible primitive system (Radix UI, Base UI, or React Aria, chosen deliberately). Do not mix several component libraries casually.
- **Icons:** Lucide React as the default; Phosphor is an alternative when its weights or semantic range fit the product better. Import specific icons; do not use emoji as interface icons.
- **Styling:** semantic CSS variables/design tokens; CSS Modules, Tailwind, or the project’s existing system. Avoid a global CSS rewrite solely for preference.
- **Desktop packaging:** Electron or Tauri if actual native windows, filesystem access, menus, installers, or desktop integrations are required. React/Vite by itself is a web application, not a native desktop app.
- **Canvas engine:** use the project’s existing engine if it is capable; otherwise select from DOM/SVG, Konva, Fabric.js, or a custom Canvas/WebGL renderer based on the interaction and rendering requirements. See the canvas-engine decision guide.

Never assume that a package is installed or that an API exists. Inspect `package.json`, lockfiles, the installed library version, and its actual local types/docs before implementing version-specific code.

## Required outputs for a design/build request

Produce as many of these as the task requires, without padding the result with unrelated material:

1. A layout and interaction model for the current task.
2. Token/component rules that align with the repository.
3. Implemented, connected controls and real state transitions—not just screenshots.
4. Keyboard and pointer paths for all important workflows.
5. Responsive behavior for panel changes and window resizing.
6. Relevant loading, empty, error, disabled, dirty, saved, and read-only states.
7. Tests or manual validation steps for the behaviors changed.
8. A concise audit/change report with known gaps and explicit assumptions.

## Reference map

Read only the files needed for the current request, but consult the relevant guide before making a material design decision.

- `references/01-design-tokens.md` — exact sizes, colors, typography, spacing, radii, elevations, icons, themes, density.
- `references/02-desktop-shell-and-layouts.md` — window structure, toolbar/ribbon, side panels, status bars, responsive desktop behavior, window persistence.
- `references/03-canvas-editor-ux.md` — document coordinate systems, tools, selection/transforms, snapping, layers, zoom, canvas-specific state and performance.
- `references/04-components-and-interactions.md` — component specifications, hover/focus/pressed/disabled states, menus, dialogs, fields, tooltips, drag-and-drop, sample copy.
- `references/05-accessibility-and-responsiveness.md` — keyboard/focus, WCAG guidance, text scaling, contrast, non-drag alternatives, motion.
- `references/06-react-typescript-architecture.md` — React/Vite/Next/Zustand boundaries, state slices, data model, undo/redo, persistence, canvas engine selection.
- `references/07-code-recipes.md` — token CSS, semantic component recipes, typed object model, keyboard shortcuts, selection/property examples.
- `references/08-quality-gates.md` — acceptance criteria, review checklist, performance, testing, anti-patterns.
- `references/09-reference-sources.md` — authoritative external documentation and tools.
- `references/10-product-archetypes.md` — specialist workflows for label/print, image editing, word processing, slides, and diagrams.

## Task-specific implementation brief

Before coding, resolve these from available context (ask only if an essential decision cannot reasonably be inferred):

- Product type: label/layout, image, document, slides, diagram, or other.
- Delivery target: browser app, packaged desktop app, or a shared web/desktop codebase.
- Existing stack and design system.
- Canvas engine and current document model.
- Target users and the 3–5 most frequent workflows.
- Required visual direction (or use the neutral professional defaults in `01-design-tokens.md`).
- Required window-size range and accessibility constraints.
- What must remain compatible: data format, commands, files, tests, exports, existing APIs.

When context is incomplete, make reversible assumptions, document them, and continue. Do not stop for questions whose answers are already in the repository or conversation.

## Final quality bar

The UI should feel like a coherent professional creative/productivity tool: clear visual hierarchy, efficient information density, predictable selection and focus, dependable keyboard workflows, adjustable workspace, safe document operations, meaningful feedback, consistent tokens, and verified implementation. The design is complete only when essential controls behave correctly—not when the screen merely looks finished.
