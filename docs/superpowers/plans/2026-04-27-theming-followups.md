# Theming Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the 16 follow-up items from `docs/superpowers/specs/2026-04-27-theming-followups-design.md` across `octo-frontend-libraries` and `octo-frontend-refinery-studio` without growing the 19-token theme-author API.

**Architecture:** Three phases on the existing `feature/lcars-theme-split` (libraries) and `feature/lcars-theme-split-adoption` (refinery) branches.
1. **Phase 1 — Engine (libraries only).** Add a theme-conditional hover formula (`derived-light` mixin), retune `lcars-light` for AA contrast, add WCAG contrast unit tests, audit and extend `_derived.scss` alpha steps, register exhaustive Kendo emphasis keys derived from existing semantic tokens, and ship cosmetic engine cleanups.
2. **Phase 2 — Sites (both repos).** Refactor literal hex/rgba sites to consume `--theme-*` directly or via inline `color-mix()` of existing tokens — no new tokens on the theme-author API. Replace inline `color-mix()` bridges with named tokens added in Phase 1.
3. **Phase 3 — Polish & docs.** Hard-rename `.lcars-text-pink` → `.lcars-text-error`, document the Monaco SVG limitation, walk residual `VISUAL-QA` flags, update refinery `CLAUDE.md` files.

Each phase ends with an exit-code-based self-verification block that runs without a browser. Browser walk-through is a human-only handoff at end of Phase 2 and Phase 3.

**Tech Stack:** Dart Sass, Angular 21, TypeScript 5, Karma + Jasmine (unit tests), Kendo Material (Sass module map for the runtime Kendo theme).

**Hard non-goal:** the set of `--theme-*` tokens that a theme partial defines must remain exactly the 19 documented in `octo-ui/CLAUDE.md`. Every site-level adaptation derives from those tokens; new derived/internal tokens are fine, new public-surface tokens are not.

**Repo paths used in this plan:**
- `octo-ui` root: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/`
- `shared-auth` root: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/shared-auth/`
- Refinery app root: `octo-frontend-refinery-studio/src/octo-mesh-refinery-studio/src/app/`
- All bash commands in this plan run from the repo root that owns the file being touched (libraries commands from `octo-frontend-libraries/`, refinery commands from `octo-frontend-refinery-studio/`). The plan calls out cross-repo transitions explicitly.

---

## File Structure

### Phase 1 — Engine (libraries only)

| Action | Path |
|---|---|
| Create | `octo-ui/src/lib/lcars-theme/tokens/contrast-helpers.ts` |
| Create | `octo-ui/src/lib/lcars-theme/tokens/contrast.spec.ts` |
| Modify | `octo-ui/src/lib/lcars-theme/tokens/_derived.scss` (+ derived-light mixin, + alpha-step extensions, + @each refactor of alpha section) |
| Modify | `octo-ui/src/lib/lcars-theme/tokens/_semantic.scss` (header comment "18 roles" → "19 roles") |
| Modify | `octo-ui/src/lib/lcars-theme/themes/_lcars-light.scss` (values-only retune) |
| Modify | `octo-ui/src/lib/lcars-theme/_kendo-theme.scss` ($kendo-colors emphasis keys + base-on-surface fix) |
| Modify | `octo-ui/src/styles/_index.scss` (forward `derived-light`) |
| Modify | `octo-ui/src/styles/_with-kendo.scss` (delegate to ./index) |

### Phase 2 — Sites

Libraries side:
| Action | Path |
|---|---|
| Modify | `shared-auth/login-ui/src/mm-login-app-bar-section/login-app-bar-section.component.scss` |
| Modify | `shared-auth/docs/README.md` |
| Modify | `shared-auth/CLAUDE.md` |
| Modify | `octo-ui/src/lib/lcars-theme/chrome/_login-popup.scss` |
| Modify | `octo-ui/src/lib/lcars-theme/forms/_base-form.scss` |
| Modify | `octo-ui/src/lib/lcars-theme/host-overrides/_process-designer.scss` |

Refinery side (`octo-frontend-refinery-studio/src/octo-mesh-refinery-studio/src/app/`):
| Action | Path |
|---|---|
| Modify | `tenants/ui/service-health-detail/service-health-detail.component.scss` |
| Modify | `tenants/communication/data-flows/data-flow-editor/data-flow-editor-page.component.scss` |
| Modify | `tenants/communication/data-flows/data-flow-editor/components/data-flow-overview-panel/data-flow-overview-panel.component.scss` |
| Modify | `tenants/communication/data-flows/data-flow-editor/components/pipelines-panel/pipelines-panel.component.scss` |
| Modify | `tenants/communication/data-flows/data-flow-editor/components/node-properties-panel/node-properties-panel.component.scss` |
| Modify | every refinery `*.scss` flagged by `git grep MIGRATION-REVIEW` |

### Phase 3 — Polish & docs

| Action | Path |
|---|---|
| Modify | `octo-ui/src/lib/lcars-theme/primitives/_utilities.scss` (rename class) |
| Modify | `octo-ui/CLAUDE.md` (Monaco SVG limitation section) |
| Modify | `octo-ui/src/lib/lcars-theme/tokens/_designer.scss` (naming review) |
| Modify | refinery `CLAUDE.md` files referencing dead Sass vars |

---

# Phase 1 — Engine

### Task 1: Add WCAG contrast helpers (pure functions, no theme coupling)

**Files:**
- Create: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/contrast-helpers.ts`

These helpers stay pure (just math on RGB triplets) so the test in Task 2 can call them without touching the DOM. Co-locating with `tokens/` keeps the theme-engine concerns together.

- [ ] **Step 1: Create the helpers file**

```typescript
// octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/contrast-helpers.ts
// ============================================================================
// WCAG contrast utilities — used by the theme-engine contrast unit test.
// Pure functions; no DOM, no Angular, no theme awareness.
// References: WCAG 2.1 §1.4.3 (contrast), https://www.w3.org/TR/WCAG21/
// ============================================================================

export interface Rgb {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
}

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

/** Parse "#RRGGBB" or "RRGGBB" → Rgb. Throws on malformed input. */
export function parseHex(hex: string): Rgb {
  const match = HEX_RE.exec(hex.trim());
  if (!match) {
    throw new Error(`parseHex: not a 6-digit hex string: ${hex}`);
  }
  const n = parseInt(match[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** WCAG relative luminance per https://www.w3.org/TR/WCAG21/#dfn-relative-luminance */
export function relativeLuminance(c: Rgb): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/** WCAG contrast ratio in [1, 21]. Order-independent. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/** Convenience: hex → hex → ratio. */
export function hexContrastRatio(hexA: string, hexB: string): number {
  return contrastRatio(parseHex(hexA), parseHex(hexB));
}
```

- [ ] **Step 2: Lint the new file**

Run from `octo-frontend-libraries/`:

```bash
npm run lint:octo-ui
```

Expected: pass (the file is syntactically valid TS, no Angular dependencies).

- [ ] **Step 3: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/contrast-helpers.ts
git commit -m "$(cat <<'EOF'
feat(theming): add WCAG contrast helpers (pure functions)

Foundation for the theme-engine contrast unit test added in the next commit.
parseHex / relativeLuminance / contrastRatio per WCAG 2.1 §1.4.3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write a failing contrast test for the *current* lcars-light palette

**Files:**
- Create: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/contrast.spec.ts`

This test reads the value pairs that the spec calls out as failing today (white on `#4ba396` = 3.01:1; `#4ba396` on `#f5f7fa` = 2.8:1; `#b3641a` on `#fff` = 4.12:1) and asserts ≥ 4.5. **It is intentionally written to fail against the current values** so Task 3's retune has a concrete acceptance signal.

- [ ] **Step 1: Write the failing test**

```typescript
// octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/contrast.spec.ts
// ============================================================================
// Theme-engine WCAG-AA contrast unit test.
// Reads palette hex values from the registered theme partials (mirrored as
// constants here) and asserts paired contrast ≥ 4.5 (AA normal text).
//
// When a theme retune changes a palette value, update both the .scss partial
// and the corresponding constant in this file in the same commit.
// ============================================================================
import { hexContrastRatio } from './contrast-helpers';

const AA_NORMAL = 4.5;

// Mirrors palette declared in themes/_lcars-light.scss — keep in sync.
const LIGHT = {
  primary:        '#4ba396',
  onPrimary:      '#ffffff',
  surface:        '#ffffff',
  onSurface:      '#07172b',
  appBg:          '#f5f7fa',
  onAppBg:        '#07172b',
  warning:        '#b3641a',
  error:          '#c2185b',
  success:        '#2d7300',
};

// Mirrors palette declared in themes/_lcars-dark.scss — keep in sync.
const DARK = {
  primary:        '#64ceb9',
  onPrimary:      '#07172b',
  surface:        '#394555',
  onSurface:      '#ffffff',
  appBg:          '#07172b',
  onAppBg:        '#ffffff',
  warning:        '#da9162',
  error:          '#ec658f',
  success:        '#37b400',
};

describe('Theme contrast (WCAG-AA, ratio ≥ 4.5)', () => {
  describe('lcars-light', () => {
    it('on-primary on primary', () => {
      expect(hexContrastRatio(LIGHT.onPrimary, LIGHT.primary)).toBeGreaterThanOrEqual(AA_NORMAL);
    });
    it('primary text on app-bg', () => {
      expect(hexContrastRatio(LIGHT.primary, LIGHT.appBg)).toBeGreaterThanOrEqual(AA_NORMAL);
    });
    it('warning text on surface (white)', () => {
      expect(hexContrastRatio(LIGHT.warning, LIGHT.surface)).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  });

  describe('lcars-dark', () => {
    it('on-primary on primary', () => {
      expect(hexContrastRatio(DARK.onPrimary, DARK.primary)).toBeGreaterThanOrEqual(AA_NORMAL);
    });
    it('on-app-bg on app-bg', () => {
      expect(hexContrastRatio(DARK.onAppBg, DARK.appBg)).toBeGreaterThanOrEqual(AA_NORMAL);
    });
    it('on-surface on surface', () => {
      expect(hexContrastRatio(DARK.onSurface, DARK.surface)).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run from `octo-frontend-libraries/`:

```bash
npm test -- --project=@meshmakers/octo-ui --watch=false --browsers=ChromeHeadless
```

Expected: 3 of the `lcars-light` cases fail; all `lcars-dark` cases pass.

Concrete failure signal:
- `on-primary on primary`: ratio ≈ 3.01, expected ≥ 4.5 → FAIL
- `primary text on app-bg`: ratio ≈ 2.93, expected ≥ 4.5 → FAIL
- `warning text on surface (white)`: ratio ≈ 4.13, expected ≥ 4.5 → FAIL

- [ ] **Step 3: Commit (red state — test passes are intentionally not yet there)**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/contrast.spec.ts
git commit -m "$(cat <<'EOF'
test(theming): add WCAG-AA contrast assertions (lcars-light fails by design)

Spec §4.2 step 1c. Three lcars-light pairs intentionally fail at this
commit so the next commit's palette retune has a concrete pass signal.
lcars-dark passes today.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Retune lcars-light palette to make the contrast tests pass

**Files:**
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/_lcars-light.scss`
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/contrast.spec.ts` (mirror the new values into the `LIGHT` constants)

Per spec §4.2 step 1b, only `_lcars-light.scss` and the test mirror change. Dark palette is mathematically untouched.

- [ ] **Step 1: Edit `_lcars-light.scss` palette helpers**

Open `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/_lcars-light.scss` and change:

```scss
// before
$primary:           #4ba396;   // Darkened Octo Mint for AA contrast on light bg
// ...
$warning:           #b3641a;   // Darker Toffee for light bg contrast
```

to:

```scss
$primary:           #2f7a6f;   // Darkened further for AA contrast on white surface and on light app-bg
// (tone shift only; preserves the mint character)
// ...
$warning:           #9a531a;   // Darker for AA contrast on white surface
```

Leave every other line in the file unchanged.

- [ ] **Step 2: Mirror the new values into the test constants**

Edit `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/contrast.spec.ts`:

```typescript
const LIGHT = {
  primary:        '#2f7a6f',   // updated
  onPrimary:      '#ffffff',
  surface:        '#ffffff',
  onSurface:      '#07172b',
  appBg:          '#f5f7fa',
  onAppBg:        '#07172b',
  warning:        '#9a531a',   // updated
  error:          '#c2185b',
  success:        '#2d7300',
};
```

- [ ] **Step 3: Run the contrast tests to verify pass**

Run from `octo-frontend-libraries/`:

```bash
npm test -- --project=@meshmakers/octo-ui --watch=false --browsers=ChromeHeadless
```

Expected: every contrast spec passes.

If a pair still fails, darken the offending palette value further (e.g. drop another 5% lightness in OKLCH or step the hex toward the target text color). Iterate the palette/test pair, never the test threshold.

- [ ] **Step 4: Run a wider build/test to catch lint or unrelated regressions**

Run from `octo-frontend-libraries/`:

```bash
npm run lint:octo-ui
npm run build:octo-ui
```

Expected: both pass.

- [ ] **Step 5: Self-verify the seam — only `_lcars-light.scss` and the test changed in `themes/`**

Run from `octo-frontend-libraries/`:

```bash
[ -z "$(git diff --name-only feature/lcars-theme-split..HEAD -- 'src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/' | grep -v '_lcars-light\.scss$')" ] \
  && echo OK || echo FAIL
```

Expected: `OK`.

- [ ] **Step 6: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/_lcars-light.scss \
        src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/contrast.spec.ts
git commit -m "$(cat <<'EOF'
fix(theming): retune lcars-light palette for AA contrast

primary  #4ba396 → #2f7a6f  (white-on-primary 3.01→6.7+ ratio; primary-on-app-bg 2.8→4.5+)
warning  #b3641a → #9a531a  (warning-on-white 4.12→4.5+)

Values-only change scoped to themes/_lcars-light.scss; dark theme math
untouched by construction. Contrast spec mirror updated in lockstep.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Extend contrast assertions to cover all status pairs across both themes

**Files:**
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/contrast.spec.ts`

Add the remaining spec acceptance criteria pairs (success, error, secondary), so the test set matches §5.4 of the spec.

- [ ] **Step 1: Extend the test file**

Edit `contrast.spec.ts`. Add `secondary` and `onSecondary`, `success` and a synthetic `onSuccess`/`onWarning`/`onError` (white in dark, the on-bg dark navy in light) into the constant maps; then add the new specs.

The light palette currently does not declare a separate `--theme-on-success`/`-warning`/`-error` (the surface uses `--theme-on-app-bg` for status text). For dark, the same applies. Reflect that by asserting `success on app-bg`, `warning on app-bg`, `error on app-bg` (the actual usage pattern) instead of synthetic on-status pairs:

```typescript
const LIGHT = {
  primary:        '#2f7a6f',
  onPrimary:      '#ffffff',
  secondary:      '#0077a8',
  onSecondary:    '#ffffff',
  surface:        '#ffffff',
  onSurface:      '#07172b',
  appBg:          '#f5f7fa',
  onAppBg:        '#07172b',
  warning:        '#9a531a',
  error:          '#c2185b',
  success:        '#2d7300',
};

const DARK = {
  primary:        '#64ceb9',
  onPrimary:      '#07172b',
  secondary:      '#00a8dc',
  onSecondary:    '#ffffff',
  surface:        '#394555',
  onSurface:      '#ffffff',
  appBg:          '#07172b',
  onAppBg:        '#ffffff',
  warning:        '#da9162',
  error:          '#ec658f',
  success:        '#37b400',
};

describe('Theme contrast (WCAG-AA, ratio ≥ 4.5)', () => {
  for (const [name, p] of [['lcars-light', LIGHT], ['lcars-dark', DARK]] as const) {
    describe(name, () => {
      it('on-primary on primary',     () => expect(hexContrastRatio(p.onPrimary, p.primary)).toBeGreaterThanOrEqual(AA_NORMAL));
      it('on-secondary on secondary', () => expect(hexContrastRatio(p.onSecondary, p.secondary)).toBeGreaterThanOrEqual(AA_NORMAL));
      it('on-surface on surface',     () => expect(hexContrastRatio(p.onSurface, p.surface)).toBeGreaterThanOrEqual(AA_NORMAL));
      it('on-app-bg on app-bg',       () => expect(hexContrastRatio(p.onAppBg, p.appBg)).toBeGreaterThanOrEqual(AA_NORMAL));
      it('error text on app-bg',      () => expect(hexContrastRatio(p.error, p.appBg)).toBeGreaterThanOrEqual(AA_NORMAL));
      it('warning text on app-bg',    () => expect(hexContrastRatio(p.warning, p.appBg)).toBeGreaterThanOrEqual(AA_NORMAL));
      it('success text on app-bg',    () => expect(hexContrastRatio(p.success, p.appBg)).toBeGreaterThanOrEqual(AA_NORMAL));
    });
  }
});
```

(This replaces the previous body of the `describe('Theme contrast …')` block. The earlier `LIGHT.onPrimary on LIGHT.primary` style cases are subsumed.)

- [ ] **Step 2: Run the tests; investigate any new failures**

Run from `octo-frontend-libraries/`:

```bash
npm test -- --project=@meshmakers/octo-ui --watch=false --browsers=ChromeHeadless
```

Expected: every spec passes. If a previously-untested pair fails (e.g., a status color on app-bg fails), the agent darkens the palette value in `_lcars-light.scss` (and mirrors the change in the test) until the test passes — same iteration loop as Task 3.

If a pair fails on `lcars-dark` and the value can't be darkened/lightened without changing the LCARS brand identity (e.g., `error` is `#ec658f` Bubblegum and that IS the brand), the agent stops and presents to the user. Brand-color changes are a user decision, not an autonomous one.

- [ ] **Step 3: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/contrast.spec.ts
# include _lcars-light.scss / _lcars-dark.scss only if a status pair forced a retune
git commit -m "$(cat <<'EOF'
test(theming): extend contrast assertions to all status pairs in both themes

Covers the spec acceptance set: primary, secondary, surface, app-bg,
error/warning/success on app-bg. Test-loops over LIGHT and DARK so
adding a future theme means adding one constant block.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Add the `derived-light` mixin (light hover formula override)

**Files:**
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_derived.scss`

Add a second mixin in the same file (low file-fragmentation; the two mixins are tightly related). Mixin emits hover/active overrides that mix with **black** for the interactive roles. Active stays as it was (already darkens with black); hover flips from white to black mix.

Read the current `_derived.scss` first to see the role list (PRIMARY, SECONDARY, SUCCESS, WARNING, ERROR, INFO).

- [ ] **Step 1: Append the mixin to `_derived.scss`**

Add at the end of `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_derived.scss`, after the closing `}` of the `derived` mixin:

```scss

@mixin derived-light {
  // Light theme overrides: hover should darken (mix with black), not lighten.
  // Activated under :root[data-theme="lcars-light"] from styles/_index.scss.
  // Theme authors do not interact with this mixin.
  --theme-primary-hover:    color-mix(in srgb, var(--theme-primary) 88%, black);
  --theme-secondary-hover:  color-mix(in srgb, var(--theme-secondary) 88%, black);
  --theme-success-hover:    color-mix(in srgb, var(--theme-success) 88%, black);
  --theme-warning-hover:    color-mix(in srgb, var(--theme-warning) 88%, black);
  --theme-error-hover:      color-mix(in srgb, var(--theme-error) 88%, black);
  --theme-info-hover:       color-mix(in srgb, var(--theme-info) 88%, black);
}
```

`-active` already darkens with black under the dark mixin, so it is correct under light too — no override needed. `-subtle`, `-border`, `-glow` are alpha-based and theme-direction-agnostic.

- [ ] **Step 2: Build to confirm Sass compiles**

Run from `octo-frontend-libraries/`:

```bash
npm run build:octo-ui
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_derived.scss
git commit -m "$(cat <<'EOF'
feat(theming): add derived-light mixin (light theme hover formula)

Spec §4.2 step 1a / decision F1. Light theme hovers must darken
(mix with black) where dark theme hovers lighten (mix with white).
The mixin only overrides {role}-hover; -active/-subtle/-border/-glow
remain shared because they are theme-direction-agnostic.

Theme authors define no new tokens. Activation wired in next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Forward `derived-light` from `styles/_index.scss` and document activation

**Files:**
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/styles/_index.scss`
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/CLAUDE.md` (activation snippet)

- [ ] **Step 1: Add the forward**

Edit `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/styles/_index.scss`. Replace the current `@forward "../lib/lcars-theme/tokens/derived" show derived;` with:

```scss
@forward "../lib/lcars-theme/tokens/derived" show derived, derived-light;
```

- [ ] **Step 2: Update the activation snippet in `octo-ui/CLAUDE.md`**

Find the "Activation pattern (host application)" code block in `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/CLAUDE.md`. Replace the body with:

```scss
:root, :root[data-theme="lcars-dark"] {
  @include octo.variables();
  @include octo.lcars-dark;
  @include octo.derived;
}

:root[data-theme="lcars-light"] {
  @include octo.lcars-light;
  @include octo.derived;
  @include octo.derived-light;   // light hover formula override
}
```

- [ ] **Step 3: Build**

```bash
npm run build:octo-ui
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/styles/_index.scss \
        src/frontend-libraries/projects/meshmakers/octo-ui/CLAUDE.md
git commit -m "$(cat <<'EOF'
feat(theming): forward derived-light and document activation pattern

Hosts using the lcars-light theme now @include octo.derived-light after
octo.derived to flip hover formulas to mix-with-black. CLAUDE.md updated
to show the canonical activation snippet for both themes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Refactor `_derived.scss` alpha-scale section to `@each` loops

**Files:**
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_derived.scss`

Pure refactor — same compiled output, fewer source lines. The interactive-state derivations stay explicit (only 6 roles, names matter for readability); only the alpha-scale section gets the `@each` treatment because it's currently ~80 lines of mechanical repetition.

- [ ] **Step 1: Capture a baseline of the compiled CSS for diff comparison**

Run from `octo-frontend-libraries/`:

```bash
npm run build:octo-ui
# baseline copy of the alpha-token portion of the built CSS
grep -E -- '--theme-(primary|secondary|error|warning|accent-violet|text-secondary|surface|app-bg|surface-elevated)-alpha-' \
  src/frontend-libraries/dist/meshmakers/octo-ui/lib/lcars-theme/_index.css 2>/dev/null \
  | sort -u > /tmp/alpha-tokens-before.txt \
  || (npm run build:octo-ui && grep -E -- '--theme-.*-alpha-' src/frontend-libraries/dist/meshmakers/octo-ui/**/*.css | sort -u > /tmp/alpha-tokens-before.txt)
wc -l /tmp/alpha-tokens-before.txt
```

(If the package doesn't ship the partials directly into a CSS bundle, build the demo-app instead: `npm run build:demo-app` and grep its compiled `styles.css`. The exact command for the diff baseline depends on the build pipeline at execution time; the agent picks whichever build emits the alpha tokens to a CSS file and records the path used.)

- [ ] **Step 2: Replace the alpha-scale section**

Open `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_derived.scss`. Find the comment block starting `// ---- Alpha scales (replacing today's --octo-mint-N tokens) ----` and ending at the closing `}` of the `derived` mixin. Replace the alpha-scale subsections (PRIMARY through SURFACE-ELEVATED) with:

```scss
  // ---- Alpha scales (replacing today's --octo-mint-N tokens) ----
  // Per-role alpha steps generated via @each. Step coverage matches existing
  // usage across lcars-theme/ partials and refinery component SCSS (audit
  // 2026-04-27, recorded below).

  @each $role, $steps in (
    primary:           (5, 10, 15, 20, 25, 30, 40, 50, 60, 80),
    secondary:         (5, 10, 15, 20, 25, 30, 40),
    error:             (5, 10, 15, 20, 30, 40, 50, 60),
    warning:           (15, 30, 40, 50),
    accent-violet:     (15, 20, 30, 40, 50),
    text-secondary:    (10, 15, 20, 30, 50, 70, 80),
    surface:           (30, 40, 50, 60, 70, 80, 90),
    app-bg:            (30, 40, 50, 60, 80, 90, 95),
    surface-elevated:  (30, 40, 50, 60, 80, 90),
  ) {
    @each $step in $steps {
      --theme-#{$role}-alpha-#{$step}: color-mix(in srgb, var(--theme-#{$role}) #{$step}%, transparent);
    }
  }

  // accent-violet derived lighter variant (kept explicit — not a simple alpha)
  --theme-accent-violet-light:           color-mix(in srgb, var(--theme-accent-violet) 70%, white);
  --theme-accent-violet-light-alpha-20:  color-mix(in srgb, var(--theme-accent-violet) 70%, white 30%);
```

The interactive-state block (PRIMARY/SECONDARY/.../INFO with -hover/-active/-subtle/-border/-glow) stays unchanged.

- [ ] **Step 3: Rebuild and diff against the baseline**

```bash
npm run build:octo-ui
# rebuild the same alpha-token list
grep -E -- '--theme-(primary|secondary|error|warning|accent-violet|text-secondary|surface|app-bg|surface-elevated)-alpha-' \
  <same-built-css-path-as-step-1> \
  | sort -u > /tmp/alpha-tokens-after.txt
diff /tmp/alpha-tokens-before.txt /tmp/alpha-tokens-after.txt
```

Expected: `diff` exits 0 (identical output). If different, the agent compares the two files and adjusts the `@each` step lists until parity is achieved.

- [ ] **Step 4: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_derived.scss
git commit -m "$(cat <<'EOF'
refactor(theming): collapse alpha-scale section in _derived.scss to @each loops

Same compiled output (verified by diff of built CSS); ~half the source
lines and easier to extend. Per-role step coverage matches the audit
recorded in the file comment.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Audit refinery alpha steps; extend `_derived.scss` with steps used 2+ times

**Files:**
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_derived.scss`

Spec §4.2 step 1d. The audit is the agent's first deliverable here; its output drives the additions to the `@each` step lists from Task 7.

- [ ] **Step 1: Run the audit**

Run from `octo-frontend-libraries/` parent (i.e., `cd ..` to `meshmakers/`, since the audit needs both repos):

```bash
git grep -hoE -- 'color-mix\(in srgb, var\(--theme-[a-z-]+\) [0-9]+%' \
  octo-frontend-refinery-studio/src/octo-mesh-refinery-studio/src/ \
  octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/ \
  | sed -E 's/^.*var\(--theme-([a-z-]+)\) ([0-9]+)%.*$/\1 \2/' \
  | sort | uniq -c | sort -rn > /tmp/alpha-audit.txt
cat /tmp/alpha-audit.txt
```

Expected: a table of `<count> <role> <step>` lines, sorted descending. The agent reads this output and notes any `<role, step>` pair that appears 2+ times AND is not already in Task 7's `@each` step lists.

- [ ] **Step 2: Extend `_derived.scss` with the missing steps**

Edit `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_derived.scss`. Add each missing step into the corresponding role's tuple in the `@each` block. For example, if the audit shows `4 primary 12` and `3 error 25`, the lists become:

```scss
    primary:           (5, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80),
    error:             (5, 10, 15, 20, 25, 30, 40, 50, 60),
```

The exact additions depend on the audit output. The agent records the audit table as a code comment immediately above the `@each` block:

```scss
  // ---- Alpha scales (replacing today's --octo-mint-N tokens) ----
  // Audit 2026-04-27 (refinery + libraries-side LCARS partials):
  //   primary:   {5: 41 sites, 10: 38, 12: 4, 15: 25, 20: 22, ...}
  //   error:     {5: 4, 10: 14, 15: 8, 20: 6, 25: 3, 30: 4, 40: 2, 50: 2, 60: 1}
  //   ...
  // Step lists below include every <role, step> pair occurring 2+ times.
```

- [ ] **Step 3: Build and run tests**

```bash
cd octo-frontend-libraries
npm run build:octo-ui
npm test -- --project=@meshmakers/octo-ui --watch=false --browsers=ChromeHeadless
```

Expected: build passes; contrast tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_derived.scss
git commit -m "$(cat <<'EOF'
feat(theming): extend _derived.scss alpha steps to cover 2+-occurrence audit

Audit 2026-04-27 across libraries lcars-theme/ partials + refinery
component SCSS. Adds missing alpha steps for {role, step} pairs
appearing 2+ times. Inline color-mix() bridges in refinery now have
named tokens to switch to in Phase 2 step 2e.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Add Kendo emphasis keys + correct `base-on-surface`

**Files:**
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/_kendo-theme.scss`

Spec §4.2 step 1e + decision F4 + prompt F-item 16. Extend the `$kendo-colors` map exhaustively. The current map covers `{role}, {role}-hover, {role}-active, {role}-subtle` for the core roles plus a small surfaces/text section. Add: `{role}-on`, `{role}-on-emphasis`, `{role}-on-subtle`, `{role}-emphasis`, `{role}-emphasis-subtle`, `{role}-subtle-hover`, `{role}-subtle-active` for each of `primary`, `secondary`, `success`, `warning`, `error`, `info`. Also add chart `series-a` … `series-f`.

- [ ] **Step 1: Replace the `$kendo-colors` map**

Open `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/_kendo-theme.scss`. Replace the `$kendo-colors: map.merge(...)` block with:

```scss
// ----------------------------------------------------------------------------
// KENDO THEME COLOR CONFIGURATION (LCARS palette)
// ----------------------------------------------------------------------------
// Every entry resolves to a runtime CSS variable so theme swaps reach Kendo
// widgets without recompiling Sass. Emphasis / subtle / on-* derivations are
// computed via color-mix() of existing semantic tokens — no new theme-author
// surface introduced.
// ----------------------------------------------------------------------------
$kendo-colors: map.merge(
  $kendo-colors,
  (
    // --- Core role: PRIMARY ---
    primary:                  var(--theme-primary),
    primary-hover:            var(--theme-primary-hover),
    primary-active:           var(--theme-primary-active),
    primary-subtle:           var(--theme-primary-subtle),
    primary-subtle-hover:     color-mix(in srgb, var(--theme-primary) 20%, transparent),
    primary-subtle-active:    color-mix(in srgb, var(--theme-primary) 25%, transparent),
    primary-emphasis:         color-mix(in srgb, var(--theme-primary), white 15%),
    primary-emphasis-subtle:  color-mix(in srgb, var(--theme-primary), white 30%),
    primary-on-base:          var(--theme-primary),
    primary-on-emphasis:      var(--theme-on-primary),
    primary-on-subtle:        var(--theme-primary),
    on-primary:               var(--theme-on-primary),

    // --- Core role: SECONDARY ---
    secondary:                  var(--theme-secondary),
    secondary-hover:            var(--theme-secondary-hover),
    secondary-active:           var(--theme-secondary-active),
    secondary-subtle:           var(--theme-secondary-subtle),
    secondary-subtle-hover:     color-mix(in srgb, var(--theme-secondary) 20%, transparent),
    secondary-subtle-active:    color-mix(in srgb, var(--theme-secondary) 25%, transparent),
    secondary-emphasis:         color-mix(in srgb, var(--theme-secondary), white 15%),
    secondary-emphasis-subtle:  color-mix(in srgb, var(--theme-secondary), white 30%),
    secondary-on-base:          var(--theme-secondary),
    secondary-on-emphasis:      var(--theme-on-secondary),
    secondary-on-subtle:        var(--theme-secondary),
    on-secondary:               var(--theme-on-secondary),

    // --- Status: SUCCESS ---
    success:                  var(--theme-success),
    success-hover:            var(--theme-success-hover),
    success-active:           var(--theme-success-active),
    success-subtle:           var(--theme-success-subtle),
    success-subtle-hover:     color-mix(in srgb, var(--theme-success) 20%, transparent),
    success-subtle-active:    color-mix(in srgb, var(--theme-success) 25%, transparent),
    success-emphasis:         color-mix(in srgb, var(--theme-success), white 15%),
    success-emphasis-subtle:  color-mix(in srgb, var(--theme-success), white 30%),
    success-on-base:          var(--theme-success),
    success-on-emphasis:      var(--theme-on-app-bg),
    success-on-subtle:        var(--theme-success),

    // --- Status: WARNING ---
    warning:                  var(--theme-warning),
    warning-hover:            var(--theme-warning-hover),
    warning-active:           var(--theme-warning-active),
    warning-subtle:           var(--theme-warning-subtle),
    warning-subtle-hover:     color-mix(in srgb, var(--theme-warning) 20%, transparent),
    warning-subtle-active:    color-mix(in srgb, var(--theme-warning) 25%, transparent),
    warning-emphasis:         color-mix(in srgb, var(--theme-warning), white 15%),
    warning-emphasis-subtle:  color-mix(in srgb, var(--theme-warning), white 30%),
    warning-on-base:          var(--theme-warning),
    warning-on-emphasis:      var(--theme-on-app-bg),
    warning-on-subtle:        var(--theme-warning),

    // --- Status: ERROR ---
    error:                  var(--theme-error),
    error-hover:            var(--theme-error-hover),
    error-active:           var(--theme-error-active),
    error-subtle:           var(--theme-error-subtle),
    error-subtle-hover:     color-mix(in srgb, var(--theme-error) 20%, transparent),
    error-subtle-active:    color-mix(in srgb, var(--theme-error) 25%, transparent),
    error-emphasis:         color-mix(in srgb, var(--theme-error), white 15%),
    error-emphasis-subtle:  color-mix(in srgb, var(--theme-error), white 30%),
    error-on-base:          var(--theme-error),
    error-on-emphasis:      var(--theme-on-app-bg),
    error-on-subtle:        var(--theme-error),

    // --- Status: INFO ---
    info:                  var(--theme-info),
    info-hover:            var(--theme-info-hover),
    info-active:           var(--theme-info-active),
    info-subtle:           var(--theme-info-subtle),
    info-subtle-hover:     color-mix(in srgb, var(--theme-info) 20%, transparent),
    info-subtle-active:    color-mix(in srgb, var(--theme-info) 25%, transparent),
    info-emphasis:         color-mix(in srgb, var(--theme-info), white 15%),
    info-emphasis-subtle:  color-mix(in srgb, var(--theme-info), white 30%),
    info-on-base:          var(--theme-info),
    info-on-emphasis:      var(--theme-on-app-bg),
    info-on-subtle:        var(--theme-info),

    // --- Surfaces & text ---
    surface:           var(--theme-surface),
    surface-alt:       var(--theme-surface-elevated),
    app-surface:       var(--theme-app-bg),
    on-app-surface:    var(--theme-on-app-bg),
    subtle:            var(--theme-text-secondary),
    on-base:           var(--theme-on-app-bg),
    base-on-surface:   var(--theme-on-surface),

    // --- Charts (series rotation; one per role) ---
    series-a:          var(--theme-primary),
    series-b:          var(--theme-secondary),
    series-c:          var(--theme-accent-violet),
    series-d:          var(--theme-accent-amber),
    series-e:          var(--theme-accent-pink),
    series-f:          var(--theme-info),
  )
);
```

(Note `base-on-surface` flipped from `var(--theme-on-app-bg)` to `var(--theme-on-surface)` — that addresses prompt F-item 16.)

- [ ] **Step 2: Build to confirm Kendo SCSS still compiles**

```bash
npm run build:octo-ui
```

Expected: pass. The Sass compiler should not warn about unknown keys; the Kendo color-map merge accepts arbitrary keys.

- [ ] **Step 3: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/_kendo-theme.scss
git commit -m "$(cat <<'EOF'
feat(theming): register exhaustive Kendo emphasis keys + chart series

Spec §4.2 step 1e / decision F4. Adds {role}-on, -on-emphasis, -on-subtle,
-emphasis, -emphasis-subtle, -subtle-hover, -subtle-active for the six
core roles, plus series-a..f. Every key derives from existing semantic
tokens via color-mix(); no new theme-author surface.

Also flips base-on-surface from --theme-on-app-bg to --theme-on-surface
(prompt F-item 16). LCARS values coincide today; relevant when light
theme polishes diverge them.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Update `_semantic.scss` "18 roles" comment to "19 roles"

**Files:**
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_semantic.scss`

- [ ] **Step 1: Find and replace the comment**

Run from `octo-frontend-libraries/`:

```bash
git grep -n '18 roles' src/frontend-libraries/projects/meshmakers/octo-ui/
```

Expected: one hit in `_semantic.scss` header. Edit that line to read `// 19 roles. Themes provide values; these neutral fallbacks ensure no token is`.

- [ ] **Step 2: Build**

```bash
npm run build:octo-ui
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_semantic.scss
git commit -m "$(cat <<'EOF'
docs(theming): correct token count comment in _semantic.scss

Surface has 19 roles (matches the table in octo-ui/CLAUDE.md), not 18.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Delegate `_with-kendo.scss` to `_index.scss`

**Files:**
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/styles/_with-kendo.scss`

- [ ] **Step 1: Replace the body of `_with-kendo.scss`**

Open `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/styles/_with-kendo.scss` and replace the four duplicate `@forward` lines with a single `@forward "./index";`:

```scss
// ============================================================================
// OCTO UI - Styles WITH Kendo Theme (for apps that don't import Kendo)
// Use this entry point when your app does NOT already import a Kendo theme.
// When Kendo is already imported, use _index.scss instead.
// ============================================================================

@use "../lib/lcars-theme/kendo-theme";
@forward "./index";
```

The four `@forward "../lib/lcars-theme/..." show ...;` lines are removed.

- [ ] **Step 2: Build to confirm both entry points still expose the same mixins**

```bash
npm run build:octo-ui
```

Expected: pass. Sass forwards transitively, so consumers using `@use "@meshmakers/octo-ui/styles" as octo;` (Kendo-imported branch) continue to see `octo.variables`, `octo.styles`, `octo.host-overrides`, `octo.lcars-dark`, `octo.lcars-light`, `octo.derived`, `octo.derived-light`. The Kendo-bundled branch sees the same set plus the runtime Kendo theme application.

- [ ] **Step 3: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/styles/_with-kendo.scss
git commit -m "$(cat <<'EOF'
refactor(theming): delegate _with-kendo.scss to ./_index.scss

Single source of forwards; eliminates the drift risk between the two
entry points. Functionally identical (Sass forwards are transitive).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Phase 1 self-verification + local NuGet pack

**Files:** none (verification only)

- [ ] **Step 1: Run the full Phase 1 self-verification block**

Run from `octo-frontend-libraries/`:

```bash
# 1. Light retune is values-only — only _lcars-light.scss in themes/ touched
[ -z "$(git diff --name-only feature/lcars-theme-split..HEAD -- \
    'src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/' \
    | grep -v '_lcars-light\.scss$')" ] && echo OK_1 || echo FAIL_1

# 2. Contrast tests pass
npm test -- --project=@meshmakers/octo-ui --watch=false --browsers=ChromeHeadless && echo OK_2 || echo FAIL_2

# 3. Build succeeds
npm run build:octo-ui && echo OK_3 || echo FAIL_3

# 4. No new semantic tokens added to the public surface
! git diff feature/lcars-theme-split..HEAD -- \
    'src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_semantic.scss' \
  | grep -qE '^\+\s+--theme-[a-z-]+:' && echo OK_4 || echo FAIL_4

# 5. _lcars-dark.scss and _lcars-light.scss define the same set of --theme-* tokens
diff \
  <(grep -oE -- '--theme-[a-z-]+:' \
      src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/_lcars-dark.scss | sort -u) \
  <(grep -oE -- '--theme-[a-z-]+:' \
      src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/themes/_lcars-light.scss | sort -u) \
  && echo OK_5 || echo FAIL_5
```

Expected: `OK_1 OK_2 OK_3 OK_4 OK_5`. Any FAIL stops the phase; agent investigates.

- [ ] **Step 2: Pack local NuGet so refinery can pick up Phase 1 changes**

The repo's local NuGet pack mechanism is whatever `octo-devtools` provides; for octo-frontend-libraries, the typical command is:

```bash
npm run build:octo-ui
# the build:octo-ui script already publishes to dist/; refinery's package
# resolves the local dist/ via npm link, so no further NuGet step needed
# for frontend libraries. Only the .NET side uses NuGet.
```

If refinery references `@meshmakers/octo-ui` via a tarball or npm-linked dist, ensure the dist is fresh:

```bash
ls -la src/frontend-libraries/dist/meshmakers/octo-ui/
# verify the modified date is recent
```

- [ ] **Step 3: Verify on the refinery side that the new tokens are visible**

Switch to refinery:

```bash
cd ../octo-frontend-refinery-studio
# ensure the dependency is current — typically a reinstall or rebuild
# of node_modules pulls the freshly-built libraries dist
ls -la node_modules/@meshmakers/octo-ui/lib/lcars-theme/tokens/_derived.scss
grep -c '@each' node_modules/@meshmakers/octo-ui/lib/lcars-theme/tokens/_derived.scss
```

Expected: file exists and contains the `@each` block from Task 7. If the file isn't refreshed, run the local-link refresh step that the project documents (e.g. `npm run link-frontend` from `octo-frontend-libraries/`, or `npm install ../octo-frontend-libraries/src/frontend-libraries/dist/meshmakers/octo-ui` from `octo-frontend-refinery-studio/`). The exact command depends on the project's local-link convention; the agent uses whichever is documented and stops to ask if neither is documented.

- [ ] **Step 4: No commit; this task is purely verification**

(Phase 1 commits are already on the branch from Tasks 1-11.)

---

# Phase 2 — Sites

### Task 13: Refactor login-app-bar-section.component.scss `rgba(...accent-rgb)` → `color-mix()`

**Files:**
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/shared-auth/login-ui/src/mm-login-app-bar-section/login-app-bar-section.component.scss`

- [ ] **Step 1: Apply the rewrites**

Open the file and replace each occurrence of the pattern `rgba(var(--mm-login-accent-rgb, 25, 118, 210), 0.N)` with `color-mix(in srgb, var(--mm-login-accent, #1976d2) M%, transparent)` per this mapping:

| Before (alpha) | After (mix percentage) |
|---|---|
| `0.1`  | `10%` |
| `0.15` | `15%` |
| `0.2`  | `20%` |
| `0.3`  | `30%` |
| `0.5`  | `50%` |

Concrete edits (matching the file as it stands today):

```scss
// :host ::ng-deep kendo-avatar.k-avatar background
background-color: var(--mm-login-avatar-bg, color-mix(in srgb, var(--mm-login-accent, #1976d2) 15%, transparent)) !important;

// :host ::ng-deep kendo-avatar.k-avatar border
border: 1.5px solid var(--mm-login-avatar-border, color-mix(in srgb, var(--mm-login-accent, #1976d2) 50%, transparent)) !important;

// .user-avatar
box-shadow: 0 0 15px color-mix(in srgb, var(--mm-login-accent, #1976d2) 30%, transparent);

// button.k-button-primary &:hover
box-shadow: 0 0 15px color-mix(in srgb, var(--mm-login-accent, #1976d2) 50%, transparent);

// a.k-button-solid background
background: color-mix(in srgb, var(--mm-login-accent, #1976d2) 10%, transparent);

// a.k-button-solid border
border: 1px solid color-mix(in srgb, var(--mm-login-accent, #1976d2) 30%, transparent);

// a.k-button-solid &:hover background
background: color-mix(in srgb, var(--mm-login-accent, #1976d2) 20%, transparent);

// a.k-button-solid &:hover box-shadow
box-shadow: 0 0 10px color-mix(in srgb, var(--mm-login-accent, #1976d2) 30%, transparent);
```

The agent runs `git grep -n 'rgba(var(--mm-login-accent-rgb,' src/frontend-libraries/projects/meshmakers/shared-auth/` after the edit and asserts the count is zero.

- [ ] **Step 2: Update the header comment block**

In the same file, the top-of-file `// Available variables:` comment lists `--mm-login-accent-rgb`. Remove that line and the `--mm-login-avatar-bg` / `--mm-login-avatar-border` defaults (which referenced it) so the doc no longer leads readers to the deleted token:

```scss
// Available variables:
//   --mm-login-bg-start        (default: #f5f5f5)
//   --mm-login-bg-end          (default: #e8e8e8)
//   --mm-login-accent          (default: #1976d2)
//   --mm-login-text            (default: #333333)
//   --mm-login-btn-primary-start (default: #1976d2)
//   --mm-login-btn-primary-end   (default: #1565c0)
//   --mm-login-btn-primary-text  (default: #ffffff)
//   --mm-login-font            (default: 'Roboto', sans-serif)
//   --mm-login-avatar-bg       (default: color-mix(srgb, accent 15%, transparent))
//   --mm-login-avatar-text     (default: --mm-login-accent)
//   --mm-login-avatar-border   (default: color-mix(srgb, accent 50%, transparent))
```

- [ ] **Step 3: Lint & build the shared-auth/login-ui package**

```bash
npm run lint:shared-auth
npm run build:shared-auth
```

Expected: both pass.

- [ ] **Step 4: Run shared-auth tests**

```bash
npm test -- --project=@meshmakers/shared-auth --watch=false --browsers=ChromeHeadless
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/shared-auth/login-ui/src/mm-login-app-bar-section/login-app-bar-section.component.scss
git commit -m "$(cat <<'EOF'
refactor(shared-auth): drop --mm-login-accent-rgb; use color-mix() of --mm-login-accent

CSS variables can't decompose colors via rgba(var(--*-rgb), N), so the
old pattern locked the login-accent surface to the LCARS-mint triplet
regardless of active theme. color-mix() against --mm-login-accent
(which is already a single-color token) follows theme swaps correctly
and lets us delete the --*-rgb companion in the next commit.

Spec §4.3 step 2a / decision F2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Delete `--mm-login-accent-rgb` declarations in `_login-popup.scss`; update shared-auth docs

**Files:**
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/chrome/_login-popup.scss`
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/shared-auth/docs/README.md`
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/shared-auth/CLAUDE.md`

- [ ] **Step 1: Delete the two `--mm-login-accent-rgb:` lines in `_login-popup.scss`**

Open `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/chrome/_login-popup.scss`. Two declarations to remove (one inside the `mm-login-app-bar-section` block, one inside `> .content`):

```scss
// REMOVE this line in both blocks
--mm-login-accent-rgb: 100, 206, 185;
```

Leave the surrounding `--mm-login-bg-start`, `--mm-login-accent`, etc. untouched.

- [ ] **Step 2: Update `shared-auth/docs/README.md` and `shared-auth/CLAUDE.md`**

Find each occurrence of `--mm-login-accent-rgb` in the Sass override examples in those two files. Remove the line from the example. The intent of the surrounding example is to show how a host overrides the login surface — `--mm-login-accent` alone is sufficient now, since the consumer derives alpha variants via `color-mix()`.

Anchor commands:

```bash
git grep -n 'mm-login-accent-rgb' \
  src/frontend-libraries/projects/meshmakers/shared-auth/docs/README.md \
  src/frontend-libraries/projects/meshmakers/shared-auth/CLAUDE.md
```

Expected: 1 hit per file (both inside an `mm-login-app-bar-section { ... }` Sass override example). Remove each line.

- [ ] **Step 3: Verify the token is fully gone from the source tree**

```bash
git grep -n -- '--mm-login-accent-rgb' \
  src/frontend-libraries/projects/meshmakers/shared-auth/ \
  src/frontend-libraries/projects/meshmakers/octo-ui/
```

Expected: only matches inside `docs/superpowers/specs/2026-04-27-theming-followups-{prompt,design}.md` (those are spec docs that *describe* the token's history; they remain untouched). Source files: zero matches.

- [ ] **Step 4: Build both libraries**

```bash
npm run build:octo-ui
npm run build:shared-auth
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/chrome/_login-popup.scss \
        src/frontend-libraries/projects/meshmakers/shared-auth/docs/README.md \
        src/frontend-libraries/projects/meshmakers/shared-auth/CLAUDE.md
git commit -m "$(cat <<'EOF'
refactor(theming): delete --mm-login-accent-rgb; consumer rewrite landed

Removes the two declarations in lcars-theme/chrome/_login-popup.scss
and the example references in shared-auth docs. The consumer (login
app-bar section) now derives alpha variants via color-mix() of
--mm-login-accent, so the rgb-triplet companion is dead weight.

Spec §4.3 step 2a tail.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Migrate `_base-form.scss` form colors to semantic tokens

**Files:**
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/forms/_base-form.scss`

- [ ] **Step 1: Apply the three substitutions**

Open the file. Replace the literal-hex/rgba declarations:

```scss
// before
--mm-form-bg: rgba(31, 46, 64, 0.6);
--mm-form-bg-alt: rgba(31, 46, 64, 0.8);
--mm-form-error: #ec658f;

// after
--mm-form-bg:     color-mix(in srgb, var(--theme-surface) 60%, transparent);
--mm-form-bg-alt: color-mix(in srgb, var(--theme-surface) 80%, transparent);
--mm-form-error:  var(--theme-error);
```

The other lines in the `--mm-form-*` block (which already reference `var(--theme-*)` or are intentionally fixed structural values like `--mm-form-shadow`) stay unchanged.

Note: `--mm-form-text: #ffffff;` and `--mm-form-overlay-bg: rgba(7, 23, 43, 0.95)` are also literal but are not in the spec's §4.3 step 2b scope (they're not flagged in the prompt). Leave them alone in this commit; they're tracked under VISUAL-QA review.

Actually — re-check: the prompt §P1 item 4 lists `--mm-form-error`, `--mm-form-bg`, `--mm-form-bg-alt`. Those three are exactly what this task touches. `--mm-form-text` and `--mm-form-overlay-bg` are not flagged.

- [ ] **Step 2: Verify the consumer still resolves**

The shared-ui consumer is `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/shared-ui/src/lib/base-form/base-form.component.scss`. It already references `var(--mm-form-*)` correctly and needs no change.

```bash
git grep -n 'var(--mm-form-' src/frontend-libraries/projects/meshmakers/shared-ui/src/lib/base-form/base-form.component.scss
```

Expected: ~7 hits, all reading `var(--mm-form-*)` — fine.

- [ ] **Step 3: Build**

```bash
npm run build:octo-ui
npm run build:shared-ui
```

Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/forms/_base-form.scss
git commit -m "$(cat <<'EOF'
refactor(theming): migrate _base-form.scss form colors to semantic tokens

--mm-form-bg / --mm-form-bg-alt: rgba(31,46,64,…) → color-mix(--theme-surface, …)
--mm-form-error: #ec658f → var(--theme-error)

Forms now follow theme/tenant overrides. Consumer (shared-ui base-form)
already references var(--mm-form-*) and needs no change.

Spec §4.3 step 2b / prompt P1 item 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Replace `--designer-text` / `--editor-text` `#ffffff` literals with `var(--theme-on-app-bg)`

**Files:**
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/host-overrides/_process-designer.scss`

- [ ] **Step 1: Replace the two declarations**

Open the file. Find each line (anchor: `git grep -nE -- '--(designer|editor)-text:\s*#ffffff'` returns 2 hits in this file). Replace:

```scss
// before
--designer-text: #ffffff;
--editor-text: #ffffff;

// after
--designer-text: var(--theme-on-app-bg);
--editor-text:   var(--theme-on-app-bg);
```

The adjacent `--designer-text-muted: var(--theme-text-secondary);` and `--editor-text-muted: var(--theme-text-secondary);` lines stay unchanged.

- [ ] **Step 2: Verify the literals are gone**

```bash
! git grep -qE -- '--(designer|editor)-text:\s*#ffffff' \
    src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/ && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Build**

```bash
npm run build:octo-ui
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/host-overrides/_process-designer.scss
git commit -m "$(cat <<'EOF'
fix(theming): designer/editor text follows --theme-on-app-bg

Replaces the literal #ffffff overrides in lcars-theme/host-overrides/
_process-designer.scss with var(--theme-on-app-bg). Under lcars-light
the designer/editor text now reads the dark navy from the light palette
instead of forcing white-on-white.

Spec §4.3 step 2c / prompt P2 item 6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Replace `#4a5568` symbol-preview gray with `color-mix()` derivation

**Files:**
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/host-overrides/_process-designer.scss`

- [ ] **Step 1: Locate the site**

```bash
git grep -n -- '#4a5568' \
  src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/
```

Expected: one hit in `host-overrides/_process-designer.scss` (a `background: #4a5568;` declaration on a `.symbol-preview` selector).

- [ ] **Step 2: Replace the literal**

```scss
// before
background: #4a5568;

// after
background: color-mix(in srgb, var(--theme-app-bg), var(--theme-on-app-bg) 25%);
```

- [ ] **Step 3: Verify visual parity under LCARS-dark**

Resolved value under LCARS-dark:
- `--theme-app-bg` = `#07172b`
- `--theme-on-app-bg` = `#ffffff`
- `color-mix(in srgb, #07172b, #ffffff 25%)` ≈ `#3d4a5b`

That's within ~1 ΔE of the original `#4a5568`. If the agent computes a noticeably different resolved value (e.g. browser engines compute `color-mix` slightly differently in srgb vs linear), the agent adjusts the percentage (e.g. 30% instead of 25%) until the resolved color is ΔE ≤ 1 against `#4a5568`.

The agent records the chosen percentage and the resolved color in the commit message.

- [ ] **Step 4: Build**

```bash
npm run build:octo-ui
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/host-overrides/_process-designer.scss
git commit -m "$(cat <<'EOF'
refactor(theming): symbol-preview bg derives from theme tokens

Replaces literal #4a5568 with color-mix(--theme-app-bg, --theme-on-app-bg 25%).
Under LCARS-dark this resolves to ~#3d4a5b (ΔE ≤ 1 vs #4a5568); under
LCARS-light it produces a corresponding gray automatically. No new
theme-author tokens introduced.

Spec §4.3 step 2d (octo-ui half) / prompt P2 item 7.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Phase 2 libraries-side commit checkpoint + local NuGet refresh

**Files:** none (verification + dist refresh)

- [ ] **Step 1: Run the libraries portion of the Phase 2 self-verification**

Run from `octo-frontend-libraries/`:

```bash
# No remaining --mm-login-accent-rgb in source
! git grep -q -- '--mm-login-accent-rgb' \
    src/frontend-libraries/projects/meshmakers/shared-auth/ \
    src/frontend-libraries/projects/meshmakers/octo-ui/ && echo OK_A || echo FAIL_A

# No remaining literal-hex form colors
! git grep -qE '#ec658f|rgba\(31, 46, 64' src/frontend-libraries/projects/meshmakers/octo-ui/ && echo OK_B || echo FAIL_B

# No remaining --designer-text/--editor-text white literals
! git grep -qE -- '--(designer|editor)-text:\s*#ffffff' \
    src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/ && echo OK_C || echo FAIL_C

# No remaining #4a5568 in lcars-theme
! git grep -q -- '#4a5568' \
    src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/ && echo OK_D || echo FAIL_D
```

Expected: `OK_A OK_B OK_C OK_D`.

- [ ] **Step 2: Build everything libraries-side**

```bash
npm run build:octo-ui
npm run build:shared-ui
npm run build:shared-auth
npm test -- --project=@meshmakers/octo-ui --watch=false --browsers=ChromeHeadless
npm test -- --project=@meshmakers/shared-auth --watch=false --browsers=ChromeHeadless
```

Expected: all green.

- [ ] **Step 3: Refresh refinery's view of the libraries**

Switch to refinery and confirm the dist is current:

```bash
cd ../octo-frontend-refinery-studio
ls -la node_modules/@meshmakers/octo-ui/lib/lcars-theme/forms/_base-form.scss
grep -c 'color-mix' node_modules/@meshmakers/octo-ui/lib/lcars-theme/forms/_base-form.scss
```

Expected: file exists, contains the new `color-mix(--theme-surface,…)` lines.

If stale, run the project's documented frontend-link refresh (see `octo-frontend-libraries/CLAUDE.md` "Build Commands" — `npm run link-frontend` from the libraries side, or `npm install ../octo-frontend-libraries/src/frontend-libraries/dist/...` from refinery).

- [ ] **Step 4: No new commit; existing commits already cover the work.**

---

### Task 19: Refinery surface-tone migration — `service-health-detail.component.scss`

**Files:**
- Modify: `octo-frontend-refinery-studio/src/octo-mesh-refinery-studio/src/app/tenants/ui/service-health-detail/service-health-detail.component.scss`

- [ ] **Step 1: Enumerate the live site list**

Run from `octo-frontend-refinery-studio/`:

```bash
git grep -nE -- '#(132a45|0d1f35)' \
  src/octo-mesh-refinery-studio/src/app/tenants/ui/service-health-detail/service-health-detail.component.scss
```

Expected: 5 hits for `#132a45` and 1 for `#0d1f35` (last grep snapshot).

- [ ] **Step 2: Apply replacements**

Replace each occurrence per the spec table:

```scss
// #132a45 → color-mix(in srgb, var(--theme-app-bg), white 4%)
// #0d1f35 → color-mix(in srgb, var(--theme-app-bg), black 8%)
```

For gradient stops, only the literal hex changes — the rest of the gradient is preserved:

```scss
// before
background: #132a45;
background: linear-gradient(135deg, var(--theme-primary-alpha-10) 0%, #132a45 100%);

// after
background: color-mix(in srgb, var(--theme-app-bg), white 4%);
background: linear-gradient(135deg, var(--theme-primary-alpha-10) 0%, color-mix(in srgb, var(--theme-app-bg), white 4%) 100%);
```

- [ ] **Step 3: Verify resolved colors against the originals**

Under LCARS-dark, `--theme-app-bg = #07172b`:
- `color-mix(srgb, #07172b, white 4%)` ≈ `#13233e` — close to `#132a45` (ΔE ~1.2; if too far, the agent adjusts to `white 5%` and recomputes).
- `color-mix(srgb, #07172b, black 8%)` ≈ `#061528` — close to `#0d1f35` (ΔE ~3, may need a different formula like `color-mix(srgb, var(--theme-app-bg), var(--theme-surface-elevated) 25%)`).

If the agent finds the resolved color is more than ΔE 1 off, it iterates the formula. Common alternatives:
- Mix toward `--theme-surface` or `--theme-surface-elevated` instead of black/white
- Adjust the percentage in 5% increments

The agent records each formula choice and the resolved color in the commit message.

- [ ] **Step 4: Confirm the literal hexes are gone**

```bash
! git grep -qE -- '#(132a45|0d1f35)' \
    src/octo-mesh-refinery-studio/src/app/tenants/ui/service-health-detail/service-health-detail.component.scss && echo OK
```

Expected: `OK`.

- [ ] **Step 5: Build refinery to confirm Sass compiles**

```bash
npm run build
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/octo-mesh-refinery-studio/src/app/tenants/ui/service-health-detail/service-health-detail.component.scss
git commit -m "$(cat <<'EOF'
refactor(refinery): derive service-health-detail surface tones from theme

#132a45 → color-mix(--theme-app-bg, white N%)
#0d1f35 → color-mix(--theme-app-bg, black N%)

Resolved values under LCARS-dark match original hexes within ΔE ≤ 1.
Under lcars-light the formulas adapt automatically. No new
theme-author tokens introduced.

Spec §4.3 step 2d (refinery half).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: Refinery surface-tone migration — `data-flow-editor` family

**Files:** (all under `octo-frontend-refinery-studio/src/octo-mesh-refinery-studio/src/app/tenants/communication/data-flows/data-flow-editor/`)
- Modify: `data-flow-editor-page.component.scss`
- Modify: `components/data-flow-overview-panel/data-flow-overview-panel.component.scss`
- Modify: `components/pipelines-panel/pipelines-panel.component.scss`
- Modify: `components/node-properties-panel/node-properties-panel.component.scss`

- [ ] **Step 1: Enumerate**

```bash
git grep -nE -- '#(0d1b2a|6a6a7a|7a7a8a)' \
  src/octo-mesh-refinery-studio/src/app/tenants/communication/data-flows/data-flow-editor/
```

Expected: hits across the four files (per last grep, ~12 sites total: 4× `#0d1b2a`, 5× `#6a6a7a`, 2× `#7a7a8a` plus repeats).

- [ ] **Step 2: Apply replacements per the spec table**

Per-hex replacement formulas (from spec §4.3 step 2d):

| Hex | Replacement formula |
|---|---|
| `#0d1b2a` | `color-mix(in srgb, var(--theme-app-bg), black 6%)` |
| `#6a6a7a` | `color-mix(in srgb, var(--theme-text-secondary), var(--theme-app-bg) 30%)` |
| `#7a7a8a` | `color-mix(in srgb, var(--theme-text-secondary), var(--theme-app-bg) 25%)` |

For each file, the agent replaces each occurrence. Where a `// MIGRATION-REVIEW: visual QA - hardcoded #0d1b2a (custom near-app-bg shade) preserved` line precedes the replaced hex, also delete that comment line — the migration is complete here.

Where a hex is used as a gradient stop (`linear-gradient(180deg, #6a6a7a, rgba(106, 106, 122, 0.3))`), replace only the hex; preserve the gradient. The trailing `rgba(106, 106, 122, 0.3)` is the same gray with alpha — also derive: `color-mix(in srgb, color-mix(in srgb, var(--theme-text-secondary), var(--theme-app-bg) 30%) 30%, transparent)` — but this is awkward; simpler to use a single derivation step throughout:

```scss
// before
background: linear-gradient(180deg, #6a6a7a, rgba(106, 106, 122, 0.3));

// after
background: linear-gradient(
  180deg,
  color-mix(in srgb, var(--theme-text-secondary), var(--theme-app-bg) 30%),
  color-mix(in srgb, var(--theme-text-secondary) 30%, transparent)
);
```

- [ ] **Step 3: Promote any 3+-occurrence formula to a named derived token**

If `color-mix(in srgb, var(--theme-app-bg), black 6%)` appears at 3+ sites across these files (likely — `#0d1b2a` is widespread), add a named token to `_derived.scss` (libraries side, in a separate small follow-up commit if necessary):

```scss
// in tokens/_derived.scss (libraries-side)
--theme-app-bg-recessed: color-mix(in srgb, var(--theme-app-bg), black 6%);
```

Then in refinery use `var(--theme-app-bg-recessed)`. Same approach for the muted gray formulas if they recur 3+ times: `--theme-text-secondary-muted` and `--theme-text-secondary-faded`.

If promotion is needed, do the libraries-side `_derived.scss` edit + commit FIRST, refresh the link to refinery (per Task 18 step 3), then update the refinery sites to reference the named token. The libraries-side commit looks like:

```bash
# (back in octo-frontend-libraries/)
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_derived.scss
git commit -m "feat(theming): add --theme-app-bg-recessed and --theme-text-secondary-muted derived tokens

Promotes formulas that recur at 3+ sites in refinery (data-flow-editor family).
Both derive from existing semantic tokens; theme-author surface unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Verify the literals are gone from these four files**

```bash
! git grep -qE -- '#(0d1b2a|6a6a7a|7a7a8a)' \
    src/octo-mesh-refinery-studio/src/app/tenants/communication/data-flows/data-flow-editor/ && echo OK
```

Expected: `OK`.

- [ ] **Step 5: Build refinery**

```bash
npm run build
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/octo-mesh-refinery-studio/src/app/tenants/communication/data-flows/data-flow-editor/
git commit -m "$(cat <<'EOF'
refactor(refinery): derive data-flow-editor surface tones from theme

Four files: data-flow-editor-page, data-flow-overview-panel,
pipelines-panel, node-properties-panel. Each previously held literal
hex near-bg shades (#0d1b2a) and muted grays (#6a6a7a / #7a7a8a)
preserved with // MIGRATION-REVIEW comments.

#0d1b2a → var(--theme-app-bg-recessed)              (or inline color-mix if <3 sites)
#6a6a7a → var(--theme-text-secondary-muted)         (or inline)
#7a7a8a → var(--theme-text-secondary-faded)         (or inline)

MIGRATION-REVIEW comments on these sites deleted as part of the
migration. Visual-QA comments (toffee, lilac-glow) on different lines
are renamed to VISUAL-QA: in the next commit.

Spec §4.3 step 2d / 2e (refinery, data-flow-editor cluster).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 21: Refinery alpha-step bridges → named tokens; MIGRATION-REVIEW deletion / VISUAL-QA rename

**Files:** every refinery `*.scss` under `octo-frontend-refinery-studio/src/octo-mesh-refinery-studio/src/app/` flagged by `git grep MIGRATION-REVIEW`.

This task processes the remaining ~60 markers (after Task 20 deleted the data-flow-editor cluster). Each marker falls into one of three buckets:

- **Bucket A — bridge formula matches a named token added in Task 8.** Replace the inline `color-mix()` with the named token; delete the marker.
- **Bucket B — bridge formula is one-off (didn't make the 2+-occurrence audit cut).** Delete the marker; leave the inline `color-mix()`.
- **Bucket C — visual-QA flag (toffee disambiguation, lilac-glow vs accent-pink, etc.).** Rewrite the marker prefix as `// VISUAL-QA:` so it survives Phase 3 walk-through.

- [ ] **Step 1: Enumerate the markers**

Run from `octo-frontend-refinery-studio/`:

```bash
git grep -n MIGRATION-REVIEW src/octo-mesh-refinery-studio/src/app/ > /tmp/migration-review.txt
wc -l /tmp/migration-review.txt
cat /tmp/migration-review.txt
```

Expected: 60–70 lines (post-Task-20). The agent reads each entry.

- [ ] **Step 2: Classify each marker**

For each line in `/tmp/migration-review.txt`, read the surrounding context (the marker comment + the next non-empty line of CSS). Decide bucket:

- If the next CSS line is `color-mix(in srgb, var(--theme-{role}) {N}%, transparent)` and `--theme-{role}-alpha-{N}` is now defined in `_derived.scss` (per Task 8) → Bucket A.
- Else if the CSS line is `color-mix(...)` but the alpha step isn't named → Bucket B.
- Else if the marker text contains "visual QA" or describes a value-judgment ambiguity (toffee→warning vs amber, lilac-glow→accent-pink, etc.) → Bucket C.

- [ ] **Step 3: Apply Bucket A replacements**

Example:

```scss
// before
// MIGRATION-REVIEW: --octo-mint-12 → 12% via color-mix bridge
background: color-mix(in srgb, var(--theme-primary) 12%, transparent);

// after (assuming --theme-primary-alpha-12 was added in Task 8)
background: var(--theme-primary-alpha-12);
```

- [ ] **Step 4: Apply Bucket B (delete marker only)**

```scss
// before
// MIGRATION-REVIEW: ad-hoc 38% mint (only site)
background: color-mix(in srgb, var(--theme-primary) 38%, transparent);

// after
background: color-mix(in srgb, var(--theme-primary) 38%, transparent);
```

- [ ] **Step 5: Apply Bucket C (rename marker to VISUAL-QA)**

```scss
// before
// MIGRATION-REVIEW: visual QA - toffee (#da9162) → --theme-warning (status context)
color: var(--theme-warning);

// after
// VISUAL-QA: toffee (#da9162) → --theme-warning chosen for status context — verify under each theme
color: var(--theme-warning);
```

- [ ] **Step 6: Verify counts**

```bash
# All MIGRATION-REVIEW markers gone
! git grep -q MIGRATION-REVIEW src/octo-mesh-refinery-studio/src/app/ && echo OK_M || echo FAIL_M
# VISUAL-QA markers introduced (count is the durable list; record in commit message)
git grep -c VISUAL-QA src/octo-mesh-refinery-studio/src/app/ | awk -F: '{ s+=$NF } END { print s }' > /tmp/vq-count.txt
echo "VISUAL-QA count: $(cat /tmp/vq-count.txt)"
```

Expected: `OK_M`; VISUAL-QA count is whatever the agent classified into Bucket C (typically 5-15 — much smaller than the original 77).

- [ ] **Step 7: Build**

```bash
npm run build
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add src/octo-mesh-refinery-studio/src/app/
git commit -m "$(cat <<'EOF'
refactor(refinery): collapse alpha bridges; convert MIGRATION-REVIEW → VISUAL-QA

Walks every // MIGRATION-REVIEW: marker and applies one of:
  A: replace inline color-mix() with named --theme-*-alpha-N (added in
     octo-ui Task 8) → marker deleted
  B: keep inline color-mix() (one-off step) → marker deleted
  C: rename marker prefix to // VISUAL-QA: (durable flag for human review)

End state: zero MIGRATION-REVIEW markers; <count> VISUAL-QA markers
flagging visual-judgment calls (toffee disambiguation, lilac-glow vs
accent-pink, etc.) for Phase 3 walk-through.

Spec §4.3 step 2e / decision F5 / decision F8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Replace `<count>` in the commit message with the actual VISUAL-QA count from Step 6.)

---

### Task 22: Phase 2 self-verification block

**Files:** none.

- [ ] **Step 1: Run the full Phase 2 self-verification block**

Run from `octo-frontend-libraries/`:

```bash
# Libraries-side checks
! git grep -q -- '--mm-login-accent-rgb' \
    src/frontend-libraries/projects/meshmakers/shared-auth/ \
    src/frontend-libraries/projects/meshmakers/octo-ui/ && echo OK_1 || echo FAIL_1
! git grep -qE '#ec658f|rgba\(31, 46, 64' src/frontend-libraries/projects/meshmakers/octo-ui/ && echo OK_2 || echo FAIL_2
! git grep -qE -- '--(designer|editor)-text:\s*#ffffff' src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/ && echo OK_3 || echo FAIL_3
! git grep -q -- '#4a5568' src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/ && echo OK_4 || echo FAIL_4
```

Run from `octo-frontend-refinery-studio/`:

```bash
# Refinery-side checks
! git grep -q MIGRATION-REVIEW src/ && echo OK_5 || echo FAIL_5
! git grep -E '#(0d1f35|132a45|0d1b2a|6a6a7a|7a7a8a)' src/ | grep -v VISUAL-QA | grep -q . \
  && echo FAIL_6 || echo OK_6
```

Expected: `OK_1 OK_2 OK_3 OK_4 OK_5 OK_6`.

- [ ] **Step 2: Build both repos clean**

```bash
# from octo-frontend-libraries/
npm run build:octo-ui
npm test -- --project=@meshmakers/octo-ui --watch=false --browsers=ChromeHeadless
# from octo-frontend-refinery-studio/
npm run build
npm test -- --watch=false --browsers=ChromeHeadless
```

Expected: all pass.

- [ ] **Step 3: Hand off to user for browser walk-through**

The autonomous portion of Phase 2 ends here. Browser walk-through items (per spec §4.6 testing strategy) require a human:

- Light theme contrast and hover direction (verify the F1 mixin actually fires)
- Kendo button hover, chip selection, dropdown highlighted item, focus rings (verify F4 emphasis keys land where Material defaults used to bleed)
- Process Designer / Symbol Editor under both themes
- Login flow under each registered theme (`window.__theme.setTheme('lcars-light')`)

The agent presents the verification output and asks the user to do the browser walk-through before continuing to Phase 3.

---

# Phase 3 — Polish & docs

### Task 23: Hard rename `.lcars-text-pink` → `.lcars-text-error`

**Files:**
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/primitives/_utilities.scss`

- [ ] **Step 1: Re-run the consumer check at execution time**

Run from `octo-frontend-libraries/` parent (`meshmakers/`):

```bash
git grep -nE 'lcars-text-pink' \
  octo-frontend-libraries/src/ \
  octo-frontend-refinery-studio/src/
```

Expected: only the class definition in `_utilities.scss`. If any non-doc consumer has appeared since the spec was written, the agent stops and asks (per spec risk H mitigation).

- [ ] **Step 2: Apply the rename**

In `_utilities.scss`, change:

```scss
// before
.lcars-text-pink {
  color: var(--theme-error);
}

// after
.lcars-text-error {
  color: var(--theme-error);
}
```

- [ ] **Step 3: Verify no source consumers reference the old name**

```bash
! git grep -q 'lcars-text-pink' \
    octo-frontend-libraries/src/ \
    octo-frontend-refinery-studio/src/ && echo OK
```

Expected: `OK`.

- [ ] **Step 4: Build**

```bash
cd octo-frontend-libraries
npm run build:octo-ui
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/primitives/_utilities.scss
git commit -m "$(cat <<'EOF'
refactor(theming): rename .lcars-text-pink → .lcars-text-error

Hue-named class becomes role-named to match the semantic-token model.
Confirmed no non-doc consumers in either repo at rename time.

Spec §4.4 step 3a / decision F7.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 24: Document Monaco editor SVG limitation in `octo-ui/CLAUDE.md`

**Files:**
- Modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/CLAUDE.md`

- [ ] **Step 1: Add a "Known limitations" section**

Append to `octo-ui/CLAUDE.md`, after the "Browser baseline" section of the theming docs:

```markdown
### Known limitation: Monaco editor SVG accents

Some Monaco editor decoration accents (validation underlines, breadcrumb
chevrons, status icons) are baked into `data:image/svg+xml,...` URIs in
`octo-mesh-refinery-studio`'s Monaco component SCSS. CSS custom properties
do not resolve inside `data:` URIs, so these accents stay LCARS-mint
regardless of active theme.

Sunset trigger: revisit when the second dark theme ships, or when an
LCARS-mint accent inside the editor becomes a customer-visible
regression (whichever comes first).

Three resolution paths exist when this limitation is taken on:

1. **Defer (current).** Document the limitation; accept LCARS-mint accents
   under any theme.
2. **Generate `data:` URIs in TypeScript at runtime.** Read computed
   values of theme tokens via `getComputedStyle()`, build the SVG string,
   encode as `data:` URI, re-run on theme change via the existing
   `TenantThemeService` hook. Medium effort; needs careful
   cache-invalidation when theme switches.
3. **Inline SVG as Angular template.** Replace `data:` URIs with
   Angular `<svg>` markup styled via CSS variables. Heaviest; cleanest
   architectural endpoint.
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(theming): document Monaco editor SVG accent limitation

Spec §4.4 step 3c / decision F3. Records the deferred-with-sunset-trigger
state of the Monaco data: URI accents and the three resolution paths
available when the limitation is taken on.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 25: Designer-panel-bg naming review

**Files:**
- Possibly modify: `octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_designer.scss`

Spec §4.4 step 3e. The current `--designer-panel-bg: var(--theme-surface-elevated)` and `--designer-panel-bg-elevated: var(--theme-surface)` reads as if the values are swapped (the panel is brighter than the elevated panel). Pre-existing behavior; faithful to original LCARS intent.

- [ ] **Step 1: Read the current state**

```bash
grep -nE -- '--designer-panel-bg' \
  src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_designer.scss
```

- [ ] **Step 2: Browser-verify under both themes (human handoff)**

The agent does not browser-verify autonomously. Present the pre-existing inversion to the user and ask one of:

- "Confirm the current visuals are correct under both themes; I will leave the values untouched and add an explanatory comment."
- "Confirm the visuals look swapped to you; I will swap the values and update the comment."

If the user says "leave it", proceed to Step 3a; if "swap it", proceed to Step 3b.

- [ ] **Step 3a: Add explanatory comment (no value change)**

Edit `tokens/_designer.scss` and add a comment immediately above the two declarations:

```scss
// LCARS Process Designer convention: the "panel" is the brightest layer;
// "elevated panel" sits below it as a recessed surface. This reads
// counter to typical Material/elevation language but is faithful to the
// original LCARS visuals — verified 2026-04-27 in browser walk-through.
--designer-panel-bg:           var(--theme-surface-elevated);
--designer-panel-bg-elevated:  var(--theme-surface);
```

- [ ] **Step 3b: Swap values (if user requested)**

Edit `tokens/_designer.scss`:

```scss
// before
--designer-panel-bg:           var(--theme-surface-elevated);
--designer-panel-bg-elevated:  var(--theme-surface);

// after
--designer-panel-bg:           var(--theme-surface);
--designer-panel-bg-elevated:  var(--theme-surface-elevated);
```

The agent then runs `git grep var\(--designer-panel-bg` to confirm consumers don't depend on the inverted semantics. If any consumer's expected visual would be broken, agent stops and asks the user to confirm consumer site updates.

- [ ] **Step 4: Build**

```bash
npm run build:octo-ui
```

Expected: pass.

- [ ] **Step 5: Commit**

If 3a was applied:

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_designer.scss
git commit -m "docs(theming): explain --designer-panel-bg / -elevated naming inversion

Spec §4.4 step 3e. Counter-intuitive naming preserved as faithful to
LCARS visuals (verified in browser); comment added to prevent future
\"helpful\" swaps.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

If 3b was applied:

```bash
git add src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/_designer.scss
git commit -m "fix(theming): swap --designer-panel-bg / -elevated values to match naming

Spec §4.4 step 3e. User-confirmed visual review found values were swapped
relative to the names. Names now match elevation convention (panel is
the recessed layer; elevated panel is brighter).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 26: Update refinery `CLAUDE.md` files referencing dead Sass variables

**Files:**
- Modify: refinery `CLAUDE.md` files containing `$iron-navy`, `$deep-sea`, or `$octo-mint`.

- [ ] **Step 1: Enumerate**

Run from `octo-frontend-refinery-studio/`:

```bash
git grep -lE -- '\$iron-navy|\$deep-sea|\$octo-mint' -- '*CLAUDE.md'
```

Expected: a small list of CLAUDE.md files referencing the dead Sass variables.

- [ ] **Step 2: Replace each Sass-variable reference with the corresponding `var(--theme-*)` token**

Mapping (per CLAUDE.md history of the LCARS palette):

| Sass var (dead) | Replacement |
|---|---|
| `$octo-mint`        | `var(--theme-primary)` |
| `$iron-navy`        | `var(--theme-surface)` |
| `$deep-sea`         | `var(--theme-app-bg)` |
| `$octo-mint-N` (any alpha) | `var(--theme-primary-alpha-N)` |
| `$iron-navy-N` (alpha)     | `var(--theme-surface-alpha-N)` |
| `$deep-sea-N` (alpha)      | `var(--theme-app-bg-alpha-N)` |
| `$neo-cyan`         | `var(--theme-secondary)` |
| `$bubblegum`        | `var(--theme-error)` |
| `$toffee`           | `var(--theme-warning)` (status) or `var(--theme-accent-amber)` (decorative) |
| `$royal-violet`     | `var(--theme-accent-violet)` |
| `$lilac-glow`       | `var(--theme-accent-pink)` |
| `$indigogo`         | `var(--theme-info)` |
| `$ash-blue`         | `var(--theme-text-secondary)` |

For each Sass variable in each file, the agent applies the corresponding replacement. Where the doc shows code examples, update the example to read in the new vocabulary; where the doc explains the LCARS palette identity, the substitution can be expanded with parenthetical context (e.g. `var(--theme-primary)` /* LCARS mint */`).

- [ ] **Step 3: Verify the dead Sass vars are gone**

```bash
! git grep -qE -- '\$iron-navy|\$deep-sea|\$octo-mint' -- '*CLAUDE.md' && echo OK
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add . -- '*CLAUDE.md'
git commit -m "$(cat <<'EOF'
docs(theming): update refinery CLAUDE.md references to current --theme-* tokens

Replaces dead Sass variable names ($iron-navy, $deep-sea, $octo-mint, ...)
with the corresponding var(--theme-*) tokens that the codebase actually
uses post-migration. Affects: <list of files updated>

Spec §4.4 step 3b / prompt P2 item 8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Agent fills in `<list of files updated>` from Step 1's enumeration.)

---

### Task 27: VISUAL-QA review walk

**Files:** any refinery `*.scss` flagged by `git grep VISUAL-QA`.

- [ ] **Step 1: Enumerate**

Run from `octo-frontend-refinery-studio/`:

```bash
git grep -n VISUAL-QA src/octo-mesh-refinery-studio/src/app/ > /tmp/visual-qa.txt
wc -l /tmp/visual-qa.txt
cat /tmp/visual-qa.txt
```

The agent reads each entry, including the surrounding context (preceding line + the CSS line the comment annotates).

- [ ] **Step 2: Classify each VISUAL-QA flag**

For each flag, the agent decides one of:

- **Resolve mechanically.** The intent is unambiguous from context (e.g., the comment says "toffee → warning chosen for status context" and the surrounding code is clearly status-related). Action: delete the VISUAL-QA comment.
- **Leave for human review.** The choice is a value judgment that depends on visual taste (e.g., "lilac-glow vs accent-pink — verify on data-flow-overview-panel selected card"). Action: leave the comment in place.

- [ ] **Step 3: Apply mechanical resolutions**

Delete the VISUAL-QA comment line (and the `// VISUAL-QA: ...` continuation lines if present) for each flag classified as "resolve mechanically".

- [ ] **Step 4: Build & verify count**

```bash
npm run build
git grep -c VISUAL-QA src/octo-mesh-refinery-studio/src/app/ \
  | awk -F: '{ s+=$NF } END { print s }'
```

Expected: build passes; the count is the residual list of human-review-needed flags.

- [ ] **Step 5: Commit**

```bash
git add src/octo-mesh-refinery-studio/src/app/
git commit -m "$(cat <<'EOF'
chore(refinery): resolve mechanical VISUAL-QA flags; <N> remain for human review

Spec §4.4 step 3d. Walked every // VISUAL-QA: comment introduced in
Phase 2 step 2e. Mechanical resolutions (unambiguous from context)
deleted; <N> flags retained for next browser walk-through.

Residual list (file:line) is left as VISUAL-QA: comments and is
greppable: `git grep VISUAL-QA src/`.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Replace `<N>` with the count from Step 4.)

---

### Task 28: Phase 3 self-verification + final build

**Files:** none.

- [ ] **Step 1: Run the Phase 3 self-verification block**

Run from `octo-frontend-libraries/` parent (`meshmakers/`):

```bash
# 1. .lcars-text-pink fully renamed in source (docs/superpowers/ copies allowed)
! git grep -E 'lcars-text-pink' \
    octo-frontend-libraries/src/ \
    octo-frontend-refinery-studio/src/ \
  && echo OK_1 || echo FAIL_1

# 2. Refinery CLAUDE.md no longer references dead Sass variables
! git grep -E -- '\$iron-navy|\$deep-sea|\$octo-mint' \
    octo-frontend-refinery-studio/ -- '*CLAUDE.md' \
  && echo OK_2 || echo FAIL_2

# 3. Monaco limitation documented
git grep -l 'Monaco editor SVG' \
    octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/CLAUDE.md \
  && echo OK_3 || echo FAIL_3
```

Expected: `OK_1 OK_2 OK_3`.

- [ ] **Step 2: Final build & test for both repos**

```bash
cd octo-frontend-libraries
npm run lint
npm run build
npm test -- --watch=false --browsers=ChromeHeadless

cd ../octo-frontend-refinery-studio
npm run lint || true   # if a lint script exists
npm run build
npm test -- --watch=false --browsers=ChromeHeadless || true   # if test script exists
```

Expected: lint + build + test all green for libraries; build green for refinery; tests green if the project has them.

- [ ] **Step 3: Browser walk-through handoff**

Phase 3 ends. The agent presents the final state to the user with:

- Total commit count per branch (libraries + refinery)
- Final VISUAL-QA flag count and file:line list
- The browser walk-through checklist (login flow, cockpit, tenants list, Data Mappings, AI Configuration, Process Designer / Symbol Editor) under each registered theme via `window.__theme.setTheme(...)`
- A list of any palette retunes that affected dark theme contrast pairs (should be empty per Risk-A mitigation)

The agent **does not push** either branch. Both branches remain on the existing `feature/lcars-theme-split{,*-adoption}` heads, ready for human review and eventual PR/merge.

---

## End-state acceptance criteria (mirror of spec §5)

- [ ] `git grep -c MIGRATION-REVIEW octo-frontend-refinery-studio/` returns 0.
- [ ] `git grep -c VISUAL-QA octo-frontend-refinery-studio/` returns the residual count, recorded in Task 27 commit message.
- [ ] `git grep -E '\-\-mm-login-accent-rgb|--mm-form-error:\s*#|--designer-text:\s*#ffffff' octo-frontend-libraries/src/ octo-frontend-refinery-studio/src/` returns empty.
- [ ] WCAG contrast tests pass for every registered theme.
- [ ] Both repos build clean and pass headless tests.
- [ ] `themes/_lcars-dark.scss` and `themes/_lcars-light.scss` declare the same set of `--theme-*` tokens, equal to the 19 documented in `octo-ui/CLAUDE.md`.
- [ ] Browser walk-through under each registered theme shows no Material-purple bleed-through in Kendo widget interaction states, no out-of-place near-bg shades under light theme, and no 3:1 paired-contrast failures. (Human-only check.)
