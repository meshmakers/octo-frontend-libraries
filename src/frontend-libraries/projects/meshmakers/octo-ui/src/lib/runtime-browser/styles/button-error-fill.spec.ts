/**
 * The error fill of the `octo-button` mixin (AB#6464) is for SOLID error buttons only. The mixin is
 * shared by dialog action rows and by the list / grid / page toolbars, where a danger text action
 * (`themeColor="error" fillMode="flat"`) must stay flat (action guideline §2.2 / §9).
 */
interface SassCompiler {
  compileString(source: string, options: { loadPaths: string[] }): { css: string };
}
declare const process: { cwd(): string };

async function compile(): Promise<string> {
  const moduleName = 'sass';
  const sass = (await import(/* @vite-ignore */ moduleName)) as SassCompiler;
  const dir = `${process.cwd()}/projects/meshmakers/octo-ui/src/lib/runtime-browser/styles`;
  return sass.compileString('@use "button" as *;\n.toolbar .k-button { @include octo-button; }', { loadPaths: [dir] }).css;
}

/** Selectors of all rules whose declarations paint the error colour as a background. */
function errorFillSelectors(css: string): string[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => /background:\s*(?:color-mix\([^;]*)?var\(--theme-status-error/.test(m[2]))
    .map((m) => m[1].trim());
}

describe('octo-button error fill (AB#6464)', () => {
  let css: string;
  beforeAll(async () => {
    css = await compile();
  });

  it('paints the error fill on the solid error button', () => {
    expect(errorFillSelectors(css).some((s) => s.includes('.k-button-solid-error'))).toBe(true);
  });

  it('never matches flat or outline error buttons or the bare themeColor attribute', () => {
    const selectors = errorFillSelectors(css);
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(selector).toContain('.k-button-solid-error');
      expect(selector).not.toMatch(/flat|outline|themecolor|k-button-error/);
    }
  });
});
