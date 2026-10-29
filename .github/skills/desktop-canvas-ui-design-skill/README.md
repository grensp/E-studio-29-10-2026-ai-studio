# Desktop Canvas UI Design Skill

Reusable skill package for AI coding assistants working on professional desktop-first creative and productivity software using TypeScript + React, Vite/Next.js, Zustand, accessible component primitives, and optional Electron/Tauri packaging.

## Files

- `SKILL.md` — core operating instructions and rules.
- `AI-PROMPTS.md` — ready-to-use prompts for common tasks.
- `COPILOT-INSTRUCTIONS-SNIPPET.md` — short text to merge into repository Copilot instructions.
- `references/01-design-tokens.md` — colors, typography, spacing, sizes, themes, icons, and density.
- `references/02-desktop-shell-and-layouts.md` — app chrome, layouts, panels, windows, and adaptive desktop behavior.
- `references/03-canvas-editor-ux.md` — canvas/editor interaction and rendering rules.
- `references/04-components-and-interactions.md` — component states, tooltip copy, keyboard/mouse patterns, and examples.
- `references/05-accessibility-and-responsiveness.md` — accessibility and resizing requirements.
- `references/06-react-typescript-architecture.md` — framework and state architecture.
- `references/07-code-recipes.md` — typed, practical implementation snippets.
- `references/08-quality-gates.md` — testable quality and production gates.
- `references/09-reference-sources.md` — current official documentation.
- `references/10-product-archetypes.md` — domain-specific patterns for print/labels, image editing, word processing, presentations, and diagrams.

## How to use it

### With GitHub Copilot

1. Copy the folder into the repository, for example `docs/skills/desktop-canvas-ui-design/`.
2. Add a short pointer in `.github/copilot-instructions.md` or a relevant `.instructions.md` file:

   > For canvas-based desktop UI work, follow `docs/skills/desktop-canvas-ui-design/SKILL.md` and consult its relevant reference files. Inspect the current implementation first, preserve repository conventions, and validate the behavior you change.

3. For a reusable command-based setup, keep this folder as a discoverable skill and invoke it explicitly in the task prompt.

### With other AI coding agents

Attach or reference `SKILL.md` first. Supply relevant reference files based on the change. For a large canvas/editor request, include at least `01`, `02`, `03`, `06`, `08`, and the matching product patterns in `10`.

### Example task prompt

> Apply the Desktop Canvas UI Design Skill to the existing editor. Inspect the repository and identify the current component, state, theme, and canvas architecture before changing anything. Improve the left tool rail, canvas selection affordances, and right properties inspector without replacing the existing canvas engine. Follow the token and accessibility requirements, make every visible control functional, preserve document compatibility and undo/redo, and run the relevant checks. Report the files changed and any unverified behavior.

## Important

The numbers and tokens in this package are strong **starting defaults**, not universal laws. Follow the product’s requirements, user research, operating-system conventions, installed library APIs, and existing design system when they differ. The skill is framework-aware but does not require a specific rendering engine or force every application into the same visual style.
