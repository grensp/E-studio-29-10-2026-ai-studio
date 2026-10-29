# 04 — Component Specifications and Interaction Patterns

This file defines shared behavior contracts. Implement each contract with the chosen component library and existing design system; do not invent a new visual behavior for every screen.

## 1. Buttons and tool buttons

### Variants

- **Primary:** one per task region for the main action, e.g. Export, Apply, Create document.
- **Secondary:** common alternative or supporting action.
- **Tertiary/ghost:** low-emphasis toolbar and inline actions.
- **Destructive:** Delete permanently, Remove workspace, Clear document; use explicit copy and confirmation when loss is difficult to recover.
- **Icon button:** compact command with accessible name and tooltip.
- **Toggle button:** persistent on/off tool state, with `aria-pressed` or an equivalent primitive state.

### Rules

- Every button has a real action or is disabled with a reason; no “coming soon” button that appears active.
- Use labels that start with verbs and describe the outcome.
- Set a consistent control height and horizontal padding from the token scale.
- Do not put two primary buttons beside each other unless they form a clear hierarchy with one obvious main action.
- Prevent duplicate submissions when an async command is already running.
- When a command fails, preserve user data and show a useful error message with a next action where possible.
- Never show an icon-only command without an accessible name. For ambiguous commands, use visible text.

### Good labels

- “Export PDF”, “Save”, “Save As…”, “Fit to Page”, “Align Left”, “Lock Selection”, “Insert Image”, “Restore Default Workspace”.
- Avoid “Go”, “Do it”, “OK” when the actual action can be named. Use “OK” only for a dialog whose outcome is already unambiguous.

## 2. Tooltips

Tooltips provide supplementary information, not the only label or the only access path to functionality.

### Recommended defaults

- Initial hover delay: 450–600ms.
- Delay before displaying sibling tooltips after the first one: 0–150ms, to support toolbar scanning without flashing.
- Hide on pointer leave, Escape, or when the target becomes unavailable; keep the tooltip visible while the pointer moves onto the tooltip if the tooltip itself contains interactive content (though ordinary tooltips should not be interactive).
- Show on keyboard focus as well as hover.
- Placement: choose the side with space; avoid clipping and keep near the target. Do not place over the pointer’s active hit area when that causes flicker.
- Typical maximum width: 260–320px; use a wider documentation popover for longer explanations.
- Use short copy; do not duplicate a full help document in a tooltip.
- Show shortcut hints when they help users discover efficient workflows.

### Tooltip template

`Action name` on the first line, followed by an optional one-sentence explanation, then shortcut hint if supported. Keep shortcut labels platform-aware (⌘ on macOS, Ctrl on Windows/Linux) and reflect the actual registered shortcut.

### Example tooltip copy

| Control | Tooltip |
|---|---|
| Undo | `Undo` · `Ctrl+Z` / `⌘Z` |
| Redo | `Redo` · `Ctrl+Shift+Z` / `⌘Shift+Z` |
| Zoom in | `Zoom in` · `Ctrl++` / `⌘+` (only if this is the actual binding) |
| Fit to Page | `Fit the current page in the canvas` |
| Grid toggle | `Show or hide the alignment grid` |
| Snap toggle | `Align objects to the grid, guides, and nearby objects` |
| Lock selection | `Prevent selected objects from being moved or edited` |
| Properties panel | `Show or hide the Properties panel` |
| Export | `Create an output file from the current document` |
| Preflight | `Review issues that could affect output` |
| Resize panel | `Resize the Properties panel` |
| Clear formatting | `Remove direct formatting while keeping the text` |

Do not display tooltips that say only “Button”, “Click here”, or “Help”. Do not use the HTML `title` attribute as the only tooltip strategy for a professional application; it provides limited timing, placement, and keyboard behavior control.

## 3. Inputs and property controls

### Text inputs

- The label communicates the field’s meaning and unit; placeholder text is only an example, not the label.
- Use helper text for constraints and validation. Keep errors adjacent to the field and associate them through `aria-describedby`.
- Commit behavior must be consistent: choose on every keystroke for cheap live properties, on blur/Enter for validated numeric fields, or an explicit Apply action for expensive operations.
- Escape cancels only when a cancel path exists and must not discard confirmed values unexpectedly.
- Preserve a typed but invalid value long enough for the user to correct it. Do not silently coerce `-1` to `0` or `NaN` to an unrelated default.

### Numeric controls

For position, size, angle, font size, stroke width, spacing, and similar values:

- Show a unit or a unit selector when the unit is not obvious.
- Support direct numeric entry and keyboard stepping; where relevant use a small increment and a modifier for larger changes.
- Support `min`, `max`, precision, step, parse, and format rules in one reusable field implementation.
- Do not assume `type="number"` alone provides acceptable locale, units, wheel, and editing behavior.
- Avoid changing a value on scroll-wheel merely because the cursor is over it unless that is the deliberate product convention. Require focus or an explicit spinner interaction if accidental edits are likely.
- Use tabular numerals for aligned values.

### Color, opacity, fill and stroke

- Present a concise swatch and the current value. A dedicated popover can provide palette, color model inputs, recent colors, opacity, gradient or stroke settings.
- Preserve transparency and color-space meaning in the document model.
- Avoid relying on color swatches alone when the user needs precise values; include hex/RGB/other relevant input and a text label.
- Avoid a palette popover that closes after every single channel entry.

### Font controls

- The font-family field should show font names in a readable way. Avoid loading hundreds of font files into the interface before they are needed.
- Missing-font states must indicate substitution and provide a way to resolve it.
- Font-size values need explicit units and numeric stepping.
- Show formatting toggles as toggles and reflect the actual selection, including mixed state for multiple text objects.

### Inspector row patterns

Recommended default row: label left, control right; label column 80–110px, control column fills the rest, 8–12px gap. At narrow panel widths, stack label and control. Keep units visible and align numeric controls to aid scanning.

## 4. Menus, popovers, and context menus

- Use a menu primitive with correct focus movement, Escape behavior, arrow-key navigation, typeahead where appropriate, checked states and submenu handling.
- Do not build a drop-down from arbitrary `div` elements unless implementing the complete keyboard/accessibility behavior.
- Open menus near the trigger and keep them within the viewport. Handle right-click near screen edges.
- Context menu items should be relevant to the target and selection. Avoid making a custom right-click menu the only way to reach common commands.
- Show checked state for toggles (Grid, Guides, Lock, Hide) and shortcuts where known.
- Keep dangerous items separated and clearly labelled. If confirmation is necessary, name the object or consequence: “Delete 4 selected objects?” rather than “Are you sure?”.
- A popover can contain controls; a tooltip should not contain interactive controls. Choose the right pattern.

## 5. Dialogs and confirmation

Use dialogs for tasks that require a focused decision or several related fields, not for every tiny operation.

- Title names the task, not a generic “Dialog”.
- Include a short description if consequences or constraints are not obvious.
- Primary action at the predictable end of the action row; cancel is explicit.
- Escape closes only when safe; Enter submits only when a sensible default exists and text editing is not active.
- On open, move focus into the dialog; on close, restore focus to the trigger unless the task naturally moves focus elsewhere.
- Handle long content with a deliberate scroll area and keep essential actions available.
- Validation errors should not close the dialog or lose entered content.
- Confirm destructive actions only when the action is irreversible, broad, expensive, or unusually risky. A reliable undo action can be a better safety mechanism than over-confirming every edit.

### Example copy

- Delete one object: `Delete “Price” from this document?` with supporting copy `This object will be removed. You can undo this action.`
- Clear the entire page: `Clear page contents?` with `All objects on this page will be removed. This can be undone.`
- Replace imported content: `Replace current document?` with `The current document has unsaved changes.` and Save / Discard / Cancel paths.
- Output blocker: `Export could not start` followed by the exact blocker and the control that can resolve it.

## 6. Notifications, toasts, and inline status

- Use toasts for short-lived, non-blocking confirmations or errors; use inline status for ongoing state such as saving, preflight issues, or field validation.
- Success example: `PDF exported to Downloads.` only after the export actually succeeds.
- Failure example: `Export failed. The output file could not be written. Check the destination and try again.`
- Save example: `Saving…`, `Saved`, or `Couldn’t save. Retry`. Do not use a green check for an unverified background operation.
- Toasts should be dismissible; important errors should persist long enough or remain inline. Avoid stacking a dozen toasts during batch jobs.
- Use a live region for status that must be announced by assistive technology, but do not announce every pointer movement or low-value progress update.

## 7. Drag-and-drop and direct manipulation

- The cursor and object preview should indicate what is being dragged.
- Use pointer capture where appropriate so a drag continues when the pointer leaves the original target; cleanly handle `pointerup`, `pointercancel`, window blur, and unmount.
- Show drop targets and an insertion indicator before completing the operation.
- Support cancellation with Escape where safe.
- Do not begin a drag after text selection or an interactive child press. Use deliberate drag handles for list reordering if needed.
- Provide a non-drag path for essential features (numeric position, Move Up/Down, click-to-select then menu command, or accessible action buttons) as appropriate to WCAG 2.2.
- Use one clear snap/threshold policy to distinguish click from drag.
- Dragging files into the workspace should support supported types, display a useful rejection message for unsupported content, and not overwrite the current document without an explicit decision.

## 8. Scrolling and wheel semantics

- Vertical wheel over an inspector scrolls the inspector; over the canvas it should pan/zoom only according to a documented interaction model.
- If wheel zoom is supported, use a modifier (commonly Ctrl/Command) or a clear setting to avoid hijacking ordinary scroll gestures, particularly on trackpads.
- Preserve natural text-field, list, and menu scrolling. Do not trap wheel events globally.
- Panel scrolling and canvas zoom must be tested with mouse wheel and trackpad gestures.
- If scrolling a number input can alter a value, prevent accidental value changes where consistent with the component behavior.

## 9. File operations and output workflows

- New, Open, Import, Save, Save As, Export, Print and Close must have distinct semantics and labels.
- File-open/import must validate type and content and report why a file was rejected. Never trust only a file extension.
- For overwriting, confirm at the moment of risk and preserve the original if the operation fails.
- Export settings should expose relevant quality, format, page/range, color, resolution, and bleed settings without burying defaults unnecessarily.
- Show progress for lengthy operations with cancel support when safe. Keep the interface responsive.
- Export output must be verified before claiming success. Distinguish “file generated” from “printed successfully”, “uploaded”, or “deployed to a physical device”.
- Use preflight checks for domain-relevant issues and map each issue to a fixable object/property where possible.

## 10. Keyboard shortcuts

A good shortcut table is documented, conflict-checked, platform-aware, and wired to the same command implementation used by menus.

| Action | Windows/Linux default | macOS default | Notes |
|---|---|---|---|
| New document | Ctrl+N | ⌘N | Use platform mapping |
| Open | Ctrl+O | ⌘O | Native file dialog if available |
| Save | Ctrl+S | ⌘S | Document owner handles save |
| Save As | Ctrl+Shift+S | ⌘Shift+S | If supported |
| Undo | Ctrl+Z | ⌘Z | One meaningful operation at a time |
| Redo | Ctrl+Y or Ctrl+Shift+Z | ⌘Shift+Z | Choose consistent product convention |
| Cut/Copy/Paste | Ctrl+X/C/V | ⌘X/C/V | Respect text-editing focus |
| Duplicate | Ctrl+D | ⌘D | Avoid conflict with browser/app conventions; test |
| Select all | Ctrl+A | ⌘A | Must target text editor or canvas correctly |
| Find | Ctrl+F | ⌘F | Contextually find content/object where useful |
| Delete selection | Delete/Backspace | Delete/Backspace | Confirm only when risk warrants |
| Nudge | Arrow keys | Arrow keys | Document-unit increment |
| Fine/larger nudge | Shift+Arrow or Alt+Arrow | Same chosen mapping | Publish exact semantics |
| Zoom in/out | Ctrl+Plus/Minus | ⌘Plus/Minus | Avoid key-layout assumptions |
| Fit page | Ctrl+0 | ⌘0 | Check OS/browser conflicts |
| Save workspace | Product-specific | Product-specific | Only when workspace can be saved separately |

This table is a starting point, not a mandatory binding map. Check platform conventions, installed shortcuts, keyboard layouts, browser reserved actions, and the native shell before assigning a key. Provide Preferences → Shortcuts when the product has enough complexity.

## 11. Command routing and shortcut ownership

- Register commands with stable IDs, labels, enable predicates, execution handlers, and optional shortcut metadata.
- A menu command, toolbar button, context-menu item, palette action, and shortcut should call the same command service.
- Scope shortcuts deliberately: global app, workspace, canvas, active text editor, dialog, or field. The most local valid text-editing context usually owns normal editing keys.
- Avoid `window.addEventListener('keydown', ...)` handlers that intercept keys from inputs. Ignore events with `defaultPrevented`, modifier combinations owned by browser/platform, input/select/textarea/contentEditable contexts where appropriate, and IME composition.
- Clean up listeners and avoid registering the same shortcut multiple times.
- Display a shortcut only if it is registered and active in the current context.

## 12. Interaction contract table

| Input | Expected contract |
|---|---|
| Hover | Quiet surface cue or tooltip after delay; no destructive side effect |
| Pointer down | Establish potential gesture; avoid committing a document change prematurely |
| Drag | Preview movement/resize/reorder; capture pointer if needed; cancellation is defined |
| Pointer up | Validate and commit a single coherent operation |
| Right click/context-menu key | Open relevant menu without accidental selection loss |
| Enter | Activate control, commit field, or confirm current tool operation depending on focus |
| Escape | Dismiss current overlay, cancel current operation, or exit text/tool submode in a documented order |
| Tab / Shift+Tab | Predictable focus movement; composites use expected arrow-key behavior |
| Arrow keys | Navigate a widget or nudge a canvas object depending on focus; never ambiguous |
| Ctrl/Command+Z | Undo the most recent document command in the active editing context |
| Focus leave | Commit or cancel according to the field’s documented policy; do not lose edits silently |

## 13. State matrix for each component

For every reusable component, describe and test the states it can actually enter:

- default;
- hovered;
- keyboard-focused;
- pressed/active;
- selected/toggled;
- disabled (and why, where the reason may surprise users);
- loading/busy;
- invalid/error;
- read-only;
- mixed-value (for multi-selection controls);
- high-contrast/forced-colors if targeted;
- light and dark theme.

Do not blindly implement a state that does not make semantic sense for that component. The point is to make the state model deliberate, not to add decorative styling for its own sake.
