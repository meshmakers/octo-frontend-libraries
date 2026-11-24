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

const SEGMENT_SCOPE = '.k-button-group > [aria-pressed]';

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
  return rules.filter((rule) => rule.selector.includes(`:is(${SEGMENT_SCOPE})`));
}

function findRule(rules: CssRule[], predicate: (selector: string) => boolean): CssRule {
  const rule = rules.find((candidate) => predicate(candidate.selector));
  expect(rule, 'expected a matching rule').toBeDefined();
  return rule as CssRule;
}

const isUnselectedBase = (selector: string) => !/k-selected|:hover|:focus|disabled/.test(selector);
const isSelectedBase = (selector: string) => /\.k-selected$/.test(selector);
const ENABLED_HOVER = ':hover:not(:disabled, .k-disabled)';
const isSelectedHover = (selector: string) => selector.endsWith(`.k-selected${ENABLED_HOVER}`);
const isUnselectedHover = (selector: string) => !selector.includes('k-selected') && selector.endsWith(ENABLED_HOVER);
const TOOLBARS = ['.list-view-toolbar', '.k-grid-toolbar', '.page-toolbar'];
const KENDO_OUTLINE_PRIMARY_STATE = 400;

describe('segmented outline-primary toggles in a button group', () => {
  let rules: CssRule[];
  let segments: CssRule[];
  beforeAll(async () => {
    rules = parseRules(await compileScss('@use "styles" as *;\n@include styles;'));
    segments = segmentRules(rules);
  });

  it('scopes every segmented rule to the toggles of a button group', () => {
    expect(segments.length).toBeGreaterThan(0);
    for (const rule of segments) {
      expect(rule.selector).toContain(SEGMENT_SCOPE);
    }
  });

  it('keeps the unselected buttons quiet', () => {
    const unselected = findRule(segments, isUnselectedBase);
    expect(unselected.body).toMatch(/background:\s*transparent/);
    expect(unselected.body).toMatch(/color:\s*var\(--theme-text-secondary/);
    expect(unselected.body).toMatch(/border-color:\s*var\(--theme-border-default/);
  });

  it('brightens the label of an unselected button on hover', () => {
    expect(findRule(segments, isUnselectedHover).body).toMatch(/color:\s*var\(--theme-text-primary/);
  });

  it('fills the selected button with the accent and keeps the fill on hover', () => {
    const selected = findRule(segments, isSelectedBase);
    expect(selected.body).toMatch(/background:\s*var\(--theme-accent[,)]/);
    expect(selected.body).toMatch(/border-color:\s*var\(--theme-accent[,)]/);
    expect(selected.body).toMatch(/color:\s*var\(--theme-text-on-accent/);
    const selectedHover = findRule(segments, isSelectedHover);
    expect(selectedHover.body).toMatch(/background:\s*var\(--theme-accent-hover/);
    expect(selectedHover.body).toMatch(/color:\s*var\(--theme-text-on-accent/);
  });

  it('restores the focus ring the quiet reset would remove', () => {
    const focus = findRule(segments, (selector) => selector.endsWith(':focus-visible'));
    expect(focus.body).toMatch(/box-shadow:\s*var\(--theme-focus-ring/);
  });

  it('marks a selected disabled toggle differently from an unselected disabled one', () => {
    const disabledRules = segments.filter((rule) => rule.selector.includes(':disabled') && !rule.selector.includes(':hover'));
    const selectedDisabled = disabledRules.find((rule) => rule.selector.includes('.k-selected'));
    const unselectedDisabled = disabledRules.find((rule) => !rule.selector.includes('.k-selected'));
    expect(selectedDisabled?.body).toMatch(/background:\s*color-mix/);
    expect(unselectedDisabled?.body).toMatch(/background:\s*transparent/);
  });

  it("outranks Kendo's outline-primary hover, active and selected fill", () => {
    expect(specificity(findRule(segments, isUnselectedBase).selector)).toBeGreaterThan(KENDO_OUTLINE_PRIMARY_STATE);
    expect(specificity(findRule(segments, isUnselectedHover).selector)).toBeGreaterThan(KENDO_OUTLINE_PRIMARY_STATE + 100);
  });

  it('outranks the solid primary branch of the list, grid and page toolbars, which comes later', () => {
    const unselected = findRule(segments, isUnselectedBase);
    const unselectedHover = findRule(segments, isUnselectedHover);
    for (const toolbar of TOOLBARS) {
      const primaryBranch = findRule(rules, (selector) => selector === `${toolbar} .k-button.k-button-primary`);
      const primaryHover = findRule(rules, (selector) => selector === `${toolbar} .k-button.k-button-primary:hover:not(:disabled)`);
      expect(primaryBranch.position).toBeGreaterThan(unselected.position);
      expect(specificity(unselected.selector)).toBeGreaterThan(specificity(primaryBranch.selector));
      expect(specificity(unselectedHover.selector)).toBeGreaterThan(specificity(primaryHover.selector));
    }
  });

  it('keeps class-disabled toggles muted on hover', () => {
    const hoverRules = segments.filter((rule) => rule.selector.includes(':hover'));
    expect(hoverRules.length).toBe(2);
    for (const rule of hoverRules) {
      expect(rule.selector.endsWith(ENABLED_HOVER)).toBe(true);
    }
  });

  it('falls back to the Kendo colour tokens, never to the brand palette, when theme() is missing', () => {
    for (const rule of segments) {
      for (const themeReference of rule.body.matchAll(/var\(--theme-[\w-]+(,[^;]*)?\)/g)) {
        expect(themeReference[1], themeReference[0]).toMatch(/var\(--kendo-color-|0 0 0 2px/);
        expect(themeReference[0]).not.toMatch(/--octo-|--deep-sea|--ash-blue/);
      }
    }
  });

  it('keeps the important flat look of action rows off the toggles of a button group', () => {
    const importantOutlineRules = rules.filter(
      (rule) => rule.selector.includes('.k-button-outline') && /background:\s*transparent\s*!important/.test(rule.body)
    );
    expect(importantOutlineRules.length).toBeGreaterThan(0);
    for (const rule of importantOutlineRules) {
      expect(rule.selector).toContain(`:not(${SEGMENT_SCOPE})`);
    }
  });

  it('drops the dead outline rules whose classes Kendo Angular 24 never emits', () => {
    expect(rules.some((rule) => rule.selector.includes('.k-button-outline-primary'))).toBe(false);
    expect(rules.some((rule) => rule.selector.endsWith('.k-button-outline-base'))).toBe(false);
  });

  describe('octo-button mixin', () => {
    let mixinRules: CssRule[];
    beforeAll(async () => {
      mixinRules = parseRules(await compileScss('@use "button" as *;\n.k-grid-toolbar .k-button { @include octo-button; }'));
    });

    it('leaves the flat toggle rule as it was', () => {
      const flatSelected = findRule(mixinRules, (selector) => /\.k-button-flat\.k-selected$/.test(selector));
      expect(flatSelected.body).toMatch(/background:\s*var\(--theme-bg-selected/);
      expect(flatSelected.body).toMatch(/color:\s*var\(--theme-text-accent/);
    });

    it('does not repeat the segmented rule under every include site', () => {
      expect(mixinRules.some((rule) => rule.selector.includes('.k-button-group'))).toBe(false);
    });
  });
});
