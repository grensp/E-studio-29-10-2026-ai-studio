# 03 — Canvas and Document-Editor UX

A canvas is not merely a large drawing area. It is a structured document editor with a coordinate system, selection model, transient gestures, commands, persistent content, and a rendering layer. Preserve that separation in the UI and implementation.

## 1. Choose an explicit document model

Define the editing concepts that belong to the product:

- **Document:** saved file/project, shared metadata, document-level options.
- **Page/artboard/slide/label:** a bounded output area with size, orientation, background, margins/bleed/safe region when applicable.
- **Object/node:** text, image, shape, barcode, chart, group, frame, path, table, field, or domain-specific element.
- **Layer/stack order:** visual ordering and grouping.
- **Selection:** currently targeted object IDs; this is interaction state, not the document itself.
- **Tool:** the current user intent (select, pan, text, shape, hand, crop, etc.).
- **Viewport:** zoom, pan/scroll, and visible region.
- **Guides/grid/snap settings:** workspace preferences or document settings depending on whether they print/export.
- **History:** reversible commands or snapshots independent of viewport-only motion where possible.
- **Preflight/validation:** domain-specific issues that affect output, such as overflow, missing fonts/images, invalid variables, insufficient resolution, bleed, clipping, or unsupported output capabilities.

Do not merge all of these into one giant `EditorState` unless the existing architecture deliberately models it that way and remains maintainable.

## 2. Coordinate systems and units

The UI must visibly distinguish screen pixels from document units. A robust editor typically has at least:

1. **Document coordinates:** stable units used to persist object geometry (e.g. CSS-like logical units, points, millimeters, inches, or normalized coordinates).
2. **Viewport/screen coordinates:** pointer positions and rendered locations, transformed by zoom and pan.
3. **Object-local coordinates:** useful for nested groups, rotations, paths, frames, and transform handles.

Use one canonical persisted unit per product or document format. Convert at the renderer/property-input boundaries. Never persist values already multiplied by the current zoom factor.

For a simple unrotated viewport:

```ts
export type Point = { x: number; y: number };
export type Viewport = { zoom: number; panX: number; panY: number };

export function screenToDocument(point: Point, view: Viewport): Point {
  return {
    x: (point.x - view.panX) / view.zoom,
    y: (point.y - view.panY) / view.zoom,
  };
}

export function documentToScreen(point: Point, view: Viewport): Point {
  return {
    x: point.x * view.zoom + view.panX,
    y: point.y * view.zoom + view.panY,
  };
}
```

If rotation, nested transforms, or nonuniform scaling exists, use a proper transform matrix or engine-supported transform utilities; do not extend this simple formula with ad hoc math.

### Print/layout applications

- Keep real document dimensions in domain units, e.g. mm and pt, separate from the editor's CSS pixels.
- Use the correct physical page geometry and orientation. Do not treat a 300-DPI export preview’s pixel width as the canonical page size.
- Handle bleed, margins, safe areas, printer limitations, page fitting, and barcode/QR quiet zones where the domain requires them.
- Distinguish visual preflight warnings from verified output constraints. If the app cannot validate actual printer firmware or printer margins, say so plainly.
- On export, use the same geometry/object interpretation as preview wherever possible. Maintain a clear renderer contract to reduce “looks right on canvas, different in PDF/print” defects.

## 3. Canvas background and surrounding area

- The canvas surround may use a neutral recessed surface; the page/artboard should have a clearly visible edge, subtle shadow, or border.
- Provide optional page border, rulers, guides, grid, margins, safe region, bleed region, and page background as distinct visual layers.
- UI aids must not accidentally become document content or export. Make that distinction explicit in the model and renderer.
- Dark application theme must not silently tint a white page, print label, or slide. Use the document’s true background.
- Avoid strong checkerboard/texture behind every document unless transparency is central (e.g. image editing). Keep the paper boundary visible against both light and dark themes.
- On a multi-page canvas, show active page, page spacing, and selection state without cluttering the document itself.

## 4. Zoom and pan

Required behavior where applicable:

- Zoom in/out, percentage entry, fit page/artboard, fit selection, and fit all/content.
- A clearly visible current zoom percentage.
- Optional zoom-to-cursor behavior; if supported, it must preserve the document point under the pointer.
- Pan via hand tool, middle-mouse drag, or a documented spacebar modifier. Avoid stealing the spacebar when the user is typing into a text field or editing text in place.
- Minimum and maximum zoom should be configurable to a sensible domain range. Clamp invalid, `NaN`, zero, and infinite values.
- Zoom/pan should not mark document content as modified unless viewport state is intentionally persisted with the document.
- On “Fit”, account for all non-collapsed UI panes and canvas padding, not the entire browser window.
- Respect high-DPI displays. Avoid rendering at an arbitrary low-resolution backing store and then scaling blurry output.
- Avoid overanimated zoom. The user should maintain orientation and know what point they are zooming around.

A common zoom-around-pointer calculation in screen/pan coordinates is:

```ts
export function zoomAtPoint(
  point: Point,
  view: Viewport,
  nextZoom: number,
): Viewport {
  const zoom = Math.min(8, Math.max(0.05, nextZoom));
  const docPoint = screenToDocument(point, view);
  return {
    zoom,
    panX: point.x - docPoint.x * zoom,
    panY: point.y - docPoint.y * zoom,
  };
}
```

This assumes a simple scale+translation viewport. If the chosen rendering engine owns viewport transformations, adapt to the engine’s documented coordinate utilities rather than maintaining conflicting transforms.

## 5. Selection model

Define the rules before implementation:

- Click selects an object; clicking empty space clears selection unless a modifier or special tool changes that behavior.
- Ctrl/Command-click toggles or adds to selection according to a documented product convention.
- Shift-click may add contiguous items or extend selection, depending on the context; do not use inconsistent semantics in canvas and layer tree without a reason.
- Dragging from empty space may create a marquee selection in select mode. Respect partially-versus-fully-contained selection rules and show a clear marquee.
- Clicking a locked object should not accidentally edit it. Make the lock state discoverable and provide a way to select/reveal locked objects if the product requires it.
- Groups need predictable selection: select group, enter group, or modifier-click child. Make the current nesting context visible.
- Text editing and object selection are separate modes. Double-click or Enter may enter text editing; Escape should exit it predictably without deleting content.
- Multi-selection should show a single collective bounding box where applicable and define whether operations apply to every selected item.
- Empty click should not discard an unfinished edit without committing or prompting according to the editor’s focus model.
- If a selection contains incompatible object types, the inspector must indicate mixed/unsupported properties rather than lying about the selection.

## 6. Transform controls

Common controls and behavior:

- Move with pointer; support exact X/Y properties.
- Resize with corner/edge handles; support exact W/H, aspect-ratio lock, and minimum sizes.
- Rotate with a rotation handle and numeric angle where relevant.
- Optional skew, crop, free-transform, perspective, anchor, pivot, or advanced transform only when the product supports their semantics.
- Provide alignment/distribution commands and optionally smart guides.
- Use modifier keys to constrain geometry (e.g. proportional resize, axis-constrained movement) only after documenting and implementing cross-platform semantics.
- Provide keyboard nudge; support larger nudges with Shift if that convention suits the product.
- Define whether resizing changes font size, text box dimensions, shape bounds, image crop, or scale. Different object types may require different semantics.
- Prevent negative geometry, invalid rotation values, nonfinite coordinates, and invisible zero-sized objects unless the document model explicitly supports them.
- Apply transforms through document commands. During a drag, use transient render state or an interaction session; commit the final transform as one undo step.

### Handle geometry

- Selection outline: 1–2px at screen scale, clearly distinguishable against the canvas.
- Handle visual diameter: roughly 6–8px at normal zoom; increase interaction hit area invisibly where the engine permits.
- Rotation handle: visibly different from resize handles, with a clear connector line.
- Handles must remain usable at small zoom. Consider constant-screen-size handles rather than scaling handle size with document zoom.
- For small objects, do not let a dense ring of handles obscure the object. Hide low-value handles or provide numeric properties.
- Draw selection/focus/snap guides above content but below menus/tooltips; make z-order deliberate.

## 7. Snapping, alignment, rulers, and guides

- Snapping must be a user-controllable setting with a visible state. If several sources exist (grid, guides, object edges, center lines, page bounds), define their priority and tie-breaking rules.
- Show a guide cue when a snap occurs; do not silently move an object far from the pointer.
- Provide a temporary modifier to suppress snap or fine movement if appropriate.
- Rulers should use the document’s display units and a tick interval that adapts to zoom. Keep labels readable and avoid tick-label collisions.
- Guides must have reliable selection, movement, deletion, and visibility semantics.
- Grid lines should not compete with document content. Use stronger major intervals and lighter minor intervals.
- Alignment/distribution should operate on the selection’s well-defined bounds, including rotated objects if the product promises that behavior.
- Smart guides should appear briefly and only when relevant; avoid flashing dozens of guide lines.
- Snap aids must not contaminate exported output unless expressly part of the document.

## 8. Layers, grouping, locking, and ordering

- Use a stable object identifier. Never use array index, visible label, or canvas node object identity as a persisted ID.
- Keep object order deterministic and provide Bring Forward/Send Backward/Bring to Front/Send to Back commands as applicable.
- Group/ungroup must preserve absolute appearance and use a well-defined local-coordinate transform.
- Visibility is different from deletion; locked is different from hidden. Use distinct icons/labels and states.
- Prevent accidental drag of a hidden or locked object.
- Support nested group expansion with visible tree indentation and correct keyboard semantics.
- For tables, timeline tracks, layers, long asset lists, or huge documents, virtualize where needed without losing selection, drag/drop targets, keyboard focus, or accessibility.

## 9. Text editing on canvas

Text tools are especially easy to get wrong because the browser/React UI itself also uses text selection and keyboard navigation.

- Define when Enter edits text versus commits a property, starts a new paragraph, or applies a dialog action.
- In-place text editing should use a robust text editor/overlay or the canvas engine’s supported mechanism; do not attempt to emulate a full text editor with a few `keydown` handlers.
- Preserve caret, selection range, IME composition, paste, undo, and keyboard navigation.
- Ensure shortcuts such as Ctrl/Command+A affect the text selection when the text editor owns focus, and the canvas selection when the canvas owns focus.
- Avoid canvas-wide listeners overriding native editing, browser/system shortcuts, or accessibility controls.
- When changing font/size/alignment through the inspector, preserve the active text selection where feasible and commit as a proper undoable command.
- Use document fonts for content and app fonts for chrome.
- For word processing and slides, evaluate whether the text model requires rich text ranges, paragraph properties, tables, footnotes, pagination, comments, or collaborative editing before choosing a primitive contentEditable implementation.

## 10. Tools and cursor modes

Common tools may include Select, Hand/Pan, Text, Shape, Image, Crop, Pen/Path, Connector, Table, Barcode, QR, Eyedropper, Zoom, Comment, or product-specific tools.

- Each tool has a unique, meaningful icon and accessible label.
- Active tool state must be visible and distinct from keyboard focus.
- Cursor appearance communicates behavior: select, move, text insertion, crosshair, resize, rotate, forbidden, etc.
- Escape exits the current sub-operation or returns to selection in a predictable sequence.
- Enter confirms where a confirm step exists; Escape cancels only the current pending operation unless the product explicitly defines otherwise.
- Tool options belong in a contextual option bar or inspector. Do not bury frequently changed tool options in Preferences.
- Tool state and selection state are separate. Changing a tool should not silently delete the selected objects.
- Shortcuts should not conflict with text editing, IME, browser accessibility, or platform-level reserved shortcuts.

## 11. Undo/redo, dirty state, and commands

- Every meaningful content mutation is undoable unless it is explicitly irreversible and clearly disclosed.
- A drag-resize produces one undo step on pointer release, not hundreds of entries.
- Selection movement, zoom and pan generally should not pollute document history unless viewport edits are a deliberate product feature.
- Typing should be coalesced into sensible typing undo units, respecting caret movements and edit boundaries.
- The menu, toolbar, shortcuts, context menus, and command palette must route to a shared command/service layer.
- Disabled undo/redo states must track real history availability.
- Track document dirty state against a saved revision/version or equivalent. Do not toggle dirty state by hand in scattered event handlers.
- Saving should not clear the dirty indicator if a later edit occurred during an async save. Associate saves with the revision being saved.
- If an undo/redo command is unavailable, it must no-op safely and present the correct disabled state.

## 12. Rendering, zoom layers, and performance

- Separate UI chrome from the rendering surface; do not nest the entire application inside the canvas renderer.
- Avoid re-rendering every node on every `pointermove` when a transient overlay or imperative engine update can handle interaction safely.
- Use memoization/selectors only where profiling shows a benefit; premature wrapping can complicate behavior.
- Keep large binary/image payloads out of Zustand JSON persistence and ordinary UI selector state. Store references/metadata and use an appropriate asset service.
- Batch expensive redraws where the renderer allows it; clean up listeners, animation frames, workers, observers, and engine references on unmount.
- Consider viewport culling, layer separation, level-of-detail behavior, and virtualization for large documents.
- For big tables/layer lists, consider TanStack Virtual or another accessible virtualization strategy.
- Test with realistically large files and many nodes—not only five rectangles in a demo.

## 13. Canvas engine decision guide

Prefer the established engine already used by the project if it satisfies the product’s rendering, selection, export, and input requirements.

| Approach | Good fit | Cautions |
|---|---|---|
| DOM + CSS | Text-heavy documents, forms, semantic content, complex focus/accessibility, layout that naturally maps to HTML | High-count freeform objects and transform/zoom may become costly or hard to manage |
| SVG | Vector layout, shapes, labels, diagrams, crisp scaling, DOM-accessible object tree for moderate complexity | Very large numbers of nodes/filters can impact performance; text/selection/editor behavior needs deliberate implementation |
| Canvas 2D custom renderer | Specialized high-density rendering, complete draw control, custom hit-testing and export pipeline | Must implement selection, accessibility alternatives, text editing, serialization, object hit-testing and redraw lifecycle carefully |
| `react-konva` / Konva | Interactive 2D scene graph with shapes, drag/resize, layers, transform tools | React state and imperative Konva nodes must remain synchronized; understand how transforms affect scale and bounds |
| Fabric.js | Object-oriented canvas editor with selection/transforms, object stack, viewport, serialization and SVG/image export | Verify current API and export fidelity; test text editing, font mapping, custom object serialization and version compatibility |
| PixiJS/WebGL | Very large or highly visual scenes where GPU acceleration is relevant | Adds complexity; text accessibility, direct selection handles, print-accurate export and DOM integration require architecture |
| Specialized editor engine | Word processor/presentation/diagram/timeline with deep semantics | Choose based on document model and export/collaboration needs; avoid building a text engine from scratch without a strong reason |

Do not select an engine based only on a demo or visual appearance. Evaluate: object model, transforms, text editing, grouping, hit-testing, serialization, import/export, printing, accessibility, memory, performance, licensing, maintenance, and long-document behavior.

## 14. Canvas interaction acceptance criteria

A production canvas workflow should verify at least:

- Select, deselect, multi-select, move, resize, rotate, lock, hide, order, group, duplicate, delete, undo and redo.
- Precise geometry through property fields and arrow-key nudging.
- Correct mapping between screen and document coordinates at multiple zoom factors.
- Snap/grid/rulers and guide visibility that does not enter output by accident.
- Text editing without broken caret/selection/IME behavior.
- Document save/reopen retains every supported object property.
- Preview/export/print geometry agrees with the document model and reports unsupported features.
- Large files remain responsive enough for the declared product target.
