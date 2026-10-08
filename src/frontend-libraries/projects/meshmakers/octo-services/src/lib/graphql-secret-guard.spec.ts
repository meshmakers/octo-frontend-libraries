import { buildSchema, parse } from 'graphql';
import { extractGraphQlDocuments, findSecretUnsafeSelections, SecretGuardViolation } from '../../testing/src/public-api';

/**
 * SECRET-safe GraphQL guard (AB#5542) for every library in this workspace.
 *
 * Scans all `.graphql` documents under `projects/` plus inline `gql` documents in non-generated
 * `.ts` files against `schema.graphql`. The rule itself is the shared
 * `findSecretUnsafeSelections` (octo-services `shared/graphql-secret-guard.ts`, unit-tested there),
 * which the Refinery Studio guard imports from `@meshmakers/octo-services` as well.
 */

/**
 * `<path relative to the workspace>#<field path>` → reason. Only for documents whose type provably
 * carries no secrets; remove the entry with the fix (the stale-entry test below fails once a
 * listed violation is gone).
 */
const ALLOW_LIST: Readonly<Record<string, string>> = {
  'projects/meshmakers/octo-ui/entity-forms/src/graphQL/getEntityForms.graphql#runtime.runtimeEntities.items.attributes':
    'System.UI/EntityForm (fixed ckId) has no secret-capable attributes — only form metadata; an attributeNames filter '
    + 'would also cut the record contents (sections, fields, listColumns) the parser reads.',
};

interface NodeFs {
  readdirSync(path: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  readFileSync(path: string, encoding: 'utf8'): string;
}
declare const process: { cwd(): string };

async function loadFs(): Promise<NodeFs> {
  const moduleName = 'node:fs';
  return (await import(/* @vite-ignore */ moduleName)) as NodeFs;
}

function collectFiles(fs: NodeFs, dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      collectFiles(fs, full, out);
    } else if (entry.name.endsWith('.graphql') && entry.name !== 'schema.graphql') {
      out.push(full);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') && !full.includes('/graphQL/')) {
      out.push(full);
    }
  }
}

describe('GraphQL SECRET guard (AB#5542)', () => {
  const violations: SecretGuardViolation[] = [];
  let scanned = 0;

  beforeAll(async () => {
    const fs = await loadFs();
    const root = process.cwd();
    const schema = buildSchema(fs.readFileSync(`${root}/schema.graphql`, 'utf8'));
    const files: string[] = [];
    collectFiles(fs, `${root}/projects`, files);
    for (const file of files) {
      const relative = file.slice(root.length + 1);
      for (const text of extractGraphQlDocuments(file, fs.readFileSync(file, 'utf8'))) {
        scanned++;
        violations.push(...findSecretUnsafeSelections(schema, parse(text), relative));
      }
    }
  });

  it('scans the GraphQL documents of the workspace', () => {
    expect(scanned).toBeGreaterThan(50);
  });

  it('has no generic attribute selection without a non-nullable attributeNames and no typed credential field', () => {
    const unexpected = violations.filter((v) => !ALLOW_LIST[v.key]).map((v) => `${v.key}: ${v.message}`);
    expect(unexpected).toEqual([]);
  });

  it('keeps the allow-list free of stale entries', () => {
    const found = new Set(violations.map((v) => v.key));
    expect(Object.keys(ALLOW_LIST).filter((key) => !found.has(key))).toEqual([]);
  });
});
