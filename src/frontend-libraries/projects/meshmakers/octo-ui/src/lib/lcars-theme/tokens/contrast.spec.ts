// octo-frontend-libraries/src/frontend-libraries/projects/meshmakers/octo-ui/src/lib/lcars-theme/tokens/contrast.spec.ts
// ============================================================================
// Theme-engine WCAG-AA contrast unit test.
//
// Palette hex values are mirrored from the registered theme partials as
// constants in this file. When a theme retune changes a palette value,
// update both the .scss partial and the corresponding constant in the
// same commit.
//
// Coverage (A2 final state):
//   * 8 pairs asserted for each registered theme: on-primary/primary,
//     on-secondary/secondary, on-surface/surface, on-app-bg/app-bg,
//     primary text/app-bg, plus error/warning/success text on
//     --theme-app-bg (the actual usage pattern; --theme-on-{error,
//     warning,success} are not declared on the semantic surface).
//   * Adding a future theme means adding one constant block and a tuple
//     entry in the `for` loop.
// ============================================================================
import { hexContrastRatio } from './contrast-helpers';

const AA_NORMAL = 4.5;

// Mirrors palette declared in themes/_lcars-light.scss — keep in sync.
const LIGHT = {
  primary:        '#2f7a6f',   // updated
  onPrimary:      '#ffffff',
  secondary:      '#0077a8',
  onSecondary:    '#ffffff',
  surface:        '#ffffff',
  onSurface:      '#07172b',
  appBg:          '#f5f7fa',
  onAppBg:        '#07172b',
  warning:        '#9a531a',   // updated
  error:          '#c2185b',
  success:        '#2d7300',
};

// Mirrors palette declared in themes/_lcars-dark.scss — keep in sync.
const DARK = {
  primary:        '#64ceb9',
  onPrimary:      '#07172b',
  secondary:      '#00a8dc',
  onSecondary:    '#07172b',   // updated for AA contrast
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
      it('primary text on app-bg',    () => expect(hexContrastRatio(p.primary, p.appBg)).toBeGreaterThanOrEqual(AA_NORMAL));
      it('error text on app-bg',      () => expect(hexContrastRatio(p.error, p.appBg)).toBeGreaterThanOrEqual(AA_NORMAL));
      it('warning text on app-bg',    () => expect(hexContrastRatio(p.warning, p.appBg)).toBeGreaterThanOrEqual(AA_NORMAL));
      it('success text on app-bg',    () => expect(hexContrastRatio(p.success, p.appBg)).toBeGreaterThanOrEqual(AA_NORMAL));
    });
  }
});
