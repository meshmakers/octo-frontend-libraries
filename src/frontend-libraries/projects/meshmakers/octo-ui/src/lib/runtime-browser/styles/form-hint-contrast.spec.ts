/**
 * Hint text must stay readable (WCAG AA, 4.5:1) in light and dark mode. The secondary text colour
 * reaches that only at full strength: mixed at 70% with transparent it fell to about 3.4:1 on a
 * white surface. Form hints and every other secondary hint-type text of the shared styles use
 * `--theme-text-secondary` without alpha; form errors keep their own colour.
 */
export {};

interface SassCompiler {
  compileString(source: string, options: { loadPaths: string[] }): { css: string };
}
declare const process: { cwd(): string };

interface CssRule {
  selector: string;
  body: string;
}

async function compileSharedStyles(): Promise<string> {
  const moduleName = 'sass';
  const sass = (await import(/* @vite-ignore */ moduleName)) as SassCompiler;
  const stylesDirectory = `${process.cwd()}/projects/meshmakers/octo-ui/src/lib/runtime-browser/styles`;
  return sass.compileString('@use "styles" as *;\n@include styles;', { loadPaths: [stylesDirectory] }).css;
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

function textColourOf(rule: CssRule): string | undefined {
  const colourDeclaration = rule.body.match(/(?:^|;)\s*color:\s*([^;]+)/);
  return colourDeclaration?.[1].trim();
}

function rulesForElement(rules: CssRule[], selectorEnding: RegExp): CssRule[] {
  return rules.filter((rule) => selectorEnding.test(rule.selector) && textColourOf(rule) !== undefined);
}

describe('hint text contrast of the shared styles', () => {
  let rules: CssRule[];

  beforeAll(async () => {
    rules = parseRules(await compileSharedStyles());
  });

  it('colours form hints, on pages and in dialogs, with the full secondary text colour', () => {
    const hintRules = rulesForElement(rules, /(?:kendo-formhint|\.k-form-hint)$/);
    expect(hintRules.length).toBeGreaterThanOrEqual(3);
    for (const hintRule of hintRules) {
      const hintColour = textColourOf(hintRule) ?? '';
      expect(hintColour, hintRule.selector).toMatch(/^var\(--theme-text-secondary\b/);
      expect(hintColour, hintRule.selector).not.toMatch(/color-mix|transparent|--ash-blue-\d/);
    }
  });

  it('lets a host restyle form hints without !important', () => {
    const hintRules = rulesForElement(rules, /(?:kendo-formhint|\.k-form-hint)$/);
    const forcedHintSelectors = hintRules
      .filter((hintRule) => (textColourOf(hintRule) ?? '').includes('!important'))
      .map((hintRule) => hintRule.selector);
    expect(forcedHintSelectors).toEqual([]);
  });

  it('leaves no text colour on the 70% alpha secondary token', () => {
    const fadedTextSelectors = rules
      .filter((rule) => (textColourOf(rule) ?? '').includes('--ash-blue-70'))
      .map((rule) => rule.selector);
    expect(fadedTextSelectors).toEqual([]);
  });

  it('keeps the form error colour unchanged', () => {
    const errorRules = rulesForElement(rules, /(?:kendo-formerror|\.k-form-error)$/);
    expect(errorRules.length).toBeGreaterThan(0);
    for (const errorRule of errorRules) {
      expect(textColourOf(errorRule), errorRule.selector).toBe('var(--bubblegum) !important');
    }
  });
});
