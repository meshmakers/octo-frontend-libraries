# Semantic Token Theming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor LCARS theme into a two-tier semantic token model (semantic + derived) with themes as plug-in palette providers, ship LCARS dark + light, migrate refinery's component SCSS to consume `var(--theme-*)`, and add a `TenantThemeService` stub for runtime palette overrides.

**Architecture:** Semantic tokens (`--theme-primary`, `--theme-surface`, …) are the public contract. Derived tokens (`--theme-primary-hover`, etc.) auto-compute via CSS `color-mix()`. Themes (`themes/_lcars-dark.scss`, `themes/_lcars-light.scss`) provide values. Activation via `data-theme` attribute on `<html>`. Three override layers compose by CSS specificity: theme defaults < app overrides in refinery's `styles.scss` < runtime overrides via inline styles set by `TenantThemeService`.

**Tech Stack:** Sass 1.x with `@use`/`@forward` modules, Angular 21 + Kendo Angular 23 (Material theme), CSS Custom Properties, CSS `color-mix()` (Chromium 111+/Firefox 113+/Safari 16.2+).

**Working branch:** `feature/lcars-theme-split` (existing). Commit incrementally; the branch tip is the "atomic" big-bang from the team's perspective.

**Spec:** [`docs/superpowers/specs/2026-04-27-semantic-token-theming-design.md`](../specs/2026-04-27-semantic-token-theming-design.md)

---

## Migration Reference Table

This table is the canonical primitive→semantic mapping. Apply consistently across every migration task.

| Old reference | New reference |
|---|---|
| `var(--octo-mint)` | `var(--theme-primary)` |
| `var(--octo-mint-N)` (steps 5/10/15/20/25/30/40/50/60) | `var(--theme-primary-alpha-N)` |
| `var(--octo-mint-08)` | `var(--theme-primary-alpha-10)` (round) — 6 sites |
| `var(--octo-mint-35)` | `var(--theme-primary-alpha-30)` (round) — 1 site |
| `var(--octo-mint-45)` | `var(--theme-primary-alpha-40)` (round) — 2 sites |
| `var(--neo-cyan)` | `var(--theme-secondary)` |
| `var(--neo-cyan-40)` | `var(--theme-secondary-alpha-40)` |
| `var(--ash-blue)` | `var(--theme-text-secondary)` |
| `var(--ash-blue-N)` (steps 10/15/20/30/50/70/80) | `var(--theme-text-secondary-alpha-N)` |
| `var(--bubblegum-N)` (steps 5/10/15/20/30/40/50/60) | `var(--theme-error-alpha-N)` |
| `var(--toffee-N)` (steps 15/40/50, decorative) | `var(--theme-warning-alpha-N)` |
| `var(--royal-violet-40)` | `var(--theme-accent-violet-alpha-40)` |
| `var(--iron-navy)` | `var(--theme-surface)` |
| `var(--surface-elevated)` | `var(--theme-surface-elevated)` |
| `var(--deep-sea)` | `var(--theme-app-bg)` |
| `var(--octo-text-color)` | `var(--theme-on-app-bg)` |
| `var(--bubblegum)` | `var(--theme-error)` |
| `var(--toffee)` | `var(--theme-warning)` (or `var(--theme-accent-amber)` if decorative) |
| `var(--royal-violet)` | `var(--theme-accent-violet)` |
| `var(--lilac-glow)` | `var(--theme-accent-pink)` |
| `var(--indigogo)` | `var(--theme-info)` |
| `var(--kendo-success)` | `var(--theme-success)` |
| `var(--lcars-border-color)` | `var(--theme-border)` |
| `var(--pink)` | `var(--theme-error)` (legacy alias) |
| `$octo-mint` (Sass) | DELETE; replace usage with `var(--theme-primary)` |
| `$iron-navy` (Sass) | DELETE; replace usage with `var(--theme-surface)` |
| `$deep-sea` (Sass) | DELETE; replace usage with `var(--theme-app-bg)` |
| `$royal-violet` (Sass) | DELETE; replace usage with `var(--theme-accent-violet)` |
| `$neo-cyan` (Sass) | DELETE; replace usage with `var(--theme-secondary)` |
| `$ash-blue` (Sass) | DELETE; replace usage with `var(--theme-text-secondary)` |
| `$octo-text-color` (Sass) | DELETE; replace usage with `var(--theme-on-app-bg)` |
| `$kendo-success` (Sass) | DELETE; replace usage with `var(--theme-success)` |
| `$pink` (Sass) | DELETE; replace usage with `var(--theme-error)` |
| `rgba($octo-mint, 0.N)` (Sass) | `var(--theme-primary-alpha-N0)` |
| `rgba($royal-violet, 0.N)` (Sass) | `color-mix(in srgb, var(--theme-accent-violet) N0%, transparent)` |

**Edge cases that need manual judgment** (mark with `// MIGRATION:` comment if unclear, address in review):
- Multi-stop gradients with multiple primitive colors → break into `var(--theme-*)` references
- `darken()` / `lighten()` Sass calls → replace with derived tokens (`-hover`, `-active`) or `color-mix()`
- Toffee used as decorative bar (footer) vs. warning state → use `--theme-accent-amber` for decorative, `--theme-warning` for status

**Application tip:** For mechanical replacements, sed (or your editor's multi-file find-and-replace) handles the bulk. Example for one common substitution:

```bash
# Replace var(--octo-mint) with var(--theme-primary) across a directory (dry-run with -n then apply)
find <directory> -name "*.scss" -exec sed -i 's/var(--octo-mint\([^a-z0-9-]\)/var(--theme-primary\1/g' {} +
```

Iterate the table top-to-bottom. After mechanical pass, manually review for edge cases (gradients, `rgba()`, `darken()`/`lighten()`).

---

## Phase A — Library token foundation (additive, no migration yet)

### Task 1: Create semantic token file

**Files:**
- Create: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_semantic.scss`

- [ ] **Step 1: Create the file with neutral fallback defaults**

```scss
// src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_semantic.scss
// ============================================================================
// SEMANTIC TOKENS — the public theming surface
// 18 roles. Themes provide values; these neutral fallbacks ensure no token is
// undefined if a theme misses a role. Activation via [data-theme="..."] on
// <html>.
// ============================================================================

@mixin semantic-defaults {
  // Core brand
  --theme-primary:           #808080;
  --theme-secondary:         #a0a0a0;

  // Status
  --theme-success:           #2e7d32;
  --theme-warning:           #ed6c02;
  --theme-error:             #d32f2f;
  --theme-info:              #0288d1;

  // Surfaces
  --theme-app-bg:            #1a1a1a;
  --theme-surface:           #2a2a2a;
  --theme-surface-elevated:  #3a3a3a;

  // Foreground (text on color)
  --theme-on-primary:        #ffffff;
  --theme-on-secondary:      #ffffff;
  --theme-on-surface:        #ffffff;
  --theme-on-app-bg:         #ffffff;
  --theme-text-secondary:    #b0b0b0;

  // Borders
  --theme-border:            #808080;
  --theme-border-subtle:     #b0b0b0;

  // LCARS-specific decorative accents (hue-named roles; LCARS sets them, other
  // themes may use defaults or set their own)
  --theme-accent-violet:     #6c4da8;
  --theme-accent-amber:      #da9162;
  --theme-accent-pink:       #c861d6;
}
```

- [ ] **Step 2: Verify the file lints**

Run from `src/frontend-libraries/`:
```bash
npm run lint:octo-ui
```
Expected: PASS (no rule errors; the file is unused but valid Sass).

- [ ] **Step 3: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_semantic.scss
git commit -m "feat(octo-ui): add semantic token surface partial"
```

---

### Task 2: Create derived token file

**Files:**
- Create: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_derived.scss`

- [ ] **Step 1: Create the file**

```scss
// src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_derived.scss
// ============================================================================
// DERIVED TOKENS — auto-computed from semantic tokens via color-mix()
// Theme-agnostic. Same rules apply to any palette.
//
// Browser support: color-mix() requires Chromium 111+, Firefox 113+,
// Safari 16.2+ (all evergreen since early 2023).
// ============================================================================

@mixin derived {
  // ---- Interactive state derivations ----
  // Pattern: -hover lighter, -active darker, -subtle transparent fill,
  //          -border medium-alpha border, -glow medium-alpha glow

  // PRIMARY
  --theme-primary-hover:   color-mix(in srgb, var(--theme-primary) 88%, white);
  --theme-primary-active:  color-mix(in srgb, var(--theme-primary) 80%, black);
  --theme-primary-subtle:  color-mix(in srgb, var(--theme-primary) 15%, transparent);
  --theme-primary-border:  color-mix(in srgb, var(--theme-primary) 30%, transparent);
  --theme-primary-glow:    color-mix(in srgb, var(--theme-primary) 40%, transparent);

  // SECONDARY
  --theme-secondary-hover:   color-mix(in srgb, var(--theme-secondary) 88%, white);
  --theme-secondary-active:  color-mix(in srgb, var(--theme-secondary) 80%, black);
  --theme-secondary-subtle:  color-mix(in srgb, var(--theme-secondary) 15%, transparent);
  --theme-secondary-border:  color-mix(in srgb, var(--theme-secondary) 30%, transparent);
  --theme-secondary-glow:    color-mix(in srgb, var(--theme-secondary) 40%, transparent);

  // SUCCESS
  --theme-success-hover:   color-mix(in srgb, var(--theme-success) 88%, white);
  --theme-success-active:  color-mix(in srgb, var(--theme-success) 80%, black);
  --theme-success-subtle:  color-mix(in srgb, var(--theme-success) 15%, transparent);
  --theme-success-border:  color-mix(in srgb, var(--theme-success) 30%, transparent);
  --theme-success-glow:    color-mix(in srgb, var(--theme-success) 40%, transparent);

  // WARNING
  --theme-warning-hover:   color-mix(in srgb, var(--theme-warning) 88%, white);
  --theme-warning-active:  color-mix(in srgb, var(--theme-warning) 80%, black);
  --theme-warning-subtle:  color-mix(in srgb, var(--theme-warning) 15%, transparent);
  --theme-warning-border:  color-mix(in srgb, var(--theme-warning) 30%, transparent);
  --theme-warning-glow:    color-mix(in srgb, var(--theme-warning) 40%, transparent);

  // ERROR
  --theme-error-hover:   color-mix(in srgb, var(--theme-error) 88%, white);
  --theme-error-active:  color-mix(in srgb, var(--theme-error) 80%, black);
  --theme-error-subtle:  color-mix(in srgb, var(--theme-error) 15%, transparent);
  --theme-error-border:  color-mix(in srgb, var(--theme-error) 30%, transparent);
  --theme-error-glow:    color-mix(in srgb, var(--theme-error) 40%, transparent);

  // INFO
  --theme-info-hover:   color-mix(in srgb, var(--theme-info) 88%, white);
  --theme-info-active:  color-mix(in srgb, var(--theme-info) 80%, black);
  --theme-info-subtle:  color-mix(in srgb, var(--theme-info) 15%, transparent);
  --theme-info-border:  color-mix(in srgb, var(--theme-info) 30%, transparent);
  --theme-info-glow:    color-mix(in srgb, var(--theme-info) 40%, transparent);

  // ---- Alpha scales (replacing today's --octo-mint-N tokens) ----
  // Step coverage matches existing usage in lcars-theme/ partials (per grep
  // analysis 2026-04-27). Outliers that don't match a listed step (mint-08,
  // mint-35, mint-45) round to the nearest provided step at migration time.

  // PRIMARY — wide coverage (mint is the most prolific accent in LCARS)
  --theme-primary-alpha-5:   color-mix(in srgb, var(--theme-primary) 5%, transparent);
  --theme-primary-alpha-10:  color-mix(in srgb, var(--theme-primary) 10%, transparent);
  --theme-primary-alpha-15:  color-mix(in srgb, var(--theme-primary) 15%, transparent);
  --theme-primary-alpha-20:  color-mix(in srgb, var(--theme-primary) 20%, transparent);
  --theme-primary-alpha-25:  color-mix(in srgb, var(--theme-primary) 25%, transparent);
  --theme-primary-alpha-30:  color-mix(in srgb, var(--theme-primary) 30%, transparent);
  --theme-primary-alpha-40:  color-mix(in srgb, var(--theme-primary) 40%, transparent);
  --theme-primary-alpha-50:  color-mix(in srgb, var(--theme-primary) 50%, transparent);
  --theme-primary-alpha-60:  color-mix(in srgb, var(--theme-primary) 60%, transparent);

  // SECONDARY — minimal coverage (only one site uses --neo-cyan-40 today)
  --theme-secondary-alpha-10:  color-mix(in srgb, var(--theme-secondary) 10%, transparent);
  --theme-secondary-alpha-20:  color-mix(in srgb, var(--theme-secondary) 20%, transparent);
  --theme-secondary-alpha-30:  color-mix(in srgb, var(--theme-secondary) 30%, transparent);
  --theme-secondary-alpha-40:  color-mix(in srgb, var(--theme-secondary) 40%, transparent);

  // ERROR — wide coverage (bubblegum is used for alerts/danger states)
  --theme-error-alpha-5:    color-mix(in srgb, var(--theme-error) 5%, transparent);
  --theme-error-alpha-10:   color-mix(in srgb, var(--theme-error) 10%, transparent);
  --theme-error-alpha-15:   color-mix(in srgb, var(--theme-error) 15%, transparent);
  --theme-error-alpha-20:   color-mix(in srgb, var(--theme-error) 20%, transparent);
  --theme-error-alpha-30:   color-mix(in srgb, var(--theme-error) 30%, transparent);
  --theme-error-alpha-40:   color-mix(in srgb, var(--theme-error) 40%, transparent);
  --theme-error-alpha-50:   color-mix(in srgb, var(--theme-error) 50%, transparent);
  --theme-error-alpha-60:   color-mix(in srgb, var(--theme-error) 60%, transparent);

  // WARNING — narrow coverage (only --toffee-15/40/50 today)
  --theme-warning-alpha-15:  color-mix(in srgb, var(--theme-warning) 15%, transparent);
  --theme-warning-alpha-40:  color-mix(in srgb, var(--theme-warning) 40%, transparent);
  --theme-warning-alpha-50:  color-mix(in srgb, var(--theme-warning) 50%, transparent);

  // ACCENT-VIOLET — narrow coverage (only --royal-violet-40 today)
  --theme-accent-violet-alpha-40:  color-mix(in srgb, var(--theme-accent-violet) 40%, transparent);

  // TEXT-SECONDARY — wide coverage including high-alpha steps for muted text
  --theme-text-secondary-alpha-10:  color-mix(in srgb, var(--theme-text-secondary) 10%, transparent);
  --theme-text-secondary-alpha-15:  color-mix(in srgb, var(--theme-text-secondary) 15%, transparent);
  --theme-text-secondary-alpha-20:  color-mix(in srgb, var(--theme-text-secondary) 20%, transparent);
  --theme-text-secondary-alpha-30:  color-mix(in srgb, var(--theme-text-secondary) 30%, transparent);
  --theme-text-secondary-alpha-50:  color-mix(in srgb, var(--theme-text-secondary) 50%, transparent);
  --theme-text-secondary-alpha-70:  color-mix(in srgb, var(--theme-text-secondary) 70%, transparent);
  --theme-text-secondary-alpha-80:  color-mix(in srgb, var(--theme-text-secondary) 80%, transparent);
}
```

- [ ] **Step 2: Verify the file lints**

```bash
npm run lint:octo-ui
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_derived.scss
git commit -m "feat(octo-ui): add derived tokens via color-mix()"
```

---

### Task 3: Create themes registry — LCARS dark

**Files:**
- Create: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/_lcars-dark.scss`

- [ ] **Step 1: Create the directory and file**

```scss
// src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/_lcars-dark.scss
// ============================================================================
// LCARS DARK THEME — maps the LCARS brand palette to the semantic surface.
// Sass color helpers below are private to this file; never escape it.
// Activated via :root[data-theme="lcars-dark"] (default).
// ============================================================================

@mixin lcars-dark {
  // 1. Private Sass helpers (LCARS brand palette)
  $primary:           #64ceb9;   // Octo Mint
  $secondary:         #00a8dc;   // Neo Cyan
  $surface:           #394555;   // Iron Navy
  $surface-elevated:  #1f2e40;
  $app-bg:            #07172b;   // Deep Sea
  $on-bg:             #ffffff;
  $on-primary:        #07172b;   // Deep Sea text on mint background
  $on-secondary:      #ffffff;
  $text-secondary:    #9292a6;   // Ash Blue
  $success:           #37b400;
  $warning:           #da9162;   // Toffee (status)
  $error:             #ec658f;   // Bubblegum
  $info:              #546fbd;   // Indigogo
  $accent-violet:     #6c4da8;   // Royal Violet
  $accent-amber:      #da9162;   // Toffee (decorative)
  $accent-pink:       #c861d6;   // Lilac Glow

  // 2. Map to semantic surface
  --theme-primary:            #{$primary};
  --theme-secondary:          #{$secondary};
  --theme-surface:            #{$surface};
  --theme-surface-elevated:   #{$surface-elevated};
  --theme-app-bg:             #{$app-bg};
  --theme-on-app-bg:          #{$on-bg};
  --theme-on-primary:         #{$on-primary};
  --theme-on-secondary:       #{$on-secondary};
  --theme-on-surface:         #{$on-bg};
  --theme-text-secondary:     #{$text-secondary};
  --theme-success:            #{$success};
  --theme-warning:            #{$warning};
  --theme-error:              #{$error};
  --theme-info:               #{$info};
  --theme-border:             #{$primary};
  --theme-border-subtle:      #{$text-secondary};
  --theme-accent-violet:      #{$accent-violet};
  --theme-accent-amber:       #{$accent-amber};
  --theme-accent-pink:        #{$accent-pink};
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint:octo-ui
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/_lcars-dark.scss
git commit -m "feat(octo-ui): add lcars-dark theme partial"
```

---

### Task 4: Create LCARS light theme

**Files:**
- Create: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/_lcars-light.scss`

Light values are starter values for v1 (per spec §3 non-goals: structural correctness over visual polish). Refinery's `CLAUDE.md` "Light Theme Support (Concept)" section provided initial values; these adapt them.

- [ ] **Step 1: Create the file**

```scss
// src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/_lcars-light.scss
// ============================================================================
// LCARS LIGHT THEME — light variant of the LCARS palette.
// v1 starter values: structurally functional, polish deferred. Activated via
// :root[data-theme="lcars-light"].
// ============================================================================

@mixin lcars-light {
  // 1. Private Sass helpers (LCARS light palette)
  $primary:           #4ba396;   // Darkened Octo Mint for AA contrast on light bg
  $secondary:         #0077a8;   // Darkened Neo Cyan
  $surface:           #ffffff;
  $surface-elevated:  #e8eef3;
  $app-bg:            #f5f7fa;
  $on-bg:             #07172b;   // Deep Sea text on light background
  $on-primary:        #ffffff;
  $on-secondary:      #ffffff;
  $text-secondary:    #394555;   // Iron Navy as muted text on light
  $success:           #2d7300;
  $warning:           #b3641a;   // Darker Toffee for light bg contrast
  $error:             #c2185b;   // Darker Bubblegum
  $info:              #3f51b5;   // Darker Indigogo
  $accent-violet:     #5c3d98;
  $accent-amber:      #b3641a;
  $accent-pink:       #a647b3;

  // 2. Map to semantic surface
  --theme-primary:            #{$primary};
  --theme-secondary:          #{$secondary};
  --theme-surface:            #{$surface};
  --theme-surface-elevated:   #{$surface-elevated};
  --theme-app-bg:             #{$app-bg};
  --theme-on-app-bg:          #{$on-bg};
  --theme-on-primary:         #{$on-primary};
  --theme-on-secondary:       #{$on-secondary};
  --theme-on-surface:         #{$on-bg};
  --theme-text-secondary:     #{$text-secondary};
  --theme-success:            #{$success};
  --theme-warning:            #{$warning};
  --theme-error:              #{$error};
  --theme-info:               #{$info};
  --theme-border:             #{$primary};
  --theme-border-subtle:      #{$text-secondary};
  --theme-accent-violet:      #{$accent-violet};
  --theme-accent-amber:       #{$accent-amber};
  --theme-accent-pink:        #{$accent-pink};
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint:octo-ui
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/_lcars-light.scss
git commit -m "feat(octo-ui): add lcars-light theme partial (v1 starter values)"
```

---

### Task 5: Themes aggregator + expose via public styles entry points

**Files:**
- Create: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/_index.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/styles/_index.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/styles/_with-kendo.scss`

- [ ] **Step 1: Create the themes aggregator**

```scss
// src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/_index.scss
// ============================================================================
// THEMES — palette providers. Each theme maps brand colors to the semantic
// surface defined in tokens/_semantic.scss. Hosts pick a theme by including
// the corresponding mixin under the appropriate :root[data-theme="..."]
// selector.
// ============================================================================

@forward "lcars-dark";
@forward "lcars-light";
```

- [ ] **Step 2: Update `styles/_index.scss` to forward themes + derived**

Replace the file contents with:

```scss
// Global Octo UI styles entrypoint.
// Forwards LCARS theme variables(), styles(), host-overrides(), individual
// theme mixins, and the derived-tokens mixin.

@forward "../lib/lcars-theme/index" show variables, styles;
@forward "../lib/lcars-theme/host-overrides/index" show host-overrides;
@forward "../lib/lcars-theme/themes/index" show lcars-dark, lcars-light;
@forward "../lib/lcars-theme/tokens/derived" show derived;
```

- [ ] **Step 3: Update `styles/_with-kendo.scss` similarly**

Replace the file contents with:

```scss
// ============================================================================
// OCTO UI - Styles WITH Kendo Theme (for apps that don't import Kendo)
// Use this entry point when your app does NOT already import a Kendo theme.
// When Kendo is already imported, use _index.scss instead.
// ============================================================================

@use "../lib/lcars-theme/kendo-theme";
@forward "../lib/lcars-theme/index" show variables, styles;
@forward "../lib/lcars-theme/host-overrides/index" show host-overrides;
@forward "../lib/lcars-theme/themes/index" show lcars-dark, lcars-light;
@forward "../lib/lcars-theme/tokens/derived" show derived;
```

- [ ] **Step 4: Lint**

```bash
cd src/frontend-libraries
npm run lint:octo-ui
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/_index.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/styles/_index.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/styles/_with-kendo.scss
git commit -m "feat(octo-ui): add themes registry and expose lcars-dark/light + derived via public styles entry points"
```

---

## Phase B — Wire new tokens into the public API (additive)

After this phase the library still emits old tokens (`--octo-mint`, etc.) AND the new ones (`--theme-primary`, etc.). All consumers remain functional.

### Task 6: Wire semantic + derived into tokens/_index.scss

**Files:**
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_index.scss`

- [ ] **Step 1: Read the existing file**

```bash
cat src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_index.scss
```

- [ ] **Step 2: Replace contents**

Current contents (per spec §4.3):
```scss
@forward "palette";
@forward "typography";
@forward "alpha-scales";
@forward "radius";
@forward "motion";
@forward "designer";
@forward "components";
```

New contents:
```scss
// Tokens aggregator. The variables() mixin at the lcars-theme/_index.scss level
// composes from these per-concern token partials.

@forward "semantic";
@forward "derived";
@forward "typography";
@forward "radius";
@forward "motion";
@forward "designer";
@forward "components";
@forward "palette";        // legacy: still emits --octo-mint etc. during migration
@forward "alpha-scales";   // legacy: still emits --octo-mint-N etc. during migration
```

- [ ] **Step 3: Lint**

```bash
npm run lint:octo-ui
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_index.scss
git commit -m "feat(octo-ui): wire semantic + derived tokens into aggregator"
```

---

### Task 7: Compose new tokens into the variables() mixin

**Files:**
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/_variables.scss`

- [ ] **Step 1: Read existing file**

```bash
cat src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/_variables.scss
```

- [ ] **Step 2: Update to include new tokens**

Replace the `@mixin variables` body to include the LCARS dark theme as the default and call into derived. The new file:

```scss
// ============================================================================
// LCARS Theme - Variables mixin (recomposed from tokens/ + themes/)
// Public API: @include octo.variables() emits all CSS custom properties for
// the default theme (lcars-dark). Hosts that want light theme support add an
// additional :root[data-theme="lcars-light"] block including themes.lcars-light.
// ============================================================================

@use "tokens/semantic" as semantic;
@use "tokens/derived" as derived;
@use "tokens/typography" as typography;
@use "tokens/radius" as radius;
@use "tokens/motion" as motion;
@use "tokens/designer" as designer;
@use "tokens/components" as components;
@use "tokens/palette" as palette;             // legacy
@use "tokens/alpha-scales" as alpha-scales;   // legacy
@use "themes/lcars-dark" as lcars-dark;

@forward "tokens/palette" show $octo-mint, $neo-cyan, $indigogo, $toffee, $bubblegum, $lilac-glow, $royal-violet, $ash-blue, $iron-navy, $deep-sea, $surface-elevated, $octo-text-color, $lcars-border-color, $pink, $kendo-inverse, $kendo-success;

/// Applies CSS custom properties for the LCARS theme.
/// Include this on :root or a container.
@mixin variables {
  // 1. Semantic neutral defaults — guaranteed presence even before theme applies
  @include semantic.semantic-defaults;

  // 2. Default theme (lcars-dark) — overrides semantic defaults with LCARS values
  @include lcars-dark.lcars-dark;

  // 3. Derived tokens — computed from current semantic values
  @include derived.derived;

  // 4. Typography font custom properties
  @include typography.typography-vars;

  // 5. Legacy palette + alpha-scales (still emitted during migration)
  @include palette.palette;
  @include alpha-scales.alpha-scales;

  // 6. Apply font-family
  @include typography.typography-apply;

  // 7. LCARS-specific design tokens (glows, buttons, focus)
  @include motion.motion-glows;

  // 8. LCARS Border Radius
  @include radius.radius;

  // 9. Panel styling and transitions
  @include motion.motion-panel;

  // 10. Designer panel and cron cell variables
  @include designer.designer;

  // 11. Component-level tokens (drawer, dialog, tabs, cards)
  @include components.components;
}
```

- [ ] **Step 3: Build the library**

```bash
cd src/frontend-libraries
npm run build:octo-ui
```
Expected: SUCCESS. The library now emits both old and new tokens.

- [ ] **Step 4: Run library tests + lint**

```bash
npm test -- --project=@meshmakers/octo-ui --watch=false --browsers=ChromeHeadless
npm run lint:octo-ui
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/_variables.scss
git commit -m "feat(octo-ui): compose semantic + derived tokens into variables() mixin"
```

---

## Phase C — Migrate library partials to consume new tokens

After each task in this phase, the library should still build and emit identical visual output (because legacy tokens are still emitted alongside the new ones).

### Task 8: Migrate `tokens/_designer.scss` and `tokens/_components.scss`

**Files:**
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_designer.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_components.scss`

- [ ] **Step 1: Apply migration table to both files**

For each `var(--octo-*)` reference in these files, apply the Migration Reference Table at the top of this plan. Save the file. Repeat for the second file.

- [ ] **Step 2: Confirm no legacy refs remain in these two files**

```bash
grep -n "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|var(--royal-violet\|var(--bubblegum\|var(--toffee\|var(--lilac-glow\|var(--indigogo" \
  src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_designer.scss \
  src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_components.scss
```
Expected: 0 matches.

- [ ] **Step 3: Build the library**

```bash
cd src/frontend-libraries
npm run build:octo-ui
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_designer.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_components.scss
git commit -m "refactor(octo-ui): migrate tokens/designer + components to --theme-*"
```

---

### Task 9: Migrate `primitives/`

**Files:**
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/primitives/_panel.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/primitives/_layout.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/primitives/_page-layout.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/primitives/_utilities.scss`

- [ ] **Step 1: Apply migration table to all four files**

Apply the Migration Reference Table to every `var(--octo-*)`, `var(--ash-blue)`, `var(--iron-navy)`, etc. reference. Replace `darken()` / `lighten()` Sass calls with derived tokens (`-hover`, `-active`) where applicable.

- [ ] **Step 2: Confirm no legacy refs remain**

```bash
grep -rn "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|var(--royal-violet\|var(--bubblegum\|var(--toffee\|var(--lilac-glow\|var(--indigogo" \
  src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/primitives/
```
Expected: 0 matches.

- [ ] **Step 3: Build**

```bash
cd src/frontend-libraries
npm run build:octo-ui
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/primitives/
git commit -m "refactor(octo-ui): migrate primitives/ to --theme-*"
```

---

### Task 10: Migrate `chrome/` and `forms/`

**Files:**
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/chrome/_login-popup.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/forms/_base-form.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/forms/_config-dialog.scss`

- [ ] **Step 1: Apply migration table to all three files**

- [ ] **Step 2: Verify**

```bash
grep -rn "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|var(--royal-violet\|var(--bubblegum\|var(--toffee\|var(--lilac-glow\|var(--indigogo" \
  src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/chrome/ \
  src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/forms/
```
Expected: 0 matches.

- [ ] **Step 3: Build**

```bash
cd src/frontend-libraries
npm run build:octo-ui
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/chrome/ src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/forms/
git commit -m "refactor(octo-ui): migrate chrome/ + forms/ to --theme-*"
```

---

### Task 11: Migrate `thirdparty/_dockview.scss`

**Files:**
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/thirdparty/_dockview.scss`

- [ ] **Step 1: Apply migration table**

- [ ] **Step 2: Verify**

```bash
grep -n "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|var(--royal-violet\|var(--bubblegum\|var(--toffee\|var(--lilac-glow\|var(--indigogo" \
  src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/thirdparty/_dockview.scss
```
Expected: 0 matches.

- [ ] **Step 3: Build**

```bash
cd src/frontend-libraries
npm run build:octo-ui
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/thirdparty/_dockview.scss
git commit -m "refactor(octo-ui): migrate thirdparty/dockview to --theme-*"
```

---

### Task 12: Migrate `host-overrides/_process-designer.scss`

This is the largest single host-override partial (~1,476 lines). Take care; do it as one task to keep the diff coherent.

**Files:**
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/host-overrides/_process-designer.scss`

- [ ] **Step 1: Apply migration table**

Sweep the file with regex/sed for each migration entry. Manual review for `darken()`/`lighten()`/multi-stop gradient cases.

- [ ] **Step 2: Verify**

```bash
grep -n "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|var(--royal-violet\|var(--bubblegum\|var(--toffee\|var(--lilac-glow\|var(--indigogo" \
  src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/host-overrides/_process-designer.scss
```
Expected: 0 matches.

- [ ] **Step 3: Build**

```bash
cd src/frontend-libraries
npm run build:octo-ui
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/host-overrides/_process-designer.scss
git commit -m "refactor(octo-ui): migrate host-overrides/process-designer to --theme-*"
```

---

### Task 13: Migrate `host-overrides/_meshboard.scss`

Second-largest host-override partial (~1,082 lines).

**Files:**
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/host-overrides/_meshboard.scss`

- [ ] **Step 1: Apply migration table**

- [ ] **Step 2: Verify**

```bash
grep -n "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|var(--royal-violet\|var(--bubblegum\|var(--toffee\|var(--lilac-glow\|var(--indigogo" \
  src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/host-overrides/_meshboard.scss
```
Expected: 0 matches.

- [ ] **Step 3: Build**

```bash
cd src/frontend-libraries
npm run build:octo-ui
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/host-overrides/_meshboard.scss
git commit -m "refactor(octo-ui): migrate host-overrides/meshboard to --theme-*"
```

---

### Task 14: Migrate remaining host-overrides

**Files:**
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/host-overrides/_markdown-widget.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/host-overrides/_process-widget.scss`

- [ ] **Step 1: Apply migration table to both**

- [ ] **Step 2: Verify**

```bash
grep -n "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|var(--royal-violet\|var(--bubblegum\|var(--toffee\|var(--lilac-glow\|var(--indigogo" \
  src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/host-overrides/
```
Expected: 0 matches.

- [ ] **Step 3: Build**

```bash
cd src/frontend-libraries
npm run build:octo-ui
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/host-overrides/
git commit -m "refactor(octo-ui): migrate host-overrides/markdown + process-widget to --theme-*"
```

---

### Task 15: Migrate `kendo/` widgets — group A

22 Kendo widget partials, split into three commits for reviewability.

**Files (group A — 7 files):**
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_appbar.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_button.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_card.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_chip.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_context-menu.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_dialog.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_drawer.scss`

- [ ] **Step 1: Apply migration table to all 7 files**

- [ ] **Step 2: Verify (only these 7 files)**

```bash
for f in _appbar.scss _button.scss _card.scss _chip.scss _context-menu.scss _dialog.scss _drawer.scss; do
  grep -l "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|var(--royal-violet\|var(--bubblegum\|var(--toffee\|var(--lilac-glow\|var(--indigogo" \
    "src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/$f" 2>/dev/null
done
```
Expected: no output (no files match).

- [ ] **Step 3: Build**

```bash
cd src/frontend-libraries
npm run build:octo-ui
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_appbar.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_button.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_card.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_chip.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_context-menu.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_dialog.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_drawer.scss
git commit -m "refactor(octo-ui): migrate kendo/ group A (appbar, button, card, chip, context-menu, dialog, drawer) to --theme-*"
```

---

### Task 16: Migrate `kendo/` widgets — group B

**Files (group B — 7 files):**
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_dropdown.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_grid.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_input-buttons.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_input.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_listview.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_popup.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_progress.scss`

- [ ] **Step 1: Apply migration table to all 7 files**

- [ ] **Step 2: Verify (only these 7 files)**

```bash
for f in _dropdown.scss _grid.scss _input-buttons.scss _input.scss _listview.scss _popup.scss _progress.scss; do
  grep -l "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|var(--royal-violet\|var(--bubblegum\|var(--toffee\|var(--lilac-glow\|var(--indigogo" \
    "src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/$f" 2>/dev/null
done
```
Expected: no output.

- [ ] **Step 3: Build**

```bash
cd src/frontend-libraries
npm run build:octo-ui
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_dropdown.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_grid.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_input-buttons.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_input.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_listview.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_popup.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_progress.scss
git commit -m "refactor(octo-ui): migrate kendo/ group B (dropdown, grid, input*, listview, popup, progress) to --theme-*"
```

---

### Task 17: Migrate `kendo/` widgets — group C (final)

**Files (group C — 7 files, completes 22 total):**
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_scrollbars.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_tabs.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_tilelayout.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_toolbar.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_tooltip.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_treeview.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_window.scss`

- [ ] **Step 1: Apply migration table to all 7 files**

- [ ] **Step 2: Verify entire kendo/ directory clean**

```bash
grep -rn "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|var(--royal-violet\|var(--bubblegum\|var(--toffee\|var(--lilac-glow\|var(--indigogo" \
  src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/
```
Expected: 0 matches across all 22 kendo files.

- [ ] **Step 3: Build**

```bash
cd src/frontend-libraries
npm run build:octo-ui
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_scrollbars.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_tabs.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_tilelayout.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_toolbar.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_tooltip.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_treeview.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_window.scss
git commit -m "refactor(octo-ui): migrate kendo/ group C (scrollbars, tabs, tilelayout, toolbar, tooltip, treeview, window) to --theme-*"
```

---

### Task 18: Update `_kendo-theme.scss` to point at `--theme-*`

Replaces Sass-time `k-generate-color-variations()` with runtime CSS variables.

**Files:**
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/_kendo-theme.scss`

- [ ] **Step 1: Read current file structure**

```bash
cat src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/_kendo-theme.scss
```

- [ ] **Step 2: Replace the `$kendo-colors` map merge section**

Find this block (currently ~lines 80–160):

```scss
$kendo-colors: map.merge(
  $kendo-colors,
  (
    primary: var(--octo-mint),
    surface: var(--iron-navy),
    surface-alt: var(--surface-elevated),
    app-surface: var(--deep-sea),
    on-app-surface: var(--octo-text-color),
    subtle: var(--ash-blue),
  )
);

$kendo-colors: map.merge(
  $kendo-colors,
  k-generate-color-variations("base", vars.$ash-blue, "material")
);
$kendo-colors: map.merge(
  $kendo-colors,
  k-generate-color-variations("primary", vars.$octo-mint, "material")
);
// … 11 more k-generate-color-variations calls
```

Replace with:

```scss
$kendo-colors: map.merge(
  $kendo-colors,
  (
    // Core palette — runtime via --theme-*
    primary:           var(--theme-primary),
    primary-hover:     var(--theme-primary-hover),
    primary-active:    var(--theme-primary-active),
    primary-subtle:    var(--theme-primary-subtle),
    secondary:         var(--theme-secondary),
    secondary-hover:   var(--theme-secondary-hover),
    secondary-active:  var(--theme-secondary-active),
    secondary-subtle:  var(--theme-secondary-subtle),

    // Status colors
    success:           var(--theme-success),
    success-hover:     var(--theme-success-hover),
    success-subtle:    var(--theme-success-subtle),
    warning:           var(--theme-warning),
    warning-hover:     var(--theme-warning-hover),
    warning-subtle:    var(--theme-warning-subtle),
    error:             var(--theme-error),
    error-hover:       var(--theme-error-hover),
    error-subtle:      var(--theme-error-subtle),
    info:              var(--theme-info),
    info-hover:        var(--theme-info-hover),
    info-subtle:       var(--theme-info-subtle),

    // Surfaces
    surface:           var(--theme-surface),
    surface-alt:       var(--theme-surface-elevated),
    app-surface:       var(--theme-app-bg),
    on-app-surface:    var(--theme-on-app-bg),

    // Text
    subtle:            var(--theme-text-secondary),
    on-base:           var(--theme-on-app-bg),
    on-primary:        var(--theme-on-primary),
    base-on-surface:   var(--theme-on-app-bg),
  )
);
```

Delete all the `k-generate-color-variations()` calls. The runtime derived tokens replace the Sass-time generated variations. Keep the `@include core-styles()`, `@include kendo-typography--styles()`, etc. block unchanged — those emit the Kendo CSS rules and they're still needed.

- [ ] **Step 3: Build**

```bash
cd src/frontend-libraries
npm run build:octo-ui
```
Expected: SUCCESS. CSS bundle should be a few KB smaller because the Sass-baked variations are gone.

- [ ] **Step 4: Run library tests + lint**

```bash
npm test -- --project=@meshmakers/octo-ui --watch=false --browsers=ChromeHeadless
npm run lint:octo-ui
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/_kendo-theme.scss
git commit -m "refactor(octo-ui): wire Kendo color map to --theme-* runtime tokens"
```

---

## Phase D — Library cleanup

### Task 19: Confirm legacy partials are still emitted (verification gate)

After all library partials consume `--theme-*`, the legacy `_palette.scss` and `_alpha-scales.scss` are unused inside the library. **But refinery still uses them** via `@include octo.variables()` — so they must continue to be emitted into refinery's compiled CSS until refinery is also migrated. The actual deletion happens in Task 31.

This is a verification gate: confirm legacy emission is still in place before proceeding to refinery work.

- [ ] **Step 1: Confirm tokens/_index.scss still forwards palette + alpha-scales**

```bash
grep "palette\|alpha-scales" src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_index.scss
```
Expected: 2 matches (`@forward "palette";` and `@forward "alpha-scales";`).

- [ ] **Step 2: Confirm `_variables.scss` still includes the legacy mixins**

```bash
grep "palette\.palette\|alpha-scales\.alpha-scales" src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/_variables.scss
```
Expected: 2 matches.

- [ ] **Step 3: No commit (verification only)**

If legacy emission is missing, restore it before proceeding — refinery's build will break otherwise.

---

### Task 20: Library-side completeness check

Verify zero legacy `var(--octo-*)` references remain across all library partials (excluding `themes/` and the legacy `_palette.scss` / `_alpha-scales.scss` files themselves).

- [ ] **Step 1: Run completeness grep**

```bash
grep -rn "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|var(--royal-violet\|var(--bubblegum\|var(--toffee\|var(--lilac-glow\|var(--indigogo" \
  src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/ \
  --exclude-dir=themes \
  --exclude=_palette.scss \
  --exclude=_alpha-scales.scss \
  --exclude=_kendo-theme.scss
```
Expected: 0 matches.

- [ ] **Step 2: Run full library build + tests + lint**

```bash
cd src/frontend-libraries
npm run lint:octo-ui
npm test -- --project=@meshmakers/octo-ui --watch=false --browsers=ChromeHeadless
npm run build:octo-ui
```
Expected: all PASS.

- [ ] **Step 3: No commit (verification only)**

If any of the above fails, identify the issue, fix it (likely a missed migration entry), and commit the fix as `fix(octo-ui): missed migration in <file>`.

---

## Phase E — Refinery integration

### Task 21: Reinstall library in refinery

Library is now built; refinery needs to pick up the new dist via its `file:` dependency.

- [ ] **Step 1: Run npm ci in refinery**

```bash
cd ../octo-frontend-refinery-studio/src/octo-mesh-refinery-studio
npm ci
```
Expected: SUCCESS, install completes without ERESOLVE errors.

- [ ] **Step 2: Verify refinery still builds with the new library**

```bash
ng build --configuration development
```
Expected: SUCCESS. Refinery currently consumes legacy `var(--octo-*)` tokens; library still emits them via `@include octo.variables()` (legacy partials still forwarded). Build succeeds.

- [ ] **Step 3: No commit (verification only)**

---

### Task 22: Migrate refinery's `styles.scss` — drop redundant Sass redeclarations

**Files:**
- Modify: `src/octo-mesh-refinery-studio/src/styles.scss`

- [ ] **Step 1: Read existing file**

```bash
cat src/octo-mesh-refinery-studio/src/styles.scss
```

- [ ] **Step 2: Replace contents**

The `octo` namespace (from `styles/_with-kendo.scss`) now exposes `lcars-dark`, `lcars-light`, and `derived` (added in Task 5). Replace the entire file with:

```scss
@use "sass:map";
@use "@progress/kendo-theme-material/scss/index.scss" as *;
@use "styles/dockview-lcars-theme" as dockview;
@use "styles/_with-kendo.scss" as octo;

// ============================================================================
// OCTO DATA REFINERY STUDIO - LCARS-INSPIRED THEME
// Brand colors and structural rules now flow through the semantic token
// surface defined in @meshmakers/octo-ui. App-level palette overrides go
// in the :root[data-theme="lcars-dark"] block below; tenant overrides apply
// at runtime via TenantThemeService.
// ============================================================================

:root,
:root[data-theme="lcars-dark"] {
  @include octo.variables();
  @include octo.lcars-dark;
  @include octo.derived;
  // App-level overrides go here — same selector, declaration order wins
}

:root[data-theme="lcars-light"] {
  @include octo.lcars-light;
  @include octo.derived;
}

@include kendo-theme--styles();

// ----------------------------------------------------------------------------
// DOCKVIEW LCARS THEME (Process Designer & Symbol Editor)
// ----------------------------------------------------------------------------
@include dockview.lcars-theme();

@include octo.styles();
@include octo.host-overrides();

// ----------------------------------------------------------------------------
// BOOTSTRAP LOADING INDICATOR (shown before Angular renders)
// ----------------------------------------------------------------------------
.mm-loading-container {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: var(--theme-app-bg);
}

.mm-loading {
  width: 80px;
  height: 80px;
}
```

- [ ] **Step 3: Verify the octo namespace exposes the new mixins**

```bash
grep -E "lcars-dark|lcars-light|derived" node_modules/@meshmakers/octo-ui/styles/_with-kendo.scss
```
Expected: 2 lines matching (the two `@forward` lines added in Task 5).

If the lines aren't there, the library wasn't rebuilt + reinstalled after Task 5. Run `cd ../../../octo-frontend-libraries/src/frontend-libraries && npm run build:octo-ui && cd - && npm ci`.

- [ ] **Step 4: Build**

```bash
ng build --configuration development
```
Expected: SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add src/octo-mesh-refinery-studio/src/styles.scss
git commit -m "refactor(refinery): clean styles.scss to consume semantic theme tokens"
```

---

### Task 23: Migrate dockview-lcars-theme (lives in octo-process-diagrams, NOT refinery)

**Note (correction 2026-04-27):** The original task description referenced `src/octo-mesh-refinery-studio/src/styles/dockview-lcars-theme.scss`, but that path doesn't exist. The actual canonical file is in the `octo-process-diagrams` library; refinery resolves it via `stylePreprocessorOptions.includePaths` to the library's `dist/`. Migration committed as commit `384ae38` on the libraries branch — see commit for details.

**Files:**
- Modify: `src/frontend-libraries/projects/meshmakers/octo-process-diagrams/src/lib/styles/_dockview-lcars-theme.scss` (NOT in refinery)

- [ ] **Step 1: Apply migration table to the file**

- [ ] **Step 2: Verify**

```bash
grep -n "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|var(--royal-violet\|var(--bubblegum\|var(--toffee\|var(--lilac-glow\|var(--indigogo\|\\\$octo-mint\|\\\$iron-navy\|\\\$deep-sea\|\\\$royal-violet\|\\\$neo-cyan\|\\\$ash-blue" \
  src/octo-mesh-refinery-studio/src/styles/dockview-lcars-theme.scss
```
Expected: 0 matches.

- [ ] **Step 3: Build**

```bash
cd src/octo-mesh-refinery-studio
ng build --configuration development
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/octo-mesh-refinery-studio/src/styles/dockview-lcars-theme.scss
git commit -m "refactor(refinery): migrate dockview-lcars-theme to --theme-*"
```

---

### Task 24: Migrate refinery app shell SCSS

**Files:**
- Modify: `src/octo-mesh-refinery-studio/src/app/app.component.scss`
- Modify: `src/octo-mesh-refinery-studio/src/app/tenant.component.scss`

- [ ] **Step 1: Apply migration table to both**

- [ ] **Step 2: Verify**

```bash
grep -n "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|var(--royal-violet\|var(--bubblegum\|var(--toffee\|var(--lilac-glow\|var(--indigogo\|\\\$octo-mint\|\\\$iron-navy\|\\\$deep-sea\|\\\$royal-violet\|\\\$neo-cyan\|\\\$ash-blue" \
  src/octo-mesh-refinery-studio/src/app/app.component.scss \
  src/octo-mesh-refinery-studio/src/app/tenant.component.scss
```
Expected: 0 matches.

- [ ] **Step 3: Build**

```bash
ng build --configuration development
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/octo-mesh-refinery-studio/src/app/app.component.scss src/octo-mesh-refinery-studio/src/app/tenant.component.scss
git commit -m "refactor(refinery): migrate app shell SCSS to --theme-*"
```

---

### Task 25: Migrate refinery `tenants/`, `cockpit/`, `service-health-detail/`, `tenant-details/`, `tenant-provisioning/`

**Files:**
- Modify: `src/octo-mesh-refinery-studio/src/app/tenants/tenants/tenants.component.scss`
- Modify: `src/octo-mesh-refinery-studio/src/app/tenants/tenant-details/tenant-details.component.scss`
- Modify: `src/octo-mesh-refinery-studio/src/app/tenants/tenant-provisioning/tenant-provisioning.component.scss`
- Modify: `src/octo-mesh-refinery-studio/src/app/tenants/ui/cockpit.component.scss`
- Modify: `src/octo-mesh-refinery-studio/src/app/tenants/ui/service-health-detail/service-health-detail.component.scss`
- Modify: `src/octo-mesh-refinery-studio/src/app/tenants/development/user-diagnostics/user-diagnostics.component.scss`

- [ ] **Step 1: Apply migration table to all 6 files**

- [ ] **Step 2: Verify**

```bash
for f in tenants/tenants/tenants.component.scss tenants/tenant-details/tenant-details.component.scss tenants/tenant-provisioning/tenant-provisioning.component.scss tenants/ui/cockpit.component.scss tenants/ui/service-health-detail/service-health-detail.component.scss tenants/development/user-diagnostics/user-diagnostics.component.scss; do
  grep -l "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|\\\$octo-mint\|\\\$iron-navy\|\\\$deep-sea\|\\\$royal-violet\|\\\$neo-cyan\|\\\$ash-blue" \
    "src/octo-mesh-refinery-studio/src/app/$f" 2>/dev/null
done
```
Expected: no output.

- [ ] **Step 3: Build**

```bash
ng build --configuration development
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/octo-mesh-refinery-studio/src/app/tenants/tenants src/octo-mesh-refinery-studio/src/app/tenants/tenant-details src/octo-mesh-refinery-studio/src/app/tenants/tenant-provisioning src/octo-mesh-refinery-studio/src/app/tenants/ui src/octo-mesh-refinery-studio/src/app/tenants/development
git commit -m "refactor(refinery): migrate tenant + cockpit + diagnostics SCSS to --theme-*"
```

---

### Task 26: Migrate refinery `repository/` component SCSS

**Files (8 files):**
- Modify: `src/octo-mesh-refinery-studio/src/app/tenants/repository/auto-increment/auto-increment-list/auto-increment-list.component.scss`
- Modify: `src/octo-mesh-refinery-studio/src/app/tenants/repository/auto-increment/auto-increment-form/auto-increment-form.component.scss`
- Modify: `src/octo-mesh-refinery-studio/src/app/tenants/repository/ck-models/ck-models-browser.component.scss`
- Modify: `src/octo-mesh-refinery-studio/src/app/tenants/repository/ck-model-libraries/ck-model-libraries.component.scss`
- Modify: `src/octo-mesh-refinery-studio/src/app/tenants/repository/query-builder/query-list/query-list.component.scss`
- Modify: `src/octo-mesh-refinery-studio/src/app/tenants/repository/query-builder/query-results-page/query-results-page.component.scss`
- Modify: `src/octo-mesh-refinery-studio/src/app/tenants/repository/query-builder/query-editor/query-editor.component.scss`
- Modify: `src/octo-mesh-refinery-studio/src/app/tenants/repository/fixup-scripts/fixup-scripts-list/fixup-scripts-list.component.scss`
- Modify: `src/octo-mesh-refinery-studio/src/app/tenants/repository/fixup-scripts/fixup-scripts-form/fixup-scripts-form.component.scss`
- Modify: `src/octo-mesh-refinery-studio/src/app/tenants/repository/events/events-list.component.scss`

Plus any files under `repository/ck-models/` (e.g., `ck-type-details`, `ck-enum-details`, `ck-*-details-inline`, `_ck-details-common.scss`).

- [ ] **Step 1: Apply migration table to all repository SCSS files**

```bash
find src/octo-mesh-refinery-studio/src/app/tenants/repository -name "*.scss" | xargs ls
```
Apply migration to every file in the output list.

- [ ] **Step 2: Verify**

```bash
grep -rn "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|\\\$octo-mint\|\\\$iron-navy\|\\\$deep-sea\|\\\$royal-violet\|\\\$neo-cyan\|\\\$ash-blue" \
  src/octo-mesh-refinery-studio/src/app/tenants/repository/
```
Expected: 0 matches.

- [ ] **Step 3: Build**

```bash
ng build --configuration development
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/octo-mesh-refinery-studio/src/app/tenants/repository
git commit -m "refactor(refinery): migrate repository/ component SCSS to --theme-*"
```

---

### Task 27: Migrate refinery `identity/` component SCSS

**Files (~9 files):**
All `.scss` files under `src/octo-mesh-refinery-studio/src/app/tenants/identity/`.

- [ ] **Step 1: List and apply migration table**

```bash
find src/octo-mesh-refinery-studio/src/app/tenants/identity -name "*.scss" | xargs ls
```
Apply migration to every file in the output list.

- [ ] **Step 2: Verify**

```bash
grep -rn "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|\\\$octo-mint\|\\\$iron-navy\|\\\$deep-sea\|\\\$royal-violet\|\\\$neo-cyan\|\\\$ash-blue" \
  src/octo-mesh-refinery-studio/src/app/tenants/identity/
```
Expected: 0 matches.

- [ ] **Step 3: Build**

```bash
ng build --configuration development
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/octo-mesh-refinery-studio/src/app/tenants/identity
git commit -m "refactor(refinery): migrate identity/ component SCSS to --theme-*"
```

---

### Task 28: Migrate refinery `communication/` component SCSS

**Files (~10 files):**
All `.scss` files under `src/octo-mesh-refinery-studio/src/app/tenants/communication/`.

- [ ] **Step 1: List and apply migration table**

```bash
find src/octo-mesh-refinery-studio/src/app/tenants/communication -name "*.scss" | xargs ls
```
Apply migration to every file in the output list.

- [ ] **Step 2: Verify**

```bash
grep -rn "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|\\\$octo-mint\|\\\$iron-navy\|\\\$deep-sea\|\\\$royal-violet\|\\\$neo-cyan\|\\\$ash-blue" \
  src/octo-mesh-refinery-studio/src/app/tenants/communication/
```
Expected: 0 matches.

- [ ] **Step 3: Build**

```bash
ng build --configuration development
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/octo-mesh-refinery-studio/src/app/tenants/communication
git commit -m "refactor(refinery): migrate communication/ component SCSS to --theme-*"
```

---

### Task 29: Migrate refinery `bot/`, `reporting/`, `general/`, `ui-management/` component SCSS

**Files (~5 files):**
All `.scss` files under those four subdirectories.

- [ ] **Step 1: List and apply migration table**

```bash
find \
  src/octo-mesh-refinery-studio/src/app/tenants/bot \
  src/octo-mesh-refinery-studio/src/app/tenants/reporting \
  src/octo-mesh-refinery-studio/src/app/tenants/general \
  src/octo-mesh-refinery-studio/src/app/tenants/ui-management \
  -name "*.scss" 2>/dev/null | xargs ls 2>/dev/null
```
Apply migration to every file in the output list.

- [ ] **Step 2: Verify**

```bash
grep -rn "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|\\\$octo-mint\|\\\$iron-navy\|\\\$deep-sea\|\\\$royal-violet\|\\\$neo-cyan\|\\\$ash-blue" \
  src/octo-mesh-refinery-studio/src/app/tenants/bot \
  src/octo-mesh-refinery-studio/src/app/tenants/reporting \
  src/octo-mesh-refinery-studio/src/app/tenants/general \
  src/octo-mesh-refinery-studio/src/app/tenants/ui-management 2>/dev/null
```
Expected: 0 matches.

- [ ] **Step 3: Build**

```bash
ng build --configuration development
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/octo-mesh-refinery-studio/src/app/tenants/bot src/octo-mesh-refinery-studio/src/app/tenants/reporting 2>/dev/null; git add src/octo-mesh-refinery-studio/src/app/tenants/general src/octo-mesh-refinery-studio/src/app/tenants/ui-management 2>/dev/null
git commit -m "refactor(refinery): migrate bot + reporting + general + ui-management SCSS to --theme-*"
```

---

### Task 30: Refinery completeness check

Verify zero legacy `$octo-mint`/etc. or `var(--octo-mint)`/etc. references remain in any refinery SCSS file.

- [ ] **Step 1: Comprehensive grep**

```bash
grep -rn "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|var(--royal-violet\|var(--bubblegum\|var(--toffee\|var(--lilac-glow\|var(--indigogo" \
  src/octo-mesh-refinery-studio/src/
```
Expected: 0 matches.

```bash
grep -rn "\\\$octo-mint\|\\\$iron-navy\|\\\$deep-sea\|\\\$royal-violet\|\\\$neo-cyan\|\\\$ash-blue\|\\\$octo-text-color\|\\\$kendo-success\|\\\$bubblegum\|\\\$toffee\|\\\$lilac-glow\|\\\$indigogo\|\\\$pink" \
  src/octo-mesh-refinery-studio/src/
```
Expected: 0 matches.

- [ ] **Step 2: If any matches, fix them in a follow-up commit**

```bash
git commit -m "fix(refinery): missed migration in <file>"
```

- [ ] **Step 3: No commit if grep is clean**

---

## Phase F — Library cleanup (final delete)

### Task 31: Delete legacy `_palette.scss` and `_alpha-scales.scss`

Now that no consumer references them, the legacy files can be deleted.

**Files:**
- Delete: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_palette.scss`
- Delete: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_alpha-scales.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_index.scss`
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/_variables.scss`

- [ ] **Step 1: Update `tokens/_index.scss` to drop legacy forwards**

Remove these two lines from `tokens/_index.scss`:

```scss
@forward "palette";        // legacy: still emits --octo-mint etc. during migration
@forward "alpha-scales";   // legacy: still emits --octo-mint-N etc. during migration
```

- [ ] **Step 2: Update `_variables.scss` to drop legacy includes**

In `_variables.scss`, remove these lines:

```scss
@use "tokens/palette" as palette;             // legacy
@use "tokens/alpha-scales" as alpha-scales;   // legacy
```

And remove these from the `@mixin variables` body:

```scss
// 5. Legacy palette + alpha-scales (still emitted during migration)
@include palette.palette;
@include alpha-scales.alpha-scales;
```

Also remove the `@forward "tokens/palette" show $octo-mint, ...;` line near the top — these Sass variables are no longer exported.

- [ ] **Step 3: Delete the files**

```bash
rm src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_palette.scss
rm src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_alpha-scales.scss
```

- [ ] **Step 4: Build library**

```bash
cd src/frontend-libraries
npm run build:octo-ui
```
Expected: SUCCESS.

- [ ] **Step 5: Reinstall library in refinery**

```bash
cd ../octo-frontend-refinery-studio/src/octo-mesh-refinery-studio
npm ci
```
Expected: SUCCESS.

- [ ] **Step 6: Build refinery**

```bash
ng build --configuration development
```
Expected: SUCCESS. Refinery no longer references any legacy tokens, so no breakage.

- [ ] **Step 7: Commit**

```bash
cd ../../../octo-frontend-libraries
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_index.scss src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/_variables.scss
git commit -m "refactor(octo-ui): remove legacy palette + alpha-scales partials"
```

(The `rm` is recorded by `git add -A` or by adding the file paths explicitly. Verify with `git status`.)

---

## Phase G — TenantThemeService

### Task 32: Write failing test for TenantThemeService

**Files:**
- Create: `src/octo-mesh-refinery-studio/src/app/services/tenant-theme.service.spec.ts`

- [ ] **Step 1: Create the spec file**

```typescript
// src/octo-mesh-refinery-studio/src/app/services/tenant-theme.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { TenantThemeService } from './tenant-theme.service';

describe('TenantThemeService', () => {
  let service: TenantThemeService;
  let setPropertySpy: jasmine.Spy;
  let removePropertySpy: jasmine.Spy;
  let setAttributeSpy: jasmine.Spy;
  let warnSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TenantThemeService);

    setPropertySpy = spyOn(document.documentElement.style, 'setProperty');
    removePropertySpy = spyOn(document.documentElement.style, 'removeProperty');
    setAttributeSpy = spyOn(document.documentElement, 'setAttribute');
    warnSpy = spyOn(console, 'warn');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('listPresets returns all hardcoded preset ids', () => {
    const presets = service.listPresets();
    expect(presets).toContain('lcars-dark');
    expect(presets).toContain('lcars-light');
    expect(presets).toContain('ember');
    expect(presets).toContain('ocean');
    expect(presets).toContain('forest');
  });

  it('setTheme("ember") writes expected --theme-* overrides', () => {
    service.setTheme('ember');
    expect(setPropertySpy).toHaveBeenCalledWith('--theme-primary', '#ff6358');
    expect(setPropertySpy).toHaveBeenCalledWith('--theme-secondary', '#da9162');
    expect(setAttributeSpy).toHaveBeenCalledWith('data-theme', 'lcars-dark');
  });

  it('setTheme("lcars-light") sets data-theme attribute and applies no overrides', () => {
    service.setTheme('lcars-light');
    expect(setAttributeSpy).toHaveBeenCalledWith('data-theme', 'lcars-light');
    expect(setPropertySpy).not.toHaveBeenCalled();
  });

  it('setTheme(unknown) logs warning and applies nothing', () => {
    service.setTheme('this-is-not-a-real-preset');
    expect(warnSpy).toHaveBeenCalled();
    expect(setPropertySpy).not.toHaveBeenCalled();
    expect(setAttributeSpy).not.toHaveBeenCalled();
  });

  it('setTheme replaces previous overrides when called twice', () => {
    service.setTheme('ember');
    setPropertySpy.calls.reset();
    removePropertySpy.calls.reset();

    service.setTheme('ocean');

    // Previous ember overrides should be removed
    expect(removePropertySpy).toHaveBeenCalledWith('--theme-primary');
    expect(removePropertySpy).toHaveBeenCalledWith('--theme-secondary');

    // New ocean overrides should be set
    expect(setPropertySpy).toHaveBeenCalledWith('--theme-primary', '#00a8dc');
    expect(setPropertySpy).toHaveBeenCalledWith('--theme-secondary', '#546fbd');
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL**

```bash
cd src/octo-mesh-refinery-studio
npm test -- --watch=false --browsers=ChromeHeadless --include='**/tenant-theme.service.spec.ts'
```
Expected: FAIL — `TenantThemeService` does not exist yet.

- [ ] **Step 3: No commit yet — implementation comes next**

---

### Task 33: Implement TenantThemeService to pass the tests

**Files:**
- Create: `src/octo-mesh-refinery-studio/src/app/services/tenant-theme.service.ts`

- [ ] **Step 1: Create the service file**

```typescript
// src/octo-mesh-refinery-studio/src/app/services/tenant-theme.service.ts
import { Injectable } from '@angular/core';

interface ThemePreset {
  /** Optional data-theme attribute value to set on <html>. Default: don't change. */
  dataTheme?: 'lcars-dark' | 'lcars-light';
  /** Token overrides applied via inline style on documentElement. */
  overrides?: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class TenantThemeService {
  private readonly presets = new Map<string, ThemePreset>([
    ['lcars-dark',  { dataTheme: 'lcars-dark' }],
    ['lcars-light', { dataTheme: 'lcars-light' }],
    ['ember', {
      dataTheme: 'lcars-dark',
      overrides: {
        '--theme-primary':   '#ff6358',
        '--theme-secondary': '#da9162',
      }
    }],
    ['ocean', {
      dataTheme: 'lcars-dark',
      overrides: {
        '--theme-primary':   '#00a8dc',
        '--theme-secondary': '#546fbd',
      }
    }],
    ['forest', {
      dataTheme: 'lcars-dark',
      overrides: {
        '--theme-primary':   '#37b400',
        '--theme-secondary': '#64ceb9',
      }
    }],
  ]);

  private appliedKeys: string[] = [];

  setTheme(presetId: string): void {
    const preset = this.presets.get(presetId);
    if (!preset) {
      console.warn(`[TenantThemeService] Unknown preset: ${presetId}, ignoring`);
      return;
    }

    // Clear previously-applied inline overrides so presets compose cleanly
    for (const key of this.appliedKeys) {
      document.documentElement.style.removeProperty(key);
    }
    this.appliedKeys = [];

    if (preset.dataTheme) {
      document.documentElement.setAttribute('data-theme', preset.dataTheme);
    }
    if (preset.overrides) {
      for (const [key, value] of Object.entries(preset.overrides)) {
        document.documentElement.style.setProperty(key, value);
        this.appliedKeys.push(key);
      }
    }
  }

  /** Available presets for v1 manual testing. */
  listPresets(): string[] {
    return Array.from(this.presets.keys());
  }
}
```

- [ ] **Step 2: Run the tests, expect PASS**

```bash
cd src/octo-mesh-refinery-studio
npm test -- --watch=false --browsers=ChromeHeadless --include='**/tenant-theme.service.spec.ts'
```
Expected: 6 tests PASS.

- [ ] **Step 3: Run all refinery tests + lint**

```bash
ng lint
npm test -- --watch=false --browsers=ChromeHeadless
```
Expected: PASS.

- [ ] **Step 4: Commit (service + test together — TDD-style)**

```bash
git add src/octo-mesh-refinery-studio/src/app/services/tenant-theme.service.ts src/octo-mesh-refinery-studio/src/app/services/tenant-theme.service.spec.ts
git commit -m "feat(refinery): add TenantThemeService stub with hardcoded preset map"
```

---

### Task 34: Wire TenantThemeService into app and expose on window for dev

**Files:**
- Modify: `src/octo-mesh-refinery-studio/src/app/app.component.ts`

- [ ] **Step 1: Inject the service and expose on window**

In `app.component.ts`, add:

```typescript
import { TenantThemeService } from './services/tenant-theme.service';
```

In the `AppComponent` class, in the constructor, after the existing service injections, add:

```typescript
private readonly tenantThemeService = inject(TenantThemeService);

// In constructor:
constructor() {
  // … existing constructor body …

  // Dev-only: expose theme service on window for manual smoke testing.
  // Removed in v2 when proper UI is in place.
  if (typeof window !== 'undefined') {
    (window as unknown as { __theme: TenantThemeService }).__theme = this.tenantThemeService;
  }
}
```

- [ ] **Step 2: Build refinery**

```bash
cd src/octo-mesh-refinery-studio
ng build --configuration development
```
Expected: SUCCESS.

- [ ] **Step 3: Run all refinery tests + lint**

```bash
ng lint
npm test -- --watch=false --browsers=ChromeHeadless
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/octo-mesh-refinery-studio/src/app/app.component.ts
git commit -m "feat(refinery): wire TenantThemeService and expose on window.__theme for dev"
```

---

## Phase H — Verification

### Task 35: Full cross-repo build via build.ps1

- [ ] **Step 1: Run unified build**

```powershell
cd C:\dev\meshmakers\octo-frontend-refinery-studio
.\build.ps1 -configuration DebugL
```
Expected: SUCCESS for both library and refinery.

- [ ] **Step 2: Run production build to verify CSS budgets**

```powershell
.\build.ps1 -configuration Release
```
Expected: SUCCESS. CSS bundle should be ~5–10kB smaller than pre-refactor (k-generate-color-variations baked CSS removed, redundant Sass redeclarations gone).

- [ ] **Step 3: No commit (verification only)**

If anything fails, identify, fix, commit as `fix(...)`, repeat.

---

### Task 36: Migration completeness final check

- [ ] **Step 1: Run all completeness greps**

```bash
# Library — primitives should only remain inside themes/
grep -rn "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|var(--royal-violet\|var(--bubblegum\|var(--toffee\|var(--lilac-glow\|var(--indigogo" \
  src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/
```
Expected: 0 matches.

```bash
grep -rn "\\\$octo-mint\|\\\$iron-navy\|\\\$deep-sea\|\\\$royal-violet\|\\\$neo-cyan\|\\\$ash-blue" \
  src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/ \
  | grep -v "/themes/"
```
Expected: 0 matches.

```bash
# Refinery — zero primitive references anywhere in app/
grep -rn "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea\|var(--royal-violet\|var(--bubblegum\|var(--toffee\|var(--lilac-glow\|var(--indigogo" \
  ../octo-frontend-refinery-studio/src/octo-mesh-refinery-studio/src/
```
Expected: 0 matches.

```bash
grep -rn "\\\$octo-mint\|\\\$iron-navy\|\\\$deep-sea\|\\\$royal-violet\|\\\$neo-cyan\|\\\$ash-blue\|\\\$octo-text-color\|\\\$kendo-success\|\\\$bubblegum\|\\\$toffee\|\\\$lilac-glow\|\\\$indigogo\|\\\$pink" \
  ../octo-frontend-refinery-studio/src/octo-mesh-refinery-studio/src/
```
Expected: 0 matches.

- [ ] **Step 2: If any matches, fix and commit**

```bash
git commit -m "fix: missed primitive token reference in <file>"
```

- [ ] **Step 3: No commit when clean**

---

### Task 37: Demo-app canary check

Demo-app does not include `octo.styles()` or `octo.host-overrides()`. After the refactor, demo-app should still build and render with stock Kendo Default theme — no LCARS bleed-through.

- [ ] **Step 1: Build demo-app**

```bash
cd src/frontend-libraries
npm run build:demo-app 2>&1 | tail -20
```
Expected: SUCCESS.

- [ ] **Step 2: Start demo-app dev server**

```bash
cd src/frontend-libraries
npx ng serve demo-app
```
Wait for "Local: https://..." output, then open in browser.

- [ ] **Step 3: Verify visually**

- Login flow renders with stock Kendo Default theme
- AppBar / drawer / breadcrumb / menu render correctly
- `mm-tenant-switcher`, `mm-login-app-bar-section` components work
- No LCARS-specific colors (no Octo Mint, no Iron Navy backgrounds, no LCARS asymmetric corners)

- [ ] **Step 4: Stop dev server and commit nothing (verification only)**

If demo-app looks broken, the library leaked theme-specific styling somewhere; investigate and fix.

---

### Task 38: Manual visual walk-through — Pass 1 (lcars-dark default)

Goal: zero visual regression vs. pre-refactor refinery.

- [ ] **Step 1: Start refinery dev server**

```bash
cd ../octo-frontend-refinery-studio/src/octo-mesh-refinery-studio
npm start
```
Expected: server runs at https://localhost:4200.

- [ ] **Step 2: Log in**

Use local dev credentials (saved in project memory, see `memory/reference_local_dev_credentials.md`).

- [ ] **Step 3: Walk through the 21 screen categories**

For each category, visit the page, eyeball it, note any color/contrast/glow that looks "off" vs. expectations.

1. Login flow (already done in Step 2)
2. Tenant switcher popup
3. Cockpit (stats / health / version)
4. Tenants list + tenant details + tenant provisioning
5. Construction Kit Browser
6. Runtime Browser
7. Auto-Increment list + form
8. Fixup Scripts list + form
9. Events list
10. Query Builder + results
11. Adapters list + form
12. Pools list + form
13. Data flows list + editor
14. Pipelines panel inside data-flow editor
15. Notification templates list + form
16. Reporting Explorer
17. Configurations list (SAP, SFTP, FinAPI, Discord, etc. variants)
18. Service Health Detail
19. User Diagnostics
20. Process Designer (canvas + dockview)
21. Symbol Library + symbol editor

- [ ] **Step 4: Note regressions**

For each regression noted, identify the responsible SCSS file and apply a targeted fix. Commit fixes individually:

```bash
git commit -m "fix(refinery): visual regression in <component> — <description>"
```

- [ ] **Step 5: When all 21 pass, no commit (just verification)**

---

### Task 39: Manual visual walk-through — Pass 2 (lcars-light)

Goal: structural correctness — no invisible text, no white-on-white, no missing borders. Visual polish is acceptable to defer.

- [ ] **Step 1: Switch to light theme**

In browser devtools console:
```javascript
document.documentElement.setAttribute('data-theme', 'lcars-light');
```

- [ ] **Step 2: Walk through the same 21 screen categories**

For each, check:
- All text is readable (contrast, not invisible)
- No white-on-white or pure-light-on-light patches
- Borders / accents / glows visible
- Buttons / inputs / interactive elements clearly delineated

- [ ] **Step 3: Note structural issues**

Polish issues (e.g., "the mint is a touch too pale") are NOT blockers — log as follow-ups. Structural issues (e.g., "drawer text invisible") ARE blockers — fix immediately.

- [ ] **Step 4: Commit any fixes**

```bash
git commit -m "fix(themes): light theme structural issue in <component>"
```

- [ ] **Step 5: When all 21 are structurally correct, no commit**

---

### Task 40: Manual tenant override smoke test — Pass 3

- [ ] **Step 1: Switch back to dark theme**

```javascript
document.documentElement.setAttribute('data-theme', 'lcars-dark');
document.documentElement.style.cssText = ''; // clear any inline overrides
```

- [ ] **Step 2: Apply ember preset**

```javascript
window.__theme.setTheme('ember');
```

- [ ] **Step 3: Verify primary color changed across these elements**

Visit each page, observe the indicated element changes color from mint to ember red:

- **Cockpit** — stat card borders + glows
- **Drawer** — selected item background tint
- **Buttons** — primary state (e.g., "Save", "Add", primary toolbar buttons)
- **LCARS page-header accent bar** — vertical bar on the left of every page header
- **Process Designer** — canvas grid lines + active tab indicator in dockview

- [ ] **Step 4: Verify ocean preset**

```javascript
window.__theme.setTheme('ocean');
```
Same elements should now show cyan-blue instead of mint.

- [ ] **Step 5: Restore default**

```javascript
window.__theme.setTheme('lcars-dark');
```
All elements should return to LCARS mint exactly.

- [ ] **Step 6: No commit (verification only)**

If any element fails to update with the override, the most likely cause is a CSS rule still referencing a hardcoded color (Sass-time baked). Trace via devtools, find the file, fix, commit.

---

### Task 41: Update CLAUDE.md docs

**Files:**
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/CLAUDE.md`
- Modify: `src/octo-mesh-refinery-studio/CLAUDE.md`

- [ ] **Step 1: Update octo-ui CLAUDE.md**

Add a section under "## LCARS Theme Mixins" (or near the existing token explanation) describing:

- The two-tier semantic + derived token model
- The themes registry (`themes/_lcars-dark.scss`, `themes/_lcars-light.scss`)
- That `--theme-*` is the public theming surface, not `--octo-*`
- color-mix() browser baseline (Chromium 111+/Firefox 113+/Safari 16.2+)

Keep it succinct (~30 lines).

- [ ] **Step 2: Update refinery CLAUDE.md**

Update the existing "## Theme System (LCARS-Inspired)" and "### Light Theme Support (Concept)" sections:

- Mark "Light Theme Support" as IMPLEMENTED, not a concept
- Document `data-theme` attribute switching
- Document `window.__theme.setTheme(presetId)` for manual testing
- List the available presets (lcars-dark, lcars-light, ember, ocean, forest)
- Note that v2 will add backend-driven tenant config UI

- [ ] **Step 3: Commit each file separately**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/CLAUDE.md
git commit -m "docs(octo-ui): document semantic token model and themes registry"
```

```bash
git add ../octo-frontend-refinery-studio/src/octo-mesh-refinery-studio/CLAUDE.md
# (commit from refinery's repo if separate, else from libraries if monorepo-style)
git commit -m "docs(refinery): document data-theme switching and TenantThemeService"
```

---

### Task 42: Final smoke

- [ ] **Step 1: Final build via build.ps1**

```powershell
cd C:\dev\meshmakers\octo-frontend-refinery-studio
.\build.ps1 -configuration DebugL
.\build.ps1 -configuration Release
```
Expected: both SUCCESS.

- [ ] **Step 2: Final test run in both repos**

```bash
cd src/frontend-libraries
npm run lint
npm test -- --watch=false --browsers=ChromeHeadless

cd ../octo-frontend-refinery-studio/src/octo-mesh-refinery-studio
ng lint
npm test -- --watch=false --browsers=ChromeHeadless
```
Expected: PASS in all four commands.

- [ ] **Step 3: Confirm git status is clean**

```bash
git status
```
Expected: working tree clean (no unstaged changes from incidental edits).

- [ ] **Step 4: Branch ready for merge — no commit**

The feature branch tip is now the atomic refactor. Merge / squash / rebase strategy is the team's call.

---

## Done

The LCARS theme is now driven by a semantic token surface. Three override layers compose: theme defaults < app overrides < tenant runtime overrides. LCARS dark and light both ship. `TenantThemeService` is wired and verifiable from devtools. v2 work — backend tenant palette config and tenant-config UI — is unblocked and can begin in a separate spec when the team is ready.
