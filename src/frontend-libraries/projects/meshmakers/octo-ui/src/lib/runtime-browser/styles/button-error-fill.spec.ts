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

  it('paints the error fill on the button Kendo renders for themeColor="error" (class k-button-error only)', () => {
    // Kendo Angular adds theme colour and fill mode as separate classes: there is never a
    // `k-button-solid-error`, a default-fill error button carries just `k-button-error`.
    const selectors = errorFillSelectors(css);
    expect(selectors.some((s) => /\.k-button-error:not\(/.test(s))).toBe(true);
  });

  it('excludes every flat / outline / link / clear fill from the error fill', () => {
    const selectors = errorFillSelectors(css);
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(selector).not.toMatch(/themecolor/);
      const bare = selector.match(/\.k-button-error:not\(([^)]*)\)/);
      expect(bare).not.toBeNull();
      for (const fill of ['.k-button-flat', '.k-button-outline', '.k-button-link', '.k-button-clear']) {
        expect(bare?.[1]).toContain(fill);
      }
    }
  });
});
