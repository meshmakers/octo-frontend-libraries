# octo-ui LCARS Theme Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `projects/meshmakers/octo-ui/src/lib/runtime-browser/styles/_styles.scss` (4,781 lines, single mixin) into a properly-structured `lib/lcars-theme/` folder with ~25–30 small partials, gate host-app LCARS overrides behind an opt-in `octo.host-overrides()` mixin, and aggressively remove gratuitous hacks.

**Architecture:** New folder `octo-ui/src/lib/lcars-theme/` becomes the home of the LCARS theme. The `runtime-browser/styles/` folder is removed (intentional break of the deep import path). The public consumer entry `<...>/octo-ui/styles` keeps the same `octo.variables()` and `octo.styles()` mixin names; a new `octo.host-overrides()` mixin is added for LCARS hosts (Refinery Studio etc.). All carving steps preserve compiled-CSS output until the final hack-removal sweep.

**Tech Stack:** SCSS (Dart Sass), Angular 21 + ng-packagr, Kendo UI Angular 23, Dockview. Build via `npm run build:octo-ui` and `npm run build:demo-app`. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-04-26-octo-ui-lcars-theme-split-design.md` (commit `27bf1a7`).

**Constraint (from user):** Local-only. **Never `git push` without explicit user permission.** Work on a feature branch off `main`.

---

## Conventions used in this plan

- **Working directory:** `C:\dev\meshmakers\octo-frontend-libraries` (the repo root). Frontend builds run from `src/frontend-libraries/`.
- **All file paths are repo-relative** unless otherwise stated.
- **Source file paths** are inside `src/frontend-libraries/projects/meshmakers/octo-ui/src/`. The plan abbreviates this as `<octo-ui>/`.
- **"Build & verify" command** (used many times):
  ```bash
  cd src/frontend-libraries
  npm run build:octo-ui
  npm run build:demo-app
  ```
  These must both succeed without new errors.
- **CSS-diff verification** — the baseline is captured in Phase 0 and lives at `<repo>/baseline-css/` (gitignored). To diff after a phase:
  ```bash
  cd src/frontend-libraries
  npm run build:demo-app
  diff -r ../../baseline-css/ dist/demo-app/browser/
  ```
  The expected diff between phases 1–4 is **empty or whitespace-only**. Phase 5 (hack sweep) will produce non-trivial diffs by design.
- **Commits** are per-task or per-logical-group. Commit messages prefixed with `refactor(octo-ui):`. The user's CLAUDE.md uses `AB#NNNN` work-item prefixes — if a work item exists, use that; otherwise plain `refactor(octo-ui):` is fine.

---

## Phase 0 — Pre-flight & Baseline

### Task 0.1: Confirm clean working tree on a feature branch

**Files:**
- No file changes.

- [ ] **Step 1: Confirm `git status` is clean (apart from the design doc commit `27bf1a7` and any unrelated untracked files).**

```bash
cd C:/dev/meshmakers/octo-frontend-libraries
git status
git log -1 --oneline
```

Expected: `git status` shows working tree clean (or only unrelated untracked files like `docs/superpowers/plans/`). HEAD is `27bf1a7` (the design spec commit) or a descendant.

- [ ] **Step 2: Create and switch to the feature branch.**

If a work-item number exists (e.g., `AB#4012`), use `feature/AB-4012-lcars-theme-split`. Otherwise:

```bash
git checkout -b feature/lcars-theme-split
```

- [ ] **Step 3: Verify branch.**

```bash
git branch --show-current
```

Expected: prints the new branch name.

- [ ] **Step 4: Commit (no-op marker).**

No commit at this step — branch creation is enough.

### Task 0.2: Capture build baseline

**Files:**
- Create: `<repo>/baseline-css/` (gitignored — local-only artifact)

- [ ] **Step 1: Run baseline lint and tests to confirm starting state is green.**

```bash
cd src/frontend-libraries
npm run lint:octo-ui
npm test -- --project=@meshmakers/octo-ui --watch=false --browsers=ChromeHeadless
```

Expected: both pass. If either fails, **stop** and reconcile before continuing — the refactor must start from a green baseline.

- [ ] **Step 2: Run baseline build of octo-ui and demo-app.**

```bash
npm run build:octo-ui
npm run build:demo-app
```

Expected: both succeed.

- [ ] **Step 3: Capture compiled CSS baseline.**

```bash
cd C:/dev/meshmakers/octo-frontend-libraries
mkdir -p baseline-css
cp -r src/frontend-libraries/dist/demo-app/browser/*.css baseline-css/
ls baseline-css/
```

Expected: at least one `*.css` file (likely `styles-<hash>.css`) is now in `baseline-css/`.

- [ ] **Step 4: Add `baseline-css/` to `.gitignore` if not already.**

Check first:

```bash
grep "baseline-css" .gitignore || echo "baseline-css/" >> .gitignore
git diff .gitignore
```

If `.gitignore` was modified, stage and commit it:

```bash
git add .gitignore
git commit -m "chore: ignore local baseline-css/ artifact for refactor verification"
```

### Task 0.3: Capture visual baseline screenshots (manual, user)

**Files:**
- No code changes. Screenshots are stored locally (or anywhere the user prefers) — not committed.

- [ ] **Step 1: Start the demo-app dev server.**

```bash
cd src/frontend-libraries
npm start
```

Expected: dev server boots; demo-app available at the URL printed in console.

- [ ] **Step 2: Walk the 21 screens in spec §8 and capture screenshots.**

The 21-screen list is in `docs/superpowers/specs/2026-04-26-octo-ui-lcars-theme-split-design.md` §8. Save screenshots wherever convenient — they're for **your** later visual comparison, not committed to git.

- [ ] **Step 3: Stop the dev server (Ctrl-C).**

---

## Phase 1 — Move files into `lib/lcars-theme/`

Plumbing only — no semantic changes. After this phase, the build still produces byte-identical CSS.

### Task 1.1: Create the new folder and move files via `git mv`

**Files:**
- Create: `<octo-ui>/lib/lcars-theme/` (folder).
- Move: `<octo-ui>/lib/runtime-browser/styles/_index.scss` → `<octo-ui>/lib/lcars-theme/_index.scss`
- Move: `<octo-ui>/lib/runtime-browser/styles/_variables.scss` → `<octo-ui>/lib/lcars-theme/_variables.scss`
- Move: `<octo-ui>/lib/runtime-browser/styles/_styles.scss` → `<octo-ui>/lib/lcars-theme/_styles.scss`
- Move: `<octo-ui>/lib/runtime-browser/styles/_kendo-theme.scss` → `<octo-ui>/lib/lcars-theme/_kendo-theme.scss`
- Move: `<octo-ui>/lib/runtime-browser/styles/_lcars-button.scss` → `<octo-ui>/lib/lcars-theme/_lcars-button.scss`
- Move: `<octo-ui>/lib/runtime-browser/styles/_lcars-flat-btn.scss` → `<octo-ui>/lib/lcars-theme/_lcars-flat-btn.scss`
- Move: `<octo-ui>/lib/runtime-browser/styles/_lcars-input.scss` → `<octo-ui>/lib/lcars-theme/_lcars-input.scss`
- Move: `<octo-ui>/lib/runtime-browser/styles/README.md` → `<octo-ui>/lib/lcars-theme/README.md`

- [ ] **Step 1: Create the new folder.**

```bash
mkdir src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme
```

- [ ] **Step 2: Run all the `git mv` commands.**

```bash
cd src/frontend-libraries/projects/meshmakers/octo-ui/src/lib

git mv runtime-browser/styles/_index.scss      lcars-theme/_index.scss
git mv runtime-browser/styles/_variables.scss  lcars-theme/_variables.scss
git mv runtime-browser/styles/_styles.scss     lcars-theme/_styles.scss
git mv runtime-browser/styles/_kendo-theme.scss lcars-theme/_kendo-theme.scss
git mv runtime-browser/styles/_lcars-button.scss lcars-theme/_lcars-button.scss
git mv runtime-browser/styles/_lcars-flat-btn.scss lcars-theme/_lcars-flat-btn.scss
git mv runtime-browser/styles/_lcars-input.scss lcars-theme/_lcars-input.scss
git mv runtime-browser/styles/README.md         lcars-theme/README.md
```

- [ ] **Step 3: Verify the old folder is empty and remove it.**

```bash
cd C:/dev/meshmakers/octo-frontend-libraries
ls src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/runtime-browser/styles/
```

Expected: empty.

```bash
rmdir src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/runtime-browser/styles
```

### Task 1.2: Update the public entry to point at the new location

**Files:**
- Modify: `<octo-ui>/styles/_index.scss`
- Modify: `<octo-ui>/styles/_with-kendo.scss`

- [ ] **Step 1: Update `_index.scss`.**

Replace the file contents with:

```scss
// Global Octo UI styles entrypoint.
// Forward LCARS theme so consumers can configure variables() and styles() mixins.
@forward "../lib/lcars-theme/index";
```

- [ ] **Step 2: Update `_with-kendo.scss`.**

Replace the file contents with:

```scss
// ============================================================================
// OCTO UI - Styles WITH Kendo Theme (for apps that don't import Kendo)
// Use this entry point when your app does NOT already import a Kendo theme.
// When Kendo is already imported, use _index.scss instead.
// ============================================================================

@use "../lib/lcars-theme/kendo-theme";
@forward "../lib/lcars-theme/index";
```

### Task 1.3: Verify the build and CSS diff

- [ ] **Step 1: Build & verify.**

```bash
cd src/frontend-libraries
npm run build:octo-ui
npm run build:demo-app
```

Expected: both succeed.

- [ ] **Step 2: Diff compiled CSS against baseline.**

```bash
cd C:/dev/meshmakers/octo-frontend-libraries
diff -r baseline-css/ src/frontend-libraries/dist/demo-app/browser/ | head -20
```

Expected: empty diff or only whitespace differences. If non-trivial CSS differences appear, **stop** and reconcile.

### Task 1.4: Commit Phase 1

- [ ] **Step 1: Stage and commit.**

```bash
cd C:/dev/meshmakers/octo-frontend-libraries
git add -A src/frontend-libraries/projects/meshmakers/octo-ui/src/
git status
git commit -m "$(cat <<'EOF'
refactor(octo-ui): move LCARS theme out of runtime-browser/

Plumbing-only move of styles files from runtime-browser/styles/ to
lib/lcars-theme/. Public entry points (octo-ui/src/styles/_index.scss
and _with-kendo.scss) updated to forward from the new location.

No semantic changes; compiled CSS is identical to baseline.

Refs spec: docs/superpowers/specs/2026-04-26-octo-ui-lcars-theme-split-design.md
EOF
)"
```

---

## Phase 2 — Decompose `_variables.scss` into `tokens/`

The current `_variables.scss` mixes brand colors, alpha scales, typography, radii, motion, designer-panel vars, and cron-cell vars. Split into focused files.

### Task 2.1: Create `tokens/` folder structure

**Files:**
- Create: `<octo-ui>/lib/lcars-theme/tokens/_index.scss`
- Create: `<octo-ui>/lib/lcars-theme/tokens/_palette.scss`
- Create: `<octo-ui>/lib/lcars-theme/tokens/_alpha-scales.scss`
- Create: `<octo-ui>/lib/lcars-theme/tokens/_radius.scss`
- Create: `<octo-ui>/lib/lcars-theme/tokens/_motion.scss`
- Create: `<octo-ui>/lib/lcars-theme/tokens/_typography.scss`
- Create: `<octo-ui>/lib/lcars-theme/tokens/_designer.scss`

- [ ] **Step 1: Create the tokens folder.**

```bash
mkdir src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens
```

### Task 2.2: Extract brand palette and Sass variables to `tokens/_palette.scss`

**Files:**
- Create: `<octo-ui>/lib/lcars-theme/tokens/_palette.scss`
- Source: `<octo-ui>/lib/lcars-theme/_variables.scss` lines 1–52 (brand color Sass vars + `--lcars-*`/`--octo-*`/`--neo-*`/etc. base CSS vars + `--kendo-color-*` overrides)

- [ ] **Step 1: Create the palette partial.**

Write the file with this exact content (copying lines 1–52 of `_variables.scss` plus a `@mixin palette` wrapper):

```scss
// ============================================================================
// LCARS DESIGN TOKENS - Brand Palette
// Sass variables and base CSS custom properties for the LCARS color system.
// ============================================================================

// ----------------------------------------------------------------------------
// LCARS DESIGN TOKENS - Brand color palette (from Brand Manual)
// ----------------------------------------------------------------------------
$octo-mint: #64ceb9;        // Primary highlight
$neo-cyan: #00a8dc;         // Secondary highlight
$indigogo: #546fbd;         // Panel accents
$toffee: #da9162;           // Warm accent
$bubblegum: #ec658f;        // Alert/warning accent
$lilac-glow: #c861d6;       // Hover states, glow effects
$royal-violet: #6c4da8;     // LCARS-typical accent
$ash-blue: #9292a6;         // Inactive elements, secondary text
$iron-navy: #394555;        // Surface, panels
$deep-sea: #07172b;         // Background (NEVER use black!)
$surface-elevated: #1f2e40; // Elevated surfaces
$octo-text-color: #ffffff;
$lcars-border-color: #64ceb9;
$pink: #ec658f;

// Additional theme colors (used when Kendo theme is applied)
$kendo-inverse: #3d3d3d;
$kendo-success: #37b400;

@mixin palette {
  --lcars-border-color: #{$lcars-border-color};
  --pink: #{$pink};

  // Brand Colors as CSS Variables
  --octo-mint: #{$octo-mint};
  --neo-cyan: #{$neo-cyan};
  --indigogo: #{$indigogo};
  --toffee: #{$toffee};
  --bubblegum: #{$bubblegum};
  --lilac-glow: #{$lilac-glow};
  --royal-violet: #{$royal-violet};
  --ash-blue: #{$ash-blue};
  --iron-navy: #{$iron-navy};
  --deep-sea: #{$deep-sea};
  --surface-elevated: #{$surface-elevated};
  --octo-text-color: #{$octo-text-color};
  --kendo-success: #{$kendo-success};

  // Kendo variable overrides - applied when Kendo is imported by host
  --kendo-color-primary: var(--octo-mint);
  --kendo-color-primary-on-surface: var(--octo-mint);
  --kendo-color-app-surface: var(--deep-sea);
  --kendo-color-on-app-surface: var(--octo-text-color);
}
```

### Task 2.3: Extract typography to `tokens/_typography.scss`

**Files:**
- Create: `<octo-ui>/lib/lcars-theme/tokens/_typography.scss`
- Source: `_variables.scss` lines 33–34 (`--lcars-font-primary`, `--lcars-font-mono`) + line 59 (`font-family` declaration)

- [ ] **Step 1: Create the typography partial.**

```scss
// ============================================================================
// LCARS DESIGN TOKENS - Typography
// ============================================================================

@mixin typography {
  --lcars-font-primary: "Montserrat", "Roboto", "Helvetica Neue", sans-serif;
  --lcars-font-mono: "Roboto Mono", "Consolas", monospace;
  font-family: var(--lcars-font-primary);
}
```

### Task 2.4: Extract alpha-scales to `tokens/_alpha-scales.scss`

**Files:**
- Create: `<octo-ui>/lib/lcars-theme/tokens/_alpha-scales.scss`
- Source: `_variables.scss` lines 62–151 (all `--*-NN` `color-mix(...)` declarations)

- [ ] **Step 1: Create the alpha-scales partial.**

```scss
// ============================================================================
// LCARS DESIGN TOKENS - Alpha & Tint Scales
// Derived colors via color-mix() for gradients/overlays.
// ============================================================================

@mixin alpha-scales {
  // Mint alpha/tint scales
  --octo-mint-05: color-mix(in srgb, var(--octo-mint) 5%, transparent);
  --octo-mint-03: color-mix(in srgb, var(--octo-mint) 3%, transparent);
  --octo-mint-08: color-mix(in srgb, var(--octo-mint) 8%, transparent);
  --octo-mint-10: color-mix(in srgb, var(--octo-mint) 10%, transparent);
  --octo-mint-15: color-mix(in srgb, var(--octo-mint) 15%, transparent);
  --octo-mint-20: color-mix(in srgb, var(--octo-mint) 20%, transparent);
  --octo-mint-25: color-mix(in srgb, var(--octo-mint) 25%, transparent);
  --octo-mint-30: color-mix(in srgb, var(--octo-mint) 30%, transparent);
  --octo-mint-35: color-mix(in srgb, var(--octo-mint) 35%, transparent);
  --octo-mint-40: color-mix(in srgb, var(--octo-mint) 40%, transparent);
  --octo-mint-45: color-mix(in srgb, var(--octo-mint) 45%, transparent);
  --octo-mint-50: color-mix(in srgb, var(--octo-mint) 50%, transparent);
  --octo-mint-60: color-mix(in srgb, var(--octo-mint) 60%, transparent);
  --octo-mint-80: color-mix(in srgb, var(--octo-mint) 80%, transparent);
  --octo-mint-dark-10: color-mix(in srgb, var(--octo-mint), black 10%);
  --octo-mint-light-5: color-mix(in srgb, var(--octo-mint), white 5%);
  --octo-mint-light-10: color-mix(in srgb, var(--octo-mint), white 10%);

  // Bubblegum scales
  --bubblegum-05: color-mix(in srgb, var(--bubblegum) 5%, transparent);
  --bubblegum-10: color-mix(in srgb, var(--bubblegum) 10%, transparent);
  --bubblegum-15: color-mix(in srgb, var(--bubblegum) 15%, transparent);
  --bubblegum-20: color-mix(in srgb, var(--bubblegum) 20%, transparent);
  --bubblegum-30: color-mix(in srgb, var(--bubblegum) 30%, transparent);
  --bubblegum-40: color-mix(in srgb, var(--bubblegum) 40%, transparent);
  --bubblegum-50: color-mix(in srgb, var(--bubblegum) 50%, transparent);
  --bubblegum-60: color-mix(in srgb, var(--bubblegum) 60%, transparent);

  // Toffee scales
  --toffee-15: color-mix(in srgb, var(--toffee) 15%, transparent);
  --toffee-30: color-mix(in srgb, var(--toffee) 30%, transparent);
  --toffee-40: color-mix(in srgb, var(--toffee) 40%, transparent);
  --toffee-50: color-mix(in srgb, var(--toffee) 50%, transparent);

  // Royal violet scales
  --royal-violet-15: color-mix(in srgb, var(--royal-violet) 15%, transparent);
  --royal-violet-30: color-mix(in srgb, var(--royal-violet) 30%, transparent);
  --royal-violet-40: color-mix(in srgb, var(--royal-violet) 40%, transparent);
  --royal-violet-50: color-mix(in srgb, var(--royal-violet) 50%, transparent);
  --royal-violet-light-20: color-mix(in srgb, var(--royal-violet), white 20%);

  // Neo-cyan scales
  --neo-cyan-05: color-mix(in srgb, var(--neo-cyan) 5%, transparent);
  --neo-cyan-10: color-mix(in srgb, var(--neo-cyan) 10%, transparent);
  --neo-cyan-30: color-mix(in srgb, var(--neo-cyan) 30%, transparent);
  --neo-cyan-40: color-mix(in srgb, var(--neo-cyan) 40%, transparent);
  --neo-cyan-dark-10: color-mix(in srgb, var(--neo-cyan), black 10%);

  // Iron-navy scales
  --iron-navy-60: color-mix(in srgb, var(--iron-navy) 60%, transparent);
  --iron-navy-80: color-mix(in srgb, var(--iron-navy) 80%, transparent);
  --iron-navy-50: color-mix(in srgb, var(--iron-navy) 50%, transparent);
  --iron-navy-70: color-mix(in srgb, var(--iron-navy) 70%, transparent);
  --iron-navy-dark-5: color-mix(in srgb, var(--iron-navy), black 5%);

  // Deep-sea scales
  --deep-sea-40: color-mix(in srgb, var(--deep-sea) 40%, transparent);
  --deep-sea-50: color-mix(in srgb, var(--deep-sea) 50%, transparent);
  --deep-sea-60: color-mix(in srgb, var(--deep-sea) 60%, transparent);
  --deep-sea-80: color-mix(in srgb, var(--deep-sea) 80%, transparent);
  --deep-sea-90: color-mix(in srgb, var(--deep-sea) 90%, transparent);
  --deep-sea-95: color-mix(in srgb, var(--deep-sea) 95%, transparent);

  // Ash-blue scales
  --ash-blue-10: color-mix(in srgb, var(--ash-blue) 10%, transparent);
  --ash-blue-15: color-mix(in srgb, var(--ash-blue) 15%, transparent);
  --ash-blue-20: color-mix(in srgb, var(--ash-blue) 20%, transparent);
  --ash-blue-30: color-mix(in srgb, var(--ash-blue) 30%, transparent);
  --ash-blue-50: color-mix(in srgb, var(--ash-blue) 50%, transparent);
  --ash-blue-70: color-mix(in srgb, var(--ash-blue) 70%, transparent);
  --ash-blue-80: color-mix(in srgb, var(--ash-blue) 80%, transparent);

  // Surface-elevated scales
  --surface-elevated-40: color-mix(in srgb, var(--surface-elevated) 40%, transparent);
  --surface-elevated-50: color-mix(in srgb, var(--surface-elevated) 50%, transparent);
  --surface-elevated-90: color-mix(in srgb, var(--surface-elevated) 90%, transparent);
  --surface-elevated-60: color-mix(in srgb, var(--surface-elevated) 60%, transparent);
  --surface-elevated-80: color-mix(in srgb, var(--surface-elevated) 80%, transparent);
}
```

### Task 2.5: Extract LCARS effect tokens to `tokens/_motion.scss` and `tokens/_radius.scss`

**Files:**
- Create: `<octo-ui>/lib/lcars-theme/tokens/_radius.scss`
- Create: `<octo-ui>/lib/lcars-theme/tokens/_motion.scss`
- Source: `_variables.scss` lines 153–175 (LCARS-specific design tokens, radius, transitions)

- [ ] **Step 1: Create `_radius.scss`.**

```scss
// ============================================================================
// LCARS DESIGN TOKENS - Border Radius
// LCARS asymmetric radii are characteristic of the design language.
// ============================================================================

@mixin radius {
  --lcars-radius-sm: 4px;
  --lcars-radius-md: 8px;
  --lcars-radius-lg: 16px;
  --lcars-radius-xl: 24px;
  --lcars-radius-pill: 50px;
}
```

- [ ] **Step 2: Create `_motion.scss`.**

```scss
// ============================================================================
// LCARS DESIGN TOKENS - Motion & Effect Composites
// Transitions, glows, button gradients, focus states.
// ============================================================================

@mixin motion {
  --lcars-glow-primary: 0 0 10px var(--octo-mint-40);
  --lcars-btn-base: linear-gradient(180deg, var(--octo-mint-15), var(--octo-mint-05));
  --lcars-btn-base-hover: linear-gradient(180deg, var(--octo-mint-25), var(--octo-mint-15));
  --lcars-input-focus: 0 0 8px var(--octo-mint-30);
  --lcars-glow-cyan: 0 0 10px var(--neo-cyan-40);
  --lcars-glow-violet: 0 0 10px var(--royal-violet-40);
  --lcars-glow-pink: 0 0 10px var(--bubblegum-40);

  // Panel styling tokens
  --lcars-panel-border: 1px solid var(--octo-mint-20);
  --lcars-panel-bg: var(--surface-elevated-60);

  // Transitions
  --lcars-transition-fast: 150ms ease;
  --lcars-transition-normal: 250ms ease;
}
```

### Task 2.6: Extract designer-panel and cron-cell tokens to `tokens/_designer.scss`

**Files:**
- Create: `<octo-ui>/lib/lcars-theme/tokens/_designer.scss`
- Source: `_variables.scss` lines 177–199 (designer panel vars + cron expression cell vars)

- [ ] **Step 1: Create `_designer.scss`.**

```scss
// ============================================================================
// LCARS DESIGN TOKENS - Designer & Specialized Component Variables
// Variables consumed by Process Designer / Symbol Editor and the cron cell.
// Defaults follow the LCARS theme; non-LCARS hosts override these.
// ============================================================================

@mixin designer {
  // Designer/Symbol Editor Panel Variables (LCARS theme)
  --designer-panel-bg: var(--surface-elevated);
  --designer-panel-bg-elevated: var(--iron-navy);
  --designer-panel-border: var(--octo-mint-20);
  --designer-panel-text: var(--octo-text-color);
  --designer-panel-text-secondary: var(--ash-blue);
  --designer-panel-text-muted: color-mix(in srgb, var(--ash-blue) 70%, transparent);
  --designer-panel-accent: var(--octo-mint);
  --designer-panel-accent-hover-bg: var(--octo-mint-15);
  --designer-panel-input-bg: var(--deep-sea);
  --designer-panel-delete-hover-bg: var(--bubblegum-20);
  --designer-panel-delete-color: var(--bubblegum);

  // Cron Expression Cell Variables (LCARS theme for list view)
  --mm-cron-code-bg: var(--deep-sea-80);
  --mm-cron-code-text: var(--octo-mint);
  --mm-cron-text-secondary: var(--ash-blue);
  --mm-cron-success: var(--kendo-success);
}
```

### Task 2.7: Wire the tokens index

**Files:**
- Create: `<octo-ui>/lib/lcars-theme/tokens/_index.scss`

- [ ] **Step 1: Create the index that aggregates the token mixins.**

```scss
// Tokens aggregator. The variables() mixin at the lcars-theme/_index.scss
// level composes from these per-concern token partials.

@forward "palette";
@forward "typography";
@forward "alpha-scales";
@forward "radius";
@forward "motion";
@forward "designer";
```

### Task 2.8: Replace `_variables.scss` with a recomposed `variables()` mixin

**Files:**
- Modify: `<octo-ui>/lib/lcars-theme/_variables.scss` (rewrite contents)

- [ ] **Step 1: Replace the file contents with a thin recomposition.**

```scss
// ============================================================================
// LCARS Theme - Variables mixin (recomposed from tokens/)
// Public API: @include octo.variables() emits all CSS custom properties.
// ============================================================================

@use "tokens/palette" as palette;
@use "tokens/typography" as typography;
@use "tokens/alpha-scales" as alpha-scales;
@use "tokens/radius" as radius;
@use "tokens/motion" as motion;
@use "tokens/designer" as designer;

@forward "tokens/palette" show $octo-mint, $neo-cyan, $indigogo, $toffee, $bubblegum, $lilac-glow, $royal-violet, $ash-blue, $iron-navy, $deep-sea, $surface-elevated, $octo-text-color, $lcars-border-color, $pink, $kendo-inverse, $kendo-success;

@mixin variables {
  @include palette.palette;
  @include typography.typography;
  @include alpha-scales.alpha-scales;
  @include radius.radius;
  @include motion.motion;
  @include designer.designer;
}
```

### Task 2.9: Verify Phase 2 build and CSS-var equivalence

- [ ] **Step 1: Build & verify.**

```bash
cd src/frontend-libraries
npm run build:octo-ui
npm run build:demo-app
```

Expected: both succeed.

- [ ] **Step 2: Diff against baseline.**

```bash
cd C:/dev/meshmakers/octo-frontend-libraries
diff -r baseline-css/ src/frontend-libraries/dist/demo-app/browser/ | head -50
```

Expected: empty or whitespace-only. Key check: every `--octo-*`, `--lcars-*`, `--designer-*`, `--mm-cron-*`, `--kendo-color-*` custom property still emits with the same value. If any are missing, the most likely cause is a missing `@include` in the recomposed `variables()` mixin — fix and re-verify.

### Task 2.10: Commit Phase 2

- [ ] **Step 1: Stage and commit.**

```bash
cd C:/dev/meshmakers/octo-frontend-libraries
git add -A src/frontend-libraries/projects/meshmakers/octo-ui/src/
git commit -m "$(cat <<'EOF'
refactor(octo-ui): decompose _variables.scss into tokens/ partials

Split the LCARS variables mixin into one file per concern:
- tokens/_palette.scss      (brand colors + Sass vars + Kendo overrides)
- tokens/_typography.scss   (font families)
- tokens/_alpha-scales.scss (color-mix derived alpha/tint scales)
- tokens/_radius.scss       (LCARS asymmetric radii)
- tokens/_motion.scss       (transitions, glows, button gradients)
- tokens/_designer.scss     (designer-panel + cron-cell vars)

variables() is recomposed from the partials. CSS output unchanged.

Refs spec: docs/superpowers/specs/2026-04-26-octo-ui-lcars-theme-split-design.md
EOF
)"
```

---

## Phase 3 — Decompose `_styles.scss` into per-concern partials

This is the biggest phase. Carve sections out of `_styles.scss` one at a time, **in source order from top to bottom**. Each carve preserves the rules verbatim — no semantic change. The leftover `_styles.scss` keeps shrinking; when empty, it's deleted.

### Approach

For each carve task:

1. **Open `<octo-ui>/lib/lcars-theme/_styles.scss`** and locate the source line range (given per task).
2. **Cut** those lines from `_styles.scss`. The cut content is **inside** `@mixin styles { ... }` and is indented two spaces. Strip the leading two spaces of indentation when copying.
3. **Paste** into the new partial inside its own `@mixin <name> { ... }` wrapper.
4. **Add `@forward` / `@include` wiring** in `lcars-theme/_index.scss` (created in Task 3.0 below).
5. **Build & diff** — diff against baseline must remain empty or whitespace-only after each carve.

The `_styles.scss` mixin keeps its `@mixin styles { ... }` wrapper; the `lcars-theme/_index.scss` aggregator includes both the leftover `styles()` mixin and the carved-out mixins. As carving proceeds, the leftover shrinks.

The line ranges below are based on the **original** `_styles.scss` (current file, length 4781 lines). Since carving removes lines, **always re-locate the next section by its `// Section comment`** rather than relying on line numbers verbatim.

### Task 3.0: Create the new `lcars-theme/_index.scss` aggregator

**Files:**
- Modify: `<octo-ui>/lib/lcars-theme/_index.scss` (rewrite contents)

- [ ] **Step 1: Replace the file contents with the new aggregator scaffold.**

```scss
// ============================================================================
// LCARS Theme — public mixin API
//
// @include octo.variables();   // CSS custom properties (composed from tokens/)
// @include octo.styles();      // Global LCARS theme rules
//
// Host-specific overrides (Process Designer / MeshBoard / Markdown Widget /
// Process Widget) are NOT included by styles(). LCARS hosts opt in via:
//   @include octo.host-overrides();
// (forwarded from <octo-ui>/styles/_host-overrides.scss).
// ============================================================================

@use "variables" as v;
@use "styles" as legacy-styles;

@forward "variables" show variables;

@mixin styles {
  // While carving Phase 3, partials are added here one at a time.
  // The leftover legacy-styles.styles() rules continue to emit until empty.
  @include legacy-styles.styles;
}
```

After each carve task in Phase 3, the engineer adds an `@use` and an `@include` line for the new partial inside `@mixin styles { ... }`, in the same source order as the original file.

### Task 3.1: Carve out Dockview overrides → `thirdparty/_dockview.scss`

**Files:**
- Create: `<octo-ui>/lib/lcars-theme/thirdparty/_dockview.scss`
- Modify: `<octo-ui>/lib/lcars-theme/_styles.scss` (remove lines 8–74 — the rules between section comment "Direct dockview element overrides" and the comment "Dockview panel content areas")
- Modify: `<octo-ui>/lib/lcars-theme/_index.scss` (add `@use` + `@include` wiring)

- [ ] **Step 1: Create the folder.**

```bash
mkdir src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/thirdparty
```

- [ ] **Step 2: Create the partial.**

Copy lines 8–74 of the original `_styles.scss` into a new file. Strip the inner indentation (2 leading spaces) and wrap in `@mixin dockview { ... }`. The file should look like:

```scss
// ============================================================================
// Dockview library overrides
// Direct dockview element overrides — needed because ViewEncapsulation blocks
// global styles. These must be at the root level to properly cascade into the
// dockview library.
// ============================================================================

@mixin dockview {
  .dv-dockview,
  .dv-grid-view {
    background-color: var(--deep-sea) !important;
  }

  .dv-tabs-container,
  .dv-tabs-and-actions-container {
    background-color: var(--iron-navy) !important;
    border-bottom: 1px solid var(--octo-mint-20) !important;
  }

  // ... (all rules from original lines 8–74, with 2 leading spaces of indentation removed)
}
```

**Concrete extraction process:**
1. Open `_styles.scss`, select lines 8–74 (the block from the first `.dv-dockview,` through the last `.dv-tabs-overflow-container { ... }` before the comment "Dockview panel content areas").
2. Cut (delete from `_styles.scss`).
3. Paste into the new file inside the `@mixin dockview { ... }` wrapper.
4. Remove 2 leading spaces of indentation from each line of the pasted block.

- [ ] **Step 3: Wire into the aggregator.**

Edit `<octo-ui>/lib/lcars-theme/_index.scss`. Add `@use "thirdparty/dockview" as dockview;` near the top with the other `@use` statements, and add `@include dockview.dockview;` as the **first** line inside `@mixin styles`.

The file should now look like:

```scss
@use "variables" as v;
@use "styles" as legacy-styles;
@use "thirdparty/dockview" as dockview;

@forward "variables" show variables;

@mixin styles {
  @include dockview.dockview;
  @include legacy-styles.styles;
}
```

- [ ] **Step 4: Build & verify.**

```bash
cd src/frontend-libraries
npm run build:octo-ui
npm run build:demo-app
```

Expected: succeed.

- [ ] **Step 5: Diff against baseline.**

```bash
cd C:/dev/meshmakers/octo-frontend-libraries
diff -r baseline-css/ src/frontend-libraries/dist/demo-app/browser/ | head -20
```

Expected: empty or whitespace-only.

- [ ] **Step 6: Commit.**

```bash
git add -A src/frontend-libraries/projects/meshmakers/octo-ui/src/
git commit -m "refactor(octo-ui): carve dockview overrides into thirdparty/_dockview.scss"
```

### Task 3.2: Carve out Process Designer host-override → `host-overrides/_process-designer.scss`

**Files:**
- Create: `<octo-ui>/lib/lcars-theme/host-overrides/_process-designer.scss`
- Modify: `<octo-ui>/lib/lcars-theme/_styles.scss` (remove lines 76–1538 — Process Designer panels through canvas LCARS overrides)
- Modify: `<octo-ui>/lib/lcars-theme/_index.scss` (add `@use` + `@include` wiring — but **NOT** in `styles()` mixin yet; this becomes a host-overrides mixin)

This block contains: `mm-elements-panel`, `mm-symbols-panel`, `mm-properties-panel`, `mm-transform-panel`, `mm-animations-panel`, `mm-simulation-panel-wrapper`, `mm-settings-panel`, `mm-exposures-panel`, `mm-styles-panel` containers plus `::ng-deep` LCARS theming for each of these panels, plus animation editor, transform property editor, simulation panel, settings panel, symbol library panel, binding editor dialog, designer Kendo inputs, SVG import dialog, symbol import dialog, **and** the Process Designer & Symbol Editor canvas LCARS overrides at the end.

- [ ] **Step 1: Create the folder.**

```bash
mkdir src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/host-overrides
```

- [ ] **Step 2: Create the partial.**

Cut lines 76–1538 of `_styles.scss` (locate by section comments "Dockview panel content areas" through end of "Force LCARS styling on process designer internal elements" — the last block before "Process Widget (MeshBoard) - LCARS overrides"). Wrap in `@mixin process-designer { ... }`:

```scss
// ============================================================================
// HOST OVERRIDE — Process Designer & Symbol Editor LCARS theming
//
// Library components (octo-process-diagrams, octo-meshboard) ship with neutral
// styles. This mixin emits LCARS-specific overrides for hosts (Refinery Studio
// etc.). Pulled in only via @include octo.host-overrides();
// ============================================================================

@mixin process-designer {
  // Dockview panel content areas
  mm-elements-panel,
  mm-symbols-panel,
  mm-properties-panel,
  // ... (all rules from original lines 76–1538, with 2 leading spaces of indentation removed)
}
```

- [ ] **Step 3: Wire into the aggregator — but NOT inside `styles()`.**

Edit `<octo-ui>/lib/lcars-theme/_index.scss`. Add `@use "host-overrides/process-designer" as host-process-designer;` near the other `@use` statements. Do **NOT** include it in `@mixin styles`. Phase 4 wires the host-overrides mixin properly. For now, keep the file compiling by also leaving the legacy `_styles.scss` `@include` intact (the rules are already gone from `_styles.scss` so the legacy include emits less now).

- [ ] **Step 4: Build & verify.**

```bash
cd src/frontend-libraries
npm run build:octo-ui
npm run build:demo-app
```

Expected: succeed.

- [ ] **Step 5: Diff against baseline.**

```bash
cd C:/dev/meshmakers/octo-frontend-libraries
diff -r baseline-css/ src/frontend-libraries/dist/demo-app/browser/ | wc -l
```

Expected: **non-zero diff** — these rules no longer emit anywhere because the host-overrides mixin isn't wired yet. The diff should consist entirely of the removed Process Designer rules. **Do not be alarmed.** Phase 4 re-wires them via the new `host-overrides()` mixin and the demo-app picks them up again.

- [ ] **Step 6: Commit.**

```bash
git add -A src/frontend-libraries/projects/meshmakers/octo-ui/src/
git commit -m "refactor(octo-ui): carve Process Designer LCARS overrides into host-overrides/"
```

### Task 3.3: Carve out Process Widget host-override → `host-overrides/_process-widget.scss`

**Files:**
- Create: `<octo-ui>/lib/lcars-theme/host-overrides/_process-widget.scss`
- Modify: `<octo-ui>/lib/lcars-theme/_styles.scss` (remove ~30 lines from section "Process Widget (MeshBoard) - LCARS overrides" — original lines 1540–1570)
- Modify: `<octo-ui>/lib/lcars-theme/_index.scss` (add `@use` only)

- [ ] **Step 1: Create the partial.**

Cut the section between `// Process Widget (MeshBoard) - LCARS overrides` and the next section comment `// Global`. Wrap:

```scss
// ============================================================================
// HOST OVERRIDE — Process Widget (MeshBoard) LCARS theming
// ============================================================================

@mixin process-widget {
  // (original lines 1540–1570, indentation stripped)
}
```

- [ ] **Step 2: Wire into the aggregator.**

Add `@use "host-overrides/process-widget" as host-process-widget;` to `lcars-theme/_index.scss`.

- [ ] **Step 3: Build & diff.**

Same as Task 3.2: build succeeds, diff continues to grow (expected).

- [ ] **Step 4: Commit.**

```bash
git commit -am "refactor(octo-ui): carve Process Widget LCARS override into host-overrides/"
```

### Task 3.4: Carve out LCARS primitives — Global / panels / asymmetric panel → `primitives/_panel.scss`

**Files:**
- Create: `<octo-ui>/lib/lcars-theme/primitives/_panel.scss`
- Modify: `_styles.scss` (remove section "Global" + "LCARS panels" + "asymmetric panel" — original lines 1572–1640)
- Modify: `_index.scss` (`@use` + `@include` inside `styles()` mixin, in source order)

- [ ] **Step 1: Create the folder.**

```bash
mkdir src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/primitives
```

- [ ] **Step 2: Create the partial.**

Cut original lines 1572–1640 (sections "Global", "LCARS panels", "LCARS-style header bar" up to but **not** including "asymmetric panel" — actually, including "asymmetric panel" too, ending at line 1640 right before the "Kendo overrides" section). Wrap in `@mixin panel { ... }`:

```scss
// ============================================================================
// LCARS PRIMITIVES — Panels & global layout
// LCARS-original UI patterns (.lcars-panel, .lcars-panel-asymmetric, etc.)
// ============================================================================

@mixin panel {
  // (original lines 1572–1640, indentation stripped)
}
```

Note: lines 1614–1640 ("LCARS-style header bar" + "asymmetric panel") will be split into their own partials in Tasks 3.5 / 3.6 if needed, but for this task all three section blocks (Global, LCARS panels, header bar, asymmetric panel) go into `_panel.scss` together — they're a coherent group of LCARS-original primitives.

- [ ] **Step 3: Wire into the aggregator.**

Add `@use "primitives/panel" as primitives-panel;` and `@include primitives-panel.panel;` inside `@mixin styles`, **after** the dockview include and **before** `legacy-styles.styles`.

- [ ] **Step 4: Build, diff, commit.**

Same procedure. Diff vs baseline should remain at the size produced by Task 3.2/3.3 (host-overrides removed) and not grow further — the panel rules are still being emitted, just from a different file.

```bash
git commit -am "refactor(octo-ui): carve LCARS panel primitives into primitives/_panel.scss"
```

### Tasks 3.5 through 3.27: Carve remaining sections

Each task follows the same pattern: create partial, cut from `_styles.scss`, wire into `_index.scss`, build, diff, commit. The partials, original line ranges, and section markers below are the carve plan. Each task gets its own commit.

| # | Partial path | Original line range | Section marker(s) in `_styles.scss` |
|---|---|---|---|
| 3.5 | `kendo/_appbar.scss` | 1642–1655 | "Kendo overrides" / "AppBar" |
| 3.6 | `kendo/_button.scss` (incl. fold of `_lcars-button.scss` + `_lcars-flat-btn.scss`) | 1657–1911 | "Buttons - LCARS style" through "General flat buttons" |
| 3.7 | `kendo/_grid.scss` | 1913–1958 | "Grid - LCARS style" |
| 3.8 | `kendo/_treeview.scss` | 1960–1978 | "TreeView - LCARS style" |
| 3.9 | `kendo/_input.scss` (incl. fold of `_lcars-input.scss`) | 1980–2032 | "Input fields", "Form fields", "Standalone labels", "Checkbox labels" |
| 3.10 | `kendo/_dialog.scss` (part 1) | 2034–2067 | "Kendo dialog - scrolling fix" |
| 3.11 | `forms/_config-dialog.scss` | 2069–2244 | "Config dialog form fields", "Widget Config Dialogs" |
| 3.12 | `kendo/_input-buttons.scss` | 2246–2271 | "Input buttons (DatePicker calendar, NumericTextBox spinners, etc.)" |
| 3.13 | `kendo/_dropdown.scss` | 2273–2298 | "Dropdown/Popup - LCARS style" |
| 3.14 | `kendo/_dialog.scss` (part 2; append) | 2300–2362 | "Dialog - LCARS style" |
| 3.15 | `kendo/_window.scss` | 2364–2415 | "Window action buttons", "Widget config dialog buttons", "Dialog Danger variant" |
| 3.16 | `kendo/_drawer.scss` | 2418–2575 | **"Drawer - LCARS style"** (the focus of this whole effort) |
| 3.17 | `kendo/_tabs.scss` | 2577–2601 | "Tabs - LCARS style" |
| 3.18 | `kendo/_card.scss` | 2603–2616 | "Cards - LCARS style" |
| 3.19 | `kendo/_tooltip.scss` | 2618–2626 | "Tooltip - LCARS style" |
| 3.20 | `kendo/_progress.scss` | 2628–2638 | "Progress indicators - LCARS style" |
| 3.21 | `kendo/_chip.scss` | 2640–2653 | "Chip/Badge - LCARS style" |
| 3.22 | `primitives/_utilities.scss` | 2655–2780 | "LCARS utilities" through "Pulse animation" (includes glow/text/bg/borders/decorative/scan-line/pulse) |
| 3.23 | `primitives/_layout.scss` | 2782–2855 | "Layout" + form container override |
| 3.24 | `kendo/_scrollbars.scss` | 2857–2883 | "Scrollbars" + "Firefox scrollbar" |
| 3.25 | `chrome/_login-popup.scss` | 2885–2992 | "Login popup" + "Style the popup container itself" + "Login popup content" |
| 3.26 | `kendo/_context-menu.scss` | 2994–3124 | "Context menu" + "Context menu popup wrapper" + "Animation container for context menu" |
| 3.27 | `kendo/_listview.scss` | 3126–3174 | "List view" + "Command cell" + "List view toolbar styling" + "Kendo grid toolbar" |
| 3.28 | `kendo/_toolbar.scss` | 3176–3208 | "Page toolbar styling" |
| 3.29 | `primitives/_page-layout.scss` | 3210–3501 | "LCARS Page Layout Pattern" + "Content Panel" + "LCARS Footer" + "Responsive LCARS Page Layout" |
| 3.30 | `forms/_base-form.scss` | 3503–3566 | "mm-base-form" |
| 3.31 | `host-overrides/_markdown-widget.scss` | 3568–3605 | "Markdown Widget & Config Dialog - LCARS theme via CSS variable overrides" |
| 3.32 | `host-overrides/_meshboard.scss` | 3607–3737 + 3843–end (skipping TileLayout) | "MeshBoard view" + "MeshBoard Toolbar" + "MeshBoard Empty State" + "Widget Error State" + "MeshBoard widgets" + "KPI Widget" + remaining MeshBoard widget styles |
| 3.33 | `kendo/_tilelayout.scss` | 3739–3842 | "Kendo TileLayout - LCARS style" + the two `// HACK:` zoom workaround blocks (drag offset and popup positioning) |

**For each carve task above (3.5 through 3.33):**

- [ ] **Step 1: Locate the section in `_styles.scss` by its section comment.** The line numbers shift as carving proceeds; use grep:

  ```bash
  grep -n "Section comment text" src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/_styles.scss
  ```

- [ ] **Step 2: Create the new partial file.** Wrap content in `@mixin <name> { ... }` where `<name>` is derived from the file basename (e.g., `_drawer.scss` → `@mixin drawer`).

- [ ] **Step 3: Cut the section out of `_styles.scss` and paste into the new partial. Strip the leading 2 spaces of indentation from each cut line.**

- [ ] **Step 4: Wire into `lcars-theme/_index.scss`:**
  - For partials in `kendo/`, `primitives/`, `thirdparty/`, `chrome/`, `forms/`: add `@use` and `@include` (inside `@mixin styles`, in source order to match the original file).
  - For partials in `host-overrides/`: add `@use` only — these are wired via the host-overrides mixin in Phase 4.

- [ ] **Step 5: Build, diff, commit.**

  ```bash
  cd src/frontend-libraries
  npm run build:octo-ui
  npm run build:demo-app
  cd C:/dev/meshmakers/octo-frontend-libraries
  diff -r baseline-css/ src/frontend-libraries/dist/demo-app/browser/ | wc -l
  ```

  For non-host-override carves: diff size should remain stable (the host-overrides removed in 3.2/3.3/3.31/3.32 are the only diff). For host-override carves: diff grows by the carved size.

  ```bash
  git commit -am "refactor(octo-ui): carve <section> into <partial path>"
  ```

### Task 3.34: Verify `_styles.scss` is empty and delete it

**Files:**
- Delete: `<octo-ui>/lib/lcars-theme/_styles.scss`
- Modify: `<octo-ui>/lib/lcars-theme/_index.scss` (remove the `@use "styles"` and the `@include legacy-styles.styles;`)

- [ ] **Step 1: Confirm `_styles.scss` contains only the empty `@mixin styles { }` wrapper.**

```bash
cat src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/_styles.scss
```

Expected: a `@mixin styles {` line, possibly some comments, and a closing `}`. **No remaining rules.** If rules remain, they belong to a section that was missed by the carve plan above — investigate, find the section, add a carve task for it, redo, and only then delete.

- [ ] **Step 2: Delete `_styles.scss`.**

```bash
git rm src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/_styles.scss
```

- [ ] **Step 3: Update `_index.scss`.**

Remove the `@use "styles" as legacy-styles;` and the `@include legacy-styles.styles;` line. The `@mixin styles { ... }` should now contain only the carved-partial includes (in source order).

- [ ] **Step 4: Build & diff.**

```bash
cd src/frontend-libraries
npm run build:octo-ui
npm run build:demo-app
cd C:/dev/meshmakers/octo-frontend-libraries
diff -r baseline-css/ src/frontend-libraries/dist/demo-app/browser/ | head -20
```

Expected: diff is **only** the host-overrides rules that have not been re-wired yet. No other deltas. If anything else differs, the carve order or wiring is wrong — investigate before continuing.

- [ ] **Step 5: Commit.**

```bash
git commit -am "refactor(octo-ui): delete empty _styles.scss; lcars-theme is fully decomposed"
```

---

## Phase 4 — Wire `host-overrides()` as a separate mixin

The four host-override partials (`process-designer`, `process-widget`, `markdown-widget`, `meshboard`) exist in `lcars-theme/host-overrides/` but aren't wired anywhere. Phase 4 wires them via a new public mixin `octo.host-overrides()`.

### Task 4.1: Create `host-overrides/_index.scss`

**Files:**
- Create: `<octo-ui>/lib/lcars-theme/host-overrides/_index.scss`

- [ ] **Step 1: Create the file.**

```scss
// ============================================================================
// LCARS Theme — Host-overrides aggregator
//
// LCARS-specific overrides for library components that ship neutral by
// default. Hosts (e.g., Refinery Studio) opt in via:
//   @use "@meshmakers/octo-ui/styles" as octo;
//   @include octo.host-overrides();
//
// Library components themselves remain theme-neutral.
// ============================================================================

@use "process-designer" as process-designer;
@use "process-widget" as process-widget;
@use "markdown-widget" as markdown-widget;
@use "meshboard" as meshboard;

@mixin host-overrides {
  @include process-designer.process-designer;
  @include process-widget.process-widget;
  @include markdown-widget.markdown-widget;
  @include meshboard.meshboard;
}
```

### Task 4.2: Create the public `host-overrides` entry

**Files:**
- Create: `<octo-ui>/styles/_host-overrides.scss`

- [ ] **Step 1: Create the public entry file.**

```scss
// Public entry — forwarded host-overrides() mixin.
// Consumers: @use "@meshmakers/octo-ui/styles/host-overrides" as octo;
// Or, more commonly, host-overrides is forwarded from the main styles entry
// so that @use "@meshmakers/octo-ui/styles" as octo; @include octo.host-overrides();
// works directly.

@forward "../lib/lcars-theme/host-overrides/index" show host-overrides;
```

### Task 4.3: Forward `host-overrides` from the main public entry

**Files:**
- Modify: `<octo-ui>/styles/_index.scss`

- [ ] **Step 1: Update `_index.scss` to forward `host-overrides`.**

```scss
// Global Octo UI styles entrypoint.
// Forwards LCARS theme variables(), styles(), and host-overrides() mixins.

@forward "../lib/lcars-theme/index" show variables, styles;
@forward "../lib/lcars-theme/host-overrides/index" show host-overrides;
```

### Task 4.4: Update demo-app to include host-overrides (for verification)

**Files:**
- Modify: `src/frontend-libraries/projects/demo-app/src/app/tenants/demos/runtime-browser/runtime-browser-demo.component.scss`

- [ ] **Step 1: Confirm current state of the file.**

```bash
cat src/frontend-libraries/projects/demo-app/src/app/tenants/demos/runtime-browser/runtime-browser-demo.component.scss
```

Expected: includes `@include octo.variables();` and `@include octo.styles();`.

- [ ] **Step 2: Add the host-overrides include after the existing styles include.**

Edit the file to add `@include octo.host-overrides();` immediately after `@include octo.styles();` inside the same scope.

- [ ] **Step 3: Build & diff.**

```bash
cd src/frontend-libraries
npm run build:octo-ui
npm run build:demo-app
cd C:/dev/meshmakers/octo-frontend-libraries
diff -r baseline-css/ src/frontend-libraries/dist/demo-app/browser/ | wc -l
```

Expected: diff is now **empty or whitespace-only** — the host-override rules removed in Phase 3.2/3.3/3.31/3.32 are now re-emitted via `octo.host-overrides()`. Phase 4 is verified when the diff returns to zero.

If the diff is still non-empty after this step: the diff lines reveal which host-override rules are missing. Fix the carved partial to include them, then re-verify.

### Task 4.5: Commit Phase 4

- [ ] **Step 1: Stage and commit.**

```bash
cd C:/dev/meshmakers/octo-frontend-libraries
git add -A src/frontend-libraries/
git commit -m "$(cat <<'EOF'
refactor(octo-ui): wire host-overrides() as a separate opt-in mixin

The four host-override partials (process-designer, process-widget,
markdown-widget, meshboard) are no longer pulled in by octo.styles().
LCARS hosts opt in via @include octo.host-overrides();

Demo-app's runtime-browser-demo.component.scss is updated to include
host-overrides so its compiled CSS matches the pre-refactor baseline.

Refs spec: docs/superpowers/specs/2026-04-26-octo-ui-lcars-theme-split-design.md §5
EOF
)"
```

### Task 4.6: Verify the host-overrides on/off behavior

**Files:**
- No file changes (manual verification only).

- [ ] **Step 1: Temporarily comment out `@include octo.host-overrides();` in the demo-app component.**

- [ ] **Step 2: Rebuild and run the demo-app.**

```bash
npm run build:demo-app
npm start
```

- [ ] **Step 3: Visually confirm Process Designer / MeshBoard panels render in their neutral library defaults (off-LCARS look).**

This proves the library is genuinely theme-neutral now — the rule the library's own CLAUDE.md states is now structurally enforced.

- [ ] **Step 4: Restore the `@include octo.host-overrides();` line.**

- [ ] **Step 5: Rebuild and confirm LCARS look returns.**

```bash
npm run build:demo-app
```

- [ ] **Step 6: No commit needed — this was a sanity check.**

---

## Phase 5 — Aggressive Hack Removal Sweep

Spec §6. **CSS output will diverge from baseline by design**. Per-partial review and visual walk-through replaces the diff-equivalence check from earlier phases.

### Task 5.1: Drop the inline-style sniff for mini drawer

**Files:**
- Modify: `<octo-ui>/lib/lcars-theme/kendo/_drawer.scss`

- [ ] **Step 1: Locate the offending selector.**

```bash
grep -n 'style\*=' src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/kendo/_drawer.scss
```

Expected: two matches, both for `[style*="flex-basis: 50px"]` and `[style*="flex-basis:50px"]`.

- [ ] **Step 2: Edit the file.**

Find the block:

```scss
&[style*="flex-basis: 50px"],
&[style*="flex-basis:50px"],
&.k-drawer-mini {
```

Replace with:

```scss
&.k-drawer-mini {
```

- [ ] **Step 3: Build & spot-check the drawer in the demo-app.**

```bash
cd src/frontend-libraries
npm run build:octo-ui
npm run build:demo-app
npm start
```

Walk to a screen with the drawer; toggle mini mode; confirm:
- Expanded mode: drawer items show full label, hierarchy levels (0/1/2) intact.
- Mini mode: drawer items show icons only, hierarchy still works (mm-drawer-level-N classes still present in mini mode).

- [ ] **Step 4: Commit.**

```bash
git commit -am "refactor(octo-ui): drop inline-style sniff for drawer mini mode

The two [style*=\"flex-basis: 50px\"] selectors were dead weight; the
sibling .k-drawer-mini selector already matches Kendo's mini state.
Spec §6.1."
```

### Task 5.2: Sweep gratuitous `!important` per partial

**Files:**
- Modify: every partial under `<octo-ui>/lib/lcars-theme/primitives/`, `<octo-ui>/lib/lcars-theme/chrome/`, `<octo-ui>/lib/lcars-theme/host-overrides/`, plus utilities in `kendo/` that are not targeting third-party DOM.
- Per spec §6.2 keep/drop matrix:
  - **Keep `!important`** in: `kendo/_drawer.scss`, `kendo/_dialog.scss`, `kendo/_grid.scss`, `kendo/_dropdown.scss`, `kendo/_window.scss`, `kendo/_listview.scss`, `thirdparty/_dockview.scss`, plus any rule whose selector targets Kendo internals (e.g., `.k-…`) or Dockview internals (`.dv-…`).
  - **Drop `!important`** elsewhere.

The partials below are the candidates. For each, apply the rule: if the selector starts with `.k-` or `.dv-` or `kendo-…`, keep `!important`; else drop it.

- [ ] **Step 1: Sweep `primitives/_panel.scss`.**

  ```bash
  grep -c '!important' src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/primitives/_panel.scss
  ```

  Open the file and remove `!important` from declarations whose containing selector does not start with `.k-`, `.dv-`, or `kendo-`. Keep them on `.k-…` selectors if any exist.

- [ ] **Step 2: Sweep `primitives/_utilities.scss`** — same procedure.

- [ ] **Step 3: Sweep `primitives/_layout.scss`** — same procedure.

- [ ] **Step 4: Sweep `primitives/_page-layout.scss`** — same procedure.

- [ ] **Step 5: Sweep `chrome/_login-popup.scss`** — same procedure.

- [ ] **Step 6: Sweep `forms/_base-form.scss`** — same procedure.

- [ ] **Step 7: Sweep `forms/_config-dialog.scss`** — same procedure.

- [ ] **Step 8: Sweep `host-overrides/_process-designer.scss`** — same procedure. This is the largest file; expect many drops.

- [ ] **Step 9: Sweep `host-overrides/_process-widget.scss`** — same procedure.

- [ ] **Step 10: Sweep `host-overrides/_markdown-widget.scss`** — same procedure.

- [ ] **Step 11: Sweep `host-overrides/_meshboard.scss`** — same procedure.

- [ ] **Step 12: Sweep `kendo/` partials selectively.** For partials in `kendo/`, keep `!important` on any rule with a `.k-…` selector, drop it on any rule whose selector is purely an LCARS-original class (e.g., `.lcars-…`) or an `mm-…` element wrapper. Manual review per file.

- [ ] **Step 13: Build & demo-app walk-through.**

  ```bash
  npm run build:octo-ui
  npm run build:demo-app
  npm start
  ```

  Visually walk all 21 screens in spec §8. Particularly: hover/focus/selected states, where `!important` was most heavily applied. Note any visual regressions — they indicate `!important` was load-bearing on a rule that should keep it.

- [ ] **Step 14: Reconcile any regression.** For any rule that broke, restore `!important` (and add a one-line comment explaining what depends on it).

- [ ] **Step 15: Confirm `!important` count is materially reduced.**

  ```bash
  grep -rc '!important' src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/ | sort
  ```

  Expected target: total ~250–350 (down from ~800).

- [ ] **Step 16: Commit.**

```bash
git commit -am "refactor(octo-ui): sweep gratuitous !important from LCARS partials

Apply the keep/drop matrix from spec §6.2: keep !important only on rules
targeting Kendo (.k-*) or Dockview (.dv-*) internals; drop everywhere
else. Total reduced from ~800 to ~<count>."
```

### Task 5.3: Clean up redundant `::ng-deep`

**Files:**
- Modify: any partial containing `::ng-deep`. Most are in `kendo/`, `host-overrides/`, and `chrome/`.

- [ ] **Step 1: Locate `::ng-deep` chains.**

```bash
grep -rn '::ng-deep' src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/ | head -40
```

- [ ] **Step 2: For each occurrence, evaluate:**
  - **Keep** if the rule must penetrate an Angular component's emulated encapsulation (e.g., `mm-styles-panel` subselectors).
  - **Drop the outer `::ng-deep`** if the surrounding mixin is already consumed at `:root` / global scope — the inner selector is global anyway. Example: `::ng-deep .k-drawer { ... }` inside the global `styles()` mixin can become `.k-drawer { ... }`.

- [ ] **Step 3: Apply the cleanup.** Edit each file as identified.

- [ ] **Step 4: Build & demo-app walk-through.**

```bash
npm run build:octo-ui && npm run build:demo-app && npm start
```

Walk the 21-screen list. Where `::ng-deep` was removed, the rule must still apply. If a rule no longer applies (visible regression), restore the `::ng-deep`.

- [ ] **Step 5: Commit.**

```bash
git commit -am "refactor(octo-ui): drop redundant ::ng-deep wrappers in global theme mixin"
```

### Task 5.4: Promote per-widget tokens to `tokens/_components.scss`

**Files:**
- Create: `<octo-ui>/lib/lcars-theme/tokens/_components.scss`
- Modify: `<octo-ui>/lib/lcars-theme/tokens/_index.scss` (forward the new file)
- Modify: `<octo-ui>/lib/lcars-theme/_variables.scss` (include the new mixin)
- Modify: per-widget partials in `kendo/` to consume the new variables

- [ ] **Step 1: Create `_components.scss` with the initial token set from spec §6.4.**

```scss
// ============================================================================
// LCARS DESIGN TOKENS - Component-level appearance tokens
// Promoted from inline values in kendo/* partials so single-component
// customization is one-variable, not a fork.
// ============================================================================

@mixin components {
  // Drawer
  --lcars-drawer-bg: linear-gradient(180deg, var(--iron-navy), var(--deep-sea));
  --lcars-drawer-border: 1px solid var(--octo-mint-20);

  // Dialog
  --lcars-dialog-bg: var(--surface-elevated);
  --lcars-dialog-border: var(--lcars-panel-border);

  // Tabs
  --lcars-tabs-border: 2px solid var(--ash-blue-20);
  --lcars-tabs-active-bg: var(--iron-navy);
  --lcars-tabs-active-border: 3px solid var(--octo-mint);

  // Cards
  --lcars-card-bg: var(--lcars-panel-bg);
  --lcars-card-border: var(--lcars-panel-border);
}
```

- [ ] **Step 2: Forward the new partial in `tokens/_index.scss`.**

Add `@forward "components";` at the end.

- [ ] **Step 3: Include the new mixin in `_variables.scss`.**

Add `@use "tokens/components" as components;` and `@include components.components;` inside `@mixin variables`.

- [ ] **Step 4: Replace inline values in `kendo/_drawer.scss`.**

Find the rule:

```scss
.k-drawer {
  background: linear-gradient(180deg, var(--iron-navy), var(--deep-sea));
  border-right: 1px solid var(--octo-mint-20);
  ...
}
```

Replace the `background:` and `border-right:` declarations with:

```scss
  background: var(--lcars-drawer-bg);
  border-right: var(--lcars-drawer-border);
```

(Note: `border-right: <token>` works because `--lcars-drawer-border` holds the full `1px solid var(--octo-mint-20)` value.)

- [ ] **Step 5: Replace inline values in `kendo/_dialog.scss`.** Apply the same pattern using `--lcars-dialog-bg` / `--lcars-dialog-border`.

- [ ] **Step 6: Replace inline values in `kendo/_tabs.scss`.** Use `--lcars-tabs-border` for the items border-bottom; `--lcars-tabs-active-bg` and `--lcars-tabs-active-border` for the active item.

- [ ] **Step 7: Replace inline values in `kendo/_card.scss`.** Use `--lcars-card-bg` and `--lcars-card-border`.

- [ ] **Step 8: Build & verify CSS-equivalence.**

The compiled CSS for the demo-app should match the post-Phase-4 baseline (after the host-overrides re-wiring), modulo the indirection through the new variables. Browsers resolve the variables identically — visual rendering should be unchanged.

```bash
npm run build:octo-ui && npm run build:demo-app
```

Run the demo-app and spot-check drawer, dialogs, tabs, cards.

- [ ] **Step 9: Commit.**

```bash
git commit -am "refactor(octo-ui): promote per-widget tokens to tokens/_components.scss

Drawer, Dialog, Tabs, Card now read --lcars-*-bg / --lcars-*-border
CSS variables. Default values match the previous inline literals so
the LCARS host's compiled CSS is unchanged.

Spec §6.4."
```

### Task 5.5: Move zoom hacks into the right partials with `// HACK:` comments

The two `zoom`-workaround blocks at original lines 3819–~3842 (TileLayout drag offset) and ~3828–end-of-section (popup positioning) currently live in whatever partial they ended up in via the carve plan (Task 3.33 placed both in `kendo/_tilelayout.scss`). Re-locate the popup hack to `kendo/_popup.scss` (or fold into `kendo/_dropdown.scss` if popup-positioning rules already live there) and add `// HACK:` headers.

**Files:**
- Modify: `<octo-ui>/lib/lcars-theme/kendo/_tilelayout.scss`
- Modify (or create): `<octo-ui>/lib/lcars-theme/kendo/_popup.scss`

- [ ] **Step 1: In `kendo/_tilelayout.scss`, identify the drag-offset hack block.**

It's the section at the bottom of the partial that handles `position: fixed` adjustments under CSS `zoom`. Add this comment immediately above the first selector in the block:

```scss
// HACK: workaround for DensityService applying CSS zoom on kendo-drawer-content.
//       CSS zoom breaks position:fixed children, which makes Kendo TileLayout
//       drag coordinates miscalculate. Counter-zooming the dragged item
//       restores correct mapping.
//       Remove if DensityService switches to transform: scale().
```

- [ ] **Step 2: Decide where the popup-positioning hack lives.**

Look in `kendo/_tilelayout.scss` for a block describing popup positioning under CSS zoom (the spec calls it out at original line 3828). If the block exists in `_tilelayout.scss`, **cut** it.

- [ ] **Step 3: Create or modify `kendo/_popup.scss` to host the popup hack.**

If `kendo/_popup.scss` does not exist (the carve plan didn't allocate one separately), create it now:

```scss
// ============================================================================
// Kendo Popup — LCARS overrides + density-zoom workaround
// ============================================================================

@mixin popup {
  // HACK: workaround for DensityService applying CSS zoom on kendo-drawer-content.
  //       Popups with appendTo:'root' are direct children of <app-root>, outside
  //       the zoomed container. Position is calculated against the unscaled
  //       coordinate space, which mismatches the zoomed children. Using
  //       transform:scale() instead of CSS zoom would fix this — until then,
  //       this block compensates.
  //       Remove if DensityService switches to transform: scale().

  // (paste the popup-positioning rules here)
}
```

- [ ] **Step 4: Wire `kendo/_popup.scss` into `lcars-theme/_index.scss`** if newly created.

- [ ] **Step 5: Build & verify.**

```bash
npm run build:octo-ui && npm run build:demo-app
```

Run the demo-app and spot-check:
- TileLayout drag (a MeshBoard widget) — drag offset feels correct.
- Kendo popup positioning under density-zoom — open a DropDownList, ContextMenu, etc. and check positioning matches before.

- [ ] **Step 6: Commit.**

```bash
git commit -am "refactor(octo-ui): isolate zoom hacks in tilelayout/popup with HACK: comments

Both blocks are workarounds for DensityService applying CSS zoom on
kendo-drawer-content. They stay until DensityService switches to
transform: scale(). Spec §6.5."
```

---

## Phase 6 — `ng-package.json` + Cleanup + Docs

### Task 6.1: Update `ng-package.json` asset paths

**Files:**
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/ng-package.json`

- [ ] **Step 1: Open the file.**

```bash
cat src/frontend-libraries/projects/meshmakers/octo-ui/ng-package.json
```

- [ ] **Step 2: Replace the `assets` array.**

The current `assets` includes `src/lib/runtime-browser/styles`. Replace it. The new `assets` block should be:

```json
"assets": [
  {
    "input": "src/styles",
    "glob": "**/*.scss",
    "output": "styles"
  },
  {
    "input": "src/lib/lcars-theme",
    "glob": "**/*.scss",
    "output": "lib/lcars-theme"
  }
]
```

Save the file.

- [ ] **Step 3: Build the library and confirm `dist/` layout.**

```bash
cd src/frontend-libraries
npm run build:octo-ui
ls dist/meshmakers/octo-ui/lib/
ls dist/meshmakers/octo-ui/lib/lcars-theme/
```

Expected:
- `dist/meshmakers/octo-ui/lib/lcars-theme/` exists and contains the partials and folders (`tokens/`, `kendo/`, `primitives/`, `thirdparty/`, `chrome/`, `forms/`, `host-overrides/`).
- No `dist/meshmakers/octo-ui/lib/runtime-browser/styles/` folder.
- `dist/meshmakers/octo-ui/styles/` still contains `_index.scss`, `_with-kendo.scss`, `_host-overrides.scss`.

- [ ] **Step 4: Build the demo-app to confirm consumer path resolves.**

```bash
npm run build:demo-app
```

### Task 6.2: Remove the empty `runtime-browser/styles/` folder if it still exists

**Files:**
- Delete: `<octo-ui>/lib/runtime-browser/styles/` (folder, if not already gone after Task 1.1)

- [ ] **Step 1: Check if folder exists.**

```bash
ls src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/runtime-browser/styles/ 2>&1
```

- [ ] **Step 2: If it exists and is empty, remove it.**

```bash
rmdir src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/runtime-browser/styles
```

If git still tracks something there, `git rm -r` it.

### Task 6.3: Update CLAUDE.md docs

**Files:**
- Modify: `src/frontend-libraries/projects/meshmakers/octo-ui/CLAUDE.md`
- Modify: `src/frontend-libraries/CLAUDE.md` (if it references the old path)

- [ ] **Step 1: Update the "Drawer Hierarchy" section in `octo-ui/CLAUDE.md`.**

Find the section starting with "## Drawer Hierarchy" (around line 36 of the file). Update the path reference from `octo.styles()` location to point to `lcars-theme/kendo/_drawer.scss`. Keep the content; just update the file location reference.

- [ ] **Step 2: Add a new section to `octo-ui/CLAUDE.md` about `host-overrides()`.**

After the "Drawer Hierarchy" section, add:

```markdown
## LCARS Theme Mixins

The LCARS theme is exposed as three SCSS mixins in `<octo-ui>/styles/_index.scss`:

- `octo.variables()` — emits CSS custom properties (`--octo-*`, `--lcars-*`, `--designer-*`, `--mm-cron-*`, `--kendo-color-*`).
- `octo.styles()` — global LCARS theme rules (Dockview, Kendo widgets, LCARS primitives, login popup, context menu, scrollbars). Theme-neutral library components inherit their look from CSS variables only.
- `octo.host-overrides()` — **opt-in** LCARS-specific overrides for library components (Process Designer / Symbol Editor, Process Widget, Markdown Widget, MeshBoard view/widgets). Hosts that want the LCARS look on these components include this mixin alongside `styles()`.

The library itself stays theme-neutral: `octo.styles()` does **not** include the host-overrides. A non-LCARS host that wants its own theme on these components can omit `host-overrides()` and supply its own.

The theme partials live under `<octo-ui>/lib/lcars-theme/`:

- `tokens/` — CSS-variable-emitting partials (palette, typography, alpha-scales, radius, motion, designer, components).
- `kendo/` — one partial per Kendo widget.
- `primitives/` — LCARS-original UI patterns (panel, page-layout, footer, utilities, layout).
- `thirdparty/` — third-party library overrides (currently just Dockview).
- `chrome/` — app-shell pieces (login popup).
- `forms/` — form composites (mm-base-form, widget config dialog).
- `host-overrides/` — opt-in host-overrides (process-designer, process-widget, markdown-widget, meshboard).
```

- [ ] **Step 3: Check `frontend-libraries/CLAUDE.md` for any reference to the old path.**

```bash
grep -n "runtime-browser/styles" src/frontend-libraries/CLAUDE.md
```

If matches found, update each to `lib/lcars-theme/...`.

- [ ] **Step 4: Commit Phase 6.**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(octo-ui): update ng-package + CLAUDE docs after lcars-theme split

ng-package.json now ships dist/.../lib/lcars-theme/ and no longer ships
the deprecated dist/.../lib/runtime-browser/styles/ asset bundle.
CLAUDE.md documents the new mixin API and folder layout.

Refs spec: docs/superpowers/specs/2026-04-26-octo-ui-lcars-theme-split-design.md
EOF
)"
```

---

## Phase 7 — Refinery Studio (cross-repo, conditional)

This phase only applies if Refinery Studio is locally available. **Do not push.** Show the diff to the user and wait for explicit approval before committing in the Refinery Studio repo.

### Task 7.1: Locate Refinery Studio checkout

- [ ] **Step 1: Ask the user where the Refinery Studio repo lives, or check common locations.**

```bash
ls C:/dev/meshmakers/ 2>&1 | grep -i refinery
ls C:/dev/ 2>&1 | grep -i refinery
```

If a folder is found, note its path. If not, ask the user. If the user says Refinery Studio is not locally available, **skip this entire phase** — record this in the user-facing summary so the user knows to apply the patch manually later.

### Task 7.2: Identify the consumer call sites

- [ ] **Step 1: Search for `octo.styles()` and `octo.variables()` includes in Refinery Studio.**

```bash
grep -rn 'octo\.\(styles\|variables\)' <refinery-studio-path>/ --include="*.scss" 2>/dev/null
```

- [ ] **Step 2: Search for any deep imports of `runtime-browser/styles`.**

```bash
grep -rn 'runtime-browser/styles' <refinery-studio-path>/ --include="*.scss" 2>/dev/null
```

If matches: each must be replaced with the public path `<...>/octo-ui/styles`.

### Task 7.3: Apply the one-line patch to Refinery Studio

- [ ] **Step 1: At every call site that uses `@include octo.styles();`, add `@include octo.host-overrides();` immediately after.**

- [ ] **Step 2: Replace any deep imports** (from Step 7.2 Step 2) with the public path.

- [ ] **Step 3: Build Refinery Studio locally.**

```bash
cd <refinery-studio-path>
# (Run whatever the build command is for that repo — likely npm/yarn build or Angular CLI build.)
```

If Refinery Studio still depends on the npm package `@meshmakers/octo-ui` from a registry rather than a local link, the local link via `npm link` (or `npm install <path-to-dist>`) is required first. Coordinate with the user — this might be out of scope for "one big bang" if the cross-repo plumbing is non-trivial.

- [ ] **Step 4: Show the diff to the user.**

```bash
cd <refinery-studio-path>
git diff
git status
```

**Wait for explicit user approval before committing.** Do not commit silently.

- [ ] **Step 5: After user approval, commit in Refinery Studio.**

```bash
git add -A
git commit -m "Adopt octo-ui host-overrides() opt-in mixin

octo-ui's runtime-browser/styles deep import path was removed; switch to
the public <...>/octo-ui/styles entry. Add @include octo.host-overrides()
to keep LCARS look on Process Designer / MeshBoard / Markdown widget."
```

**Do NOT `git push`** — local commit only.

---

## Phase 8 — Final Verification

### Task 8.1: Final lint, test, build

- [ ] **Step 1: Lint.**

```bash
cd src/frontend-libraries
npm run lint:octo-ui
```

Expected: pass.

- [ ] **Step 2: Tests.**

```bash
npm test -- --project=@meshmakers/octo-ui --watch=false --browsers=ChromeHeadless
```

Expected: pass.

- [ ] **Step 3: Production build.**

```bash
npm run build:prod
```

Expected: pass.

If any of the above fails, **stop** and reconcile before declaring the refactor complete.

### Task 8.2: Final demo-app walk-through

**Files:**
- No file changes (manual verification).

- [ ] **Step 1: Start dev server.**

```bash
cd src/frontend-libraries
npm start
```

- [ ] **Step 2: Walk all 21 screens listed in spec §8.** Compare each to the baseline screenshots taken in Task 0.3. Note any visual regressions.

- [ ] **Step 3: For each regression, identify the partial and rule, restore the necessary `!important` / `::ng-deep` / inline value, rebuild, and re-walk that screen.**

- [ ] **Step 4: When the walk-through is clean, stop the dev server.**

### Task 8.3: Verify host-overrides on/off behavior one more time

- [ ] **Step 1: Comment out `@include octo.host-overrides();` in `runtime-browser-demo.component.scss`.**

- [ ] **Step 2: Rebuild and confirm Process Designer / MeshBoard / Markdown widget render in their neutral library defaults.**

- [ ] **Step 3: Restore the include and rebuild.**

- [ ] **Step 4: Confirm LCARS look returns.**

- [ ] **Step 5: No commit needed.**

### Task 8.4: Hand off to user — confirm and (optionally) push

- [ ] **Step 1: Show the user the full set of commits on the branch.**

```bash
cd C:/dev/meshmakers/octo-frontend-libraries
git log main..HEAD --oneline
```

- [ ] **Step 2: Report:**
  - Number of commits.
  - Lines of `_styles.scss` deleted (~4781).
  - Number of new partials created (~25–30).
  - Final `!important` count (`grep -rc '!important' .../lib/lcars-theme/ | sort`).
  - Whether Refinery Studio was patched in lockstep.
  - Any visual regressions found and reconciled.

- [ ] **Step 3: Ask the user whether to push the branch.**

> "Refactor complete on branch `feature/lcars-theme-split` (or whatever name you used). All commits are local. Do you want me to push the branch and open a pull request, or hold off?"

**Do not push or open a PR until the user explicitly says yes.**

---

## Self-Review (writing-plans)

Run before declaring this plan complete.

### Spec coverage check

| Spec section | Covered by task(s) |
|---|---|
| §4.1 A1 — Move LCARS theme out of runtime-browser/ | Phase 1 (Tasks 1.1–1.4) |
| §4.1 A2 — host-overrides() opt-in mixin | Phase 4 (Tasks 4.1–4.6) |
| §4.1 A3 — Fine-grained partials | Phase 3 (Tasks 3.0–3.34) |
| §4.1 A4 — Aggressive hack removal | Phase 5 (Tasks 5.1–5.5) |
| §4.1 A5 — Build + walk-through verification | Tasks 0.2, 0.3, 8.1, 8.2 |
| §4.2 file layout | Phase 2 (tokens), Phase 3 (other folders), Phase 6 (ng-package) |
| §5 Public API contract | Tasks 1.2, 4.2, 4.3 |
| §5.4 ng-package.json updates | Task 6.1 |
| §6.1 inline-style sniff drop | Task 5.1 |
| §6.2 !important sweep | Task 5.2 |
| §6.3 ::ng-deep cleanup | Task 5.3 |
| §6.4 token promotion | Task 5.4 |
| §6.5 zoom hacks flagged | Task 5.5 |
| §7.1 pre-flight | Tasks 0.1, 0.2, 0.3 |
| §7.2 move | Phase 1 |
| §7.3 decompose variables | Phase 2 |
| §7.4 decompose styles | Phase 3 |
| §7.5 wire host-overrides | Phase 4 |
| §7.6 hack sweep | Phase 5 |
| §7.7 ng-package + cleanup | Phase 6 |
| §7.8 Refinery Studio | Phase 7 |
| §7.9 final verification | Phase 8 |
| §7.10 commit policy | Per-task commits throughout; no `git push` without approval (Tasks 7.3 step 5, 8.4 step 3) |
| §8 demo-app walk-through (21 screens) | Tasks 0.3, 8.2, 5.2 step 13, 5.3 step 4 |
| §9 risks (visual regression, deep-import break, token drift, zoom hack relocation) | Per-task verification + Phase 8 |

All spec sections are covered.

### Placeholder scan

- No `TBD` / `TODO` markers in actionable steps. The branch name is `feature/lcars-theme-split` with an explicit hand-off to the user if a work-item number exists.
- Refinery Studio path is `<refinery-studio-path>` placeholder — explicit because the location is user-environment-dependent. Task 7.1 instructs how to resolve it (or skip).
- Build commands and exact paths included throughout.

### Type / signature consistency

- Every partial's mixin is named after the file basename (`_drawer.scss` → `@mixin drawer`) — consistent throughout.
- `@use` and `@forward` syntax used consistently.
- Public mixin names (`variables`, `styles`, `host-overrides`) match across the spec, the public entry files, and the consumer-facing demo-app.

Plan is internally consistent.
