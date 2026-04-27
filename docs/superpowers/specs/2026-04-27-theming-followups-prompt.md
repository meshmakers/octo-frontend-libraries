# Future-agent prompt: finish the theming refactor follow-ups

You are continuing work on the OctoMesh frontend semantic-token theming refactor. The two foundational specs are:

- `docs/superpowers/specs/2026-04-26-octo-ui-lcars-theme-split-design.md` (extraction)
- `docs/superpowers/specs/2026-04-27-semantic-token-theming-design.md` (semantic surface, runtime switching)

The **§7a "Known follow-ups"** section of the second spec is the canonical list — read it first. Most items below are tracked there with full context.

The refactor itself shipped on `feature/lcars-theme-split` (libraries) and `feature/lcars-theme-split-adoption` (refinery), 3 commits each, and was verified live in browser via theme-switching across multiple pages including new code added by a colleague in parallel. Both branches are merge-ready. **The work below is polish, not core.**

You don't need to find exact files or line numbers — grep + the canonical migration table at the top of `docs/superpowers/plans/2026-04-27-semantic-token-theming.md` will guide you. The codebase has ~95 `// MIGRATION-REVIEW:` markers serving as breadcrumbs.

## Priority 1 — User-visible risks

These could surface as actual visual bugs in production:

1. **Light theme is structurally functional but not polished.** The current `themes/_lcars-light.scss` has at least three paired-contrast failures (white on darkened mint = 3.01:1, mint as text on light bg = 2.8:1, warning text on white = 4.12:1) and the derived `*-hover` formula mixes with white universally — wrong for light surfaces, where hover should darken. Tighten light palette values; introduce a theme-conditional hover formula (or a `derived-light` mixin) if needed.

2. **Kendo emphasis variants dropped during Phase C-F.** The Sass-time `k-generate-color-variations()` calls were replaced with explicit runtime `var(--theme-*)` mappings — but variants like `primary-emphasis`, `primary-emphasis-subtle`, `primary-on-base` were dropped entirely. Any Kendo widget that reads those keys falls back to imported Material defaults (purple/teal). Walk through Kendo button hover, chip selection, dropdown highlighted item, focus rings — anything that looks "Material-purple" needs the missing key added to `_kendo-theme.scss`.

3. **`--mm-login-accent-rgb` hardcodes the LCARS-mint RGB triplet** in `shared-auth/login-ui/...login-app-bar-section.component.scss` via `rgba(var(--*-rgb), 0.N)`. CSS variables can't decompose colors, so the consumer pattern can't follow theme swaps. Two paths: refactor the consumer to use `color-mix(in srgb, var(--mm-login-accent) N%, transparent)` against a real color token, or add `--theme-primary-rgb` companion tokens per theme.

4. **Hardcoded form colors** in `octo-ui/lib/lcars-theme/forms/_base-form.scss` — `--mm-form-error: #ec658f`, `--mm-form-bg: rgba(31, 46, 64, 0.6)`, `--mm-form-bg-alt: rgba(31, 46, 64, 0.8)`. Pre-existing literal hex/rgba; should consume the semantic surface so host or tenant overrides reach forms.

5. **Monaco editor SVG `data:` URI hex literals** in refinery's `monaco-editor.component.scss` bake in LCARS-mint, toffee, bubblegum, neo-cyan, ash-blue. CSS variables don't resolve inside `data:` URIs, so theme swap doesn't affect these icons. Three paths in the spec — pick whichever fits the team's appetite.

## Priority 2 — Architectural cleanup

Real but low-risk debt:

6. **Process-designer's `--designer-text`/`--editor-text` are hardcoded `#ffffff`** in `host-overrides/_process-designer.scss`. Replace with `var(--theme-on-app-bg)` to follow theme.

7. **`#4a5568` symbol-preview background** in process-designer.scss is a deliberate fixed-gray contrast bg for SVG previews. For multi-theme support, promote to a per-component token like `--theme-symbol-preview-bg` so light theme can override it.

8. **Refinery CLAUDE.md's "Process Designer / Symbol Editor Canvas Theming" and "LCARS Page Layout Pattern" sections** still reference Sass variables (`$iron-navy`, `$deep-sea`, `$octo-mint`) that no longer exist. The doc-update subagent left these alone because they aren't strictly about theming, but the patterns they describe now use `var(--theme-*)`. Update the docs.

9. **~95 `// MIGRATION-REVIEW:` markers across refinery** — most flag inline `color-mix()` bridges for non-canonical alpha steps. Two ways to clean up: (a) extend `_derived.scss` with the missing steps, or (b) keep the inline bridges and just remove the markers. Some markers also flag visual-QA targets (toffee disambiguation in different contexts, lilac-glow vs accent-pink) — those need eyeballs, not code changes.

10. **Non-LCARS surface tones preserved as inline hex** in some refinery components (`#0d1f35`, `#132a45`, `#0d1b2a`, `#6a6a7a`, `#7a7a8a`). These are deliberate near-bg shades distinct from the canonical surface tokens. For multi-theme support, promote to per-component tokens.

## Priority 3 — Cosmetic / DRY

Pure polish:

11. **`tokens/_semantic.scss` line 4 says "18 roles"** but the surface actually has 19. Update the comment.

12. **`styles/_index.scss` and `styles/_with-kendo.scss` duplicate four `@forward` lines.** Consider delegating `_with-kendo.scss` → `@forward "./index"` once you trust they won't diverge.

13. **`tokens/_derived.scss` could use Sass `@each` loops** for the alpha-scale section instead of explicit listings. Same compiled output, ~half the source lines.

14. **`.lcars-text-pink` class name** — defined to map to `--theme-error`, but the name describes hue not role. A theme that picks non-pink error renders the class in non-pink. Rename to `.lcars-text-error` (with a deprecation period if the class is used outside the codebase).

15. **`--designer-panel-bg`/`--designer-panel-bg-elevated` semantics** in `tokens/_designer.scss` read as if values are swapped (panel is brighter than elevated panel). Pre-existing behavior; reconsider naming or values.

16. **`base-on-surface`** in Kendo color map currently maps to `var(--theme-on-app-bg)`; could use `var(--theme-on-surface)` for semantic precision. Coincides today; relevant when light theme polishes.

## How to approach this

- **Don't try to do all of it at once.** Priorities 1 → 2 → 3, smallest commits per item.
- **Don't introduce new Sass `$variable` declarations** in component code — that's the anti-pattern the refactor exists to prevent.
- **The browser baseline is `color-mix()` in Chromium 111+, Firefox 113+, Safari 16.2+.** Use it freely.
- **For visual verification**, start refinery (`npm start` from `octo-mesh-refinery-studio/`) and use `window.__theme.setTheme('ember' | 'ocean' | 'forest' | 'lcars-light')` in DevTools.
- **Backups exist** as `feature/lcars-theme-split-{post,pre}squash-2026-04-27` in libraries and `feature/lcars-theme-split-adoption-{post,pre}squash-2026-04-27` in refinery. Delete them once you're confident.

## What's done — don't redo

The current state (after the rebase + post-rebase migration commits):

- Two-tier semantic + derived token model fully in place
- `themes/lcars-dark` and `themes/lcars-light` registered, both functional
- `_kendo-theme.scss` rewired to runtime tokens (no more `k-generate-color-variations()`)
- All `lcars-theme/` partials migrated, legacy `_palette.scss` + `_alpha-scales.scss` deleted
- Refinery's component SCSS fully migrated (~37 files, ~290+ refs)
- `TenantThemeService` shipped with 6 unit tests, exposed on `window.__theme` in dev
- Surface alpha tokens (`--theme-surface-alpha-N`, `--theme-app-bg-alpha-N`, `--theme-surface-elevated-alpha-N`) added and adopted
- `--theme-accent-violet-light` derived token added
- Inline `color-mix()` bridges collapsed to derived tokens where steps match
- 4 lcars-theme files originally missed by Phase C inventory (lcars-button/flat-btn/input, tokens/_motion) migrated
- 7 runtime-browser SCSS files originally missed by Phase C inventory migrated
- 3 refinery `.ts` files with broken Sass-in-CSS (process-designer-page, node-catalog-panel, validation-panel) fixed
- Live theme-switching verified across login flow, cockpit, tenants list, Data Mappings, AI Configuration form

If you find something not on the priority lists above that looks like it needs fixing — check spec §7a first, it's probably already documented.
