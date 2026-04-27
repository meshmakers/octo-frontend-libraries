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
