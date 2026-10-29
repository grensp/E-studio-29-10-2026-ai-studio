# 08 — Quality Gates, Audit Rubric, and Acceptance Tests

Use this checklist to plan, implement, review, and report a UI change. Do not mark an item “pass” only because the relevant component exists in the code.

## 1. Review dimensions

Rate each dimension 0–3:

- **0 — Absent/broken:** missing, inert, misleading, or materially unusable.
- **1 — Partial:** exists but has significant behavioral, visual, accessibility, or robustness gaps.
- **2 — Good:** coherent and usable; small gaps remain.
- **3 — Production-ready for the stated scope:** verified, consistent, robust, and documented.

| Dimension | What to inspect |
|---|---|
| Visual hierarchy | Primary work surface is prominent; commands are grouped; visual noise is controlled |
| Desktop fit | Information density, toolbars, panels, context menus, window resizing |
| Design-system coherence | Token use, typography, controls, spacing, icon family, component states |
| Functionality | Every visible interactive control works and routes through a consistent command/state model |
| Canvas ergonomics | Select/move/resize/rotate, zoom/pan, snap, layers, properties, text editing, undo/redo |
| State integrity | Document, workspace, transient, derived state separation; no contradictory flags |
| Accessibility | Keyboard, focus, naming, contrast, screen-reader semantics, drag alternatives |
| Responsiveness | Small/maximized/snapped windows, panel collapse/resizing, text scaling |
| Performance | Pointer handling, large-document behavior, list virtualization, resource lifecycle |
| Reliability | Empty/error states, save failure, import/export failure, corrupted data, recovery |
| Testing | Useful automated tests plus manual keyboard/window-size checks |
| Maintainability | Existing conventions reused, typed boundaries, no needless dependencies or broad rewrites |

For critical professional editors, zero scores in functionality, state integrity, accessibility, or reliability are release blockers. A high average does not compensate for a critical blocker.

## 2. Definition of done for a desktop UI change

### Design and layout

- [ ] Existing app patterns, component library, and tokens were inspected before new patterns were introduced.
- [ ] The layout has a clear primary work surface and sensible command hierarchy.
- [ ] Panel widths, collapse states, and smaller-window behavior are defined.
- [ ] No content is clipped, hidden behind overlays, or inaccessible at the target minimum size.
- [ ] All icons are consistent and all non-obvious icon-only controls have accessible names/tooltips.
- [ ] Hover, active, selected, focus, disabled, busy, invalid, and read-only states are differentiated where relevant.
- [ ] Light and dark modes have been checked if both are supported.
- [ ] Tokens are used instead of arbitrary inline values, except for documented exceptions.

### Functionality

- [ ] Every visible control has a real action, or is correctly disabled with a clear state.
- [ ] Keyboard shortcuts match visible hints and menu accelerators.
- [ ] Context menu and toolbar commands use the same action implementation.
- [ ] Async commands communicate progress, success, and failure truthfully.
- [ ] Actions preserve user content on failure and handle dirty/unsaved documents correctly.
- [ ] No stub, fake status, hard-coded success toast, or placeholder handler is presented as production behavior.

### Canvas/document integrity

- [ ] The document model remains the source of truth.
- [ ] Selection IDs are stable and not based on array indexes.
- [ ] Screen/document unit conversion is correct at several zoom levels.
- [ ] Drag/resize/rotate commands can be undone and produce coherent history entries.
- [ ] Cancelling a gesture restores the original geometry.
- [ ] Panel layout, zoom and transient selection do not unintentionally mutate saved document content.
- [ ] Save and reopen preserve supported fields, IDs, assets and geometry.
- [ ] Import/export reports unsupported or missing content rather than silently dropping it.

### Accessibility

- [ ] The main workflow can be completed without a mouse.
- [ ] Focus is visible and is not lost unexpectedly on state update.
- [ ] Menus, dialogs, tabs, trees, and splitters use appropriate keyboard behavior.
- [ ] Form labels and errors are connected semantically.
- [ ] Contrast is checked for text, focus, selection, warnings and errors.
- [ ] No essential state or instruction is conveyed by color alone.
- [ ] Dragging-only features have an accessible alternative where required.
- [ ] Reduced-motion and text-scaling behavior has been considered.

### Reliability and performance

- [ ] Long names, large values, missing assets, zero objects, one object, multi-selection and mixed values have been tested.
- [ ] Error boundaries or failure handling do not erase a working document.
- [ ] Event listeners, observers, timers, animation frames, object URLs and engine resources are cleaned up.
- [ ] Pointer moves do not cause unnecessary whole-app rerenders.
- [ ] Long lists or object trees use a scalable approach when needed.
- [ ] Window/panel layout restores safely after the display changes where desktop shell behavior is in scope.

## 3. Minimum manual test matrix

| Scenario | Expected outcome |
|---|---|
| Window at 1024×768 | Essential controls remain available; optional panels collapse/dock; no unusable canvas strip |
| Window at 1280×800 | Default workspace remains practical and canvas is usable |
| Window at 1920×1080 | Extra space improves canvas/panels without stretching controls excessively |
| Resize inspector repeatedly | Canvas document geometry does not change; widths remain clamped and saved correctly |
| Theme changes Light → Dark → System | App chrome changes; document content remains unchanged |
| Keyboard-only common workflow | New/open or start, select tool, edit property, undo/redo, save/export reachable with focus visible |
| Text editor focus + Ctrl/Command+A/Z | Text editor owns the expected editing command rather than the canvas, except where product semantics explicitly differ |
| Multi-selection with mixed properties | Inspector clearly shows common/mixed state and updates only intended properties |
| Cancel a drag/transform | No unintended document mutation remains |
| Rapid pointer movement on large document | Interaction remains responsive and no duplicate handlers/updates accumulate |
| Invalid file import | Current document stays safe; useful error appears |
| Save failure / export failure | UI does not report success; user can retry; document remains intact |
| Close dirty document | Save / discard / cancel path is presented accurately |
| High DPI / 125–200% scale | Text and critical controls remain usable; canvas remains crisp enough for the target |
| Screen reader / keyboard | Selected object, field labels, dialog focus and status changes can be understood without color alone |

## 4. Automated tests to prioritize

### Unit tests

- unit conversion and viewport transforms;
- bounding box / alignment / distribution math;
- snapping tolerance and priority;
- document validation and schema migration;
- command execute/undo/redo and transaction coalescing;
- dirty revision and async save race conditions;
- keyboard shortcut conflict and scope resolution;
- serialization round trips for each supported node type;
- preflight rules and export capability limitations.

### Component/integration tests

- button and toggle semantics;
- tooltip appears on hover and keyboard focus;
- property field validation, mixed state and commit behavior;
- dialogs trap/restore focus correctly;
- layer selection and canvas selection stay synchronized;
- resizing/collapsing panel preserves document geometry;
- shortcuts do not hijack input/text-editor typing;
- save/export busy and failure state;
- theme switching through the actual settings control.

### End-to-end tests

- open/create/edit/save/reopen document;
- select/move/resize/undo/redo through UI;
- import supported assets and handle unsupported files;
- export/print preview using actual output pipeline where testable;
- resize panel, switch tabs/documents, close dirty document;
- keyboard-only completion of at least one representative workflow.

## 5. Visual regression tests

Use screenshot/visual tests strategically:

- standard workspace with no selection;
- canvas with one selection and multi-selection handles;
- empty state and error state;
- dark theme with visible focus;
- narrow workspace with collapsed panel;
- dialog/menus near viewport edges;
- inspector with long values and mixed properties.

Do not accept or update snapshots blindly if the test changed the behavior. Canvas antialiasing and font rasterization may vary by environment; use justified tolerances, stable test fonts, and behavior assertions as well as pixel diffs.

## 6. Common anti-patterns

Reject or revisit these patterns:

- Mobile cards stacked into a “desktop” app while ignoring menus, toolbars, panel layouts and keyboard input.
- A large dashboard template used as the editor shell with a canvas added as one card.
- Every control at 48px height or large rounded cards in a workspace where users need high density.
- Every property hidden inside modal dialogs, forcing repetitive navigation.
- Unlabelled icon buttons, arbitrary icon families, or emoji in professional toolbars.
- Text and icons with contrast too low to read in common states.
- A panel that cannot resize or collapse and leaves the canvas unusable in a snapped window.
- A save button that only shows a toast; a print button that does not invoke a print/export pipeline; or a spinner that never resolves.
- A settings page full of switches that do not change anything.
- Global keyboard listeners that intercept text editing and browser/platform shortcuts.
- UI state mixed with saved document content, causing zoom or selected object changes to mark the file dirty.
- Updating the entire document on every pointer move and generating hundreds of undo actions for one drag.
- Replacing the canvas engine or state library without proof it is necessary.
- Adding broad dependencies for a small isolated feature.
- Hard-coded text, colors, widths, IDs, or output capabilities that pretend to be configurable.
- Silent fallback for missing assets, invalid font/data binding, export failure, or corrupt file.
- Treating a successful build as proof of correct interaction behavior.
- Claiming production readiness when tests did not run or hardware/printer behavior was not verified.

## 7. Audit report template

```md
## UI audit
- Scope:
- Framework/library versions checked:
- Existing patterns preserved:

### Findings
1. [Severity: blocker/high/medium/low] Description — evidence — user impact.

### Implemented
- ...

### Validation
- Commands run:
- Tests passed/failed/not run:
- Manual scenarios checked:

### Remaining risks
- ...
```

Be concrete. “Improved UI” is not a useful report; “resizing the Properties dock no longer changes the canvas transform, and the stored width is clamped to 260–420px” is useful if verified.
