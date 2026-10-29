# 01 — Design Tokens and Visual System

Use a token system before writing component-specific CSS. The purpose is not to force every application into the same style; it is to make the interface internally consistent and allow a whole application to change themes without rewriting components.

## 1. Token rules

1. Components consume **semantic tokens** (`--surface`, `--text-primary`, `--border`, `--accent`), not raw palette values.
2. Separate **palette tokens** (raw color steps) from **semantic tokens** (meaning) and **component tokens** (specific overrides). Example: `--blue-600` → `--accent` → optional `--button-primary-bg`.
3. Provide at least Light, Dark, and System theme modes. “System” follows `prefers-color-scheme`; an explicit user preference wins over the system preference.
4. Theme every application surface: menus, popovers, dialogs, tooltips, menus, docked panels, canvas surrounding area, status bar, selection, focus rings, warnings, error states, and charts.
5. Do not theme document contents with application chrome tokens unless the document is intentionally theme-aware. A label’s fill, a slide’s background, or text color is user content—not an app theme color.
6. For a professional editor, prefer quiet surfaces and thin dividers. Use the accent for selection, active tools, focused controls, and primary actions—not every icon and panel.
7. Colors must be tested against their actual backgrounds. Never assume a token is accessible because it looks bright.

## 2. Base palette

A neutral cool palette is a reasonable default for creative/professional desktop software. Change the accent to match the brand without changing the underlying semantics.

| Token | Light default | Dark default | Intended use |
|---|---:|---:|---|
| `--app-bg` | `#F3F5F8` | `#17191D` | Outer application background |
| `--surface-1` | `#FFFFFF` | `#202329` | Primary panels, menus, dialogs |
| `--surface-2` | `#F7F8FA` | `#252930` | Secondary panels and field areas |
| `--surface-3` | `#ECEFF3` | `#2D323A` | Hovered rows, subtle grouped areas |
| `--surface-inset` | `#E5E9EF` | `#111317` | Canvas surround, input inset areas |
| `--text-primary` | `#20242C` | `#F2F4F7` | Main labels and content |
| `--text-secondary` | `#596273` | `#B5BBC6` | Supporting labels |
| `--text-muted` | `#737D8D` | `#929AA8` | Hints and low-priority metadata; verify contrast |
| `--border` | `#D9DEE7` | `#3A404A` | Dividers and component outlines |
| `--border-strong` | `#BBC3D0` | `#505865` | Resizers, emphasized borders |
| `--accent` | `#4F46E5` | `#8B83FF` | Active/focus states and primary action |
| `--accent-hover` | `#4338CA` | `#A49EFF` | Accent hover state |
| `--accent-soft` | `#EEF2FF` | `#302D50` | Selected row/tool surface |
| `--accent-foreground` | `#FFFFFF` | `#161329` | Text/icons on accent fill; verify contrast |
| `--selection` | `#4F46E5` | `#A49EFF` | Canvas selection outline/handles |
| `--success` | `#18794E` | `#65D6A0` | Completed/saved state |
| `--warning` | `#9A6700` | `#F2C66D` | Caution/preflight issue |
| `--danger` | `#C0362C` | `#FF8078` | Destructive actions and errors |
| `--info` | `#1769AA` | `#7BC4FF` | Informational state |
| `--focus-ring` | `#315EFB` | `#A9B7FF` | Keyboard focus; test against adjacent surfaces |
| `--scrim` | `rgb(20 24 31 / 42%)` | `rgb(0 0 0 / 58%)` | Modal backdrop |

**Important:** These are starting values, not a claim that every pair passes WCAG contrast. In particular, `text-muted`, accent-on-accent, disabled text, and status colors must be checked in context. Maintain a design token contrast test if possible.

### Semantic role rules

- `app-bg` is the application frame; `surface-1` is a panel; `surface-2` is a grouped subsection; `surface-inset` is recessed.
- Use elevation/shadows sparingly. A surface hierarchy built from value and borders is usually clearer than stacking shadows on every panel.
- Status color always accompanies a word, icon, pattern, or shape where meaning matters. Never use color as the only signal.
- Danger red means error/destructive intent; it is not an accent for ordinary decoration.
- Canvas paper/artboard color should represent the document output accurately. Do not make the page gray just because the app is in dark mode; optionally provide a paper-shadow/theme preference outside the document itself.

## 3. CSS variable foundation

This is a complete starter subset. Add component-specific tokens only when a true exception exists.

```css
:root {
  color-scheme: light;
  --app-bg: #f3f5f8;
  --surface-1: #ffffff;
  --surface-2: #f7f8fa;
  --surface-3: #eceff3;
  --surface-inset: #e5e9ef;
  --text-primary: #20242c;
  --text-secondary: #596273;
  --text-muted: #737d8d;
  --border: #d9dee7;
  --border-strong: #bbc3d0;
  --accent: #4f46e5;
  --accent-hover: #4338ca;
  --accent-soft: #eef2ff;
  --accent-foreground: #ffffff;
  --selection: #4f46e5;
  --success: #18794e;
  --warning: #9a6700;
  --danger: #c0362c;
  --info: #1769aa;
  --focus-ring: #315efb;
  --scrim: rgb(20 24 31 / 42%);

  --font-ui: Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont,
    "Helvetica Neue", Arial, sans-serif;
  --font-document: Aptos, Calibri, "Segoe UI", Arial, sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;

  --text-xs: 0.6875rem;  /* 11px */
  --text-sm: 0.75rem;    /* 12px */
  --text-md: 0.8125rem;  /* 13px; compact desktop UI default */
  --text-base: 0.875rem; /* 14px */
  --text-lg: 1rem;       /* 16px */
  --text-xl: 1.125rem;   /* 18px */
  --text-2xl: 1.375rem;  /* 22px */
  --text-3xl: 1.75rem;   /* 28px */
  --text-4xl: 2.25rem;   /* 36px */

  --space-0: 0;
  --space-1: 0.25rem;    /* 4px */
  --space-2: 0.5rem;     /* 8px */
  --space-3: 0.75rem;    /* 12px */
  --space-4: 1rem;       /* 16px */
  --space-5: 1.25rem;    /* 20px */
  --space-6: 1.5rem;     /* 24px */
  --space-8: 2rem;       /* 32px */
  --space-10: 2.5rem;    /* 40px */
  --space-12: 3rem;      /* 48px */

  --radius-xs: 3px;
  --radius-sm: 5px;
  --radius-md: 7px;
  --radius-lg: 10px;
  --radius-xl: 14px;
  --radius-pill: 999px;

  --shadow-menu: 0 8px 26px rgb(15 23 42 / 16%), 0 2px 6px rgb(15 23 42 / 8%);
  --shadow-dialog: 0 20px 60px rgb(15 23 42 / 22%), 0 4px 16px rgb(15 23 42 / 10%);

  --duration-fast: 90ms;
  --duration-ui: 150ms;
  --duration-panel: 200ms;
  --ease-ui: cubic-bezier(0.2, 0, 0, 1);
}

[data-theme="dark"] {
  color-scheme: dark;
  --app-bg: #17191d;
  --surface-1: #202329;
  --surface-2: #252930;
  --surface-3: #2d323a;
  --surface-inset: #111317;
  --text-primary: #f2f4f7;
  --text-secondary: #b5bbc6;
  --text-muted: #929aa8;
  --border: #3a404a;
  --border-strong: #505865;
  --accent: #8b83ff;
  --accent-hover: #a49eff;
  --accent-soft: #302d50;
  --accent-foreground: #161329;
  --selection: #a49eff;
  --success: #65d6a0;
  --warning: #f2c66d;
  --danger: #ff8078;
  --info: #7bc4ff;
  --focus-ring: #a9b7ff;
  --scrim: rgb(0 0 0 / 58%);
}

html {
  font-family: var(--font-ui);
  font-size: 100%;
  color: var(--text-primary);
  background: var(--app-bg);
}

* { box-sizing: border-box; }

:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Use the light/dark variables as the default baseline only. For System mode, synchronize an explicit application preference with `matchMedia('(prefers-color-scheme: dark)')`, and clean up event listeners. If using a theme provider already in the repository, reuse it rather than building a second one.

## 4. Typography

### UI text scale

| Use | Default | Weight | Line height | Notes |
|---|---:|---:|---:|---|
| Dense metadata, shortcut hints | 11–12px | 400–500 | 1.25–1.4 | Keep limited and high contrast |
| Compact control labels | 12–13px | 400–500 | 1.3–1.45 | Suitable for dense professional tools |
| Default panels and controls | 13–14px | 400 | 1.35–1.5 | Main UI workhorse |
| Panel/section heading | 14–16px | 600 | 1.25–1.4 | Use consistent hierarchy |
| Dialog / workspace title | 18–22px | 600 | 1.2–1.35 | Keep clear but not oversized |
| Marketing/dashboard display heading | 28–36px | 600–700 | 1.1–1.25 | Use sparingly in editors |

The compact desktop defaults are not a reason to make all copy tiny. Maintain readable base text, support system/browser zoom, and test at 125% and 200% text scaling. If the target audience often uses high scaling or high-DPI screens, increase the default density.

### Font rules

- UI: use a neutral system stack for native-like rendering, or bundle a licensed font such as Inter when cross-platform consistency is a product requirement.
- Document content: use the fonts and font metrics required by the document itself; do not blindly inherit the UI font.
- Technical values, coordinates, hex codes, dimensions, IDs, and measurements: use tabular numerals or a mono font when it improves comparison.
- Prefer `font-variant-numeric: tabular-nums` for aligned numbers in tables and inspectors.
- Do not use more than two UI font families plus an optional code/measurement family without a concrete reason.
- Use font weight and spacing for hierarchy before introducing more colors.
- Truncate only when the complete value remains available through selection, a tooltip, a details pane, or copy action.

## 5. Geometry and dimensions

### Layout scale

| Element | Recommended starting size |
|---|---:|
| Application menu/title strip | 28–36px high (native title bar may differ) |
| Primary toolbar | 40–48px high |
| Secondary toolbar/context bar | 32–40px high |
| Left tool rail | 44–52px wide |
| Icon-only toolbar button | 28–36px square; 32px default |
| Standard button/input | 30–36px high; 32px default in dense mode |
| Comfortable button/input | 36–40px high |
| Minimum resize hit area | Aim for 6–8px visual handle / 10–12px interaction target |
| Docked properties inspector | 260–340px wide |
| Layers/object tree panel | 220–300px wide |
| Assets/library panel | 240–320px wide |
| Optional secondary side pane | 220–300px wide |
| Status bar | 22–28px high |
| Dialog corner radius | 8–12px |
| Small field/button radius | 4–7px |
| Menu/popup radius | 6–10px |
| Standard panel border | 1px |
| Floating overlay shadow | Use tokenized menu/dialog shadows |

These are starting ranges for an ordinary desktop window. Make panels resizable, clamp to minimum/maximum widths, and persist the user’s layout. A canvas editor should not begin with so many fixed-width panels that the canvas becomes unusable at 1280×800.

### Spacing

Use a 4px base rhythm. Common gaps: 4px within a tight control cluster, 8px between related controls, 12px inside dense sections, 16px between sections, and 24px between major groups. Do not insert large card padding around every property row in a dense inspector.

### Icon rules

Use one icon family by default, consistent stroke weight, and a clear mapping between concepts and icon names.

| Context | Size | Notes |
|---|---:|---|
| Dense metadata/status inline | 12–14px | Only if legible |
| Compact toolbar/menu icons | 16px | Default |
| Main toolbar / prominent controls | 18–20px | Use selectively |
| Empty-state illustration or major action | 24px | Keep subordinate to the message |
| Large empty-state illustration | 32–48px | Avoid decorative excess |

- Use `lucide-react` imports such as `Save`, `Undo2`, `Redo2`, `ZoomIn`, `Layers3`, `AlignHorizontalCenter`, `Grid2X2`, `Printer`, `Settings2`, `Search`, `PanelRight`, `Ruler`, `Lock`, `Unlock`, `Eye`, `EyeOff`, `MoreHorizontal`, `ChevronDown`, `Check`, `X`, `AlertTriangle`, and `Info` where the exact icon exists in the installed version.
- Avoid ambiguous icons. Pair rare commands with labels or tooltips. Do not use emoji as replacements for toolbar icons.
- Avoid using the same icon for unrelated actions in the same context.
- A toolbar icon button needs an accessible name even when its visible label is omitted.

## 6. Density modes

Provide density options only if they solve real user needs. Do not style each component with its own unrelated compactness setting.

| Token | Compact | Standard | Comfortable |
|---|---:|---:|---:|
| Control height | 28–30px | 32–36px | 38–42px |
| Horizontal control padding | 6–8px | 8–12px | 10–14px |
| Inspector row vertical padding | 4px | 6–8px | 9–12px |
| Table row height | 26–30px | 32–36px | 40–44px |
| Group spacing | 8–12px | 12–16px | 16–20px |
| UI font | 12–13px | 13–14px | 14–16px |

Compact mode may reduce padding, but must not eliminate necessary focus indicators or make common targets impossible to operate. WCAG 2.2 target-size requirements and spacing exceptions should be checked on the actual UI; do not assume all small controls qualify for an exception.

## 7. Motion and elevation

- Hover/focus color transition: 80–120ms.
- Small press/selection transition: 100–160ms.
- Panel expansion: 150–220ms.
- Dialog appearance: 120–180ms; avoid exaggerated travel or spring motion in dense professional tools.
- Do not animate document geometry when a direct manipulation should track the pointer.
- Respect `prefers-reduced-motion`; remove nonessential motion rather than merely slowing it.
- Use borders for persistent grouping, a subtle shadow for floating overlays, and no shadow for every nested panel.
- Never use animation as the only indication that saving, exporting, or applying a command succeeded.

## 8. Control state visuals

Every control family should define states consistently:

- **Rest:** default surface, normal border, primary/secondary text as appropriate.
- **Hover:** subtle surface change; cursor communicates whether it is clickable, draggable, text-selectable, or disabled.
- **Pressed:** visible feedback during activation.
- **Selected/toggled:** distinct from hover; use accent-soft surface and a clear indicator.
- **Keyboard focus:** visible outline/ring, not only a background color.
- **Disabled:** lower emphasis and disabled semantics; retain enough clarity to understand what is disabled, and explain why when the reason is not obvious.
- **Busy:** clear busy state, block conflicting repeat submissions where appropriate, preserve safe navigation, and provide accessible status.
- **Invalid:** border plus error icon/text/description; do not depend on red alone.
- **Dirty/saved:** concise document status, including a meaningful save/error state. Do not imply cloud sync if only local persistence is working.

## 9. Theme acceptance criteria

- Components use semantic tokens rather than unrelated hardcoded values.
- Light and dark themes both render every app surface and all states.
- A new accent color can be introduced by changing tokens, without editing every component.
- Text and key UI indicators pass contrast checks against actual adjacent backgrounds.
- Document output appearance remains independent of the chrome theme unless the user explicitly configures document content.
- System preference and explicit user selection do not fight each other.
- Theme changes do not reset the document, workspace layout, zoom, or selection unexpectedly.
