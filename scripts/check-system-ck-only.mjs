#!/usr/bin/env node
// Guard: the frontend may depend on System CK models only (AB#6203, epic AB#6186).
//
// Rules
//   1. String literals in *.ts / *.html / *.json / *.md and GraphQL string values that
//      look like a CK id (`Model/Type`, `Model.Sub-1.2.3/Type`) must reference an allowlisted
//      model. Synthetic models (`Test`, `TestModel`) are allowed only in spec/testing paths.
//      Matches in comments are warnings (errors with --strict).
//   2. GraphQL documents (*.graphql and `gql` tagged templates in *.ts): every named type and
//      every field under `runtime` (queries and mutations, also through inline fragments, fragment
//      spreads and fragments on the runtime/subscription root types) or a subscription root must
//      not resolve to a non-System CK type. *.graphql documents are also validated against the
//      schema (unknown types and fields), so they fail once the schema is System-only (AB#6204).
//      `gql` templates with substitutions are only word-scanned for non-System GraphQL type names.
//   3. schema.graphql and generated GraphQL TypeScript: no non-System CK type.
//   4. Optional import boundaries (e.g. libraries must not import demo apps).
//
// Limits: CK ids built at runtime (`Basic/${name}`, 'Basic' + '/Tree', ids read from data) are
// not detected; a literal is only checked as a whole token.
//
// Configuration lives next to this script:
//   system-ck-allowlist.json   allowed models, file scopes, schema location, import boundaries
//   system-ck-exceptions.json  [{ path, pattern?, maxCount?, reason, workItem, expires? }]
//                              Non-generated files need `pattern` and `maxCount`.
//
// Usage: node scripts/check-system-ck-only.mjs [--strict] [--verbose] [--json]
// Exit code 1 on errors. Dependencies: `graphql` and `typescript`, resolved from the
// npm package directory configured in the allowlist (`packageDir`).

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const started = Date.now();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const verbose = args.has('--verbose');

const allowlistPath = path.join(scriptDir, 'system-ck-allowlist.json');
const exceptionsPath = path.join(scriptDir, 'system-ck-exceptions.json');
const config = JSON.parse(readFileSync(allowlistPath, 'utf8'));
const exceptions = existsSync(exceptionsPath) ? JSON.parse(readFileSync(exceptionsPath, 'utf8')) : [];

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: scriptDir, encoding: 'utf8' }).trim();
const packageDir = path.resolve(repoRoot, config.packageDir ?? '.');
const requireFromPackage = createRequire(path.join(packageDir, 'package.json'));
const graphql = requireFromPackage('graphql');
const ts = requireFromPackage('typescript');

// ---------------------------------------------------------------------------------------------
// Glob helper (supports **, *, ?, {a,b})
// ---------------------------------------------------------------------------------------------
const globCache = new Map();
function globToRegExp(glob) {
  let cached = globCache.get(glob);
  if (cached) return cached;
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if (c === '{') {
      const end = glob.indexOf('}', i);
      re += '(?:' + glob.slice(i + 1, end).split(',').map(escapeRe).join('|') + ')';
      i = end;
    } else {
      re += escapeRe(c);
    }
  }
  cached = new RegExp('^' + re + '$');
  globCache.set(glob, cached);
  return cached;
}
function escapeRe(s) {
  return s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}
const matchesAny = (file, globs = []) => globs.some((g) => globToRegExp(g).test(file));

// ---------------------------------------------------------------------------------------------
// Model allowlist
// ---------------------------------------------------------------------------------------------
const CK_ID = /(?<![\w./-])([A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)*)(?:-\d+(?:\.\d+)*)?\/[A-Z][A-Za-z0-9]+/g;
const ignoreTokens = new Set(config.ignoreTokens ?? []);
let schemaFileList = null; // see schemaFiles()
const modelPrefixes = (config.modelPrefixes ?? []).map((p) => (p.endsWith('.') ? p : p + '.'));

function modelAllowed(model, file) {
  const scope = scopesFor(file);
  const models = [...config.models, ...scope.flatMap((s) => s.models ?? [])];
  if (models.includes(model)) return true;
  // `System.` allows every System.* model; the prefix must end with a dot so that e.g.
  // `SystemAir/Fan` is not mistaken for a System model.
  if (modelPrefixes.some((p) => model.startsWith(p))) return true;
  if (isSynthetic(model)) return matchesAny(file, config.syntheticPaths);
  return false;
}
function isSynthetic(model) {
  return (config.synthetic ?? []).some((s) => model === s || model.startsWith(s + '.'));
}
function scopesFor(file) {
  return (config.scopes ?? []).filter((s) => matchesAny(file, s.paths));
}
function allowedGraphQlPrefixes(file) {
  const models = [...config.models, ...scopesFor(file).flatMap((s) => s.models ?? [])];
  return [...models, ...modelPrefixes.map((p) => p.replace(/\.$/, ''))].map((m) => m.replace(/\./g, ''));
}

// ---------------------------------------------------------------------------------------------
// Findings and exceptions
// ---------------------------------------------------------------------------------------------
const findings = [];
function report(file, text, index, token, message, severity) {
  const before = text.slice(0, index);
  const line = before.split('\n').length;
  const column = index - before.lastIndexOf('\n');
  findings.push({ file, line, column, token, message, severity });
}

const today = new Date().toISOString().slice(0, 10);
const exceptionState = exceptions.map((e, i) => {
  const problems = [];
  if (!e.path) problems.push('missing "path"');
  if (!e.reason || !String(e.reason).trim()) problems.push('missing "reason"');
  if (!/^AB#\d+$/.test(e.workItem ?? '')) problems.push('missing or invalid "workItem" (expected "AB#1234")');
  let patternRe = null;
  if (e.pattern) {
    try {
      patternRe = new RegExp(e.pattern);
    } catch (err) {
      problems.push(`invalid "pattern": ${err.message}`);
    }
  }
  if (e.path && !isGeneratedPath(e.path)) {
    if (!e.pattern) problems.push('"pattern" is required for non-generated files');
    if (!Number.isInteger(e.maxCount) || e.maxCount < 1) problems.push('"maxCount" (positive integer) is required for non-generated files');
  }
  return { ...e, index: i, problems, used: 0, patternRe };
});
// An exception path counts as generated when it only covers the schema / generated GraphQL files
function isGeneratedPath(glob) {
  if (schemaFiles().includes(glob)) return true;
  return (config.generatedGraphQlFiles ?? []).some((g) => g === glob || globToRegExp(g).test(glob.replace(/\{([^,}]+)[^}]*\}/g, '$1')));
}
// Every matching exception counts the finding (overlapping entries are not reported as stale)
function exceptionsFor(finding) {
  return exceptionState.filter(
    (e) => e.problems.length === 0 && !(e.expires && e.expires < today) && globToRegExp(e.path).test(finding.file) && (!e.patternRe || e.patternRe.test(finding.token)),
  );
}

// ---------------------------------------------------------------------------------------------
// Rule 1: CK id literals
// ---------------------------------------------------------------------------------------------
// `A/B` is also plain English ("Yes/No", "Cmd/Ctrl"). A match is treated as a CK id when
//   - its model is a known non-System model (`knownForeignModels`), or
//   - its model is dotted or versioned (`Industry.Basic/Alarm`, `Foo-1.0.0/Bar`), or
//   - it is the whole string literal / attribute value / quoted value, or
//   - it directly follows a CK key (`ckTypeId: `, `ckTypeId="`, ...), or
//   - `Model` + `Type` is a CK entity type of the GraphQL schema.
// Other matches are ignored (listed with --verbose).
const CK_KEY_BEFORE = /\b(?:[a-z]*[cC]k[A-Za-z]*Id|ck[A-Z][A-Za-z]*|ckId|typeId|ckTypeIds?)["']?\s*[:=]\s*["'`]?$/;
const knownForeign = new Set(config.knownForeignModels ?? []);
const ignoreModels = new Set(config.ignoreModels ?? []);
let weakMatches = 0;

function isStrongMatch(text, index, token, model, typeName) {
  if (knownForeign.has(model) || knownForeign.has(model.split('.')[0])) return true;
  if (model.includes('.') || /^[^/]*-\d/.test(token)) return true;
  const prev = text[index - 1];
  const next = text[index + token.length];
  const quotes = '\'"`';
  const afterEscape = next === '\\' ? text[index + token.length + 1] : next;
  if (prev && next && quotes.includes(prev) && (next === prev || next === '@' || afterEscape === prev)) return true;
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  if (CK_KEY_BEFORE.test(text.slice(Math.max(lineStart, index - 60), index))) return true;
  const { entitySet } = loadSchema();
  if (entitySet.has(model.replace(/\./g, '') + typeName)) return true;
  return false;
}

function scanText(file, text, ranges /* [{start,end,kind:'code'|'comment'}] or null = all code */) {
  CK_ID.lastIndex = 0;
  let m;
  while ((m = CK_ID.exec(text))) {
    const token = m[0];
    const model = m[1];
    if (ignoreTokens.has(token) || ignoreModels.has(model.split('.')[0])) continue;
    if (modelAllowed(model, file)) continue;
    let kind = 'code';
    if (ranges) {
      const r = ranges.find((x) => m.index >= x.start && m.index < x.end);
      if (!r) continue; // TS: identifiers/operators outside literals and comments are not CK ids
      kind = r.kind;
    }
    const typeName = token.slice(token.indexOf('/') + 1);
    if (!isStrongMatch(text, m.index, token, model, typeName)) {
      weakMatches++;
      if (verbose) report(file, text, m.index, token, `'${token}' looks like prose, ignored`, 'info');
      continue;
    }
    const synthetic = isSynthetic(model);
    const message = synthetic
      ? `'${token}' (synthetic model '${model}' is allowed in specs/testing only)`
      : `'${token}' (model '${model}' not in System allowlist)`;
    report(file, text, m.index, token, kind === 'comment' ? message + ' [comment]' : message, kind === 'comment' && !strict ? 'warning' : 'error');
  }
}

function tsLiteralRanges(file, text, sf) {
  const ranges = [];
  const seenComments = new Set();
  const addComments = (list) => {
    for (const c of list ?? []) {
      if (seenComments.has(c.pos)) continue;
      seenComments.add(c.pos);
      ranges.push({ start: c.pos, end: c.end, kind: 'comment' });
    }
  };
  const visit = (node) => {
    addComments(ts.getLeadingCommentRanges(text, node.pos));
    addComments(ts.getTrailingCommentRanges(text, node.end));
    switch (node.kind) {
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      case ts.SyntaxKind.TemplateHead:
      case ts.SyntaxKind.TemplateMiddle:
      case ts.SyntaxKind.TemplateTail:
      case ts.SyntaxKind.RegularExpressionLiteral:
        ranges.push({ start: node.getStart(sf), end: node.end, kind: 'code' });
        break;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  addComments(ts.getLeadingCommentRanges(text, sf.endOfFileToken.pos));
  return ranges;
}

function markupCommentRanges(text, open, close) {
  const ranges = [];
  let i = 0;
  let last = 0;
  while ((i = text.indexOf(open, last)) >= 0) {
    const end = text.indexOf(close, i + open.length);
    const stop = end < 0 ? text.length : end + close.length;
    ranges.push({ start: last, end: i, kind: 'code' }, { start: i, end: stop, kind: 'comment' });
    last = stop;
  }
  ranges.push({ start: last, end: text.length, kind: 'code' });
  return ranges;
}

function graphQlCommentRanges(text) {
  const ranges = [];
  let pos = 0;
  for (const line of text.split('\n')) {
    const hash = line.search(/(^|\s)#/);
    if (hash >= 0) {
      const at = line.indexOf('#', hash);
      ranges.push({ start: pos, end: pos + at, kind: 'code' }, { start: pos + at, end: pos + line.length + 1, kind: 'comment' });
    } else {
      ranges.push({ start: pos, end: pos + line.length + 1, kind: 'code' });
    }
    pos += line.length + 1;
  }
  return ranges;
}

// ---------------------------------------------------------------------------------------------
// Rules 2 + 3: GraphQL
// ---------------------------------------------------------------------------------------------
const builtinScalars = new Set(['String', 'Int', 'Float', 'Boolean', 'ID']);
let schemaInfo = null;

// Schema sources: `schema` of the allowlist (string or array) plus every file listed under `schema:`
// in the codegen configs (`codegenConfigs`), e.g. local `extend type ...` files. They are merged,
// checked with rule 3 and never treated as documents.
function schemaFiles() {
  if (schemaFileList) return schemaFileList;
  const list = [].concat(config.schema ?? []);
  for (const cfg of config.codegenConfigs ?? []) {
    const abs = path.join(repoRoot, cfg);
    if (!existsSync(abs)) continue;
    for (const entry of codegenSchemaEntries(readFileSync(abs, 'utf8'))) {
      if (/^[a-z]+:\/\//i.test(entry)) continue; // introspection URL
      const rel = path.posix.normalize(path.posix.join(path.posix.dirname(cfg), entry));
      if (!list.includes(rel)) list.push(rel);
    }
  }
  schemaFileList = list;
  return list;
}
// Minimal YAML reading of the top-level `schema:` key (string or list of strings)
function codegenSchemaEntries(yaml) {
  const lines = yaml.split(/\r?\n/);
  const i = lines.findIndex((l) => /^schema\s*:/.test(l));
  if (i < 0) return [];
  const inline = lines[i].replace(/^schema\s*:\s*/, '').replace(/\s+#.*$/, '').trim();
  if (inline) return [inline.replace(/^['"]|['"]$/g, '')];
  const entries = [];
  for (const l of lines.slice(i + 1)) {
    if (/^\s*(#.*)?$/.test(l)) continue;
    const m = /^\s+-\s*(['"]?)([^'"#]+?)\1\s*(#.*)?$/.exec(l);
    if (!m) break;
    entries.push(m[2]);
  }
  return entries;
}
const isSchemaFile = (file) => schemaFiles().includes(file);

function loadSchema() {
  if (schemaInfo) return schemaInfo;
  schemaInfo = { types: new Map(), fields: new Map(), entityNames: [], entitySet: new Set(), bySegment: new Map(), runtimeTypes: new Set(), subscriptionType: null, sources: [], doc: null };
  const definitions = [];
  for (const file of schemaFiles()) {
    const abs = path.join(repoRoot, file);
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, 'utf8');
    let doc;
    try {
      doc = graphql.parse(text);
    } catch (e) {
      findings.push({ file, line: 1, column: 1, token: file, message: `GraphQL schema parse error: ${e.message}`, severity: 'error' });
      continue;
    }
    schemaInfo.sources.push({ file, text, doc });
    definitions.push(...doc.definitions);
  }
  if (!definitions.length) return schemaInfo;
  schemaInfo.doc = { kind: 'Document', definitions };
  for (const def of definitions) {
    if (!def.name) continue;
    const name = def.name.value;
    if (!/Extension$/.test(def.kind)) schemaInfo.types.set(name, def);
    if (def.fields) schemaInfo.fields.set(name, [...(schemaInfo.fields.get(name) ?? []), ...def.fields]);
  }
  const roots = { query: 'Query', mutation: 'Mutation', subscription: 'Subscription' };
  for (const def of definitions) {
    if (def.kind === 'SchemaDefinition') {
      for (const op of def.operationTypes) roots[op.operation] = op.type.name.value;
    }
  }
  schemaInfo.subscriptionType = roots.subscription;
  // `runtime` fields of the query and mutation roots lead to the per-CK-type fields
  for (const root of [roots.query, roots.mutation]) {
    for (const f of schemaInfo.fields.get(root) ?? []) {
      if (f.name.value === 'runtime') schemaInfo.runtimeTypes.add(namedTypeOf(f.type));
    }
  }
  // CK entity names = types reachable through the runtime fields (XConnection / XMutations)
  const names = new Set();
  for (const rt of schemaInfo.runtimeTypes) {
    for (const f of schemaInfo.fields.get(rt) ?? []) {
      const t = namedTypeOf(f.type);
      const base = t.replace(/(Connection|Mutations)$/, '');
      if (base !== t && schemaInfo.types.has(base) && !isGenericGraphQlType(base)) names.add(base);
    }
  }
  for (const f of schemaInfo.fields.get(roots.subscription) ?? []) {
    const t = namedTypeOf(f.type);
    const base = t.replace(/(UpdateMessage|Update)$/, '');
    if (base !== t && schemaInfo.types.has(base) && !isGenericGraphQlType(base)) names.add(base);
  }
  // longest first so that prefixes are matched precisely
  schemaInfo.entityNames = [...names].sort((a, b) => b.length - a.length);
  schemaInfo.entitySet = names;
  for (const e of schemaInfo.entityNames) {
    const seg = SEGMENT.exec(e)?.[0];
    if (!seg) continue;
    if (!schemaInfo.bySegment.has(seg)) schemaInfo.bySegment.set(seg, []);
    schemaInfo.bySegment.get(seg).push(e);
  }
  return schemaInfo;
}
// Platform types (RtEntity, RtQuery, Ck*) are not CK model types
function isGenericGraphQlType(name) {
  return (config.genericGraphQlPrefixes ?? ['Rt', 'Ck']).some((p) => new RegExp('^' + p + '[A-Z]').test(name));
}
function namedTypeOf(t) {
  while (t.kind !== 'NamedType') t = t.type;
  return t.name.value;
}
const SEGMENT = /^[A-Z][a-z0-9]*/;
function foreignCkType(typeName, file) {
  const { entityNames, bySegment } = loadSchema();
  const allowed = allowedGraphQlPrefixes(file);
  const seg = SEGMENT.exec(typeName)?.[0];
  if (!seg) return null;
  const entity = (bySegment.get(seg) ?? []).find((e) => typeName.startsWith(e));
  if (!entity) return null;
  if (allowed.some((p) => entity.startsWith(p))) return null;
  return entity;
}
function pascal(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Fragment definitions of all *.graphql documents (spreads may cross files, like in codegen)
const allFragments = new Map();
let validationSchema;
function getValidationSchema() {
  if (validationSchema !== undefined) return validationSchema;
  const { doc } = loadSchema();
  validationSchema = null;
  if (doc) {
    try {
      validationSchema = graphql.buildASTSchema(doc, { assumeValidSDL: true });
    } catch (e) {
      console.log(`${schemaFiles().join(', ')}: warning: schema could not be built for validation: ${e.message}`);
    }
  }
  return validationSchema;
}

function parseGraphQl(file, fullText, docText, base) {
  try {
    return graphql.parse(docText);
  } catch (e) {
    report(file, fullText, base, file, `GraphQL parse error: ${e.message}`, 'error');
    return null;
  }
}

// docText is the GraphQL source; it starts at offset `base` inside fullText (for `gql` templates)
function checkGraphQlDocument(file, fullText, doc, base = 0, { validate = false } = {}) {
  const schema = loadSchema();
  const offsetOf = (node) => base + (node.loc?.start ?? 0);
  const fragments = new Map(allFragments);
  const local = new Set();
  for (const def of doc.definitions) {
    if (def.kind === 'FragmentDefinition') {
      fragments.set(def.name.value, def);
      local.add(def);
    }
  }

  graphql.visit(doc, {
    NamedType(node) {
      const name = node.name.value;
      const entity = foreignCkType(name, file);
      if (entity) {
        report(file, fullText, offsetOf(node), name, `type '${name}' belongs to non-System CK type '${entity}'`, 'error');
      } else if (schema.types.size > 0 && !schema.types.has(name) && !builtinScalars.has(name)) {
        report(file, fullText, offsetOf(node), name, `type '${name}' is not defined in the schema (${schemaFiles().join(', ')}; only System CK types are available)`, 'error');
      }
    },
    StringValue(node) {
      scanText(file, fullText, [{ start: offsetOf(node), end: base + node.loc.end, kind: 'code' }]);
    },
  });

  // Fields of a runtime / subscription root selection, through inline fragments and spreads
  const reported = new Set();
  // `via` = spread of a fragment from another file: findings are reported at that spread
  const checkRootSelection = (selectionSet, visited, via) => {
    for (const sel of selectionSet?.selections ?? []) {
      if (sel.kind === 'Field') {
        const name = sel.name.value;
        const entity = foreignCkType(pascal(name), file);
        if (entity && !reported.has(sel)) {
          reported.add(sel);
          const at = via ?? sel;
          const where = via ? ` (via fragment '${via.name.value}')` : '';
          report(file, fullText, offsetOf(at), name, `field '${name}' resolves to non-System CK type '${entity}'${where}`, 'error');
        }
      } else if (sel.kind === 'InlineFragment') {
        checkRootSelection(sel.selectionSet, visited, via);
      } else if (sel.kind === 'FragmentSpread') {
        const frag = fragments.get(sel.name.value);
        if (frag && !visited.has(frag)) checkRootSelection(frag.selectionSet, new Set(visited).add(frag), via ?? (local.has(frag) ? undefined : sel));
      }
    }
  };
  // Find `runtime` fields anywhere, following inline fragments and spreads
  const walk = (selectionSet, visited, via) => {
    for (const sel of selectionSet?.selections ?? []) {
      if (sel.kind === 'Field' && sel.name.value === 'runtime') checkRootSelection(sel.selectionSet, visited, via);
      if (sel.kind === 'FragmentSpread') {
        const frag = fragments.get(sel.name.value);
        if (frag && !visited.has(frag)) walk(frag.selectionSet, new Set(visited).add(frag), via ?? (local.has(frag) ? undefined : sel));
      } else if (sel.selectionSet) {
        walk(sel.selectionSet, visited, via);
      }
    }
  };
  const rootTypes = new Set([...schema.runtimeTypes, schema.subscriptionType].filter(Boolean));
  for (const def of doc.definitions) {
    if (def.kind === 'OperationDefinition') {
      if (def.operation === 'subscription') checkRootSelection(def.selectionSet, new Set());
      walk(def.selectionSet, new Set());
    } else if (def.kind === 'FragmentDefinition') {
      if (rootTypes.has(def.typeCondition.name.value)) checkRootSelection(def.selectionSet, new Set([def]));
      walk(def.selectionSet, new Set([def]));
    }
  }

  // Unknown types and fields (relevant once the schema is System-only, AB#6204)
  const vSchema = validate ? getValidationSchema() : null;
  if (vSchema) {
    const errors = graphql.validate(vSchema, doc, [graphql.FieldsOnCorrectTypeRule, graphql.KnownTypeNamesRule]);
    for (const err of errors) {
      if (/^Unknown type/.test(err.message)) continue; // already reported above
      const loc = err.nodes?.[0]?.loc?.start ?? 0;
      report(file, fullText, base + loc, err.message, `GraphQL validation: ${err.message}`, 'error');
    }
  }
}

// `gql` tagged templates in hand-written TypeScript
function checkGqlTemplates(file, text, sf) {
  const visit = (node) => {
    if (ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && (node.tag.text === 'gql' || node.tag.text === 'graphql')) {
      const tpl = node.template;
      if (ts.isNoSubstitutionTemplateLiteral(tpl)) {
        const base = tpl.getStart(sf) + 1;
        const doc = parseGraphQl(file, text, tpl.text, base);
        if (doc) checkGraphQlDocument(file, text, doc, base);
      } else {
        scanGraphQlTypeNames(file, text, tpl.getStart(sf), tpl.end, 'GraphQL template references');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

// Generated GraphQL TypeScript (possibleTypes, operation types): type names of non-System CK types
function scanGraphQlTypeNames(file, text, start, end, what) {
  const seen = new Set();
  const WORD = /\b[A-Za-z][A-Za-z0-9_]*\b/g;
  const slice = text.slice(start, end);
  let m;
  while ((m = WORD.exec(slice))) {
    const name = m[0];
    if (seen.has(name)) continue;
    const entity = foreignCkType(pascal(name), file);
    if (!entity) continue;
    seen.add(name);
    report(file, text, start + m.index, name, `${what} '${name}' of non-System CK type '${entity}'`, 'error');
  }
}
function checkGeneratedGraphQlTs(file, text) {
  scanGraphQlTypeNames(file, text, 0, text.length, 'generated code references');
}

// Rule 3. The primary (introspected) schema also holds generic platform types, so it is checked
// against the CK entity types; additional local sources may only define System-prefixed or
// generic (Rt*/Ck*) types, and may only extend existing types.
function checkSchema(file) {
  const schema = loadSchema();
  const src = schema.sources.find((x) => x.file === file);
  if (!src) return;
  const primary = schemaFiles()[0] === file;
  const allowed = allowedGraphQlPrefixes(file);
  for (const def of src.doc.definitions) {
    if (!def.name) continue;
    const name = def.name.value;
    const entity = foreignCkType(name, file);
    if (entity) {
      report(file, src.text, def.name.loc.start, name, `schema defines '${name}' of non-System CK type '${entity}'`, 'error');
    } else if (!primary && !/Extension$/.test(def.kind) && !allowed.some((p) => name.startsWith(p)) && !isGenericGraphQlType(name)) {
      report(file, src.text, def.name.loc.start, name, `local schema source defines '${name}', which is neither a System type nor a generic Rt*/Ck* type`, 'error');
    }
    for (const f of def.fields ?? []) {
      const fe = /Extension$/.test(def.kind) ? foreignCkType(pascal(f.name.value), file) : null;
      if (fe) report(file, src.text, f.name.loc.start, f.name.value, `schema extension adds field '${f.name.value}' of non-System CK type '${fe}'`, 'error');
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Rule 4: import boundaries
// ---------------------------------------------------------------------------------------------
const IMPORT_RE = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
function checkImports(file, text) {
  for (const rule of config.importBoundaries ?? []) {
    if (!matchesAny(file, rule.paths) || matchesAny(file, rule.excludePaths)) continue;
    IMPORT_RE.lastIndex = 0;
    let m;
    while ((m = IMPORT_RE.exec(text))) {
      const spec = m[1] ?? m[2] ?? m[3];
      const target = spec.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)) : spec;
      if (rule.forbidden.some((g) => globToRegExp(g).test(target) || globToRegExp(g).test(target + '/x'))) {
        report(file, text, m.index, spec, `import '${spec}' crosses a boundary: ${rule.reason}`, 'error');
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The script exists once per repo; warn when a checked-out sibling copy differs
// ---------------------------------------------------------------------------------------------
function checkSiblingCopies() {
  const own = readFileSync(fileURLToPath(import.meta.url));
  for (const rel of config.siblingCopies ?? []) {
    const other = path.resolve(repoRoot, rel);
    if (!existsSync(other)) continue;
    if (!own.equals(readFileSync(other))) {
      findings.push({ file: path.relative(repoRoot, fileURLToPath(import.meta.url)), line: 1, column: 1, token: rel, message: `differs from the sibling copy ${rel} - keep both in sync`, severity: 'warning' });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------
const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\n')
  .filter(Boolean)
  .filter((f) => matchesAny(f, config.include) && !matchesAny(f, config.exclude));

const QUICK = /[A-Z][A-Za-z0-9.]*(?:-\d[\d.]*)?\/[A-Z]/;
const GQL_TAG = /\b(?:gql|graphql)\s*`/;
const sources = [];
for (const file of files) {
  const abs = path.join(repoRoot, file);
  if (!existsSync(abs)) continue; // deleted but not yet staged
  sources.push({ file, text: readFileSync(abs, 'utf8') });
}
// Pass 1: parse *.graphql documents and collect their fragments
for (const src of sources) {
  if (isSchemaFile(src.file) || path.extname(src.file) !== '.graphql') continue;
  src.doc = parseGraphQl(src.file, src.text, src.text, 0);
  for (const def of src.doc?.definitions ?? []) if (def.kind === 'FragmentDefinition') allFragments.set(def.name.value, def);
}
// Pass 2: rules
for (const { file, text, doc } of sources) {
  if (isSchemaFile(file)) {
    checkSchema(file);
    continue;
  }
  const ext = path.extname(file);
  if (ext === '.graphql') {
    if (doc) checkGraphQlDocument(file, text, doc, 0, { validate: true });
    if (QUICK.test(text)) scanText(file, text, graphQlCommentRanges(text).filter((r) => r.kind === 'comment'));
    continue;
  }
  if (ext === '.ts') {
    checkImports(file, text);
    const generated = matchesAny(file, config.generatedGraphQlFiles);
    if (generated) checkGeneratedGraphQlTs(file, text);
    const needsLiterals = QUICK.test(text);
    const needsGql = !generated && GQL_TAG.test(text);
    if (!needsLiterals && !needsGql) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    if (needsLiterals) scanText(file, text, tsLiteralRanges(file, text, sf));
    if (needsGql) checkGqlTemplates(file, text, sf);
    continue;
  }
  if (!QUICK.test(text)) continue;
  if (ext === '.html') scanText(file, text, markupCommentRanges(text, '<!--', '-->'));
  else scanText(file, text, null);
}
checkSiblingCopies();

// Apply exceptions
let errors = 0;
let warnings = 0;
let excepted = 0;
const out = [];
for (const f of findings) {
  const matching = f.severity === 'info' ? [] : exceptionsFor(f);
  if (matching.length) {
    for (const ex of matching) ex.used++;
    excepted++;
    continue;
  }
  if (f.severity === 'error') errors++;
  else if (f.severity === 'warning') warnings++;
  out.push(`${f.file}:${f.line}:${f.column}: ${f.severity}: ${f.message}`);
}
for (const e of exceptionState) {
  const label = `${path.basename(exceptionsPath)}[${e.index}] (${e.path}${e.pattern ? ` /${e.pattern}/` : ''})`;
  if (e.problems.length) {
    errors++;
    out.push(`${label}: error: invalid exception: ${e.problems.join(', ')}`);
  } else if (e.expires && e.expires < today) {
    errors++;
    out.push(`${label}: error: exception expired on ${e.expires} (${e.workItem})`);
  } else if (e.used === 0) {
    warnings++;
    out.push(`${label}: warning: stale exception, nothing matches any more - remove it (${e.workItem})`);
  } else if (e.maxCount && e.used > e.maxCount) {
    errors++;
    out.push(`${label}: error: ${e.used} findings exceed maxCount ${e.maxCount} - fix the new ones instead of raising the limit (${e.workItem})`);
  } else if (e.maxCount && e.used < e.maxCount) {
    warnings++;
    out.push(`${label}: warning: only ${e.used} of maxCount ${e.maxCount} findings left - lower maxCount (${e.workItem})`);
  }
}

// --json: machine-readable list of the findings not covered by an exception (for baseline updates)
if (args.has('--json')) {
  const open = findings.filter((f) => f.severity !== 'info' && exceptionsFor(f).length === 0);
  console.log(JSON.stringify(open, null, 2));
  process.exit(errors > 0 ? 1 : 0);
}
if (out.length) console.log(out.join('\n'));
if (verbose) {
  const byException = exceptionState.filter((e) => e.used).map((e) => `  ${e.used.toString().padStart(5)}  ${e.workItem}  ${e.path}${e.pattern ? ` /${e.pattern}/` : ''}`);
  if (byException.length) console.log('Excepted findings:\n' + byException.join('\n'));
}
console.log(
  `check-system-ck-only: ${sources.length} files, ${errors} error(s), ${warnings} warning(s), ${excepted} excepted by ${exceptions.length} exception(s), ${weakMatches} prose match(es) ignored in ${Date.now() - started} ms`,
);
process.exitCode = errors > 0 ? 1 : 0;
