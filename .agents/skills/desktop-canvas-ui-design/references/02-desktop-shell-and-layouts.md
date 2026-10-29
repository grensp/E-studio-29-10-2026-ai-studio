# 02 — Desktop Shell and Workspace Layouts

## 1. Model the workspace before styling it

A professional desktop application typically has the following zones. Use only the zones that serve the product; do not include every zone to appear sophisticated.

```text
┌────────────────────────────────────────────────────────────────────┐
│ Native title bar / app title / document name / modified indicator  │
├────────────────────────────────────────────────────────────────────┤
│ Menu bar or command bar                                            │
├────────────────────────────────────────────────────────────────────┤
│ Contextual toolbar / ribbon / quick actions                        │
├───────┬─────────────────────────────────────────┬──────────────────┤
│ Tool  │                                         │ Properties /     │
│ rail  │         Canvas / page / artboard         │ Inspector        │
│       │                                         │                  │
│       │                                         │                  │
├───────┴─────────────────────────────────────────┴──────────────────┤
│ Optional layers, pages, timeline, asset strip, or notes panel       │
├────────────────────────────────────────────────────────────────────┤
│ Status bar: selection, size, zoom, page, preflight, save, hints     │
└────────────────────────────────────────────────────────────────────┘
```

For an image editor, layers and assets may be docked left and properties right. For slides, a slide navigator can be left and speaker notes below. For word processing, document content and navigation pane may outrank the inspector. For label/print design, dimensions, print constraints, data bindings, preflight, and output controls deserve first-class access.

## 2. Priority order

1. **Document/content work surface** — the object being authored.
2. **Primary action access** — common commands, tool selection, undo/redo, save, zoom, add/insert.
3. **Contextual properties** — controls for the current selection or active tool.
4. **Structure navigation** — layers, pages, slide thumbnails, outline, timeline, asset tree.
5. **Status and diagnostics** — selected object, coordinates/dimensions, zoom, page count, save status, warnings.
6. **Occasional settings** — use menus, preferences, dialogs, or secondary tabs rather than permanently occupying the canvas.

The actual order should follow the task and user research. Do not display two competing primary command areas with duplicated buttons and inconsistent behaviors.

## 3. Practical width budget

For an ordinary 1280px-wide content window, a useful starting layout is:

- tool rail: 48px;
- optional left dock: 220–260px;
- right inspector: 280–320px;
- gaps, separators, and margins: 16–32px total;
- center canvas viewport: remaining width.

At 1440–1920px, the application may show a larger canvas, wider inspectors, or a second dock. At smaller widths, collapse optional panes and allow overlay docks rather than squeezing all controls indefinitely.

### Suggested behavior by available content width

| Workspace width | Behavior |
|---|---|
| ≥ 1600px | Allow left structure pane and right inspector simultaneously; optional contextual dock |
| 1280–1599px | Core shell with resizable panes; hide low-priority secondary pane by default |
| 1024–1279px | Collapse tool groups or optional left pane; inspector can become overlay/drawer |
| < 1024px | Treat as constrained mode: hide or dock panels, reduce ribbon groups, use contextual inspector; do not force a mobile-first stacked layout unless tablet use is a requirement |

These are content-width heuristics, not fixed device breakpoints. Use CSS container queries for components whose behavior depends on their own panel width. Use viewport media queries only when the whole shell genuinely depends on the window width.

## 4. Shell implementation pattern

Use CSS Grid for the large workspace regions and a resizable-panel library/accessible handle for user-adjustable divisions. Avoid multiple nested `position: absolute` hacks for the main application shell.

```css
.app-shell {
  display: grid;
  grid-template-rows: var(--titlebar-height, 32px)
                     var(--menubar-height, 30px)
                     auto minmax(0, 1fr)
                     var(--statusbar-height, 24px);
  width: 100%;
  height: 100dvh;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--app-bg);
  color: var(--text-primary);
}

.workspace {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.workspace__left,
.workspace__right,
.workspace__center {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.workspace__center {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.canvas-viewport {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--surface-inset);
}
```

If the app supports a native title bar, account for platform-specific title-bar regions and window controls. Do not hide OS window controls without implementing reliable replacements and drag regions.

## 5. Menu bar and command organization

Use conventional menu categories when the product has a sufficient number of commands:

- **File:** New, Open, Open Recent, Close, Save, Save As, Import, Export, Print, document properties, exit.
- **Edit:** Undo, Redo, Cut, Copy, Paste, Duplicate, Delete, Select All, Find/Replace, preferences when expected by platform.
- **View:** zoom, fit, rulers, guides, grids, panels, display modes, full screen.
- **Insert:** text, shapes, images, tables, fields, pages/slides, symbols.
- **Format:** typography, fill/stroke, paragraph/layout options appropriate to the product.
- **Arrange:** align, distribute, reorder, group/ungroup, lock/unlock, position and size.
- **Window:** workspace/panel visibility, document tabs, reset workspace, window list.
- **Help:** shortcuts, tutorials/documentation, diagnostics, about.

Do not create a menu category with only one unrelated command unless platform convention or future growth justifies it. Keep destructive actions visually separated from normal commands. Disabled commands must be truly disabled and have a clear reason when useful.

### Command-label style

- Begin with a verb: “Align Left”, “Export PDF”, “Fit to Page”.
- Use ellipses only when a command opens another dialog/step before completion, and apply the convention consistently.
- Show shortcuts right-aligned in menus when known.
- Use sentence case consistently; do not randomly mix title case and sentence case.
- Ensure menu commands, toolbar buttons, context-menu items, and keyboard shortcuts call the same command implementation.

## 6. Toolbar and ribbon rules

- Put the highest-frequency actions nearest the user’s working area and keep grouping stable.
- Use separators, spacing, and subtle group labels to divide commands semantically.
- Prefer icon + accessible label, with visible text for ambiguous or high-risk actions.
- Compact toolbars can use icon-only buttons for standard, discoverable commands if each has an accessible name and tooltip.
- Use a segmented control only for mutually exclusive choices, e.g. Select / Hand or fill/stroke modes; use toggle buttons for independent on/off settings such as grid visibility.
- In contextual toolbars, change controls based on selection type, but do not reorder the whole toolbar unexpectedly on every click. Stable command locations build muscle memory.
- If commands overflow, use a labelled “More tools” menu and retain an obvious path to all important commands.
- Separate document mode from application mode: a “Text” tool is an editing tool; “Dark mode” changes app chrome. Do not combine them in one selector.

## 7. Side panels, docks, inspector and layer tree

### Panels

- Default panels should have clear headings and a predictable close/collapse action.
- Use a draggable splitter with a sufficiently large invisible hit area, a visible cue on hover/focus, keyboard adjustment, and a tooltip such as “Resize Properties panel”.
- Persist widths and collapse state by workspace/profile. Validate stored values before applying them; clamp to supported minimum/maximum values.
- Avoid horizontal scrolling inside property inspectors. At narrow widths, stack label/control rows vertically or collapse advanced groups.
- Prefer one vertical scrolling region per pane. Nested independent scrolling areas should be intentional.
- Do not let a panel resize change document content or alter object geometry.

### Property inspector

- Show properties relevant to the current selection. With no selection, display document/page settings or a useful next action.
- Preserve the user’s scroll position when a property changes, unless a workflow intentionally moves focus to a new control.
- Group controls: Transform, Layout, Appearance, Typography, Data/Content, Effects, Accessibility/Metadata, and Advanced as relevant.
- Display X/Y/W/H or page/paragraph metrics with units. Support linked aspect ratio and exact numeric entry where relevant.
- Numeric fields should support select-all, keyboard increments, unit conversion, validation, and commit-on-Enter/blur rules. Explain invalid values inline.
- If a field is unavailable due to mixed selection, show a deliberate “Mixed” state rather than silently using the first selected object’s value.
- Avoid resetting other fields when one property changes. Support partial updates and undo grouping.

### Layers/object tree

- Represent actual object order and grouping. Use stable IDs and a tree/list data model; do not derive identity from array index.
- Distinguish visibility, lock, group, clipping/mask, and selected states with accessible controls.
- Long trees should be virtualized when needed, while preserving keyboard navigation and expansion state.
- Renaming should be available in a predictable way (F2/double-click where supported, or context menu), with clear commit/cancel behavior.
- Context menus need relevant object actions, not a duplicate copy of every app command.

## 8. Status bar

A status bar is useful when it reports context the user would otherwise have to search for. Examples:

- “Saved” / “Unsaved changes” / “Saving…” / “Couldn’t save”; only claim cloud sync when it truly occurred.
- Selection count and object type.
- Exact dimensions or cursor position with selected units.
- Zoom percentage, fit-to-page, and zoom menu.
- Page/slide count or current page number.
- Print readiness/preflight status (warnings and blockers differentiated).
- A context hint such as “Shift-click to add to selection” when the hint is actionable and not repeated constantly.

Do not place ordinary primary commands in the status bar. Low-priority diagnostic values should be copyable.

## 9. Document tabs and multiple windows

- Show unsaved state on the specific document tab/window.
- Closing a dirty document must save, discard, or cancel; never silently lose edits.
- Support predictable tab ordering and keyboard switching if multi-document editing is supported.
- Keep document state isolated. Switching files must not leak selection, tool settings, undo history, zoom, or object references between documents.
- Use native window menus/commands where the host supports them; browser-only implementations should not falsely imitate unavailable OS functionality.

## 10. Window resizing and persistence

- Define a verified minimum window size that preserves essential controls; do not allow the canvas or inspector to reach zero width accidentally.
- Restore window bounds only if they still intersect a currently available display. Recover sensibly when a monitor is disconnected or the display scale/resolution changes.
- Persist panel sizes, visible panels, layout preset, and possibly canvas zoom/pan per workspace or document, depending on product semantics.
- Persist preferences and workspace layout separately from document content and undo history.
- Support reset-to-default workspace. Resetting a workspace must not reset the document.
- In Electron/Tauri, use native window/state facilities where available rather than only storing arbitrary browser-local layout JSON. Tauri has a window-state plugin; Electron has native window/menu APIs.

## 11. Empty and reduced workspaces

- First run: explain the primary action, e.g. “Create a document”, “Open a file”, or “Choose a template”. Provide a single primary action and a small number of genuine secondary actions.
- No selection: show page/document properties or a useful insertion starting point.
- Empty layer list: explain how objects appear there; do not display a broken-looking tree scaffold.
- Missing assets/fonts: provide a clear resolution path and avoid rendering success states when substitution occurred.
- Hidden panels: retain a discoverable command to restore them.
- Reset workspace: use a confirmation only if the reset would be surprising or costly; name which layout settings will be reset.
