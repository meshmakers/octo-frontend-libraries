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
