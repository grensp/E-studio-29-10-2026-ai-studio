# 05 — Accessibility and Responsive Desktop Behavior

Accessibility is an interaction requirement, not a final visual polish task. Follow WCAG 2.2 AA where applicable, the WAI-ARIA Authoring Practices for custom widgets, platform keyboard conventions, and the actual assistive technologies supported by the product.

## 1. Keyboard is a first-class input

- Every essential function is reachable and usable without a mouse.
- Keyboard focus is always visible and does not depend solely on hover.
- Tab order follows a meaningful sequence through shell, active workspace, panels, dialogs, and status areas.
- Composite controls use the expected navigation model: arrow keys inside menus, tabs, radio groups, listboxes, grids, and trees where appropriate; Tab moves between composite widgets.
- Do not place every item in a large toolbar into the tab order if a roving-tabindex/arrow-navigation model is more appropriate.
- Provide escape paths from popovers, menus, modal dialogs, canvas tools, text editing, and active drag/transform gestures.
- Restore focus after a dialog or popup closes unless the user’s next task makes another focus target more logical.
- Clearly distinguish selection from keyboard focus. A selected object is not necessarily the focused interactive control.
- Preserve focus when the inspector updates or a selected object is modified. Avoid remounting whole panel trees on each property edit.
- Do not disable outlines globally without replacing them with an equally clear `:focus-visible` state.

## 2. Canvas accessibility

Canvas work surfaces create special challenges because many objects may not be represented as individually focusable DOM elements.

- Offer a keyboard-operable object list/layers tree that exposes the same objects as the canvas.
- Provide an accessible name and role for the workspace/canvas region and summarize the current selection/active tool when useful.
- Ensure selecting an item in the object tree selects the corresponding canvas object and vice versa.
- Provide keyboard equivalents for move, resize, rotate, align, reorder, group, lock, hide, and delete where those functions exist.
- Essential drag-based actions need an alternative that does not require dragging: exact numeric fields, menu commands, buttons, keyboard nudging, or another one-pointer path.
- Do not announce every pointer move to screen readers. Announce state changes, selection changes, operation results, important errors, and progress updates at a sensible rate.
- Make selection outline and handles visible in high-contrast themes, against both light and dark document contents. Use outline plus fill/shape/labels where needed, not only accent color.
- Ensure the object tree and inspector remain usable when a canvas engine cannot expose individual content elements semantically.
- Offer a route to inspect/edit text content without precision mouse positioning.

## 3. Accessible names and semantics

- Use native HTML controls (`button`, `input`, `select`, `textarea`, `label`, `fieldset`, `legend`) where possible.
- Icon-only button example: `<button type="button" aria-label="Zoom in"><ZoomIn aria-hidden="true" /></button>`.
- Connect labels with controls and error/help text with `aria-describedby`.
- State changes should use semantics like `aria-pressed`, `aria-expanded`, `aria-selected`, `aria-checked`, `aria-disabled`, `aria-invalid`, `role="status"`, or `role="alert"` where appropriate, preferably through a well-built component primitive.
- Do not use ARIA to imitate a native role when a native element provides that behavior. Do not attach arbitrary roles without implementing their keyboard interaction.
- Decorative icons should be hidden from screen readers when the adjacent text already conveys the same meaning.
- Announce changes in save/export status using concise live regions; avoid interruptive alert semantics for every noncritical update.
- Dialogs must manage focus, expose a label and description, and prevent focus from leaking behind a modal where the chosen primitive supports modal behavior.

## 4. Contrast and non-color cues

- Normal text: target a contrast ratio of at least 4.5:1 against its actual background.
- Large text: target at least 3:1 under WCAG’s large-text definition.
- Important UI boundaries and focus/selected indicators: check non-text contrast where applicable, targeting at least 3:1 against adjacent colors when required.
- Test icons, placeholders, muted labels, disabled states, selected rows, keyboard focus, warning text, and error messages—not only regular paragraph text.
- Never encode status only by red/green or only by a heatmap color. Add a label, pattern, icon, numeric value, outline, or other cue.
- Provide an appropriate color-scale legend for heatmaps and charts. Use a perceptually ordered scale and include numeric ranges/thresholds. Check color-vision accessibility and preserve meaning when printed in grayscale if required.
- If the app supports high-contrast or forced-colors mode, test outlines, selection handles, borders, and custom icons under that mode.

## 5. Target size and hit area

WCAG 2.2 AA defines a 24×24 CSS pixel minimum target size with listed exceptions. In dense desktop toolbars, the visible icon can be smaller if the real hit target is appropriately sized and spaced. This skill recommends:

- aim for 28–36px square toolbar buttons;
- do not place many undersized controls directly adjacent without adequate spacing;
- provide a larger invisible hit area when possible;
- make selection/resize handles easier to acquire without visually overwhelming the document;
- verify every exception rather than assuming it applies.

## 6. Dragging alternatives

If a feature requires dragging, provide an equivalent action that does not require dragging unless dragging is essential to the task:

- Move object → X/Y fields, nudge keys, or Move dialog.
- Resize object → Width/Height fields, aspect-ratio lock, or accessible resize commands.
- Reorder layer → Bring Forward/Send Backward buttons or context menu.
- Reorder a slide/page → Move Up/Move Down commands.
- Resize panel → keyboard-operable splitter in addition to pointer dragging.
- Select region → accessible selection list or another targeting method where feasible.

Do not treat “keyboard shortcuts exist” as proof of accessibility if the essential feature still cannot be reached or operated without precise dragging.

## 7. Text scaling and window-size behavior

- Support browser/system zoom and enlarged text up to 200% without losing essential functionality, clipping controls, or hiding content behind fixed panels.
- Prefer `rem` for typography and many internal spacing values; use pixels for fine control geometry where predictability is required.
- Use `min-width: 0` and `min-height: 0` on grid/flex children that should shrink; otherwise content may force panels beyond their intended width.
- Use CSS container queries for inspector rows, tool groups, and property controls that adapt to panel width.
- Define minimum pane widths but allow collapse or overlay modes before the canvas becomes unusably narrow.
- Do not rely on horizontal scrolling as the only way to access inspector controls.
- At constrained sizes, prioritize canvas + active tool + relevant inspector. Let optional panels collapse.
- Test at 1024×768, 1280×800, 1440×900, 1920×1080, and a high-DPI / high-scaling configuration appropriate to the target audience.
- Test when maximized, resized slowly, and snapped side-by-side with another app.

Example container query:

```css
.properties-panel {
  container-type: inline-size;
  container-name: properties;
}

.property-row {
  display: grid;
  grid-template-columns: minmax(88px, 36%) minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

@container properties (max-width: 250px) {
  .property-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }
}
```

## 8. Motion and input preferences

- Respect `prefers-reduced-motion`.
- Do not use blinking, pulsing, or large-scale animated movement to demand attention except where a specific safety workflow justifies it.
- Support mouse, trackpad, and keyboard. If stylus/touch input is in scope, use Pointer Events and test pen pressure/hover only if the feature actually requires them.
- Do not map the same gesture to different destructive actions in adjacent contexts.
- Avoid hijacking the wheel, Space, Tab, Ctrl/Command, or browser navigation without a clearly scoped behavior.
- Use `setPointerCapture` for gestures that need to continue after the pointer leaves the original target; handle `pointercancel` and lost capture.

## 9. Internationalization and localization

- Localize visible UI strings and accessibility labels. Do not concatenate sentence fragments in ways that break word order.
- Format number/date/measurement values with a locale-aware formatter, but store canonical numeric values independently of display strings.
- Plan for long translated labels; use flex/grid and `min-width: 0`, not hard-coded widths based on English text.
- Shortcuts should display platform-specific modifier names; do not show macOS symbols to Windows users unless that is a product convention.
- Use logical CSS properties (`margin-inline`, `padding-inline`, `inset-inline-start`) if right-to-left layout is a supported requirement.
- Document content and UI language may differ. Do not auto-rewrite user-authored document content during an app language change.

## 10. Accessibility validation

Minimum practical checks:

- Complete a core workflow using only keyboard.
- Navigate menus, tree, tabs, dialog, inspector, and canvas alternatives with visible focus.
- Verify screen-reader labels and announcements for primary actions and state changes.
- Check contrast with a tool, including dark theme and selected/focused states.
- Verify that error messages are associated with fields and do not disappear before the user can act.
- Test at 200% zoom/text scaling and narrow layouts.
- Test reduced motion and, where applicable, forced-colors mode.
- Verify essential drag actions have alternate paths.
- Use automated accessibility checks as a supplement, not a substitute for real keyboard and assistive-technology validation.

## 11. Reference standards

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI-ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
- Keyboard interface practices: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- WCAG contrast minimum: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum
- MDN reduced motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- MDN pointer events: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
