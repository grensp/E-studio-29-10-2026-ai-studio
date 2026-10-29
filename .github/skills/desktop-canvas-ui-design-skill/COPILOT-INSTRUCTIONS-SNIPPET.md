# Copilot repository-instructions snippet

Copy the following into `.github/copilot-instructions.md`, or merge it into an existing file. Preserve the repository's existing instructions.

---

For work on any desktop-first or canvas-based creative/productivity UI (label/layout editor, image editor, word processor, presentation tool, diagramming app, or similar), follow `docs/skills/desktop-canvas-ui-design/SKILL.md` and consult its relevant files in `references/`.

Before changing code, inspect the repository’s actual framework, installed library versions, design tokens, component primitives, state model, document schema, canvas engine, and tests. Reuse established patterns and APIs; do not create a parallel design system, replace the canvas engine, or add dependencies without a clear reason.

Treat the document model as the source of truth. Separate persisted document content, workspace preferences, selection/UI state, and transient pointer/renderer state. Make every visible interactive control functional, keyboard-accessible, and consistent with shared commands. Preserve undo/redo, dirty/save state, import/export behavior, document compatibility, and object identity.

Use semantic design tokens; support light/dark themes where applicable; make panels resizable/collapsible; prioritize the canvas; preserve desktop keyboard/mouse conventions; provide alternatives to essential drag-only actions; and validate focus, contrast, text scaling, window resizing, and error states.

Do not return a static mockup, fake success state, placeholder handler, or production claim without verification. Run relevant checks and report what changed, the commands/tests actually run, what remains unverified, and any assumptions.
