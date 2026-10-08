#!/usr/bin/env node
/**
 * merge-schema-domain.mjs — replace ONE construction-kit domain inside a GraphQL codegen schema
 * with the definitions from another introspected SDL, and leave everything else alone.
 *
 * Why: a codegen schema (`schema.graphql`) is introspected from a single tenant. When one CK model
 * moves ahead (e.g. System.Communication 3.x → 4.x), the only tenant that already carries the new
 * model rarely carries every other model the libraries/Studio build against (System.UI EntityForm,
 * System.Ai, accounting, ...). Replacing the schema wholesale would silently drop those. This script
 * swaps only the domain identified by a type-name prefix and validates the result.
 *
 * What is taken from --source (all matched by --prefix, default `SystemCommunication`):
 *   1. every named definition whose name starts with the prefix (types, inputs, enums, unions,
 *      interfaces). Prefixed definitions that exist in --base but not in --source are REMOVED
 *      (that is how renamed CK types such as `Pool` → `DeploymentSite` disappear);
 *   2. on every non-prefixed object/interface/input type that exists in BOTH schemas: the fields
 *      that belong to the domain — name starts with the camelCase prefix (`systemCommunication…`
 *      root query/mutation/subscription fields) or whose type or any argument type is a prefixed
 *      type (association navigation such as `mapsFrom`, `taggedBy`, `usedBy`). Base's domain
 *      fields on that type are dropped and source's are added;
 *   3. on every non-prefixed union that exists in BOTH schemas: the prefixed members (runtime
 *      unions such as `SystemEntity_RelatesToUnion` list every CK type). Non-prefixed members
 *      always stay as in --base;
 *   4. any non-prefixed definition the merged domain references that --base lacks (pulled in as a
 *      dependency and reported).
 *
 * SECRET overlay (on by default, `--no-secret-overlay` turns it off): the base schema may already
 * reflect SECRET credentials (AB#5537/AB#5542: `clientSecret: OctoSecretState`) that the source
 * tenant does not carry yet. For prefixed types present in both, a base field whose type is
 * `OctoSecretState` is kept instead of source's plain `String`, and so are the fields listed in
 * PRESERVE_BASE_FIELDS (the SECRET companions on ValueOverride). Every preserved field is printed,
 * so a reviewer sees exactly where base won. Turn the overlay off once the source tenant runs a
 * model version that declares the credentials as SECRET itself.
 *
 * The output is validated (buildASTSchema + assertValidSchema) and printed exactly like the
 * existing codegen schema: lexicographically sorted, with the "generated" header. Merging a schema
 * with itself reproduces it byte for byte, and re-running a merge is idempotent.
 *
 * Usage (from src/frontend-libraries):
 *   node scripts/merge-schema-domain.mjs --base schema.graphql \
 *        --source /path/to/introspected-comm-4.x.graphql --out schema.graphql
 *   options:
 *     --prefix <TypePrefix>     domain type-name prefix (default SystemCommunication)
 *     --preserve <Type.field>   additionally keep this base field (repeatable)
 *     --no-secret-overlay       take source's fields even where base has OctoSecretState
 *     --check                   validate and report only, write nothing
 *   then: npm run codegen   (regenerates globalTypes.ts / possibleTypes.ts / *.ts documents)
 *
 * The Refinery Studio (S0b, AB#5843) reuses this script unchanged: run it from the Studio repo with
 * the libraries' node_modules or its own (needs the `graphql` package, v16), pointing --base at the
 * Studio's schema file.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const graphql = require('graphql');
const { parse, Kind, buildASTSchema, assertValidSchema, lexicographicSortSchema, printSchema } = graphql;

const HEADER = '# This file was generated. Do not edit manually.\n\n';

/** Base fields that stay although the source tenant has no (or a different) definition for them. */
const PRESERVE_BASE_FIELDS = [
  // SECRET value overrides (AB#5537/AB#5542): `value` is null for a secret entry, the secret's
  // state lives in `secretValue`. Communication 4.5.0 predates that split.
  'SystemCommunicationValueOverride.secretValue',
  'SystemCommunicationValueOverride.value',
  'SystemCommunicationValueOverrideInput.secretValue'
];

function parseArgs(argv) {
  const args = { prefix: 'SystemCommunication', preserve: [], secretOverlay: true, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    switch (a) {
      case '--base': args.base = next(); break;
      case '--source': args.source = next(); break;
      case '--out': args.out = next(); break;
      case '--prefix': args.prefix = next(); break;
      case '--preserve': args.preserve.push(next()); break;
      case '--no-secret-overlay': args.secretOverlay = false; break;
      case '--check': args.check = true; break;
      case '-h': case '--help': args.help = true; break;
      default: throw new Error(`Unknown argument ${a}`);
    }
  }
  return args;
}

const namedTypeOf = (typeNode) => (typeNode.kind === Kind.NAMED_TYPE ? typeNode.name.value : namedTypeOf(typeNode.type));

/** Field shape without descriptions and with sorted arguments — what the codegen output depends on. */
const typeString = (t) =>
  t.kind === Kind.NAMED_TYPE ? t.name.value : t.kind === Kind.LIST_TYPE ? `[${typeString(t.type)}]` : `${typeString(t.type)}!`;
const fieldSignature = (f) =>
  `${f.name.value}(${(f.arguments ?? []).map((a) => `${a.name.value}:${typeString(a.type)}`).sort().join(',')}):${typeString(f.type)}`;

function collectReferencedNames(def, into) {
  const add = (t) => into.add(namedTypeOf(t));
  (def.interfaces ?? []).forEach((i) => into.add(i.name.value));
  (def.types ?? []).forEach((t) => into.add(t.name.value));
  for (const f of def.fields ?? []) {
    add(f.type);
    (f.arguments ?? []).forEach((a) => add(a.type));
  }
}

export function mergeSchemaDomain(baseSdl, sourceSdl, options = {}) {
  const prefix = options.prefix ?? 'SystemCommunication';
  const fieldPrefix = prefix.charAt(0).toLowerCase() + prefix.slice(1);
  const secretOverlay = options.secretOverlay ?? true;
  const preserve = new Set([...(secretOverlay ? PRESERVE_BASE_FIELDS : []), ...(options.preserve ?? [])]);
  const isDomain = (name) => name.startsWith(prefix);

  const baseDoc = parse(baseSdl);
  const sourceDoc = parse(sourceSdl);
  const named = (doc) => new Map(doc.definitions.filter((d) => d.name).map((d) => [d.name.value, d]));
  const baseDefs = named(baseDoc);
  const sourceDefs = named(sourceDoc);
  const others = baseDoc.definitions.filter((d) => !d.name); // schema { ... }, directives without name

  const report = { removed: [], added: [], replaced: 0, preserved: [], fieldsChanged: [], unionsChanged: [], pulledIn: [] };
  const isDomainField = (f) =>
    f.name.value.startsWith(fieldPrefix) ||
    isDomain(namedTypeOf(f.type)) ||
    (f.arguments ?? []).some((a) => isDomain(namedTypeOf(a.type)));

  const merged = new Map();
  for (const [name, def] of baseDefs) {
    if (isDomain(name)) {
      const src = sourceDefs.get(name);
      if (!src) { report.removed.push(name); continue; }
      merged.set(name, overlayDomainDef(name, def, src));
      report.replaced++;
      continue;
    }
    const src = sourceDefs.get(name);
    if (!src) { merged.set(name, def); continue; }
    if (def.kind === Kind.UNION_TYPE_DEFINITION && src.kind === Kind.UNION_TYPE_DEFINITION) {
      const keep = def.types.filter((t) => !isDomain(t.name.value));
      const domainMembers = src.types.filter((t) => isDomain(t.name.value));
      const before = def.types.filter((t) => isDomain(t.name.value)).map((t) => t.name.value).sort().join();
      if (before !== domainMembers.map((t) => t.name.value).sort().join()) report.unionsChanged.push(name);
      merged.set(name, { ...def, types: [...keep, ...domainMembers] });
      continue;
    }
    if (def.fields && src.fields && def.kind === src.kind) {
      const baseDomain = def.fields.filter(isDomainField);
      const srcDomain = src.fields.filter(isDomainField);
      const sig = (fs) => fs.map(fieldSignature).sort().join('\n');
      if (sig(baseDomain) !== sig(srcDomain)) report.fieldsChanged.push(name);
      merged.set(name, { ...def, fields: [...def.fields.filter((f) => !isDomainField(f)), ...srcDomain] });
      continue;
    }
    merged.set(name, def);
  }
  for (const [name, src] of sourceDefs) {
    if (isDomain(name) && !merged.has(name)) { merged.set(name, src); report.added.push(name); }
  }

  // Dependency closure: non-domain definitions the merged result references but base lacks.
  const builtIns = new Set(['String', 'Int', 'Float', 'Boolean', 'ID']);
  for (let changed = true; changed;) {
    changed = false;
    const refs = new Set();
    for (const def of merged.values()) collectReferencedNames(def, refs);
    for (const ref of refs) {
      if (merged.has(ref) || builtIns.has(ref)) continue;
      const src = sourceDefs.get(ref);
      if (!src) throw new Error(`Merged schema references ${ref}, which neither schema defines`);
      merged.set(ref, src);
      report.pulledIn.push(ref);
      changed = true;
    }
  }

  function overlayDomainDef(name, baseDef, srcDef) {
    if (!secretOverlay && preserve.size === 0) return srcDef;
    if (!baseDef.fields || !srcDef.fields || baseDef.kind !== srcDef.kind) return srcDef;
    const keepFromBase = baseDef.fields.filter(
      (f) => preserve.has(`${name}.${f.name.value}`) || (secretOverlay && namedTypeOf(f.type) === 'OctoSecretState')
    );
    if (keepFromBase.length === 0) return srcDef;
    const keepNames = new Set(keepFromBase.map((f) => f.name.value));
    for (const f of keepFromBase) {
      const s = srcDef.fields.find((x) => x.name.value === f.name.value);
      if (!s || fieldSignature(s) !== fieldSignature(f)) report.preserved.push(`${name}.${f.name.value}`);
    }
    return { ...srcDef, fields: [...srcDef.fields.filter((f) => !keepNames.has(f.name.value)), ...keepFromBase] };
  }

  const doc = { kind: Kind.DOCUMENT, definitions: [...others, ...merged.values()] };
  const schema = buildASTSchema(doc);
  assertValidSchema(schema);
  const sdl = HEADER + printSchema(lexicographicSortSchema(schema)) + '\n';
  return { sdl, report };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.base || !args.source || (!args.out && !args.check)) {
    console.log('Usage: node scripts/merge-schema-domain.mjs --base <schema.graphql> --source <introspected.graphql> --out <file> [--prefix SystemCommunication] [--preserve Type.field] [--no-secret-overlay] [--check]');
    process.exit(args.help ? 0 : 1);
  }
  const { sdl, report } = mergeSchemaDomain(readFileSync(args.base, 'utf8'), readFileSync(args.source, 'utf8'), args);
  const list = (label, items) => console.log(`${label} (${items.length})${items.length ? ':\n  ' + [...items].sort().join('\n  ') : ''}`);
  console.log(`Domain prefix: ${args.prefix}`);
  console.log(`Replaced from source: ${report.replaced}`);
  list('Removed (in base, not in source)', report.removed);
  list('Added (only in source)', report.added);
  list('Non-domain types with changed domain fields', report.fieldsChanged);
  list('Non-domain unions with changed domain members', report.unionsChanged);
  list('Base fields preserved over source (SECRET overlay / --preserve)', report.preserved);
  list('Non-domain definitions pulled in from source', report.pulledIn);
  if (args.check) { console.log('--check: schema is valid, nothing written'); return; }
  writeFileSync(args.out, sdl);
  console.log(`Wrote ${args.out}`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('merge-schema-domain.mjs')) {
  main();
}
