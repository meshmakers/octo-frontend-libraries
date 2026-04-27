# Semantic Token Theming — Follow-ups

**Date:** 2026-04-27
**Status:** Draft (pending implementation plan)
**Continues:** `docs/superpowers/specs/2026-04-27-semantic-token-theming-design.md`
**Scope:** Coordinated change across `octo-frontend-libraries` and `octo-frontend-refinery-studio`. Continues the existing branches (`feature/lcars-theme-split` and `feature/lcars-theme-split-adoption`). No remote pushes without explicit permission.

## 1. Background

The semantic-token theming refactor (2026-04-27 spec) shipped on `feature/lcars-theme-split` (libraries) and `feature/lcars-theme-split-adoption` (refinery), and was verified live in the browser with theme switching across login flow, cockpit, tenants list, Data Mappings, and AI Configuration. Both branches are merge-ready.

`§7a Known follow-ups` of that spec captured the polish items deferred from v1. The companion handoff document (`2026-04-27-theming-followups-prompt.md`) reorganizes those items into priority bands (P1 user-visible, P2 architectural, P3 cosmetic) with concrete file/line references and ~95 `// MIGRATION-REVIEW:` breadcrumbs left in refinery during the migration.

This spec converts that handoff into an implementation contract that an autonomous agent can execute against, with mechanical self-verification at each phase boundary. The work is **polish, not a re-architecture**: the two-tier semantic + derived token model stands; we are tightening edges.

## 2. Goals

1. Eliminate the user-visible theming gaps in P1 of the handoff:
   - Light theme is structurally functional today but has paired-contrast failures and a wrong-direction hover formula.
   - Kendo emphasis variants dropped during Phase C-F may surface as Material-purple bleed-through in widget interaction states.
   - The login-accent surface, the form surface, and the designer-text overrides do not follow theme swaps because they hold literal hex/rgba.
2. Adopt the existing `// MIGRATION-REVIEW:` breadcrumbs by promoting alpha steps that recur to named derived tokens, replacing inline `color-mix()` bridges, and deleting the markers.
3. Make the cosmetic / DRY items in P3 happen as a final polish commit (token-comment count, `_with-kendo.scss` delegation, `@each` loops, `.lcars-text-pink` rename).
4. **Hard guarantee that the theme-author API does not grow.** A future theme partial defines exactly the same set of `--theme-*` values it does today (the 19 semantic tokens documented in `octo-ui/CLAUDE.md`). Every new site-level adaptation derives from those existing tokens via `color-mix()`.
5. Each phase ends with a self-verification block the agent runs (greps + build) before handing the result to a human reviewer.

## 3. Non-Goals

- **No new theme-author API surface.** Per Goal 4. This is a hard non-goal: any change that would make a future theme partial define one extra value is rejected and the implementation finds a derivation instead.
- **No new theme** beyond retuning `lcars-light` to be visually-correct alongside `lcars-dark`.
- **No automated visual-regression infrastructure.** Verification remains manual browser walk-through plus targeted unit tests for contrast.
- **No tenant-config UI / backend persistence.** Still v2 work.
- **No Process Designer / Markdown Widget / MeshBoard structural redesign.**
- **No Monaco editor refactor.** The hex literals embedded in `data:` URI SVGs are deferred and documented as accepted limitation; sunset trigger is "the second dark theme ships".
- **No `prefers-color-scheme` auto-detection.** Adjacent to the theme system but interacts with FOUC, tenant override precedence, and startup ordering — not 5 lines.

## 4. Approach

### 4.1 Locked decisions

| # | Decision | Reason |
|---|---|---|
| F1 | **Theme-conditional hover formula** via a `derived-light` mixin scoped under `[data-theme="lcars-light"]`. Dark formulas in `tokens/_derived.scss` are unchanged. | Light theme needs hovers that darken (mix with black). Universal mix-with-white produces washed-out hovers under light. The mixin is engine code; theme authors see no new tokens. |
| F2 | **Login-accent leak fixed by rewriting the shared-auth consumer** to `color-mix(in srgb, var(--mm-login-accent) N%, transparent)`. The `--mm-login-accent-rgb` triplet token is **deleted**. | Refactoring the consumer onto an existing token shrinks the public surface (one fewer token to define) and matches the pattern used everywhere else in the migration. |
| F3 | **Monaco SVG accents stay LCARS-mint** under any theme. Documented in `octo-ui/CLAUDE.md` and §8 here. Sunset trigger: revisit when the second dark theme ships. | Three resolution paths exist (template, dynamic data: URI generation, defer); even the medium path is a real refactor with cache-invalidation pitfalls. Cost beats benefit until a real second dark theme actually exists. |
| F4 | **Missing Kendo emphasis keys** added exhaustively to `_kendo-theme.scss` runtime map, derived from existing semantic tokens via `color-mix()`. | Walking through Kendo widgets to find missing keys is human-judgment work; registering the full Kendo emphasis-key list once is mechanical. The map is engine data; theme authors see no new tokens. |
| F5 | **Alpha-step audit + promotion to named derived tokens** in `tokens/_derived.scss` for steps that occur 2+ times in refinery; one-off bridges stay inline. `// MIGRATION-REVIEW:` markers get deleted as the inline bridges are replaced. | Same compiled output; smaller component-level diffs; future-readers see named tokens, not arithmetic. |
| F6 | **Surface tones derived inline via `color-mix()`** of existing semantic tokens. **No per-component tokens are introduced.** | The earlier draft proposed `--theme-symbol-preview-bg` and similar — that would have grown the theme-author surface. Inline `color-mix(in srgb, var(--theme-app-bg), var(--theme-on-app-bg) N%)` reproduces the LCARS-dark visual today and adapts to any theme automatically. If the same formula recurs 3+ times in the codebase, *then* it gets named in `_derived.scss` (still derived, still zero theme-author work). |
| F7 | **Hard-rename `.lcars-text-pink` → `.lcars-text-error`** with a single repo-wide find-replace. | `git grep` shows the class is only defined in `octo-ui` and has no consumers in refinery (only doc references in spec/prompt files). No deprecation period needed for an internally-scoped utility class. |
| F8 | **`// VISUAL-QA:` introduced as a durable marker form** distinct from the migration-time `// MIGRATION-REVIEW:`. Visual-QA flags (toffee disambiguation, lilac-glow vs accent-pink) become VISUAL-QA comments and survive Phase 3; MIGRATION-REVIEW markers all get deleted. | Removes the risk of mass-deletion masking real visual flags. Greppable in two distinct namespaces: `MIGRATION-REVIEW` should drop to zero, `VISUAL-QA` becomes the durable list of "needs eyeballs". |
| F9 | **Single combined spec, three phases**: Engine → Sites → Polish, with a self-verification block at each phase boundary. | The phases align with the dependency direction: engine changes (alpha steps, Kendo keys, light hover, light palette retune) must land first because site-level work consumes them. Polish runs last so doc updates reflect the final state. |
| F10 | **Continue extending `feature/lcars-theme-split` and `feature/lcars-theme-split-adoption`** rather than branching. Linear history; one merge per repo. | User preference. Backups (`feature/lcars-theme-split-{post,pre}squash-2026-04-27`) remain untouched until follow-ups also land and merge. |
| F11 | **WCAG-AA contrast unit tests** added in Phase 1 to assert the contrast ratio of every registered theme's `(primary, on-primary)`, `(surface, on-surface)`, `(app-bg, on-app-bg)`, `(error, on-error)`, `(warning, on-warning)`. | Cheap (~30 lines), agent-runnable without a browser, mitigates the contrast-failure class of risk durably (catches future palette regressions, not just today's three failures). |

### 4.2 Phase 1 — Engine (libraries only)

All work in `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/`. Goal: when Phase 1 ships, the engine math is correct under both themes; sites still consume it via the existing `--theme-*` surface.

**1a. Light hover formula (F1).**
Add a new `derived-light` mixin to `tokens/_derived.scss` (or a new sibling `tokens/_derived-light.scss` forwarded from the same `tokens/_index.scss`). Mixin overrides `--theme-{role}-hover` (and `-active` if needed) for the interactive roles, mixing with **black** instead of white. Wire activation in `octo-ui/styles/_index.scss`:

```scss
:root[data-theme="lcars-light"] {
  @include octo.lcars-light;
  @include octo.derived;
  @include octo.derived-light;   // new — overrides the dark hover formula
}
```

`derived-light` is a strict override of named tokens; it does not introduce any token a theme author has to define.

**1b. Light palette retune (F11 contrast inputs).**
Modify only `themes/_lcars-light.scss`. No other file changes. Tighten:

| Pair | Today | Target | Change |
|---|---|---|---|
| `--theme-on-primary` on `--theme-primary` | white on `#4ba396` (3.01:1) | ≥ 4.5:1 | Either darken `$primary` to `~#2f7a6f`, or flip `$on-primary` to `#07172b` (~6.7:1) |
| `--theme-primary` text on `--theme-app-bg` | `#4ba396` on `#f5f7fa` (2.8:1) | ≥ 4.5:1 (3:1 AA-large) | Darken `$primary`. Cascades into `--theme-border: $primary` |
| `--theme-warning` text on white | `#b3641a` on `#fff` (4.12:1) | ≥ 4.5:1 (passes AA-large) | Darken `$warning` to `~#9a531a` |

The retune is values-only; the engine seam (`themes/_lcars-light.scss` is the only file touched here) ensures dark theme is mathematically untouched. Spec mandates this constraint as the mitigation for Risk-A in §6 — agent self-verifies via `git diff --stat` showing this is the only file touched in step 1b.

**1c. WCAG-AA contrast unit tests (F11).**
New test file under the appropriate octo-ui tests path. Reads each registered theme partial's value map (or, more simply, asserts against the runtime `getComputedStyle(documentElement)` after activating each theme). For each theme, assert:

- `contrast(primary, on-primary) ≥ 4.5`
- `contrast(secondary, on-secondary) ≥ 4.5`
- `contrast(surface, on-surface) ≥ 4.5`
- `contrast(app-bg, on-app-bg) ≥ 4.5`
- `contrast(error, on-error) ≥ 4.5`
- `contrast(warning, on-warning) ≥ 4.5`
- `contrast(success, on-success) ≥ 4.5`

The spec accepts a small, vetted helper (Karma test, no external dependency beyond a 30-line `relativeLuminance` + `contrastRatio` utility). The test runs under `npm test -- --project=@meshmakers/octo-ui --watch=false`.

**1d. Alpha-step audit + named tokens (F5, engine half).**
Mechanical script (an agent-run grep, not committed code): walk `octo-frontend-refinery-studio/src/octo-mesh-refinery-studio/` for `color-mix(in srgb, var(--theme-{role})` and tally the `N%` step values. Steps that occur **2+ times across the codebase** get named tokens added to `_derived.scss` under the existing alpha-scale section. Examples of the form:

```scss
--theme-primary-alpha-12:  color-mix(in srgb, var(--theme-primary) 12%, transparent);
--theme-primary-alpha-18:  color-mix(in srgb, var(--theme-primary) 18%, transparent);
// ...etc per role
```

The audit is the agent's first deliverable in Phase 1; the spec does not pre-enumerate the steps because the actual frequency lives in the refinery codebase and we want the agent to compute it, not guess. The committed change includes the audit table as a code comment on the alpha-scale section so a future reviewer can see why each step is there.

**1e. Kendo emphasis keys (F4).**
In `octo-ui/src/lib/lcars-theme/kendo/_kendo-theme.scss`: extend the runtime color map with the full set of Kendo emphasis keys derived from existing semantic tokens. The exhaustive Kendo key set (from Kendo's color map docs) includes:

- `{role}-emphasis`, `{role}-emphasis-subtle`, `{role}-on-base`, `{role}-on-emphasis`, `{role}-on-subtle` for each of `primary`, `secondary`, `success`, `warning`, `error`, `info`
- `series-a` … `series-f` mapped to a sensible rotation (`primary`, `secondary`, `accent-violet`, `accent-amber`, `accent-pink`, `info` is a reasonable default)
- `base-on-surface` corrected to `var(--theme-on-surface)` per F-item 16 of the prompt

Each emphasis derivation uses `color-mix()` of the corresponding base semantic token (e.g., `primary-emphasis: color-mix(in srgb, var(--theme-primary), white 15%)`). The map keys are written exhaustively, even if some are unused today, because writing data is cheaper than walking widgets to find what's missing.

**1f. Cosmetic engine touch-ups bundled with Phase 1 (F-items 11, 12, 13 of prompt).**

- `tokens/_semantic.scss` header comment: change "18 roles" → "19 roles" (matches the table in `octo-ui/CLAUDE.md`). Anchor: `git grep -n '18 roles' octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/`.
- `styles/_with-kendo.scss`: replace its four duplicated `@forward` lines with `@forward "./index";` — single source, lower drift risk.
- `tokens/_derived.scss` alpha-scale section: refactor the explicit per-role listings into Sass `@each` loops over the role list and the alpha steps. Same compiled output; ~half the source lines.

**Phase 1 self-verification block** (exit-code based; non-zero ⇒ failed):

```bash
# 1. Light retune is values-only — only _lcars-light.scss in themes/ changed by step 1b
[ -z "$(git diff --name-only feature/lcars-theme-split..HEAD -- \
    'octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/' \
    | grep -v '_lcars-light\.scss$')" ]

# 2. Contrast tests pass
npm test -- --project=@meshmakers/octo-ui --watch=false

# 3. Build succeeds (local NuGet pack runs as part of build:octo-ui)
npm run build:octo-ui

# 4. No new semantic tokens added to the public surface (only derived/alpha tokens may grow)
! git diff feature/lcars-theme-split..HEAD -- \
    'octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_semantic.scss' \
  | grep -qE '^\+\s+--theme-[a-z-]+:'

# 5. _lcars-dark.scss and _lcars-light.scss define the same set of --theme-* tokens
diff \
  <(grep -oE -- '--theme-[a-z-]+:' \
      octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/_lcars-dark.scss \
      | sort -u) \
  <(grep -oE -- '--theme-[a-z-]+:' \
      octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/_lcars-light.scss \
      | sort -u)

# 6. Kendo emphasis key count is recorded in the commit message
# (manual: agent counts keys in _kendo-theme.scss runtime map and records the count)
```

**Phase 1 deliverable:** one commit on `feature/lcars-theme-split` that bundles 1a–1f. Local NuGet pack runs as part of the commit's verification so refinery picks up the engine changes in Phase 2.

### 4.3 Phase 2 — Sites (refinery + shared-auth)

Goal: every site that holds a literal hex/rgba consumes the existing `--theme-*` surface or a derivation of it via `color-mix()`. Phase 2 ships when `git grep -nE '#[0-9a-fA-F]{6}|rgba\(' octo-frontend-refinery-studio/src/` shows only theme-author-irrelevant cases (e.g., gradient stops with `transparent`).

**2a. Login-accent refactor (F2).**
File: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/shared-auth/login-ui/src/mm-login-app-bar-section/login-app-bar-section.component.scss`. Anchor pattern: every line matching `rgba\(var\(--mm-login-accent-rgb,` (8 sites at last grep).

Rewrite each call as `color-mix(in srgb, var(--mm-login-accent) N%, transparent)`. Mapping the alpha values: `0.1 → 10%`, `0.15 → 15%`, `0.2 → 20%`, `0.3 → 30%`, `0.5 → 50%`. Keep the `--mm-login-accent` fallback chain (`var(--mm-login-accent, var(--theme-primary, …))`) intact.

Agent runs `git grep -n 'rgba(var(--mm-login-accent-rgb,'` at execution time to enumerate the live site list and rewrite each.

After the refactor:
- Delete every `--mm-login-accent-rgb:` declaration. Anchor: `git grep -n -- '--mm-login-accent-rgb:'` — at last grep this returned 2 sites in `octo-ui/src/lib/lcars-theme/chrome/_login-popup.scss` plus 2 doc references (handled separately) and 1 self-reference in the same `login-app-bar-section.component.scss` header comment.
- Update `shared-auth/docs/README.md` and `shared-auth/CLAUDE.md` to remove the `--mm-login-accent-rgb` example and replace with the `color-mix()` pattern. Anchor: `git grep -n 'mm-login-accent-rgb:' octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/shared-auth/`.

**2b. Form colors migration (F-item 4 of prompt).**
File: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/forms/_base-form.scss`. Three declarations to rewrite — anchors are the variable names (`--mm-form-bg:`, `--mm-form-bg-alt:`, `--mm-form-error:`):

```scss
// Before
--mm-form-bg: rgba(31, 46, 64, 0.6);
--mm-form-bg-alt: rgba(31, 46, 64, 0.8);
--mm-form-error: #ec658f;

// After
--mm-form-bg:     color-mix(in srgb, var(--theme-surface) 60%, transparent);
--mm-form-bg-alt: color-mix(in srgb, var(--theme-surface) 80%, transparent);
--mm-form-error:  var(--theme-error);
```

The shared-ui consumer (`shared-ui/src/lib/base-form/base-form.component.scss`) already references `var(--mm-form-*)` correctly and needs no change.

**2c. Designer text white literals (F-item 6 of prompt).**
File: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/host-overrides/_process-designer.scss`. Anchor: `git grep -nE -- '--(designer|editor)-text:\s*#ffffff' <file>` — at last grep this returned 2 sites (one for `--designer-text`, one for `--editor-text`).

```scss
// Before
--designer-text: #ffffff;
--editor-text: #ffffff;

// After
--designer-text: var(--theme-on-app-bg);
--editor-text:   var(--theme-on-app-bg);
```

**2d. Surface tones — inline color-mix derivations (F6).**

The agent enumerates the live site list at execution time via:

```bash
git grep -nE -- '#(0d1f35|132a45|0d1b2a|6a6a7a|7a7a8a|4a5568)' \
  octo-frontend-refinery-studio/src/ \
  octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/
```

(That single grep covers both repos: refinery component SCSS and the octo-ui host-override where the symbol-preview gray lives. At last grep the pattern matched in 5 refinery files and 1 octo-ui file. The maco-app working copy is out of scope.)

Each match gets replaced with a `color-mix()` derivation of existing semantic tokens. **No new tokens are introduced.** Per-hex replacement formulas the agent uses as starting points (verified to reproduce LCARS-dark within ΔE ≤ 1; if a formula doesn't, the agent iterates on the formula, never on adding a token):

| Original hex | Role | Replacement formula |
|---|---|---|
| `#132a45` | recessed background tone | `color-mix(in srgb, var(--theme-app-bg), white 4%)` |
| `#0d1f35` | recessed background tone, deeper | `color-mix(in srgb, var(--theme-app-bg), black 8%)` |
| `#0d1b2a` | near-bg tone, deeper still | `color-mix(in srgb, var(--theme-app-bg), black 6%)` |
| `#6a6a7a` | muted gray (text or accent gradient stop) | `color-mix(in srgb, var(--theme-text-secondary), var(--theme-app-bg) 30%)` |
| `#7a7a8a` | slightly lighter muted gray | `color-mix(in srgb, var(--theme-text-secondary), var(--theme-app-bg) 25%)` |
| `#4a5568` | fixed contrast bg for SVG previews | `color-mix(in srgb, var(--theme-app-bg), var(--theme-on-app-bg) 25%)` |

For each match, the agent picks the row by hex value, applies the formula, and verifies. Where a hex appears as a gradient stop (e.g., `linear-gradient(135deg, var(--theme-primary-alpha-10) 0%, #132a45 100%)`), only the literal hex is replaced — the rest of the gradient is preserved.

**Promotion rule (consistent with F6):** if the same formula is applied at **3 or more sites**, the agent adds a named derived token to `tokens/_derived.scss` and replaces the inline call sites with the named reference. Naming follows the existing convention (`--theme-app-bg-recessed` for the dark near-bg shades, `--theme-text-secondary-muted` for the gray text variants, etc.). Named or inline, the result is still a derivation of existing semantic tokens — the theme-author surface does not grow.

The agent records the chosen formula, any per-site deviation, and any token promotions in the commit message.

**2e. Alpha-step bridges → named tokens; MIGRATION-REVIEW deletion (F5, sites half).**
For each refinery site marked with `// MIGRATION-REVIEW:` whose bridge formula matches a named alpha-step token introduced in Phase 1 step 1d:

1. Replace the inline `color-mix(...)` with the named token.
2. Delete the `// MIGRATION-REVIEW:` line.

Sites whose bridge formula is one-off (the alpha step occurred only once in the audit) get the marker deleted but keep the inline `color-mix()`.

Sites whose marker flagged a **visual-QA concern** (toffee disambiguation, lilac-glow vs accent-pink — see prompt F-items 9 visual-QA flags) get rewritten as `// VISUAL-QA:` (F8) — they survive into Phase 3 for human review.

Self-check: `git grep -c MIGRATION-REVIEW octo-frontend-refinery-studio/` must return 0 after Phase 2.

**Phase 2 self-verification block** (each command uses an exit-code check; non-zero exit ⇒ verification failed):

```bash
# 1. No remaining MIGRATION-REVIEW markers
! git grep -q MIGRATION-REVIEW octo-frontend-refinery-studio/

# 2. No remaining hardcoded login RGB triplets (occurrences in spec/prompt docs are excluded by path)
! git grep -q -- '--mm-login-accent-rgb' \
    octo-frontend-libraries/src/ \
    octo-frontend-refinery-studio/src/

# 3. No remaining literal-hex form colors
! git grep -qE '#ec658f|rgba\(31, 46, 64' octo-frontend-libraries/src/

# 4. No remaining --designer-text/--editor-text white literals in lcars-theme
! git grep -qE -- '--(designer|editor)-text:\s*#ffffff' octo-frontend-libraries/src/

# 5. Refinery surface-tone hex literals replaced (VISUAL-QA flags allowed to survive)
! git grep -E '#(0d1f35|132a45|0d1b2a|6a6a7a|7a7a8a)' octo-frontend-refinery-studio/src/ | grep -v VISUAL-QA | grep .

# 6. Both repos still build
( cd octo-frontend-libraries && npm run build:octo-ui ) && \
( cd octo-frontend-refinery-studio && npm run build )
```

**Phase 2 deliverable:** one commit on `feature/lcars-theme-split` (libraries-side: 2a docs and `_login-popup.scss` deletions, 2b, 2c, the octo-ui half of 2d — i.e. the `#4a5568` symbol-preview replacement) and one commit on `feature/lcars-theme-split-adoption` (refinery-side: 2a consumer rewrite, the refinery half of 2d, 2e). The libraries commit lands first and bumps the local NuGet package; refinery picks it up.

### 4.4 Phase 3 — Polish & docs

**3a. `.lcars-text-pink` rename (F7).**
- Rename `.lcars-text-pink` → `.lcars-text-error`. Anchor: `git grep -nE 'lcars-text-pink' octo-frontend-libraries/ octo-frontend-refinery-studio/`. At last grep this returned only the class definition in `octo-ui/src/lib/lcars-theme/primitives/_utilities.scss` and a few self-references in spec/prompt files (which are docs, not consumers).
- The agent re-runs the grep at execution time and only proceeds with a hard rename if non-doc consumers are still zero. If a real consumer has appeared since this spec was written, agent stops and asks — this is exactly the "user reviews before push" guard.

**3b. Refinery CLAUDE.md updates (F-item 8 of prompt).**
The "Process Designer / Symbol Editor Canvas Theming" and "LCARS Page Layout Pattern" sections still reference dead Sass variables (`$iron-navy`, `$deep-sea`, `$octo-mint`). Update to reference the corresponding `var(--theme-*)` tokens. Other CLAUDE.md sections that already track current state are left alone.

**3c. Monaco SVG limitation documented (F3).**
Add a section to `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/CLAUDE.md` titled "Known limitation: Monaco editor SVG accents". Note: editor decoration accents (validation underlines, breadcrumb chevrons, status icons) stay LCARS-mint regardless of active theme because they are baked into `data:` URI SVGs, which CSS variables cannot reach. Sunset trigger: revisit when the second dark theme ships, or when a non-mint accent becomes a customer-visible regression. Three known resolution paths are listed for the future agent.

**3d. VISUAL-QA review (F8).**
`git grep -nE 'VISUAL-QA' octo-frontend-refinery-studio/` lists every flagged site. Agent walks the list and either:
- Fixes mechanically if the call is unambiguous (e.g., toffee → `--theme-warning` because the surrounding code is clearly status-related),
- Or leaves the comment for human review.

Agent records the count of unresolved VISUAL-QA flags in the Phase 3 commit message.

**3e. Designer naming follow-up (F-item 15 of prompt).**
`tokens/_designer.scss` has `--designer-panel-bg: var(--theme-surface-elevated)` and `--designer-panel-bg-elevated: var(--theme-surface)` — names suggest values are swapped (panel is brighter than elevated panel). Pre-existing behavior; faithful to original intent. Agent verifies via Process Designer view under both themes that the visual hierarchy looks correct, and either:
- Renames the tokens for clarity (preserves values, swaps names) — fully internal to host-overrides; no theme-author impact.
- Or leaves as-is and adds a comment explaining the deliberate inversion.

**Phase 3 self-verification block** (exit-code based; non-zero ⇒ failed):

```bash
# 1. .lcars-text-pink fully renamed (spec/prompt doc references in docs/superpowers/ are excluded by path)
! git grep -E 'lcars-text-pink' \
    octo-frontend-libraries/src/ \
    octo-frontend-refinery-studio/src/

# 2. Refinery CLAUDE.md no longer references dead Sass variables
! git grep -E -- '\$iron-navy|\$deep-sea|\$octo-mint' \
    octo-frontend-refinery-studio/ -- '*CLAUDE.md'

# 3. Monaco limitation documented
git grep -l 'Monaco editor SVG' \
    octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/CLAUDE.md

# 4. Both repos still build, all tests still pass
( cd octo-frontend-libraries && npm run build && \
  npm test -- --watch=false --browsers=ChromeHeadless )
```

**Phase 3 deliverable:** one commit per repo. Refinery commit deletes the last 0–3 VISUAL-QA flags that resolved cleanly; libraries commit handles 3a, 3c, 3e and CLAUDE.md updates.

### 4.5 Branch & cross-repo coordination

| Repo | Branch | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|---|
| `octo-frontend-libraries` | `feature/lcars-theme-split` | 1a–1f one commit; local NuGet pack at end | 2a/b/c/d-libraries one commit; local NuGet pack at end | 3a, 3c, 3e + CLAUDE.md updates one commit |
| `octo-frontend-refinery-studio` | `feature/lcars-theme-split-adoption` | none | 2a-consumer, 2d-refinery, 2e one commit | 3b, 3d one commit |

Cross-repo build sequence (carried over from the original spec §4.7): every libraries-side commit that touches octo-ui is followed by `build.ps1` (or the documented local-NuGet-pack command) before a refinery-side commit references the new behavior.

The merge-ready branches stay merge-ready throughout: each follow-up commit is additive and self-contained. If only Phase 1 and Phase 2 land before merge, Phase 3 can ship later as a focused PR.

### 4.6 Testing strategy

- **Unit tests (new):** the WCAG contrast suite from 1c. Runs in Karma headless. Detects palette regressions for any registered theme automatically.
- **Build gates:** every phase ends with `npm run build:octo-ui` + `npm test -- ... --watch=false` per the existing `octo-ui/CLAUDE.md` pre-commit checklist.
- **Manual browser walk-through:** end of Phase 2 and end of Phase 3. Same routes as the original verification (login flow, cockpit, tenants list, Data Mappings, AI Configuration form), under each registered theme via `window.__theme.setTheme(...)`. Items to specifically verify: Kendo button hover, chip selection, dropdown highlighted item, focus rings (Phase 2), light theme contrast and hover direction (Phase 1, again at Phase 2 / Phase 3), Process Designer panel layering (Phase 3 step 3e).

The agent **stops and presents to the user** at every phase-end self-verification block. Manual browser verification is a human-only step the agent does not attempt.

## 5. Verification

End-state acceptance criteria (all must be true before declaring the work done):

1. `git grep -c MIGRATION-REVIEW octo-frontend-refinery-studio/` returns 0.
2. `git grep -c VISUAL-QA octo-frontend-refinery-studio/` returns the expected residual count, recorded in the Phase 3 commit message; each surviving flag has a one-line rationale.
3. `git grep -E '\-\-mm-login-accent-rgb|--mm-form-error:\s*#|--designer-text:\s*#ffffff' octo-frontend-libraries/src/ octo-frontend-refinery-studio/src/` returns nothing.
4. WCAG contrast tests pass for every registered theme.
5. Both repos build clean under `npm run build` and pass `npm test -- --watch=false --browsers=ChromeHeadless`.
6. The set of `--theme-*` tokens declared in `themes/_lcars-dark.scss` and `themes/_lcars-light.scss` is identical and equal to the 19 documented in `octo-ui/CLAUDE.md`. (Agent self-verifies via `diff <(grep -oE '\-\-theme-[a-z-]+:' themes/_lcars-dark.scss) <(grep -oE '\-\-theme-[a-z-]+:' themes/_lcars-light.scss)` returning empty.)
7. Browser walk-through under each registered theme shows no Material-purple bleed-through in Kendo widget interaction states, no out-of-place near-bg shades under light theme, and no 3:1 paired-contrast failures.

## 6. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| **A. Light palette retune leaks into dark theme via shared formulas.** | Architectural: step 1b touches **only** `themes/_lcars-light.scss`; step 1a's `derived-light` mixin is scoped to `[data-theme="lcars-light"]`. Dark cannot regress unless the seam is broken. Agent self-verifies via `git diff --stat` after step 1b. |
| **B. Theme-author API quietly grows.** | Hard non-goal §3 + acceptance criterion §5.6. Every new "site needs a value" gets resolved via `color-mix()` of existing tokens, not by adding to `themes/_*.scss`. Spec self-review (§4.6) re-checks this before merge. |
| **C. Mass-deletion of `MIGRATION-REVIEW` markers hides real visual-QA flags.** | F8: visual-QA markers get rewritten as `// VISUAL-QA:` *before* the mass deletion, separating the namespaces. Phase 3 walks the surviving VISUAL-QA list explicitly. |
| **D. Cross-repo build sequence drift — refinery resolves to a stale `octo-ui` package and theme-engine changes don't reach it.** | Phase 1 and Phase 2 each end with a local NuGet pack on the libraries side before refinery commits land. The phase self-verification block runs the build for both repos. |
| **E. Surface-tone color-mix formulas don't visually match the original hex.** | The agent computes the formula's resolved value under LCARS-dark and asserts ΔE ≤ 1 against the original hex. If a formula misses, the agent iterates on the formula, not on adding a token. The choice is committed in the commit message. |
| **F. Kendo emphasis-key list is wrong or incomplete.** | Phase 2 manual browser walk-through specifically targets Kendo button hover, chip selection, dropdown highlighted item, focus rings (per prompt P1.2). If a key is missing, it's added in a follow-up commit; the runtime map is structured so additions are one-line each. |
| **G. WCAG contrast tests fail for tomorrow's tenant palette.** | The tests run on every commit going forward. A failing test surfaces the regression at PR time, not at customer-visit time. v2 tenant-config UI inherits the same gate. |
| **H. `.lcars-text-pink` rename misses a consumer outside the monorepo.** | Class lives in a public library; theoretically external consumers could exist. Mitigation: agent re-runs `git grep` at execution time and stops if any consumer appears. The check is mechanical and the spec's stop-and-ask is honored. |

## 7. Open Questions

None blocking. F1–F11 cover the architectural choices.

## 8. Future Work

Carried forward from the original spec §8 plus what this spec defers:

- **Tenant-config UI** for picking palettes (v2 — original spec).
- **Backend persistence** of tenant palette (v2 — original spec).
- **localStorage cache** for FOUC-free first paint (v2 — original spec).
- **`prefers-color-scheme` integration** (original spec — kept future).
- **Contrast validation on tenant-supplied palettes** beyond the registered-theme assertion in 1c.
- **Additional themes** (`themes/_forest.scss`, `themes/_corporate-x.scss`, etc.) as white-label deployments demand.
- **Theme assets beyond colors** — typography overrides per tenant, logo upload, custom icons.
- **M3-style tonal palettes** if v2 reveals demand for finer tone control.
- **Monaco SVG dynamic generation (F3 sunset).** Revisit when the second dark theme ships, or when the LCARS-mint accent becomes a customer-visible regression. Three resolution paths in §7a of the original spec.
- **Process Designer / Symbol Editor structural redesign** — separate spec when the time comes.
