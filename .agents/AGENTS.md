# Workspace Agent Instructions

## Default specialized skill
For any task involving UI/UX design, implementation, refactoring, theming, auditing, or production validation of desktop-first canvas-based creative/productivity software, use the `desktop-canvas-ui-design` skill:

`.agents/skills/desktop-canvas-ui-design/SKILL.md`

This includes label/price-tag designers, image editors, page-layout tools, word processors, presentation editors, diagramming tools, technical authoring apps, and editors with canvases, artboards, pages, objects, layers, or timelines.

## Required behavior
1. Read the skill before proposing or implementing material UI changes.
2. Read only the reference files needed for the specific task; the skill's Reference map describes their contents.
3. Inspect the repository's actual framework, dependencies, design tokens, component primitives, renderer/canvas engine, document model, state management, persistence, and tests before changing code.
4. Preserve working architecture and document compatibility. Do not add dependencies or replace major systems without a concrete reason.
5. Build real interactions, including keyboard and pointer workflows, focus/selection states, resizing, error/empty/loading states, and persistence when required. Never present inert controls as functional.
6. Validate with the relevant available checks. Report what was actually tested and distinguish verified behavior from assumptions.
7. Treat the skill's dimensions, tokens, and component recipes as default starting points; adapt to the product, existing design system, user requirements, and installed APIs.

For unrelated tasks, do not force this specialized skill onto the work.
