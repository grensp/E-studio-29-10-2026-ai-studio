# 10 — Product Archetypes and Domain-Specific UI Rules

A single editor foundation can support multiple content models, but each product needs distinct workflows and inspector groups. Do not use one generic “canvas + properties panel” pattern without adapting the panels, commands, terminology, and output checks to the product.

## 1. Label, price-tag, packaging, signage, and print-layout designers

### Primary workflow

Choose/open a template → set page/label geometry → add or bind content → arrange objects → inspect print constraints → preview → export/print/deploy through a verified output path.

### Recommended workbench

- **Top:** File/Edit/View/Insert/Arrange/Output menus and common commands.
- **Left:** Select, text, shape, image, barcode/QR, line, table, field/variable, hand/zoom tools.
- **Center:** page/label with rulers, margin/safe/bleed boundaries, grid/guides, zoom and pan.
- **Right inspector:** selected object properties plus data-binding/conditional rules where relevant.
- **Optional bottom/left dock:** layers, records/variants, template thumbnails, multi-label imposition/page navigator.
- **Status/footer:** physical dimensions, zoom, selected object, page/variant, preflight status, save state.

### Inspector groups and fields

| Group | Typical fields |
|---|---|
| Document / label | width, height, units, orientation, stock/template, background, page/label count |
| Position & size | X, Y, W, H, rotation, aspect lock, anchor/alignment |
| Appearance | fill, stroke, opacity, border style, corners, effects where supported |
| Text | content/data field, font family, size, weight, line-height, align, wrap, fit/overflow |
| Image | asset, crop/fit, aspect lock, rotation, DPI/resolution warning |
| Barcode / QR | symbology, value/data binding, module/bar width, quiet zone, human-readable text, validation state |
| Data / variables | source field, formatter, fallback, preview record, conditional visibility |
| Price / promo element | current price, previous price, discount %, currency/locale, tier/quantity rules, effective dates, visibility conditions |
| Print / output | color mode, resolution, bleed, imposition, output format, printer capability, preflight |
| Layers | name, order, visibility, lock, group, data-bound/conditional marker |

Only display properties supported by the current object type. Clearly distinguish data preview from saved content. For dynamically generated objects (e.g. price tiers), preview the selected record and display why an element is visible/hidden.

### Domain requirements

- Store physical dimensions in a canonical unit such as millimeters or points; convert for display/rendering.
- Display page and label sizes with units, and make unit changes non-destructive.
- Keep safe margin, bleed, cutter gap, printer margin, and imposition slot geometry as distinct concepts. Do not represent all as a single “margin” value.
- Barcode/QR options must use the chosen symbology’s real validation rules. Do not imply that a visually generated code is scannable without testing/validation.
- If output deployment to a physical printer is not implemented, label the feature as export/print preview rather than printer deployment.
- Preflight should separate blockers from warnings and map each issue to an object or setting that can fix it.
- Export must be tested at realistic page sizes and output resolution; do not rely solely on the editor’s low-resolution viewport.
- Template defaults should not create undocumented hidden objects, duplicate labels, or synthetic pages.

### Example tooltips

- **Insert Barcode:** `Add a barcode and configure its symbology and value.`
- **Preview Record:** `Preview this label using the selected data record. Does not modify the source data.`
- **Bleed:** `Extend artwork beyond the trim boundary to reduce unprinted edges after cutting.` (only when this matches the print workflow)
- **Preflight:** `Check content, geometry, assets and output settings before export.`
- **Imposition:** `Arrange multiple labels on a sheet using the selected slot and spacing rules.`

## 2. Image/photo editing and illustration tools

### Primary workflow

Open/import → inspect pixels/layers → make non-destructive edits where feasible → use selection/crop/transform → inspect color/resolution → export.

### Workspace priorities

- Canvas is dominant with pan/zoom and useful zoom presets.
- Layers and history are persistently accessible.
- Properties change with the selected layer, tool, mask, adjustment, or selection.
- Tool options appear near the main toolbar or inspector.
- Histogram, color picker, navigator/minimap, and asset browser are optional contextual docks—not mandatory permanent panels in every workflow.

### Inspector groups

- Transform: X/Y, width/height, rotation, flip, crop/anchor, scale.
- Pixel/image: dimensions, resolution, color mode/profile, bit depth, alpha/transparency.
- Layer: visibility, opacity, blend mode, clipping/mask, lock, grouping.
- Selection: feather, expand/contract, invert, refine edge, clear.
- Brush: size, hardness, opacity/flow, spacing, pressure if supported.
- Color: foreground/background, palette, RGB/HSL/hex, profile.
- Effects/adjustments: parameters, enable/disable, reorder, reset.

### Domain requirements

- Distinguish destructive raster operations from non-destructive adjustment layers or editable transforms.
- Give a clear indication when a transformation or filter is still previewing/rendering.
- Track selection, layer selection, and keyboard focus separately.
- Avoid blocking the UI for large image operations; use progress/cancel when safe.
- Preserve color profile/alpha metadata where supported; disclose conversion.
- Undo history should be bounded or resource-aware for large image mutations.
- Image export must report format, dimensions, and meaningful quality settings; don't promise lossless output for a lossy format.

## 3. Word processors and rich-text document editors

### Primary workflow

Open/create document → edit content with stable caret/selection → structure and format → navigate pages/outline → review/annotate → save/export/print.

### Workspace priorities

- Document page area is central and readable; show page boundaries, margins, headers/footers, and page gaps when the model supports pagination.
- Use a text-editing engine/model capable of rich text, selection, composition, undo and paragraph semantics; do not build a word processor by wiring a few buttons to `contentEditable` without a proper model.
- Use styles/paragraph structure and semantic headings, not just arbitrary per-run formatting.
- Provide navigation/outline/find panel when the document length warrants it.
- Formatting controls should reflect the current text selection, paragraph, table cell, or mixed state.
- Page layout mode and web/continuous mode should be distinguishable.

### Typical groups

- Character: font, size, bold, italic, underline, color, highlight, script/case.
- Paragraph: alignment, indent, line/paragraph spacing, bullets/numbering, keep-with-next where relevant.
- Page: margins, orientation, columns, size, page breaks, header/footer.
- Insert: table, image, link, page number, fields, symbols, references/comments.
- Review: comments, track changes, spelling/grammar, word count, compare.
- Accessibility/structure: heading level, language, alt text, table headers, reading order.

### Domain requirements

- Ctrl/Command+A, arrows, Delete, Enter, Tab, Home/End and undo/redo must respect the text editor’s focus and caret state.
- Handle IME composition, paste, multi-range selection where supported, keyboard navigation in tables, and selection mapping.
- Provide reliable save/recovery and export/print consistency.
- Avoid reflow surprises when changing page widths or font metrics.
- Keep the accessible reading structure distinct from visual styling.

## 4. Presentation and slide editors

### Primary workflow

Create/open deck → add/reorder slides → design current slide → align/distribute/group objects → manage speaker notes/transition if supported → present/export.

### Workspace priorities

- Slide thumbnail navigator on the left, main slide canvas in the center, properties/format inspector on the right.
- Bottom notes area or presenter notes toggle when notes are a real workflow.
- A persistent slide count and current slide index; optional master/layout/theme editor separated from normal slide editing.
- Multi-select/reorder thumbnails via drag and buttons/menu alternatives.
- Present mode should be a distinct mode with obvious exit controls and correct keyboard handling.

### Inspector groups

- Slide: layout, background, size/aspect ratio, master/theme.
- Object: position, size, rotation, alignment, grouping, z-order.
- Text: typography, alignment, margins, autofit/overflow.
- Media: crop, fit, playback/audio settings where supported.
- Animation/transition: timeline/order/duration only when implemented.
- Accessibility: alternative text, reading order, title, speaker notes as relevant.

### Domain requirements

- Object order and reading order may differ; preserve both when the document format supports them.
- Avoid text overflow that is invisible until presentation/export. Provide visible warnings or autofit controls.
- Ensure slide thumbnails update without full-deck rerender on each pointer move.
- Presentation shortcuts must be scoped to presentation mode and must not trigger during ordinary text editing.
- Theme/master changes should have a clearly defined scope and should not silently destroy local formatting.

## 5. Diagramming, flowchart and technical layout tools

### Primary workflow

Create node/connector → connect and route → align/distribute → group/container → annotate → validate links/flow → export/share.

### Inspector groups

- Geometry: X/Y/W/H, rotation, position constraints.
- Shape: type, fill/stroke, corner radius, line style, arrowheads.
- Text: content, alignment, padding, wrap, label placement.
- Connector: endpoints, attachment point, routing, waypoints, arrowheads.
- Layout: alignment, distribution, spacing, flow direction, auto-layout parameters.
- Metadata: IDs, semantic types, status, data binding, alt text.

### Domain requirements

- Node identity must be stable while edges reference IDs, not current array positions.
- Validate dangling connectors when nodes are deleted; define whether connections delete, reroute or remain dangling.
- Preserve endpoints through node movement and group transforms.
- Make snapping and align/distribute behavior predictable.
- Do not represent semantic graph topology solely as pixels or manually routed SVG paths.

## 6. Shared components and names across products

A component may be shared when both the **interaction contract** and the **semantic meaning** are shared. A generic button, split pane, command menu, color picker shell, or property-row layout can be shared. A “Slide Layout” picker and a “Label Stock” picker should not be forced into one component API just because both are dropdowns.

Keep these separate where semantics differ:

- image crop vs object resize;
- text selection vs canvas selection;
- page background vs app theme background;
- print margins vs panel padding;
- layer visibility vs item disabled state;
- slide thumbnail selection vs canvas object selection;
- file import vs document open;
- export image vs print/deploy output.

## 7. Choosing the next best panel/action

When unsure what belongs in a panel, ask:

1. Does the user change this value frequently during the primary workflow? If yes, keep it visible in a toolbar or inspector.
2. Is it relevant only for one object/tool/type? If yes, use a contextual inspector section.
3. Is it rarely changed and application-wide? If yes, use Preferences.
4. Is it a complex task with validation/output options? If yes, use a focused workspace or dialog.
5. Is it a diagnostic result with a fix path? If yes, use a preflight/issues panel that links to the affected object/setting.

Avoid creating a new panel when the same action can be clearly integrated into an existing one.
