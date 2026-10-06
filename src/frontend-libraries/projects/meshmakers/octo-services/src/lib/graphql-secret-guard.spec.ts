import {
  buildSchema,
  DocumentNode,
  getNamedType,
  GraphQLSchema,
  parse,
  print,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from 'graphql';
import { isCredentialLikeAttributeName } from './shared/secret-safe-attributes';

/**
 * SECRET-safe GraphQL guard (AB#5542) for every library in this workspace.
 *
 * Scans all `.graphql` documents under `projects/` plus inline `gql` documents in non-generated
 * `.ts` files, validated against `schema.graphql`, and fails when
 *
 * 1. a generic runtime `attributes` selection (`RtEntityAttributeDtoConnection`) has no
 *    `attributeNames` argument, binds it to a NULLABLE variable, or lists a credential-like name
 *    — omitting the filter returns every attribute, passwords and client secrets included;
 * 2. a typed selection contains a credential-like String field (`password`, `clientSecret`,
 *    `apiKey`, `botToken`, …; Boolean/number fields such as `isSecret` or `maxTokens` are fine).
 *
 * A non-null variable with a default (`$attributeNames: [String!]! = []`) is accepted: an omitted
 * value then means "no attributes". Justified exceptions go into {@link ALLOW_LIST} with a reason.
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
  existsSync(path: string): boolean;
}
declare const process: { cwd(): string };

const GENERIC_ATTRIBUTE_CONNECTION = 'RtEntityAttributeDtoConnection';
const NON_TEXT_SCALARS = new Set(['Boolean', 'Int', 'Float', 'Long', 'Decimal', 'DateTime', 'Date', 'TimeSpan']);
const INLINE_GQL = /gql`([\s\S]*?)`/g;
const OPERATION_START = /^\s*(#[^\n]*\n\s*)*(query|mutation|subscription|fragment|\{)/;

interface Violation {
  readonly key: string;
  readonly message: string;
}

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

function documentsOf(path: string, source: string): string[] {
  if (path.endsWith('.graphql')) return [source];
  return [...source.matchAll(INLINE_GQL)]
    .map((m) => m[1].replace(/\$\{[^}]*\}/g, ''))
    .filter((text) => OPERATION_START.test(text));
}

function checkDocument(schema: GraphQLSchema, doc: DocumentNode, file: string): Violation[] {
  const violations: Violation[] = [];
  const variableTypes = new Map<string, string>();
  for (const def of doc.definitions) {
    if (def.kind === 'OperationDefinition') {
      for (const v of def.variableDefinitions ?? []) variableTypes.set(v.variable.name.value, print(v.type));
    }
  }

  const typeInfo = new TypeInfo(schema);
  const path: string[] = [];
  visit(doc, visitWithTypeInfo(typeInfo, {
    Field: {
      enter(node) {
        path.push(node.alias?.value ?? node.name.value);
        const fieldPath = path.join('.');
        const named = getNamedType(typeInfo.getType() ?? undefined);
        const selectsValue = node.selectionSet?.selections.some(
          (s) => s.kind === 'Field' && s.name.value === 'items'
            && s.selectionSet?.selections.some((i) => i.kind === 'Field' && i.name.value === 'value'),
        );
        const isGeneric = node.name.value === 'attributes'
          && (named?.name === GENERIC_ATTRIBUTE_CONNECTION || (!named && !!selectsValue));

        if (isGeneric) {
          const arg = node.arguments?.find((a) => a.name.value === 'attributeNames');
          const key = `${file}#${fieldPath}`;
          if (!arg) {
            violations.push({ key, message: 'generic `attributes` without `attributeNames` (returns ALL attributes incl. secrets)' });
          } else if (arg.value.kind === 'Variable') {
            const type = variableTypes.get(arg.value.name.value);
            if (!type?.endsWith('!')) {
              violations.push({ key, message: `\`attributeNames\` bound to nullable variable $${arg.value.name.value}: ${type ?? '?'}` });
            }
          } else if (arg.value.kind === 'ListValue') {
            for (const item of arg.value.values) {
              if (item.kind === 'StringValue' && isCredentialLikeAttributeName(item.value)) {
                violations.push({ key, message: `\`attributeNames\` lists credential-like "${item.value}"` });
              }
            }
          } else if (arg.value.kind !== 'StringValue') {
            violations.push({ key, message: '`attributeNames` must be a non-null list' });
          }
        } else if (!node.selectionSet && isCredentialLikeAttributeName(node.name.value)) {
          const scalar = named?.name;
          if (!scalar || !NON_TEXT_SCALARS.has(scalar)) {
            violations.push({
              key: `${file}#${fieldPath}`,
              message: `typed selection of credential-like field "${node.name.value}" (${scalar ?? 'unknown type'})`,
            });
          }
        }
      },
      leave() {
        path.pop();
      },
    },
  }));
  return violations;
}

describe('GraphQL SECRET guard (AB#5542)', () => {
  const violations: Violation[] = [];
  let scanned = 0;

  beforeAll(async () => {
    const fs = await loadFs();
    const root = process.cwd();
    const schema = buildSchema(fs.readFileSync(`${root}/schema.graphql`, 'utf8'));
    const files: string[] = [];
    collectFiles(fs, `${root}/projects`, files);
    for (const file of files) {
      const relative = file.slice(root.length + 1);
      for (const text of documentsOf(file, fs.readFileSync(file, 'utf8'))) {
        scanned++;
        violations.push(...checkDocument(schema, parse(text), relative));
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

  describe('rule', () => {
    const schema = buildSchema(`
      type Query { runtime: Runtime }
      type Runtime { entities: [RtEntity] sap: [Sap] }
      type RtEntity { rtId: ID attributes(attributeNames: [String]): RtEntityAttributeDtoConnection }
      type RtEntityAttributeDtoConnection { items: [Attr] }
      type Attr { attributeName: String value: String }
      type Sap { user: String password: String isSecret: Boolean maxTokens: Int }
    `);
    const check = (text: string) => checkDocument(schema, parse(text), 'x.graphql').map((v) => v.message);

    it('flags a missing or nullable attributeNames and credential-like literals', () => {
      expect(check('{ runtime { entities { attributes { items { value } } } } }')).toHaveLength(1);
      expect(check('query q($n: [String]) { runtime { entities { attributes(attributeNames: $n) { items { value } } } } }')).toHaveLength(1);
      expect(check('{ runtime { entities { attributes(attributeNames: ["name", "password"]) { items { value } } } } }')).toHaveLength(1);
    });

    it('accepts non-null variables (with or without default) and safe literals', () => {
      expect(check('query q($n: [String!]!) { runtime { entities { attributes(attributeNames: $n) { items { value } } } } }')).toEqual([]);
      expect(check('query q($n: [String!]! = []) { runtime { entities { attributes(attributeNames: $n) { items { value } } } } }')).toEqual([]);
      expect(check('{ runtime { entities { attributes(attributeNames: ["name"]) { items { value } } } } }')).toEqual([]);
    });

    it('flags typed credential String fields but not Boolean/Int look-alikes', () => {
      expect(check('{ runtime { sap { user password isSecret maxTokens } } }')).toEqual([
        'typed selection of credential-like field "password" (String)',
      ]);
    });
  });
});
