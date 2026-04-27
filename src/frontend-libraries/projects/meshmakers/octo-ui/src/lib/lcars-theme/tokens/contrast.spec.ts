// octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/contrast.spec.ts
// ============================================================================
// Theme-engine WCAG-AA contrast unit test.
//
// Palette hex values are mirrored from the registered theme partials as
// constants in this file. When a theme retune changes a palette value,
// update both the .scss partial and the corresponding constant in the
// same commit.
//
// Coverage notes (state at A1 — A2 expands the assertion set):
//   * Tested pairs at this commit: on-primary/primary, primary/app-bg,
//     warning/surface (lcars-light); on-primary/primary, on-app-bg/app-bg,
//     on-surface/surface (lcars-dark). The three lcars-light pairs fail
//     by design — A2's palette retune turns them green.
//   * NOT yet asserted: on-secondary/secondary (lcars-dark currently
//     2.75:1 — A2 adds the assertion; if dark $secondary cannot be
//     adjusted without breaking LCARS brand identity, agent stops to ask).
//   * The plan calls for asserting (error, on-error), (warning, on-warning),
//     (success, on-success), but --theme-on-{error,warning,success} are
//     not declared on the semantic surface. A2 substitutes the actual
//     usage pattern: status text on --theme-app-bg.
// ============================================================================
import { hexContrastRatio } from './contrast-helpers';

const AA_NORMAL = 4.5;

// Mirrors palette declared in themes/_lcars-light.scss — keep in sync.
// Fields not referenced in this file's `describe` blocks (error, success)
// are scaffolding for A2 and become live there.
const LIGHT = {
  primary:        '#4ba396',
  onPrimary:      '#ffffff',
  secondary:      '#0077a8',   // asserted in A2
  onSecondary:    '#ffffff',   // asserted in A2
  surface:        '#ffffff',
  onSurface:      '#07172b',
  appBg:          '#f5f7fa',
  onAppBg:        '#07172b',
  warning:        '#b3641a',
  error:          '#c2185b',   // asserted in A2 (error on app-bg)
  success:        '#2d7300',   // asserted in A2 (success on app-bg)
};

// Mirrors palette declared in themes/_lcars-dark.scss — keep in sync.
// Fields not referenced in this file's `describe` blocks (secondary,
// onSecondary, error, success) are scaffolding for A2.
const DARK = {
  primary:        '#64ceb9',
  onPrimary:      '#07172b',
  secondary:      '#00a8dc',   // asserted in A2 (currently 2.75:1 on white onSecondary)
  onSecondary:    '#ffffff',   // asserted in A2
  surface:        '#394555',
  onSurface:      '#ffffff',
  appBg:          '#07172b',
  onAppBg:        '#ffffff',
  warning:        '#da9162',
  error:          '#ec658f',   // asserted in A2 (error on app-bg)
  success:        '#37b400',   // asserted in A2 (success on app-bg)
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
