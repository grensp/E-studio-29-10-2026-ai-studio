# Ready-to-use AI prompts

Use the shortest prompt that fits the task. Reference `SKILL.md` as the governing contract and select specific reference files when possible.

## 1. Build a new editor workspace

> Follow `SKILL.md`, `references/01-design-tokens.md`, `02-desktop-shell-and-layouts.md`, `03-canvas-editor-ux.md`, `06-react-typescript-architecture.md`, `08-quality-gates.md`, and the relevant section of `10-product-archetypes.md`. First inspect the repository and report its current framework, state approach, UI primitives, document model, and rendering engine. Then implement the workspace using existing conventions. Make the canvas primary, panels resizable/collapsible, properties contextual, keyboard and pointer workflows functional, and all states/token-based styles complete. Keep document, workspace, selection, and transient interaction state separate. Run the relevant tests and report exact checks and remaining gaps.

## 2. Refine an existing screen without rewriting it

> Improve the specified UI using the Desktop Canvas UI Design Skill. Inspect the component tree, styles/tokens, state ownership, and tests first. Preserve current behavior, APIs, file/document compatibility, naming conventions, and rendering engine. Identify the smallest coherent set of changes, then implement it. Avoid unnecessary dependencies, broad rewrites, generic dashboard styling, and inert controls. Validate desktop window sizes, theme states, focus/keyboard behavior, and regression risk. Report files changed and test results.

## 3. Audit the UI critically

> Audit this desktop canvas UI against `references/01-design-tokens.md`, `02-desktop-shell-and-layouts.md`, `03-canvas-editor-ux.md`, `05-accessibility-and-responsiveness.md`, and `08-quality-gates.md`. Do not modify code yet. Inspect actual source and run appropriate checks if possible. List findings by severity with file/location, evidence, user impact, and an actionable fix. Specifically look for inconsistent tokens, misleading controls, keyboard conflicts, inaccessible drag-only features, panel/window-size failures, document/state coupling, undo/redo bugs, poor pointer performance, save/export failure handling, and visual inconsistency. Do not report hypothetical issues as confirmed defects.

## 4. Build a property inspector

> Follow the Skill’s inspector and component contracts. Inspect the existing document schema and editor state before coding. Build property groups relevant to the selected object type, with numeric units, validation, mixed-selection states, linked dimensions where supported, accessible labels, error/help associations, keyboard stepping, and consistent commit/undo behavior. Do not mutate document state on every render, overwrite unrelated properties, or use the first selected object as if it represented a mixed selection. Include tests for single selection, multi-selection, empty selection, invalid values, and undo/redo.

## 5. Improve canvas selection/transforms

> Follow `references/03-canvas-editor-ux.md` and `06-react-typescript-architecture.md`. Inspect current canvas-engine APIs and installed version before changes. Implement or refine selection, move/resize/rotate, snapping/handles, cancel behavior, exact numeric properties, keyboard nudging, and undo grouping. Keep screen coordinates separate from document coordinates, prevent engine nodes from becoming the persisted source of truth, and avoid global rerenders during pointer motion. Validate coordinate transforms at multiple zoom values and test pointer cancellation and undo/redo.

## 6. Implement theming

> Follow `references/01-design-tokens.md`. Inspect the current theme provider, CSS variables, component library, and any document-specific colors. Implement semantic tokens with light, dark, and system behavior if in scope. Theme all app chrome, menus, dialogs, tooltips, sidebars, focus/selection states, and error/success states. Keep document content colors independent from application chrome. Check contrast using actual rendered token pairs; do not assume the sample palette automatically passes. Verify switching themes does not reset document, selection, zoom, or workspace layout.

## 7. Improve desktop responsiveness

> Follow `references/02-desktop-shell-and-layouts.md` and `05-accessibility-and-responsiveness.md`. Test the shell at narrow, normal, and wide desktop sizes; inspect min-width/min-height behavior; implement deliberate collapse/overlay modes and accessible panel splitters; persist validated workspace layout where appropriate. Do not shrink controls indefinitely or introduce mobile-card layouts as a substitute for desktop panel design. Confirm panel changes never modify document geometry.

## 8. Make a feature production-ready

> Follow the full skill. Inspect the current implementation and the task’s external dependencies. Replace placeholders only after understanding the intended behavior. Implement error/empty/loading/disabled states, keyboard/pointer interaction, state ownership, persistence and undo semantics where relevant, and tests. Do not claim a printer, export, cloud-sync, or hardware integration works unless its real pipeline was exercised. Run the repository’s checks and report real results without overstating coverage.
