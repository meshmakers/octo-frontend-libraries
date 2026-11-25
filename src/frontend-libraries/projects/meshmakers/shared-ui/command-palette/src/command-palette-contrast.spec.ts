/**
 * Every text of the command palette must reach WCAG AA (4.5:1) against its own background, in light
 * and dark mode. The spec resolves the colour of each text rule against the theme tokens of octo-ui
 * and measures it on the dialog surface and on the tinted selected row.
 */
export {};

interface SassCompiler {
  compile(path: string): { css: string };
  compileString(source: string, options: { loadPaths: string[] }): { css: string };
}
declare const process: { cwd(): string };

type Mode = 'light' | 'dark';
type ThemeTokens = Map<string, string>;
interface Rgba {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}
interface CssRule {
  selector: string;
  body: string;
}

const LIBRARY_ROOT = `${process.cwd()}/projects/meshmakers`;
const SELECTED_ROW = /^\.cp-option\[aria-selected=["']?true["']?\]\s+/;

const TEXT_ON_DIALOG = ['.cp-input::placeholder', '.cp-group-header', '.cp-side', '.cp-hint', 'kbd', '.cp-empty', '.cp-footer'];
const TEXT_ON_SELECTED_ROW = ['.cp-side', '.cp-hint', 'kbd', 'mark'];
const DECORATION_SELECTORS = ['.cp-icon', '.cp-search-icon'];

async function loadSass(): Promise<SassCompiler> {
  const moduleName = 'sass';
  return (await import(/* @vite-ignore */ moduleName)) as SassCompiler;
}

function parseRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectorList = match[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    for (const selector of selectorList.split(',')) {
      rules.push({ selector: selector.trim(), body: match[2] });
    }
  }
  return rules;
}

function declaration(body: string, property: string): string | undefined {
  return body.match(new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)`))?.[1].trim();
}

function tokensOf(rules: CssRule[], selector: string): ThemeTokens {
  const tokens: ThemeTokens = new Map();
  for (const rule of rules.filter((candidate) => candidate.selector === selector)) {
    for (const match of rule.body.matchAll(/(--theme-[\w-]+):\s*([^;]+)/g)) {
      tokens.set(match[1], match[2].trim());
    }
  }
  return tokens;
}

function resolve(value: string, tokens: ThemeTokens): string {
  const reference = value.match(/^var\((--[\w-]+)(?:,\s*(.+))?\)$/);
  if (!reference) {
    return value;
  }
  const tokenValue = tokens.get(reference[1]) ?? reference[2];
  if (tokenValue === undefined) {
    throw new Error(`token ${reference[1]} is not defined by the theme`);
  }
  return resolve(tokenValue.trim(), tokens);
}

function parseColour(colour: string): Rgba {
  const hex = colour.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) {
    return { red: parseInt(hex[1], 16), green: parseInt(hex[2], 16), blue: parseInt(hex[3], 16), alpha: 1 };
  }
  const rgba = colour.match(/^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)$/);
  if (rgba) {
    return { red: Number(rgba[1]), green: Number(rgba[2]), blue: Number(rgba[3]), alpha: Number(rgba[4] ?? 1) };
  }
  throw new Error(`cannot measure colour ${colour}`);
}

function over(top: Rgba, bottom: Rgba): Rgba {
  const mix = (upper: number, lower: number) => upper * top.alpha + lower * (1 - top.alpha);
  return { red: mix(top.red, bottom.red), green: mix(top.green, bottom.green), blue: mix(top.blue, bottom.blue), alpha: 1 };
}

function luminance(colour: Rgba): number {
  const linear = (channel: number) => {
    const scaled = channel / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : Math.pow((scaled + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(colour.red) + 0.7152 * linear(colour.green) + 0.0722 * linear(colour.blue);
}

function contrast(text: Rgba, background: Rgba): number {
  const textLuminance = luminance(over(text, background));
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(textLuminance, backgroundLuminance);
  const darker = Math.min(textLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('command palette text contrast', () => {
  let paletteRules: CssRule[];
  let themeTokens: Record<Mode, ThemeTokens>;

  beforeAll(async () => {
    const sass = await loadSass();
    paletteRules = parseRules(sass.compile(`${LIBRARY_ROOT}/shared-ui/command-palette/src/command-palette.component.scss`).css);
    const themeRules = parseRules(
      sass.compileString('@use "theme" as *;\n@include theme;', {
        loadPaths: [`${LIBRARY_ROOT}/octo-ui/src/lib/runtime-browser/styles`],
      }).css,
    );
    const darkTokens = tokensOf(themeRules, ':root');
    const lightOverrides = tokensOf(themeRules, ':root[data-theme=light]');
    themeTokens = { dark: darkTokens, light: new Map([...darkTokens, ...lightOverrides]) };
  });

  function textColourOf(selector: string, onSelectedRow: boolean): string {
    const colouredRules = paletteRules
      .filter((rule) => (onSelectedRow ? SELECTED_ROW.test(rule.selector) : !SELECTED_ROW.test(rule.selector)))
      .filter((rule) => rule.selector.replace(SELECTED_ROW, '') === selector)
      .filter((rule) => declaration(rule.body, 'color') !== undefined);
    const matchingRule = colouredRules[colouredRules.length - 1];
    if (!matchingRule) {
      throw new Error(`no colour rule for ${onSelectedRow ? 'the selected row ' : ''}${selector}`);
    }
    return declaration(matchingRule.body, 'color') ?? '';
  }

  for (const mode of ['light', 'dark'] as const) {
    it(`reaches 4.5:1 for every text on the dialog and on the selected row in ${mode} mode`, () => {
      const tokens = themeTokens[mode];
      const dialogBackground = parseColour(resolve('var(--theme-bg-overlay)', tokens));
      const selectedRowBackground = over(parseColour(resolve('var(--theme-accent-subtle)', tokens)), dialogBackground);
      const measurements = [
        ...TEXT_ON_DIALOG.map((selector) => ({ selector, colour: textColourOf(selector, false), background: dialogBackground })),
        ...TEXT_ON_SELECTED_ROW.map((selector) => ({
          selector: `selected row ${selector}`,
          colour: textColourOf(selector, true),
          background: selectedRowBackground,
        })),
      ];
      for (const measurement of measurements) {
        const ratio = contrast(parseColour(resolve(measurement.colour, tokens)), measurement.background);
        expect(ratio, `${measurement.selector}: ${measurement.colour}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it('keeps the muted text token only on decorative icons', () => {
    const mutedSelectors = paletteRules
      .filter((rule) => /(?:^|;)\s*(?:color|stroke):\s*var\(--theme-text-muted\b/.test(rule.body))
      .map((rule) => rule.selector);
    expect(mutedSelectors.length).toBeGreaterThan(0);
    expect(mutedSelectors.filter((selector) => !DECORATION_SELECTORS.includes(selector))).toEqual([]);
  });
});
