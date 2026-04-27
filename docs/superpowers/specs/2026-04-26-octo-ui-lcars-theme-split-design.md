# octo-ui LCARS Theme Split — Design

**Date:** 2026-04-26
**Status:** Approved (pending implementation)
**Scope:** `octo-frontend-libraries` (local repo). Refinery Studio touched in lockstep only if locally available. **No remote pushes without explicit permission.**

## 1. Problem

`projects/meshmakers/octo-ui/src/lib/runtime-browser/styles/_styles.scss` is 4,781 lines of LCARS theme rules wrapped in a single `@mixin styles`. The file:

- Is mis-located: it lives under `runtime-browser/` but emits global Kendo overrides, Dockview overrides, MeshBoard styles, Process Designer styles, etc. — none of which are scoped to the runtime browser.
- Violates the library's own "components must be theme-neutral; theme is the host's responsibility" rule by shipping LCARS-specific overrides for Process Designer / Process Widget / Markdown Widget / MeshBoard inside the library bundle.
- Is unreadable: 30+ visually distinct concerns share one mixin in one file with no internal partitioning.
- Carries hacks that bloat every rule (~800 `!important` declarations, `::ng-deep` chains, an inline-style attribute sniff for the mini drawer, two CSS-`zoom` workarounds).
- Makes the drawer styling — recently added under AB#3970 — discoverable only by scrolling to line ~2418.

`_variables.scss` (in the same folder) has the same problem: LCARS tokens for designer panels and cron cells are intermingled with the runtime-browser palette.

## 2. Goals

1. **Readable** — finding the rule for a given Kendo widget takes seconds, not minutes.
2. **Maintainable** — each concern lives in its own partial, owned by a single small file.
3. **Less hacks** — sweep gratuitous `!important`/`::ng-deep`, drop the inline-style sniff, promote inline values to per-widget tokens. Flag (don't fix) the cross-repo `zoom` workarounds.
4. **Honest layout** — folder name reflects content; `runtime-browser/` keeps only runtime-browser code.
5. **Architectural rule enforced** — the library exposes a theme-neutral default; LCARS-host overrides become an explicit opt-in.

## 3. Non-Goals

- Visual redesign of any LCARS rule. The compiled CSS for the default LCARS host stays effectively identical (modulo hack-removal cleanup).
- Switching `DensityService` from CSS `zoom` to `transform: scale()`. The two `zoom` workarounds stay, flagged with `// HACK:` comments.
- Snapshot/automated visual regression infrastructure (Playwright). Verification is build + manual walk-through.
- Promoting the LCARS theme into its own npm package. Stays inside `@meshmakers/octo-ui` for now.
- Cross-browser fidelity beyond Chromium spot-checks. Firefox/Safari verification is optional, not gated.

## 4. Approach

### 4.1 Locked Decisions

| # | Decision |
|---|---|
| A1 | Move LCARS theme **out** of `runtime-browser/` to `octo-ui/src/lib/lcars-theme/`. Drop the deep-import asset path from `ng-package.json`. The deep path under `lib/runtime-browser/styles/` is removed — intentional break. |
| A2 | LCARS overrides for Process Designer / Process Widget / Markdown Widget / MeshBoard move to a separate **opt-in** mixin `octo.host-overrides()`. `octo.styles()` no longer emits them. |
| A3 | Fine-grained partitioning — one file per concern (~25–30 partials). |
| A4 | Aggressive hack removal: drop inline-style sniff, sweep gratuitous `!important`, sweep gratuitous `::ng-deep`, promote per-widget tokens. Leave the two `zoom` workarounds flagged. |
| A5 | Verify by lint + tests + build gates + manual demo-app walk-through across 21 screens. |

### 4.2 Target File Layout

```
octo-ui/src/
├── public-api.ts                          (unchanged)
├── styles/
│   ├── _index.scss                        (PUBLIC: variables() + styles())
│   ├── _with-kendo.scss                   (PUBLIC: variant that pulls Kendo theme)
│   └── _host-overrides.scss               (PUBLIC: host-overrides() mixin entrypoint)
└── lib/
    ├── lcars-theme/                       ← NEW HOME of the theme
    │   ├── _index.scss                    (aggregator: defines variables() + styles() mixins)
    │   ├── _kendo-theme.scss              (moved from runtime-browser/styles; pulled in only by _with-kendo.scss)
    │   ├── tokens/
    │   │   ├── _index.scss
    │   │   ├── _palette.scss              ($octo-mint, $iron-navy, … brand colors)
    │   │   ├── _alpha-scales.scss         (--octo-mint-10 / -20 / -30 …)
    │   │   ├── _radius.scss               (--lcars-radius-*)
    │   │   ├── _motion.scss               (--lcars-transition-*)
    │   │   ├── _typography.scss           (--lcars-font-*)
    │   │   ├── _designer.scss             (--designer-* vars)
    │   │   └── _components.scss           (newly-promoted per-widget vars)
    │   ├── primitives/                    (LCARS-original UI patterns)
    │   │   ├── _panel.scss                (.lcars-panel / .lcars-panel-asymmetric)
    │   │   ├── _header-bar.scss
    │   │   ├── _page-layout.scss          (.lcars-page-layout grid + responsive)
    │   │   ├── _footer.scss
    │   │   └── _utilities.scss            (text/bg helpers, glow, scan, pulse, decorative)
    │   ├── kendo/                         (one file per Kendo widget)
    │   │   ├── _appbar.scss
    │   │   ├── _button.scss
    │   │   ├── _card.scss
    │   │   ├── _checkbox.scss
    │   │   ├── _chip.scss
    │   │   ├── _context-menu.scss
    │   │   ├── _dialog.scss
    │   │   ├── _drawer.scss               (incl. level-0/1/2 hierarchy + mini mode)
    │   │   ├── _dropdown.scss
    │   │   ├── _form.scss
    │   │   ├── _grid.scss
    │   │   ├── _input.scss
    │   │   ├── _input-buttons.scss        (DatePicker calendar btn, NumericTextBox spinners)
    │   │   ├── _label.scss
    │   │   ├── _listview.scss
    │   │   ├── _popup.scss                (incl. zoom-positioning HACK comment)
    │   │   ├── _progress.scss
    │   │   ├── _scrollbars.scss
    │   │   ├── _tabs.scss
    │   │   ├── _tilelayout.scss           (incl. drag-offset HACK comment)
    │   │   ├── _toolbar.scss
    │   │   ├── _tooltip.scss
    │   │   ├── _treeview.scss
    │   │   └── _window.scss
    │   ├── thirdparty/
    │   │   └── _dockview.scss
    │   ├── chrome/
    │   │   └── _login-popup.scss
    │   ├── forms/
    │   │   ├── _base-form.scss            (mm-base-form)
    │   │   └── _config-dialog.scss        (widget config dialogs / mm-dialog-actions)
    │   └── host-overrides/                (LCARS overrides for library components — opt-in)
    │       ├── _index.scss                (defines host-overrides() mixin)
    │       ├── _process-designer.scss
    │       ├── _process-widget.scss
    │       ├── _markdown-widget.scss
    │       └── _meshboard.scss
    └── runtime-browser/
        ├── components/                    (unchanged)
        ├── runtime-browser.component.scss (unchanged)
        ├── entity-detail.component.scss   (unchanged)
        └── styles/                        ← REMOVED (folder ceases to exist)
```

**Composition rules:**

- `tokens/` is the only place that emits `--*` custom properties. All other partials consume them.
- `kendo/`, `primitives/`, `thirdparty/`, `chrome/`, `forms/` together compose `octo.styles()` via the `lcars-theme/_index.scss` aggregator.
- `host-overrides/` is **NOT** included by `octo.styles()`. Hosts opt in via `@include octo.host-overrides()`.
- The `variables()` mixin emits the union of all `tokens/*` partials.

**Disposition of existing files in `runtime-browser/styles/`:**

| Existing file | Disposition |
|---|---|
| `_index.scss` | Replaced by `lcars-theme/_index.scss`. Deep import path is broken (intentional, §5.3). |
| `_variables.scss` | Decomposed into `tokens/*` partials (§7.3). The `variables()` mixin recomposes them. |
| `_styles.scss` | Decomposed into `kendo/*`, `primitives/*`, `thirdparty/*`, `chrome/*`, `forms/*`, and `host-overrides/*` partials (§7.4). Deleted when empty. |
| `_kendo-theme.scss` | Moved verbatim to `lcars-theme/_kendo-theme.scss`. Still referenced only by the public `_with-kendo.scss` entry. |
| `_lcars-button.scss` | Folded into `kendo/_button.scss`. The `lcars-button` mixin's contents become rules in the `_button.scss` partial. |
| `_lcars-flat-btn.scss` | Folded into `kendo/_button.scss` (flat-button variants live alongside other button styles). |
| `_lcars-input.scss` | Folded into `kendo/_input.scss`. |

`tokens/_components.scss` is created during the hack-removal sweep (§7.6) — not in the initial decomposition. It's shown in the layout above for completeness; the file exists in the final state.

## 5. Public API Contract

### 5.1 Consumer surface

```scss
@use "@meshmakers/octo-ui/styles" as octo;

@include octo.variables();        // unchanged contract — same CSS custom properties as today (plus additions)
@include octo.styles();           // unchanged behavior minus the host-overrides
@include octo.host-overrides();   // NEW — opt-in for LCARS hosts (Refinery Studio etc.)
```

### 5.2 Mixin behavior

| Mixin | Emits | Notes |
|---|---|---|
| `variables()` | All existing `--octo-*`, `--lcars-*`, `--designer-*`, `--mm-cron-*`, `--kendo-color-*` overrides + new per-widget tokens (`--lcars-drawer-bg`, `--lcars-drawer-border`, `--lcars-dialog-bg`, …) | Same set of names as today, plus additions. **No removals.** **No renames.** |
| `styles()` | Dockview overrides + LCARS primitives + Kendo overrides + base-form + config-dialog + login popup + context menu + listview/page toolbar | **Stops emitting** the four host-override blocks (Process Designer / Process Widget / Markdown Widget / MeshBoard). |
| `host-overrides()` | The four host-override blocks | New mixin. |
| `with-kendo` entry | Same as today — also pulls `kendo-theme` first | Unchanged. |

### 5.3 Breaking changes (intentional)

1. **Deep imports of `<...>/octo-ui/lib/runtime-browser/styles/...`** stop working. The folder is gone. Anyone on the deep path must switch to `<...>/octo-ui/styles` (the public path the docs already document).
2. **`octo.styles()` no longer emits host-overrides.** Any LCARS host that depended on the old bundle adds one line: `@include octo.host-overrides();`.
3. **Token name additions** are additive only. Nothing existing is removed or renamed.

### 5.4 ng-package.json

- **Drop:** `src/lib/runtime-browser/styles` asset entry.
- **Add:** `src/lib/lcars-theme` shipped to `dist/.../lib/lcars-theme/`.
- **Keep:** `src/styles` shipped to `dist/.../styles/` (the public consumer entry).

## 6. Hack Removal Details

### 6.1 Inline-style sniff (drop)

In `kendo/_drawer.scss`, drop `&[style*="flex-basis: 50px"]` / `&[style*="flex-basis:50px"]`. The next selector `&.k-drawer-mini` already matches Kendo's mini state correctly.

### 6.2 `!important` sweep

| Keep `!important` in | Drop `!important` in |
|---|---|
| `kendo/_drawer.scss`, `_dialog.scss`, `_grid.scss`, `_dropdown.scss`, `_popup.scss`, `_window.scss` | `primitives/*` (LCARS-original classes — no third-party CSS competing) |
| `thirdparty/_dockview.scss` | `chrome/_login-popup.scss` body styles where the surrounding container is owned |
| Where overriding Kendo internals that ship their own theme | Decorative utilities (`.lcars-glow-*`, `.lcars-scan-line-*`, `.lcars-pulse-*`) |

Target reduction: ~800 → ~250–350 declarations.

### 6.3 `::ng-deep` cleanup

- Drop redundant outer `::ng-deep` where the inner selector is already global (the mixin is consumed at `:root` / `body` scope).
- Keep `::ng-deep` only where the rule must specifically penetrate an Angular component's emulated encapsulation.

### 6.4 Per-widget token promotion

Hardcoded gradients/colors get promoted to CSS variables, with current values as defaults in `tokens/_components.scss`. The default LCARS host's compiled output is unchanged.

| Today (inline) | Variable | Default |
|---|---|---|
| `.k-drawer { background: linear-gradient(180deg, var(--iron-navy), var(--deep-sea)); }` | `--lcars-drawer-bg` | `linear-gradient(180deg, var(--iron-navy), var(--deep-sea))` |
| `.k-drawer { border-right: 1px solid var(--octo-mint-20); }` | `--lcars-drawer-border` | `1px solid var(--octo-mint-20)` |
| `.k-dialog { background: …; border: …; }` | `--lcars-dialog-bg`, `--lcars-dialog-border` | current values |
| `.k-tabstrip-items { border-bottom: 2px solid var(--ash-blue-20); }` | `--lcars-tabs-border` | `2px solid var(--ash-blue-20)` |
| `.k-card { background: var(--lcars-panel-bg); border: var(--lcars-panel-border); }` | `--lcars-card-bg`, `--lcars-card-border` | current values |
| `.k-tabstrip .k-item.k-active { background: var(--iron-navy); border-bottom: 3px solid var(--octo-mint); }` | `--lcars-tabs-active-bg`, `--lcars-tabs-active-border` | current values |

Equivalent promotions apply for the other widgets in `kendo/`. Concrete list emerges during decomposition; rule-of-thumb: any inline gradient or any `border:` shorthand on a top-level Kendo selector becomes a token.

### 6.5 The `zoom` hacks (NOT FIXED — flagged)

The TileLayout drag-offset hack and the Kendo popup-positioning hack stay. They patch around `DensityService` setting CSS `zoom` on `kendo-drawer-content` — a different repo / different concern.

- TileLayout hack moves into `kendo/_tilelayout.scss`. Popup-positioning hack moves into `kendo/_popup.scss`.
- Both blocks get a leading comment:
  ```scss
  // HACK: workaround for DensityService applying CSS zoom on kendo-drawer-content.
  //       CSS zoom breaks position:fixed children (drag offset) and popup positioning.
  //       Remove if DensityService switches to transform: scale().
  ```

### 6.6 Dead-code

- `&.k-drawer-separator { display: none; }` — kept (intentional: Kendo separators don't fit LCARS hierarchy). Add a one-line comment explaining why.
- The two `[style*="flex-basis: 50px"]` selectors — deleted (see 6.1).

## 7. Migration Steps (One Big Bang, Local Only)

### 7.1 Pre-flight

1. Confirm clean working tree on a fresh feature branch (work-item number TBD by user; placeholder `feature/lcars-theme-split` until provided).
2. Baseline build:
   ```bash
   cd src/frontend-libraries
   npm run build:octo-ui
   npm run build:demo-app
   npm test -- --watch=false --browsers=ChromeHeadless
   ```
3. Run demo-app, capture baseline screenshots for the 21 walk-through screens (§8).

### 7.2 Move (file plumbing only)

4. `git mv` `runtime-browser/styles/_variables.scss` → `lib/lcars-theme/_variables.scss` (temporary).
5. `git mv` the same way for `_styles.scss`, `_kendo-theme.scss`, `_lcars-button.scss`, `_lcars-flat-btn.scss`, `_lcars-input.scss`, `_index.scss`.
6. Update `octo-ui/src/styles/_index.scss` and `_with-kendo.scss` to point at the new location. Rebuild — should compile, no visual change.

### 7.3 Decompose `_variables.scss`

7. Split into `tokens/_palette.scss`, `_alpha-scales.scss`, `_radius.scss`, `_motion.scss`, `_typography.scss`, `_designer.scss`, plus `tokens/_index.scss`. The `variables()` mixin in `lcars-theme/_index.scss` `@include`s each token partial.
8. Rebuild. Confirm CSS-var diff against baseline is zero.

### 7.4 Decompose `_styles.scss`

9. Carve sections out one at a time, in source order, into `kendo/`, `primitives/`, `thirdparty/`, `chrome/`, `forms/`, `host-overrides/`. Each carved section keeps its current rules verbatim — **no semantic change in this step**.
10. After each carve, the now-shorter `_styles.scss` keeps emitting the leftover rules. The `lcars-theme/_index.scss` `styles()` mixin `@include`s carved partials + the leftover. When the leftover hits zero lines, delete `_styles.scss`.
11. Rebuild + visual spot-check after **each major carve** (Kendo block, primitives block, host-overrides block).
11a. Once `_styles.scss` is deleted, **before** starting the hack sweep: rebuild and diff the compiled CSS in `dist/.../styles/*.css` against the §7.1 baseline. The diff should be **zero or whitespace-only** (decomposition is intended to be byte-equivalent). If non-trivial differences appear, stop and reconcile before proceeding.

### 7.5 Wire host-overrides as a separate mixin

12. `lcars-theme/host-overrides/_index.scss` exposes `host-overrides()` mixin. The four host-override partials register there.
13. `octo.styles()` no longer pulls `host-overrides`. Add `host-overrides()` to the public surface in `octo-ui/src/styles/_host-overrides.scss` (forwards from `lcars-theme/host-overrides`).

### 7.6 Hack removal sweep

14. Drop `[style*="flex-basis: 50px"]` in `kendo/_drawer.scss`.
15. `!important` sweep, partial-by-partial. Apply the keep/drop matrix from §6.2.
16. `::ng-deep` redundancy cleanup, partial-by-partial.
17. Token promotion per Kendo widget. Create `tokens/_components.scss` and add it to `tokens/_index.scss`. Variables get the current inline values as defaults; partials replace inline values with `var(--lcars-*)` references. Compiled CSS for the default LCARS host is unchanged.
18. Move `zoom` hacks into `kendo/_tilelayout.scss` and `kendo/_popup.scss` with `// HACK:` comments.

### 7.7 ng-package + cleanup

19. Update `octo-ui/ng-package.json`: drop the `src/lib/runtime-browser/styles` asset entry, add `src/lib/lcars-theme`. Confirm published `dist/` layout.
20. Delete the now-empty `runtime-browser/styles/` folder.
21. Update `octo-ui/CLAUDE.md` and `frontend-libraries/CLAUDE.md` "Drawer Hierarchy" section to point at the new path (`lcars-theme/kendo/_drawer.scss`) and document the new `host-overrides()` mixin.

### 7.8 Refinery Studio (cross-repo, only if locally available)

22. Locate Refinery Studio's checkout. Identify any deep `runtime-browser/styles` imports — replace with the public path. Add `@include octo.host-overrides();` after the existing `octo.styles()` call. **Do not push.** Show the diff and wait for explicit approval.
23. If Refinery Studio is **not available locally**, ship the octo-ui side as a versioned breaking change and hand the user the one-line patch to apply when they are in that repo.

### 7.9 Final verification

24. `npm run lint:octo-ui` + `npm test -- --project=@meshmakers/octo-ui --watch=false` + `npm run build:prod`.
25. Full demo-app walk-through (§8).
26. Diff `dist/.../styles/*.css` against baseline to confirm only expected changes.

### 7.10 Commit policy

- Commits per major step (move, decompose vars, decompose styles, host-overrides split, hack sweep, ng-package + docs). Each commit independently revertible.
- Optional final squash before review.
- **No `git push` without explicit user approval.**

## 8. Verification — Demo-App Walk-Through

Build gates first:

```bash
cd src/frontend-libraries
npm run lint:octo-ui
npm test -- --project=@meshmakers/octo-ui --watch=false --browsers=ChromeHeadless
npm run build:octo-ui
npm run build:demo-app
```

Then visually confirm each screen against the baseline:

| # | Screen / Component | What to verify |
|---|---|---|
| 1 | Drawer (sidebar nav) | Level-0 / Level-1 / Level-2 indents, colors, guide line, icon scale, hover, selected state, mini mode |
| 2 | Runtime browser | List view, entity detail panels, attribute fields, attributes group |
| 3 | Dialogs (Kendo, mm-dialog-actions, danger variant) | Borders, action button bar, scrolling, title bar |
| 4 | Window service dialogs | Action button styling, content fill |
| 5 | Widget config dialogs | Form fields, radio groups, config cards, query info, options card, loading indicator |
| 6 | Buttons (solid/outline/flat × default/primary/error) | Visibility on dark background, hover/focus rings |
| 7 | Inputs (TextBox, NumericTextBox, TextArea, DatePicker, DropDownList) | Borders, focus glow, calendar/spinner buttons |
| 8 | Form fields (labels, checkboxes) | Label color, checkbox spacing |
| 9 | Grid | Header bar, row hover, command cell, toolbar |
| 10 | TreeView | Indent, hover, selection |
| 11 | Tabs | Active state, hover, border-bottom |
| 12 | Cards | Background, border, padding |
| 13 | Tooltip / Progress / Chips | Colors, sizing |
| 14 | Login popup | Popup-in-body style cascade still works |
| 15 | Context menu | Hover, focus, separator, destructive action |
| 16 | List view + page toolbar | Toolbar layout, command cell, three-dot menu |
| 17 | LCARS page layout / footer | Grid pattern, responsive at narrow widths |
| 18 | Scrollbars | Webkit + Firefox rendering |
| 19 | Process Designer (with `host-overrides()` enabled) | Canvas bg, grid lines, palette, property inspector, exposures, animations, simulation, settings, symbol library, binding editor, SVG import |
| 20 | MeshBoard view (with `host-overrides()` enabled) | Toolbar, empty state, TileLayout drag (zoom hack), widget header/body |
| 21 | Markdown widget (with `host-overrides()` enabled) | Background, text, code blocks |

**Host-overrides on/off check:** build demo-app **without** `@include octo.host-overrides();` and confirm the process-designer / meshboard panels render in the **neutral** library defaults (off-LCARS look). Then add `@include octo.host-overrides();` and confirm the LCARS look returns. Proves the gating works and the library is now genuinely theme-neutral.

## 9. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Visual regression introduced by `!important` sweep | Per-partial review during the sweep; demo-app walk-through after each major partial; commit-per-step lets us revert one partial without losing the whole refactor. |
| Visual regression introduced by `::ng-deep` cleanup | Same as above. |
| External consumer (Refinery Studio?) breaks on deep-import removal | A2 mixin breakage is intentional and documented; one-line patch in Refinery Studio. If Refinery Studio is locally available, apply in lockstep; otherwise hand off the patch. |
| Token-promotion default drift (a value I copy is slightly off) | Promotion rule: copy the existing inline value verbatim as the variable default. Final CSS diff against baseline catches drift. |
| `zoom` hack relocation accidentally changes selector specificity | The hack blocks move verbatim into the right partial; selectors and specificity preserved. |
| Forgotten asset path in `ng-package.json` | Spot-check `dist/.../lib/lcars-theme/` exists and contains the expected partials after build. |

## 10. Out of Scope (Follow-ups)

- Switch `DensityService` from `zoom` to `transform: scale()` (separate work item).
- Promote `@meshmakers/lcars-theme` to its own package.
- Snapshot-based visual regression infrastructure (Playwright).
- Cross-browser visual fidelity beyond Chromium.
- Decomposition of the legacy octo-ui-legacy / shared-ui-legacy themes.

## 11. Approvals

- Brainstorming dialogue: approved interactively (5 questions, all decided).
- Spec self-review: pending (next step).
- User review of spec: pending (after self-review).
- Implementation plan: produced via `superpowers:writing-plans` after spec approval.
