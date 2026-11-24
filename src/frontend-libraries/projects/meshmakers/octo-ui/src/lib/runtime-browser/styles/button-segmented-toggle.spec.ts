/**
 * Outline-primary toggles inside a `kendo-buttongroup` are a segmented control: the unselected
 * buttons are quiet, the selected one is filled with the accent. The `octo-button` primary branch
 * used to paint every primary button solid, outline fill included, so the unselected buttons read
 * as the selected ones. A single outline-primary button, a split button (it carries
 * `k-button-group` too) and flat toggles keep their own rules.
 */
export {};

interface SassCompiler {
  compileString(source: string, options: { loadPaths: string[] }): { css: string };
}
declare const process: { cwd(): string };

interface CssRule {
  selector: string;
  body: string;
  position: number;
}

const SEGMENT_SCOPE = '.k-button-group:not(.k-split-button)';

async function compileScss(source: string): Promise<string> {
  const moduleName = 'sass';
  const sass = (await import(/* @vite-ignore */ moduleName)) as SassCompiler;
  const stylesDirectory = `${process.cwd()}/projects/meshmakers/octo-ui/src/lib/runtime-browser/styles`;
  return sass.compileString(source, { loadPaths: [stylesDirectory] }).css;
}

function parseRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const selector of splitTopLevel(match[1].trim())) {
      rules.push({ selector, body: match[2], position: match.index ?? 0 });
    }
  }
  return rules;
}

function splitTopLevel(selectorList: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of selectorList) {
    if (character === '(') depth++;
    if (character === ')') depth--;
    if (character === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  parts.push(current.trim());
  return parts;
}

function specificity(selector: string): number {
  let remaining = selector;
  let total = 0;
  const functional = /:(is|not|where|has)\(/;
  let functionalMatch = functional.exec(remaining);
  while (functionalMatch) {
    const start = functionalMatch.index;
    const argumentStart = start + functionalMatch[0].length;
    let depth = 1;
    let index = argumentStart;
    while (depth > 0) {
      if (remaining[index] === '(') depth++;
      if (remaining[index] === ')') depth--;
      index++;
    }
    const argumentList = remaining.slice(argumentStart, index - 1);
    if (functionalMatch[1] !== 'where') {
      total += Math.max(...splitTopLevel(argumentList).map(specificity));
    }
    remaining = remaining.slice(0, start) + remaining.slice(index);
    functionalMatch = functional.exec(remaining);
  }
  const ids = (remaining.match(/#[\w-]+/g) ?? []).length;
  const classesAttributesPseudos = (remaining.match(/\.[\w-]+|\[[^\]]+\]|(?<!:):[\w-]+/g) ?? []).length;
  const elements = (remaining.replace(/\.[\w-]+|\[[^\]]+\]|::?[\w-]+|#[\w-]+/g, ' ').match(/[a-z][\w-]*/gi) ?? []).length;
  return total + ids * 10000 + classesAttributesPseudos * 100 + elements;
}

function segmentRules(rules: CssRule[]): CssRule[] {
  return rules.filter((rule) => rule.selector.includes(SEGMENT_SCOPE) && rule.selector.includes('.k-button-outline'));
}

function findRule(rules: CssRule[], predicate: (selector: string) => boolean): CssRule {
  const rule = rules.find((candidate) => predicate(candidate.selector));
  expect(rule, 'expected a matching rule').toBeDefined();
  return rule as CssRule;
}

const isUnselectedBase = (selector: string) => !/k-selected|:hover|:focus|disabled|svg|k-icon/.test(selector);
const isSelectedBase = (selector: string) => /\.k-selected$/.test(selector);
const isSelectedHover = (selector: string) => /\.k-selected:hover:not\(:disabled\)$/.test(selector);
const isUnselectedHover = (selector: string) => !selector.includes('k-selected') && /:hover:not\(:disabled\)$/.test(selector);

describe('segmented outline-primary toggles in a button group', () => {
  describe('inside a toolbar that uses the octo-button mixin', () => {
    let rules: CssRule[];
    beforeAll(async () => {
      rules = parseRules(await compileScss('@use "button" as *;\n.k-grid-toolbar .k-button { @include octo-button; }'));
    });

    it('keeps the unselected buttons quiet', () => {
      const unselected = findRule(segmentRules(rules), isUnselectedBase);
      expect(unselected.body).toMatch(/background:\s*transparent/);
      expect(unselected.body).toMatch(/color:\s*var\(--theme-text-secondary/);
      expect(unselected.body).toMatch(/border-color:\s*var\(--theme-border-default/);
    });

    it('fills the selected button with the accent and keeps the fill on hover', () => {
      const selected = findRule(segmentRules(rules), isSelectedBase);
      expect(selected.body).toMatch(/background:\s*var\(--theme-accent[,)]/);
      expect(selected.body).toMatch(/border-color:\s*var\(--theme-accent[,)]/);
      expect(selected.body).toMatch(/color:\s*var\(--theme-text-on-accent/);
      const selectedHover = findRule(segmentRules(rules), isSelectedHover);
      expect(selectedHover.body).toMatch(/background:\s*var\(--theme-accent-hover/);
      expect(selectedHover.body).toMatch(/color:\s*var\(--theme-text-on-accent/);
    });

    it('brightens the label of an unselected button on hover', () => {
      const unselectedHover = findRule(segmentRules(rules), isUnselectedHover);
      expect(unselectedHover.body).toMatch(/color:\s*var\(--theme-text-primary/);
    });

    it('outranks the solid primary branch, which comes earlier', () => {
      const primaryBranch = findRule(rules, (selector) => /\.k-button\.k-button-primary$/.test(selector));
      const primaryHover = findRule(rules, (selector) => /\.k-button\.k-button-primary:hover:not\(:disabled\)$/.test(selector));
      const unselected = findRule(segmentRules(rules), isUnselectedBase);
      const unselectedHover = findRule(segmentRules(rules), isUnselectedHover);
      expect(unselected.position).toBeGreaterThan(primaryBranch.position);
      expect(specificity(unselected.selector)).toBeGreaterThan(specificity(primaryBranch.selector));
      expect(specificity(unselectedHover.selector)).toBeGreaterThan(specificity(primaryHover.selector));
    });

    it('restores the focus ring the quiet reset would remove', () => {
      const focus = findRule(segmentRules(rules), (selector) => selector.endsWith(':focus-visible'));
      expect(focus.body).toMatch(/box-shadow:\s*var\(--theme-focus-ring/);
    });

    it('leaves the flat toggle rule as it was', () => {
      const flatSelected = findRule(rules, (selector) => /\.k-button-flat\.k-selected$/.test(selector));
      expect(flatSelected.body).toMatch(/background:\s*var\(--theme-bg-selected/);
      expect(flatSelected.body).toMatch(/color:\s*var\(--theme-text-accent/);
    });

    it('scopes every segmented rule to a button group that is not a split button', () => {
      const outlinePrimaryQuietOrFilled = rules.filter(
        (rule) =>
          rule.selector.includes('.k-button-outline') &&
          !rule.selector.includes('.k-button-error') &&
          /--theme-text-secondary|--theme-text-on-accent/.test(rule.body)
      );
      expect(outlinePrimaryQuietOrFilled.length).toBeGreaterThan(0);
      for (const rule of outlinePrimaryQuietOrFilled) {
        expect(rule.selector).toContain(SEGMENT_SCOPE);
      }
    });
  });

  describe('in the global styles', () => {
    let rules: CssRule[];
    beforeAll(async () => {
      rules = parseRules(await compileScss('@use "styles" as *;\n@include styles;'));
    });

    it('drops the dead k-button-outline-primary selector Kendo Angular 24 never emits', () => {
      expect(rules.some((rule) => rule.selector.includes('.k-button-outline-primary'))).toBe(false);
    });

    it('styles a button group outside any toolbar as a segmented control', () => {
      const unselected = findRule(segmentRules(rules), (selector) => selector.startsWith('.k-button.') && isUnselectedBase(selector));
      const selected = findRule(segmentRules(rules), (selector) => selector.startsWith('.k-button.') && isSelectedBase(selector));
      expect(unselected.body).toMatch(/color:\s*var\(--theme-text-secondary/);
      expect(selected.body).toMatch(/background:\s*var\(--theme-accent[,)]/);
    });

    it('marks a selected disabled toggle differently from an unselected disabled one', () => {
      const disabledRules = segmentRules(rules).filter((rule) => rule.selector.includes(':disabled') && !/:hover|:active/.test(rule.selector));
      const selectedDisabled = disabledRules.find((rule) => rule.selector.includes('.k-selected'));
      const unselectedDisabled = disabledRules.find((rule) => !rule.selector.includes('.k-selected'));
      expect(selectedDisabled?.body).toMatch(/background:\s*color-mix/);
      expect(unselectedDisabled?.body).toMatch(/background:\s*transparent/);
    });
  });
});
