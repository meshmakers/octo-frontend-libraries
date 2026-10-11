/**
 * Dialog action layout guard (AB#6464).
 *
 * Every dialog footer in the libraries shows the one shared action layout (right-aligned, 34 px
 * buttons, token gap, danger-styled destructive confirm). This spec scans the sources of all
 * libraries under `projects/meshmakers` and fails when
 *
 *  1. a template uses `<kendo-dialog-actions>` but its component does not import
 *     `MmDialogActionsDirective` (Kendo would fall back to the stretched layout),
 *  2. a `<kendo-dialog-actions>` asks for a layout other than `end` (static attribute) or binds `[layout]`,
 *  3. a component stylesheet or inline `styles` re-declares a dialog footer class
 *     (`.mm-dialog-actions`, `.action-bar`, `.dialog-actions`, `.edit-actions`, `.mm-efr-actions`) - the look is
 *     defined once in octo-ui `runtime-browser/styles/_dialog-actions.scss`.
 *
 * Same idea as the SECRET guard in octo-services (`graphql-secret-guard.spec.ts`).
 */

export interface DialogActionsViolation {
  readonly file: string;
  readonly rule: 'directive-not-imported' | 'foreign-layout' | 'copied-footer-css';
  readonly detail: string;
}

const FOOTER_CLASS_RULE = /(^|[\s,}>+~])\.(mm-dialog-actions|action-bar|dialog-actions|edit-actions|mm-efr-actions)\s*[{,]/m;
// A static `layout="..."` other than end, or ANY `[layout]` / `[attr.layout]` binding (bindings are
// applied after the directive's constructor and would win over it).
const FOREIGN_LAYOUT = /<kendo-dialog-actions\b[^>]*(?:\[(?:attr\.)?layout\]|\blayout\s*=\s*["'](?!end["'])[^"']*["'])/;

/** Rules 2 and 3 on one source text; rule 1 needs the component file, see `findViolations`. */
export function scanSource(file: string, source: string): DialogActionsViolation[] {
  const found: DialogActionsViolation[] = [];
  if (FOREIGN_LAYOUT.test(source)) {
    found.push({ file, rule: 'foreign-layout', detail: 'kendo-dialog-actions with a layout other than "end"' });
  }
  if (FOOTER_CLASS_RULE.test(source)) {
    found.push({ file, rule: 'copied-footer-css', detail: 'dialog footer class styled outside the shared definition' });
  }
  return found;
}

/**
 * @param files path (relative to the workspace) → source text. A template (`.html`) is checked
 *   against the component `.ts` next to it with the same base name.
 */
export function findViolations(files: ReadonlyMap<string, string>): DialogActionsViolation[] {
  const violations: DialogActionsViolation[] = [];
  for (const [file, source] of files) {
    if (file.includes('/runtime-browser/styles/')) continue; // the one definition
    if (!file.endsWith('.directive.ts') || !file.includes('/dialog-actions/')) {
      violations.push(...scanSource(file, source));
    }
    if (source.includes('<kendo-dialog-actions')) {
      const component = file.endsWith('.html') ? file.replace(/\.html$/, '.ts') : file;
      const componentSource = files.get(component) ?? '';
      if (!componentSource.includes('MmDialogActionsDirective')) {
        violations.push({ file, rule: 'directive-not-imported', detail: `${component} must import MmDialogActionsDirective from @meshmakers/shared-ui` });
      }
    }
  }
  return violations;
}

interface NodeFs {
  readdirSync(path: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  readFileSync(path: string, encoding: 'utf8'): string;
}
declare const process: { cwd(): string };

async function loadFs(): Promise<NodeFs> {
  const moduleName = 'node:fs';
  return (await import(/* @vite-ignore */ moduleName)) as NodeFs;
}

function collect(fs: NodeFs, root: string, dir: string, out: Map<string, string>): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      collect(fs, root, full, out);
    } else if (/\.(ts|html|scss|css)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') && !full.includes('/dist/')) {
      out.set(full.slice(root.length + 1), fs.readFileSync(full, 'utf8'));
    }
  }
}

describe('Dialog action layout guard (AB#6464)', () => {
  describe('rules', () => {
    const sample = (name: string, text: string) => new Map([[name, text]]);

    it('accepts a dialog whose component imports the directive', () => {
      const files = new Map([
        ['a/a.component.ts', 'imports: [MmDialogActionsDirective]'],
        ['a/a.component.html', '<kendo-dialog-actions><button kendoButton>Cancel</button></kendo-dialog-actions>'],
      ]);
      expect(findViolations(files)).toEqual([]);
    });

    it('fails a kendo-dialog-actions without the directive (inline template and html file)', () => {
      expect(findViolations(sample('a/a.component.ts', 'template: `<kendo-dialog-actions></kendo-dialog-actions>`')).map((v) => v.rule))
        .toEqual(['directive-not-imported']);
      const files = new Map([
        ['a/a.component.ts', 'imports: []'],
        ['a/a.component.html', '<kendo-dialog-actions></kendo-dialog-actions>'],
      ]);
      expect(findViolations(files).map((v) => v.rule)).toEqual(['directive-not-imported']);
    });

    it('fails an explicit layout other than end', () => {
      const files = new Map([
        ['a/a.component.ts', 'imports: [MmDialogActionsDirective]'],
        ['a/a.component.html', '<kendo-dialog-actions layout="stretched"></kendo-dialog-actions>'],
      ]);
      expect(findViolations(files).map((v) => v.rule)).toEqual(['foreign-layout']);
      files.set('a/a.component.html', '<kendo-dialog-actions [layout]="actionsLayout"></kendo-dialog-actions>');
      expect(findViolations(files).map((v) => v.rule)).toEqual(['foreign-layout']);
      files.set('a/a.component.html', '<kendo-dialog-actions\n  [attr.layout]="x">\n</kendo-dialog-actions>');
      expect(findViolations(files).map((v) => v.rule)).toEqual(['foreign-layout']);
      files.set('a/a.component.html', '<kendo-dialog-actions layout="end"></kendo-dialog-actions>');
      expect(findViolations(files)).toEqual([]);
    });

    it('fails copy-pasted footer CSS in inline styles and stylesheets', () => {
      const inline = '    .action-bar { display: flex; justify-content: flex-end; gap: 8px; }';
      expect(findViolations(sample('b/b.component.ts', `styles: [\`\n${inline}\n\`]`)).map((v) => v.rule)).toEqual(['copied-footer-css']);
      expect(findViolations(sample('b/b.component.scss', '.host {\n  .dialog-actions {\n    gap: 1rem;\n  }\n}')).map((v) => v.rule))
        .toEqual(['copied-footer-css']);
      expect(findViolations(sample('b/b.component.scss', '.mm-dialog-actions { gap: 1rem }')).map((v) => v.rule)).toEqual(['copied-footer-css']);
    });

    it('allows the class in a template and the shared definition itself', () => {
      expect(findViolations(sample('b/b.component.html', '<div class="action-bar mm-dialog-actions"></div>'))).toEqual([]);
      expect(findViolations(sample('octo-ui/src/lib/runtime-browser/styles/_dialog-actions.scss', '.mm-dialog-actions { gap: 1rem; }'))).toEqual([]);
    });
  });

  describe('libraries', () => {
    const sources = new Map<string, string>();

    beforeAll(async () => {
      const fs = await loadFs();
      const root = process.cwd();
      collect(fs, root, `${root}/projects/meshmakers`, sources);
    });

    it('scans the library sources', () => {
      expect(sources.size).toBeGreaterThan(100);
      expect([...sources.keys()].some((f) => f.endsWith('confirmation-window.component.html'))).toBe(true);
    });

    it('has no dialog action row outside the shared layout', () => {
      const violations = findViolations(sources);
      expect(violations.map((v) => `${v.file}: ${v.rule} - ${v.detail}`)).toEqual([]);
    });
  });
});
