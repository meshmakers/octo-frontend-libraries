# Semantic Token Theming — Design

**Date:** 2026-04-27
**Status:** Approved (pending implementation)
**Scope:** Coordinated change across `octo-frontend-libraries` and `octo-frontend-refinery-studio`. Lands as a single big-bang on the existing `feature/lcars-theme-split` branch (or a successor branch off it). No remote pushes without explicit permission.

## 1. Background

The just-landed LCARS theme split (`docs/superpowers/specs/2026-04-26-octo-ui-lcars-theme-split-design.md`) decomposed `octo-ui`'s 4,781-line `_styles.scss` monolith into ~30 partials under `lcars-theme/`, separated tokens from rules, and made `host-overrides()` an opt-in mixin. That refactor made the LCARS theme legible and created clean seams — but did not extract LCARS as a swappable thing. There is still exactly one `styles()` mixin emitting LCARS-specific rules.

This spec builds on those seams to deliver:

1. **A semantic theming surface** — apps and tenants override roles (`--theme-primary`), not implementation tokens (`--octo-mint`). Closes the leaky-abstraction tension where `--octo-mint` is surfaced but its name encodes a value identity, breaking once a tenant sets `--octo-mint: red`.
2. **Auto-derived interaction states** — hover/active/subtle/border/glow shades for each interactive role come from CSS `color-mix()`, not from Sass-time `k-generate-color-variations()`. Tenant palette swaps recolor hovers correctly, not just the base.
3. **A theme registry** — themes plug into the semantic surface as data (`themes/_lcars-dark.scss`, `themes/_lcars-light.scss`). The system has no opinion about LCARS being special; it's one of N possible palettes. Future white-label is "drop a partial into `themes/`."
4. **A working LCARS-light theme** — designed alongside dark, ships dark-only in v1 with light values structurally functional but not visually polished. Establishes that the pluggable model works in practice.
5. **Component SCSS migration** — refinery's ~37 component SCSS files (~290+ hardcoded `$octo-mint` / `$iron-navy` / etc.) are rewritten to consume `var(--theme-*)`. Every color in refinery flows through the semantic surface.
6. **A `TenantThemeService` stub** — runtime override mechanism in place via `document.documentElement.style.setProperty()`, hardcoded preset map for v1. No backend, no UI; foundation for v2 backend integration.

The driver is **customer branding** (tenants want the app to feel like *their* app). White-label deployments are aspirational future work this spec sets up. Per-tenant config UI is explicitly v2.

## 2. Goals

1. Single semantic token surface, ~18 roles, all themeable, all overridable through the same mechanism at theme / app / runtime layers.
2. Two-tier model (semantic + derived) with themes as plug-in palette providers.
3. LCARS dark and LCARS light both shipping, light visually-functional but polish-deferred.
4. Refinery's component SCSS fully migrated — no Sass color references remain in component code.
5. `TenantThemeService` callable from devtools (`window.__theme.setTheme('ember')`), enabling manual end-to-end verification of the runtime override mechanism.
6. Demo-app continues to work unchanged — the architectural firewall holds.
7. Public API of `octo-ui` unchanged: `octo.variables()`, `octo.styles()`, `octo.host-overrides()` retain signatures and behavior for consumers.

## 3. Non-Goals

- Tenant-config UI for picking palettes (deferred to v2; v1 has hardcoded presets only).
- Backend persistence of tenant palette (deferred to v2).
- Visual polish of LCARS-light theme. v1 ships *structurally functional* light theme; design polish is a follow-up.
- Light/dark auto-switching from `prefers-color-scheme`. v1 defaults to `data-theme="lcars-dark"`; toggling is manual.
- Re-doing the LCARS theme structural decomposition. The 2026-04-26 split stands; we only swap token references inside it.
- Snapshot/automated visual regression infrastructure. Same call as the 2026-04-26 spec — verification is build gates + manual walk-through.
- Contrast validation tooling. Useful eventually, not v1.
- White-label theme assets (logos, fonts, custom typography). Out of scope; theme registry makes this addable later without architectural change.
- Process Designer / MeshBoard / Markdown Widget structural redesign. Their LCARS host-overrides are migrated to consume semantic tokens, but their structural rules are unchanged.

## 4. Approach

### 4.1 Locked Decisions

| # | Decision |
|---|---|
| A1 | **Two-tier token model** — semantic tokens (the contract, ~18 roles) + derived tokens (auto-computed via `color-mix()`). No separate "primitives" tier exposed. |
| A2 | **Themes as plug-in registry** — `themes/_lcars-dark.scss`, `themes/_lcars-light.scss` provide values. Each theme owns its private Sass color helpers. Activation via `[data-theme="…"]` on `<html>`. |
| A3 | **Naming convention `--theme-*`** — matches the convention sketched in refinery's CLAUDE.md "Light Theme Support (Concept)" section. |
| A4 | **Light theme ships in v1** — dark is the default; light is shipped structurally-functional but not polished. |
| A5 | **Big-bang migration on `feature/lcars-theme-split`** — single coordinated change across both repos. Working solo; no review pressure. Linear history, mergeable as one or more PRs at the team's discretion. |
| A6 | **Full component SCSS migration in v1** — all hardcoded `$color` references (~290+ across ~37 files) in refinery's component SCSS swapped to `var(--theme-*)`. No half-migrated state. |
| A7 | **TenantThemeService stub** — hardcoded preset map, exposed on `window.__theme` in dev. No backend, no UI. Wired into `app.config.ts`. |
| A8 | **`color-mix()` baseline** — Chromium 111+, Firefox 113+, Safari 16.2+. All evergreen since early 2023. No fallback path. Documented in `octo-ui/CLAUDE.md`. |
| A9 | **All semantic tokens are equally themeable** — no architectural distinction between "themable" and "non-themable" tokens. Tenant-config UI in v2 enforces curation as policy, not as architecture. |

### 4.2 Target Token Surface

Eighteen semantic roles in `tokens/_semantic.scss`. Default values are neutral fallbacks (visible-but-not-broken if a theme misses a role).

```
CORE BRAND        --theme-primary, --theme-secondary
STATUS            --theme-success, --theme-warning, --theme-error, --theme-info
SURFACES          --theme-app-bg, --theme-surface, --theme-surface-elevated
FOREGROUND        --theme-on-primary, --theme-on-secondary, --theme-on-surface,
                  --theme-on-app-bg, --theme-text-secondary
BORDERS           --theme-border, --theme-border-subtle
LCARS ACCENTS     --theme-accent-violet, --theme-accent-amber, --theme-accent-pink
                  (named by hue role; LCARS sets them, other themes may use defaults)
```

Derived tokens (in `tokens/_derived.scss`) — computed once via `color-mix()`, never manually overridden:

```
For each interactive role (primary, secondary, success, warning, error, info):
  --theme-{role}-hover    : color-mix(in srgb, var(--theme-{role}) 88%, white)
  --theme-{role}-active   : color-mix(in srgb, var(--theme-{role}) 80%, black)
  --theme-{role}-subtle   : color-mix(in srgb, var(--theme-{role}) 15%, transparent)
  --theme-{role}-border   : color-mix(in srgb, var(--theme-{role}) 30%, transparent)
  --theme-{role}-glow     : color-mix(in srgb, var(--theme-{role}) 40%, transparent)

Plus alpha scales (replacing today's --octo-mint-N/--bubblegum-N/--ash-blue-N/etc.
tokens). Step coverage is per-role and matches actual codebase usage rather than
a uniform set:

  --theme-primary-alpha-{5,10,15,20,25,30,40,50,60}        (9 steps)
  --theme-secondary-alpha-{10,20,30,40}                    (4 steps)
  --theme-error-alpha-{5,10,15,20,30,40,50,60}             (8 steps)
  --theme-warning-alpha-{15,40,50}                         (3 steps)
  --theme-accent-violet-alpha-{40}                         (1 step)
  --theme-text-secondary-alpha-{10,15,20,30,50,70,80}      (7 steps)
```

Outliers in the old token set (mint-08, mint-35, mint-45 — 9 sites total) round to the nearest provided step at migration time. See plan's Migration Reference Table for the explicit mapping.

### 4.3 Target File Layout

#### `octo-ui` library

```
projects/meshmakers/octo-ui/src/lib/lcars-theme/
  tokens/
    _semantic.scss                ← NEW: 18 --theme-* declarations + neutral defaults
    _derived.scss                 ← NEW: ~30 derived tokens via color-mix()
    _typography.scss              ← unchanged
    _radius.scss                  ← unchanged
    _motion.scss                  ← unchanged
    _designer.scss                ← migrated to consume --theme-*
    _components.scss              ← migrated to consume --theme-*
    _index.scss                   ← updated: forwards new partials, drops palette/alpha-scales
    _palette.scss                 ← DELETED (replaced by themes/)
    _alpha-scales.scss            ← DELETED (replaced by --theme-*-alpha-* in _derived.scss)

  themes/                         ← NEW directory
    _lcars-dark.scss              ← LCARS dark palette → --theme-* mapping (private Sass helpers)
    _lcars-light.scss             ← LCARS light palette → --theme-* mapping
    _index.scss                   ← @forward themes; exposes lcars-dark and lcars-light mixins

  _index.scss                     ← variables() mixin updated; styles()/host-overrides() unchanged externally
  _kendo-theme.scss               ← simplified: $kendo-colors map points to var(--theme-*) tokens directly,
                                    drops k-generate-color-variations() calls

  primitives/*.scss               ← migrated to consume --theme-*
  kendo/*.scss                    ← migrated to consume --theme-* (22 files)
  chrome/_login-popup.scss        ← migrated to consume --theme-*
  forms/*.scss                    ← migrated to consume --theme-*
  host-overrides/*.scss           ← migrated to consume --theme-* (4 files)
  thirdparty/_dockview.scss       ← migrated to consume --theme-*
```

#### `octo-mesh-refinery-studio` app

```
src/octo-mesh-refinery-studio/src/
  styles.scss                     ← cleaned up: drops Sass color redeclarations, drops $kendo-colors
                                    map merge, includes themes.lcars-dark + themes.lcars-light under
                                    [data-theme] selectors

  styles/
    dockview-lcars-theme.scss     ← migrated to consume --theme-*
    _with-kendo.scss              ← unchanged (re-exports octo-ui)

  app/services/
    tenant-theme.service.ts       ← NEW: preset map + setTheme() + window.__theme exposure
    tenant-theme.service.spec.ts  ← NEW: unit tests

  app/                            ← ~37 component SCSS files migrated to var(--theme-*)
    app.component.scss
    tenant.component.scss
    tenants/**/*.component.scss
    (full file list in §4.5 Migration Inventory)
```

### 4.4 Theme Definition Convention

Every theme partial follows the same structure:

```scss
// themes/_lcars-dark.scss
@mixin lcars-dark {
  // 1. Private Sass color helpers — scoped to this theme, never escape this file
  $primary:           #64ceb9;   // LCARS Octo Mint
  $secondary:         #00a8dc;   // Neo Cyan
  $surface:           #394555;   // Iron Navy
  $surface-elevated:  #1f2e40;
  $app-bg:            #07172b;   // Deep Sea
  $on-bg:             #ffffff;
  $on-primary:        #07172b;   // Deep Sea text on mint
  $on-secondary:      #ffffff;
  $text-secondary:    #9292a6;   // Ash Blue
  $success:           #37b400;
  $warning:           #da9162;   // Toffee
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

Activation in refinery's `styles.scss`:

```scss
@use "@meshmakers/octo-ui/themes" as themes;
@use "@meshmakers/octo-ui/styles" as octo;

:root,
:root[data-theme="lcars-dark"] {
  @include themes.lcars-dark;
  @include octo.derived;
  // App-level overrides go here, same selector — declaration order wins
}

:root[data-theme="lcars-light"] {
  @include themes.lcars-light;
  @include octo.derived;
}
```

App-level overrides live in the same selector block as the theme include (matching specificity, declaration order wins).

### 4.5 Migration Inventory

#### Library partials referencing primitive tokens

| Folder | File count | Token references migrated (approximate) |
|---|---|---|
| `kendo/` | 22 | `var(--octo-mint)` → `var(--theme-primary)`, `var(--ash-blue)` → `var(--theme-text-secondary)`, alpha-scaled `--octo-mint-30` → `--theme-primary-alpha-30`, etc. |
| `primitives/` | 4 (panel, layout, page-layout, utilities) | Same migration table |
| `chrome/` | 1 (login-popup) | Same |
| `forms/` | 2 (base-form, config-dialog) | Same |
| `host-overrides/` | 4 (process-designer, process-widget, markdown-widget, meshboard) | Same |
| `thirdparty/` | 1 (dockview) | Same |
| `tokens/_designer.scss` | 1 | Same |
| `tokens/_components.scss` | 1 | Same |
| `_kendo-theme.scss` | 1 | `$kendo-colors` map merge rewritten to point at `var(--theme-*)` directly |

Total: ~36 library files touched.

#### Refinery component SCSS files

Approximately 37 files containing ~290+ hardcoded Sass color references (initial grep was paginated to 30 files; full inventory below):

```
src/styles.scss
src/app/app.component.scss
src/app/tenant.component.scss
src/app/tenants/tenants/tenants.component.scss
src/app/tenants/tenant-details/tenant-details.component.scss
src/app/tenants/tenant-provisioning/tenant-provisioning.component.scss
src/app/tenants/ui/cockpit.component.scss
src/app/tenants/ui/service-health-detail/service-health-detail.component.scss
src/app/tenants/development/user-diagnostics/user-diagnostics.component.scss
src/app/tenants/repository/auto-increment/auto-increment-list/auto-increment-list.component.scss
src/app/tenants/repository/ck-models/ck-models-browser.component.scss
src/app/tenants/repository/query-builder/query-list/query-list.component.scss
src/app/tenants/repository/query-builder/query-results-page/query-results-page.component.scss
src/app/tenants/repository/query-builder/query-editor/query-editor.component.scss
src/app/tenants/repository/fixup-scripts/fixup-scripts-list/fixup-scripts-list.component.scss
src/app/tenants/repository/events/events-list.component.scss
src/app/tenants/repository/ck-model-libraries/ck-model-libraries.component.scss
src/app/tenants/reporting/explorer/explorer.component.scss
src/app/tenants/identity/users/users-list/users-list.component.scss
src/app/tenants/identity/users/users-form/users-form.component.scss
src/app/tenants/identity/users/reset-password/reset-password.component.scss
src/app/tenants/identity/clients/clients-list/clients-list.component.scss
src/app/tenants/identity/groups/groups-list/groups-list.component.scss
src/app/tenants/identity/roles/roles-list/roles-list.component.scss
src/app/tenants/identity/identity-providers/identity-providers-list/identity-providers-list.component.scss
src/app/tenants/identity/email-domain-group-rules/email-domain-group-rules-list/email-domain-group-rules-list.component.scss
src/app/tenants/communication/adapters/adapters-list/adapters-list.component.scss
src/app/tenants/communication/adapters/adapters-form/adapters-form.component.scss
src/app/tenants/communication/pools/pools-list/pools-list.component.scss
src/app/tenants/communication/pools/pools-form/pools-form.component.scss
src/app/tenants/communication/pools/pools-form/components/pool-adapter-selector/pool-adapter-selector.component.scss
src/app/tenants/communication/data-flows/data-flows-list/data-flows-list.component.scss
src/app/tenants/communication/data-flows/data-flows-form/data-flows-form.component.scss
src/app/tenants/communication/data-flows/data-flows-form/components/adapter-selector/adapter-selector.component.scss
src/app/tenants/communication/data-flows/data-flow-editor/data-flow-editor-page.component.scss
src/app/tenants/bot/notification-templates/notification-templates-list/notification-templates-list.component.scss
src/app/tenants/bot/notification-templates/notification-templates-form/notification-templates-form.component.scss
```

Plus templates referencing `lcars-*` classes (107 occurrences across 30 HTML files): **no migration needed** — those classes remain valid; only the underlying CSS variables change.

#### Migration table (primitive → semantic)

A single source of truth applied programmatically (sed/regex), then manually reviewed:

```
--octo-mint            → --theme-primary
--octo-mint-N          → --theme-primary-alpha-N    (for N in 5,10,15,20,30,40,50)
--neo-cyan             → --theme-secondary
--ash-blue             → --theme-text-secondary
--iron-navy            → --theme-surface
--surface-elevated     → --theme-surface-elevated
--deep-sea             → --theme-app-bg
--octo-text-color      → --theme-on-app-bg
--bubblegum            → --theme-error
--toffee               → --theme-warning              (also --theme-accent-amber where decorative)
--royal-violet         → --theme-accent-violet
--lilac-glow           → --theme-accent-pink          (or derived --theme-primary-hover where applicable)
--indigogo             → --theme-info
--kendo-success        → --theme-success
--lcars-border-color   → --theme-border
--pink                 → --theme-error                (legacy alias for bubblegum)

$octo-mint  (Sass)     → DELETE; replace usages with var(--theme-primary)
$iron-navy  (Sass)     → DELETE; replace usages with var(--theme-surface)
…etc
```

Edge cases reviewed manually:
- `rgba($octo-mint, 0.5)` style usages — replaced with the appropriate `--theme-primary-alpha-50` derived token.
- Gradients with multiple stops — broken into multiple `var(--theme-*)` references.
- Kendo `$kendo-colors` map values — switched from `var(--octo-mint)` to `var(--theme-primary)` (no behavior change, just naming).

### 4.6 TenantThemeService Stub

```typescript
// src/app/services/tenant-theme.service.ts
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
    ['ember',       { dataTheme: 'lcars-dark', overrides: {
      '--theme-primary':   '#ff6358',
      '--theme-secondary': '#da9162',
    }}],
    ['ocean',       { dataTheme: 'lcars-dark', overrides: {
      '--theme-primary':   '#00a8dc',
      '--theme-secondary': '#546fbd',
    }}],
    ['forest',      { dataTheme: 'lcars-dark', overrides: {
      '--theme-primary':   '#37b400',
      '--theme-secondary': '#64ceb9',
    }}],
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

Wired in `app.config.ts`:

```typescript
// In ApplicationConfig providers, add:
{ provide: TenantThemeService, useClass: TenantThemeService },

// And in main.ts (or app.component constructor):
const themeService = inject(TenantThemeService);
(window as any).__theme = themeService;  // Dev-only console exposure
```

For v2, the same service grows to:
- Subscribe to tenant route changes via `Router.events`
- Fetch tenant palette from backend
- Apply on tenant change
- Cache in `localStorage` for FOUC-free first paint

### 4.7 Cross-Repo Build Sequence

The migration touches both repositories. After library changes, refinery must `npm ci` (or `npm i`) to pick up the rebuilt `dist/` via its `file:` dependency.

The refinery repo provides `build.ps1` which orchestrates this:

```powershell
# From octo-frontend-refinery-studio root:
.\build.ps1 -configuration DebugL    # builds libraries + refinery in one command
.\build.ps1 -configuration Release   # production build of both
```

Manual sequence (when `build.ps1` isn't appropriate):

```bash
# 1. Build libraries
cd octo-frontend-libraries/src/frontend-libraries
npm ci && npm run build              # or build:prod for Release

# 2. Reinstall in refinery to pick up new dist/
cd ../../../octo-frontend-refinery-studio/src/octo-mesh-refinery-studio
npm ci && npm run build:clean
```

Implementation plan must honor this sequence — library work commits first, then `npm ci` in refinery, then refinery work on top of the rebuilt libraries.

## 5. Verification

### 5.1 Build Gates

Both repos must pass:

```bash
# octo-frontend-libraries/src/frontend-libraries
npm run lint
npm test -- --watch=false --browsers=ChromeHeadless
npm run build:octo-ui

# octo-mesh-refinery-studio/src/octo-mesh-refinery-studio
ng lint
npm test -- --watch=false --browsers=ChromeHeadless
ng build --configuration development
ng build --configuration production    # CSS budget: anyComponentStyle 16kB warning, 20kB error
```

Or via the unified script: `.\build.ps1 -configuration DebugL` (clean local build) and `.\build.ps1 -configuration Release` (production).

### 5.2 Migration Completeness Check

Mechanical grep, expected zero matches outside `themes/`:

```bash
# In octo-ui — primitive references should only exist inside themes/
grep -rn "var(--octo-mint\|var(--neo-cyan\|var(--ash-blue\|var(--iron-navy\|var(--deep-sea" \
  projects/meshmakers/octo-ui/src/lib/lcars-theme/ \
  | grep -v "/themes/"
# Expected: 0 matches

grep -rn "\\\$octo-mint\|\\\$iron-navy\|\\\$deep-sea\|\\\$royal-violet" \
  projects/meshmakers/octo-ui/src/lib/lcars-theme/ \
  | grep -v "/themes/"
# Expected: 0 matches

# In refinery — component SCSS should only reference --theme-* tokens
grep -rn "\\\$octo-mint\|\\\$iron-navy\|\\\$deep-sea\|\\\$royal-violet\|\\\$neo-cyan" \
  src/octo-mesh-refinery-studio/src/app/
# Expected: 0 matches

grep -rn "var(--octo-mint\|var(--neo-cyan\|var(--iron-navy\|var(--deep-sea\|var(--ash-blue" \
  src/octo-mesh-refinery-studio/src/app/
# Expected: 0 matches
```

### 5.3 Unit Tests

| Target | Test count | Coverage |
|---|---|---|
| `TenantThemeService` (new) | ~5 tests | known preset writes expected overrides; unknown preset warns and no-ops; second call replaces previous overrides; default preset clears overrides; `listPresets()` returns all preset names. |
| Existing `octo-ui` Karma suite | unchanged | Library components remain theme-neutral; failures here would indicate accidental theme coupling. |
| Existing refinery Karma suite | unchanged | Component logic doesn't depend on CSS variable values. |

### 5.4 Manual Visual Walk-Through

Two passes across refinery's screen categories.

**Pass 1: `data-theme="lcars-dark"` (default).** Goal: zero visual regression vs. pre-refactor refinery. Compare side-by-side with `main` branch where ambiguous. Screen categories (21):

1. Login flow
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

**Pass 2: `data-theme="lcars-light"`.** Goal: structural correctness — no invisible text, no white-on-white, no missing borders. Visual polish in light theme is acceptable to defer; structural brokenness blocks v1.

**Pass 3: Tenant override smoke test.** Open devtools, run `window.__theme.setTheme('ember')` on a few representative pages. Verify primary color changes across:
- Cockpit stat cards (border + glow)
- Drawer selected item
- Buttons in primary state
- LCARS page-header accent bar
- Process Designer grid
- Process Designer canvas tabs (active tab indicator)

Then `window.__theme.setTheme('lcars-dark')` — must restore exactly.

### 5.5 Demo-app Canary

Demo-app does **not** include `octo.styles()` or `octo.host-overrides()`. After the migration, demo-app must:

- Build clean
- Render with stock Kendo Default theme (no LCARS bleed-through)
- Library components (`mm-tenant-switcher`, drawer, breadcrumb, etc.) work without LCARS styling

Demo-app is the architectural firewall — if demo-app is broken, the library leaked theme-specific styling somewhere. Run demo-app once after the migration to confirm.

## 6. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Migration misses a token reference; component renders with invalid `var(--missing)` | Migration table-driven; grep checks in §5.2 must come back empty before merge |
| Light theme has unreadable contrast somewhere | Pass 2 walk-through catches this. v1 ships only when structurally functional, not pixel-perfect |
| Kendo widget caches color at render time, doesn't repaint on `setTheme()` (Charts, Gauges) | Documented in `octo-ui/CLAUDE.md`. v1 has no theme-switcher UI so not user-visible. v2 reloads on tenant change as simple correct mitigation |
| `color-mix()` fallback values needed for some browsers | Browser baseline is well-supported (early 2023). Documented; no fallback path |
| Big-bang merge introduces regression that's hard to bisect | Working solo on a feature branch; commits are linear and small inside the big-bang. Branch is squash-mergeable but commit history preserved for bisection |
| Light theme starter values turn out to be wrong | Iterate after v1. Light values are explicitly placeholder-ish; structural correctness is the v1 bar |
| Cross-repo build sequence forgotten — refinery built without rebuilt libraries | `build.ps1` documented in `§4.7`; implementation plan honors the order |

## 7. Open Questions

None blocking. Decisions A1–A9 cover the architectural choices.

## 7a. Known follow-ups surfaced during Phase A implementation

Items deferred from v1 with full review trace. Logged 2026-04-27 after Phase A code-quality reviews.

### Light theme contrast failures (deferred polish)

Three paired-contrast failures in `themes/_lcars-light.scss`. v1 ships these as starter values per Non-Goal §3 ("Visual polish of LCARS-light theme"). Address before any v2 light-theme rollout:

| Pair | Measured | Required (WCAG AA normal text) | Recommended fix |
|---|---|---|---|
| White text on `--theme-primary` (`#4ba396`) | 3.01:1 | 4.5:1 | Either darken `$primary` to ~`#2f7a6f`, or flip `$on-primary` to `#07172b` (~6.7:1) |
| `--theme-primary` text on `--theme-app-bg` (`#f5f7fa`) | 2.8:1 | 4.5:1 (3:1 for AA-large) | Darken `$primary`. Affects `--theme-border: $primary` wiring too |
| `--theme-warning` text on white (`#b3641a` on `#fff`) | 4.12:1 | 4.5:1 (passes AA-large) | Darken `$warning` to ~`#9a531a` |

### Light theme hover direction (deferred)

`tokens/_derived.scss` mixes hover with **white** universally (good for dark, washed-out for light). For light theme, hover should darken (mix with black). Defer to Task 38 visual walk-through; if visibly broken, add theme-conditional formulas (e.g., a separate `derived-light` mixin invoked under `[data-theme="lcars-light"]`).

### Cosmetic (low priority)

- `tokens/_semantic.scss` line 4 says "18 roles" but the surface has 19 (including `--theme-border`, `--theme-border-subtle`, accents). Spec/plan also use "18" in places. Update on next pass through the file.
- `styles/_index.scss` and `styles/_with-kendo.scss` duplicate four `@forward` lines. Consider delegating `_with-kendo.scss` → `@forward "./index"` if either file's exports diverge in the future. Defer until that need arises.
- `tokens/_derived.scss` could be reorganized using Sass `@each` loops for the alpha scales section instead of explicit listings. Same output, more maintainable. Deferred for clarity-of-diff during Phase B–E migration; revisit after migration when the file's "shape" is stable.

### Surfaced during Phase C-A migration (2026-04-27)

**Surface alpha-scale gap (must address before Task 31 deletion):** The legacy `_alpha-scales.scss` partial emits alpha-scaled variants of surface colors (`--surface-elevated-N`, `--deep-sea-N`, `--iron-navy-N`) that are referenced by ~15 sites across `lcars-theme/` partials. These were NOT included in the migration table for Phase C-A and were intentionally left as legacy refs. They resolve via the legacy alpha-scales mixin during dual-emission, but Task 31 cannot delete the legacy partials until these are migrated. Two paths:
- Add corresponding `--theme-surface-alpha-N`, `--theme-app-bg-alpha-N`, `--theme-surface-elevated-alpha-N` derived tokens (steps observed: 30, 40, 50, 60, 80, 95)
- Or rewrite each call site with inline `color-mix(in srgb, var(--theme-*) N%, transparent)` (~15 sites)

Recommend the derived-token path for consistency and runtime tenant-swap support.

**Hardcoded RGB triplet leak — blocks theme swap on login surface:** `lcars-theme/chrome/_login-popup.scss` defines `--mm-login-accent-rgb: 100, 206, 185;` (LCARS mint as a comma-separated triplet). The downstream consumer `shared-auth/login-ui/.../login-app-bar-section.component.scss` uses `rgba(var(--mm-login-accent-rgb, …), 0.N)`. This pattern can't decompose a CSS color, so even when a different theme is active (e.g. lcars-light), the login avatar borders/glows render LCARS-mint. **Remediation:** refactor the shared-auth consumer to use `color-mix(in srgb, var(--mm-login-accent) N%, transparent)` against a real color token, or expose `--theme-primary-rgb` companion tokens per theme. Track for shared-auth migration follow-up.

**Hardcoded form colors — blocks theme swap on forms:** `lcars-theme/forms/_base-form.scss` declares `--mm-form-error: #ec658f;`, `--mm-form-bg: rgba(31, 46, 64, 0.6);`, `--mm-form-bg-alt: rgba(31, 46, 64, 0.8);` with literal hex/rgba. These are pre-existing but prevent host or tenant theme overrides from changing form colors. **Remediation:** rewrite as `var(--theme-error)`, `color-mix(in srgb, var(--theme-surface) 60%, transparent)`, etc. Not done in C-A to keep scope tight; do as a focused fix-up.

**Migration table extensions for Phase C-B+:** Add two rows to capture patterns that surfaced during C-A:
- `rgba(<hex>, <alpha>)` literal RGBA → `color-mix(in srgb, <semantic-token> <N>%, transparent)` with examples
- `<rgb-triplet>` raw `R, G, B` (consumed via `rgba(var(--*-rgb), 0.N)`) → flagged as **NEEDS REFACTORING**: refactor consumer to use `color-mix` on the color variable, or introduce `--theme-*-rgb` companion tokens per theme

**Inconsistent gradient stop migration:** `_base-form.scss` line 24 `linear-gradient(180deg, var(--deep-sea-95), var(--theme-app-bg))` mixes a legacy alpha token with a new semantic token. Either both should be legacy (postpone) or both should be semantic (introduce `--theme-app-bg-alpha-95`). Folds into the surface alpha-scale gap above.

**Naming oddity to revisit:** `tokens/_designer.scss` lines 9-10 — `--designer-panel-bg: var(--theme-surface-elevated)` and `--designer-panel-bg-elevated: var(--theme-surface)` reads as if values are swapped (panel is brighter; elevated panel is darker). Pre-existing behavior, faithful to original semantics; reconsider naming or values in a future cleanup.

**Decorative vs semantic class names:** `primitives/_utilities.scss` `.lcars-text-pink` mapped to `var(--theme-error)` per the migration table. Class is named for hue, not role; means a theme that picks a non-pink error color (crimson, vermilion) renders `.lcars-text-pink` in non-pink. Defer rename to `.lcars-text-error` or deprecation to a later cleanup pass.

### Surfaced during Phase C-B / C-C / C-F migration

**`--designer-text` and `--editor-text` hardcoded `#ffffff` in `host-overrides/_process-designer.scss` (lines 1350, 1366):** Pre-existing literal whites that pre-dated this refactor. For correct light-theme support, replace with `var(--theme-on-app-bg)`. Eliminates the last theme-color hex literals in the file. Cleanup pass.

**`#4a5568` in `host-overrides/_process-designer.scss` line 970 (`.symbol-preview` background):** Deliberate fixed-gray contrast bg for SVG symbol previews. Pre-existing, faithfully preserved by Phase C-B. For multi-theme support, promote to a per-component token like `--theme-symbol-preview-bg` so it varies per theme.

**Kendo emphasis variants dropped from `_kendo-theme.scss`:** Phase C-F removed all `k-generate-color-variations()` Sass-time calls. The previous output included synthesized derivatives like `primary-emphasis`, `primary-emphasis-subtle`, `primary-on-base`, `secondary-emphasis`, etc. The new runtime map intentionally omits these. **Risk:** any Kendo component that reads `--kendo-color-primary-emphasis` or `--kendo-color-on-primary-subtle` will fall back to imported Material defaults (purple/teal) and clash with LCARS. Verify during Phase G visual walk-through; add the missing keys to the map if surfaced. Ones to expect issues with: button hover, chip selection, dropdown highlighted item, focus rings.

**Kendo charting series colors omitted:** The previous `k-generate-color-variations("series-a", ...)` etc. provided 6 chart series colors. Phase C-F omitted these (zero codebase references found). If charts/gauges are added later, register sensible mappings (e.g., `series-a: var(--theme-primary)`, `series-b: var(--theme-secondary)`, etc.) in the `$kendo-colors` map.

**`base-on-surface` mapping nit:** Currently maps to `var(--theme-on-app-bg)`; for semantic precision could use `var(--theme-on-surface)` instead (a separate token for surfaces vs the overall app background). LCARS values happen to coincide so no functional difference today; relevant when light theme polishes or when `--theme-on-surface` and `--theme-on-app-bg` diverge.

### Surfaced during Phase E (refinery component SCSS migration)

**Need for `--theme-accent-violet-light` derived token:** 6 sites in `tenants/repository/` (ck-models browser components and query-builder) use `lighten($royal-violet, 20%)` Sass calls producing `#9c8ec4` or `#9d7ed4`. These were preserved as literal hex with `// MIGRATION-REVIEW:` markers pending introduction of a `--theme-accent-violet-light` derived token (or equivalent — could also be a generic `*-light` derivation in `_derived.scss` paralleling `*-hover`).

**~95+ `// MIGRATION-REVIEW:` markers across refinery (Phase E-6 communication module heaviest):** Most flag legitimate gaps: out-of-scope `--iron-navy-N`/`--surface-elevated-N`/`--deep-sea-N` alpha tints (handled via inline `color-mix()` bridges), non-canonical alpha steps not in `_derived.scss` (also bridged), and visual-QA flags for non-exact color matches. All grep-able under "MIGRATION-REVIEW" for follow-up cleanup.

**Visual-QA flags for `#da9162` toffee disambiguation:** Multiple sites map `#da9162` (toffee) to `--theme-warning` for status contexts and `--theme-accent-amber` for decorative contexts. The decision was per-site judgment based on surrounding code/intent. v2 visual walk-through should specifically verify status vs decorative usage looks correct under tenant overrides.

**Visual-QA flag for `#c861d6` lilac-glow vs accent-pink:** LCARS palette has both `--lilac-glow` (#c861d6, hover/glow effects) and conceptually-distinct accent-pink intent. Current migration table maps `--lilac-glow` → `--theme-accent-pink`. Most visible site: data-flow-overview-panel selected-card glow effect. Verify visual QA — if the glow tone looks off, may need separate `--theme-accent-glow` token.

**Monaco editor SVG data: URI hex literals preserved:** `monaco-editor.component.scss` embeds inline SVG via `data:image/svg+xml,...` URIs. CSS custom properties don't resolve inside data: URIs. Hardcoded `#64ceb9`, `#da9162`, `#ec658f`, `#00a8dc`, `#9292a6` literals remain. Theme swap won't affect these visuals. Resolution paths (any of):
- Inline the SVG as Angular template instead of `data:` URI (heaviest refactor)
- Generate the data: URI dynamically in TypeScript from theme token computed values (medium)
- Accept LCARS-mint accents in the editor (lightest — defer)

**Non-LCARS surface tones preserved as inline hex:** Multiple files use deliberate near-bg shades distinct from the canonical `--theme-app-bg`/`--theme-surface` (e.g., `#0d1f35`, `#132a45`, `#0d1b2a`, `#6a6a7a`, `#7a7a8a`, `#0d1b2a` Dockview content panel bg). Preserved as-is rather than forced into a misleading semantic mapping. Could be promoted to per-component tokens in v2 if multi-theme support of these specific surfaces matters.

**`microsoft-graph-configuration-details.component.scss` rewritten with canonical header during E-7:** Original file was truncated/header-less. Rewritten with the standard refinery component SCSS header pattern. Cosmetic, not a regression.

**Empty / comment-only files left untouched:** `loxone-configuration-details.component.scss` (0 bytes), `discord-configuration-details.component.scss` (comment placeholder only). Acceptable; they have no LCARS references to migrate.

**Refinery branch is `feature/lcars-theme-split-adoption`** in the refinery repo (separate from libraries' `feature/lcars-theme-split`). Both branches need to merge in coordinated fashion.

**Phase F (legacy partial deletion) blocked by surface alpha-scale gap:** Cannot delete `_alpha-scales.scss` until either (a) `--theme-surface-alpha-N`/`--theme-app-bg-alpha-N`/`--theme-surface-elevated-alpha-N` derived tokens are added, OR (b) all ~15-30 `--iron-navy-N`/`--surface-elevated-N`/`--deep-sea-N` references across library + refinery are inlined as `color-mix()`. Recommend the derived-token path.

## 8. Future Work (out of scope for v1)

- **Tenant configuration UI** — palette picker form in `general/configurations/tenant-configuration-details/`. Curated presets + custom override per question 3 of the brainstorming session.
- **Backend persistence** — tenant palette as a tenant-config attribute. Loaded via GraphQL on tenant entry. `TenantThemeService` extended to fetch and apply.
- **localStorage cache** — per-tenant palette cached client-side for FOUC-free first paint.
- **Light theme polish pass** — after v1 ships, dedicated visual QA + design iteration on LCARS-light values.
- **`prefers-color-scheme` integration** — auto-pick dark vs. light based on system preference, with manual override.
- **Contrast validation** — WCAG AA / AAA checks on tenant-supplied palettes; UI warnings or rejections.
- **Additional themes** — `themes/_forest.scss`, `themes/_corporate-x.scss`, etc. as white-label deployments demand.
- **Theme assets beyond colors** — typography overrides per tenant, logo upload, custom icons. Theme registry already supports this without architectural change; just adds a few file types.
- **M3-style tonal palettes** — if v2 reveals demand for finer tone control, swap the linear `color-mix()` derivations for OKLCH-based tonal scales. Architecturally drop-in; the semantic surface stays the same.
