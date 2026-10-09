#!/usr/bin/env node
// Guard: the frontend may depend on System CK models only (AB#6203, epic AB#6186).
//
// Rules
//   1. String literals in *.ts / *.html / *.json / *.md and GraphQL string values that
//      look like a CK id (`Model/Type`, `Model.Sub-1.2.3/Type`) must reference an allowlisted
//      model. Synthetic models (`Test`, `TestModel`) are allowed only in spec/testing paths.
//      Matches in comments are warnings (errors with --strict).
//   2. *.graphql documents: every named type and every field directly under `runtime`
//      (queries and mutations) or a subscription root must not resolve to a non-System CK type.
//      Types unknown to the schema are errors as well.
//   3. schema.graphql: no type definition may belong to a non-System CK type.
//   4. Optional import boundaries (e.g. libraries must not import demo apps).
//
// Configuration lives next to this script:
//   system-ck-allowlist.json   allowed models, file scopes, schema location, import boundaries
//   system-ck-exceptions.json  [{ path, pattern?, reason, workItem, expires? }]
//
// Usage: node scripts/check-system-ck-only.mjs [--strict] [--verbose]
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

function modelAllowed(model, file) {
  const scope = scopesFor(file);
  const models = [...config.models, ...(config.platformModels ?? []), ...scope.flatMap((s) => s.models ?? [])];
  if (models.includes(model)) return true;
  if ((config.modelPrefixes ?? []).some((p) => model.startsWith(p))) return true;
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
  return [...models, ...(config.modelPrefixes ?? []).map((p) => p.replace(/\.$/, ''))].map((m) => m.replace(/\./g, ''));
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
  return { ...e, index: i, problems, used: 0, patternRe: e.pattern ? new RegExp(e.pattern) : null };
});
function exceptionFor(finding) {
  return exceptionState.find(
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

function tsLiteralRanges(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
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
function loadSchema() {
  if (schemaInfo) return schemaInfo;
  schemaInfo = { types: new Map(), entityNames: [], entitySet: new Set(), bySegment: new Map(), runtimeTypes: new Set(), subscriptionType: null, text: '', doc: null };
  if (!config.schema) return schemaInfo;
  const schemaFile = path.join(repoRoot, config.schema);
  if (!existsSync(schemaFile)) return schemaInfo;
  const text = readFileSync(schemaFile, 'utf8');
  const doc = graphql.parse(text, { noLocation: false });
  schemaInfo.text = text;
  schemaInfo.doc = doc;
  for (const def of doc.definitions) {
    if (def.name) schemaInfo.types.set(def.name.value, def);
  }
  const roots = { query: 'Query', mutation: 'Mutation', subscription: 'Subscription' };
  for (const def of doc.definitions) {
    if (def.kind === 'SchemaDefinition') {
      for (const op of def.operationTypes) roots[op.operation] = op.type.name.value;
    }
  }
  schemaInfo.subscriptionType = roots.subscription;
  // `runtime` fields of the query and mutation roots lead to the per-CK-type fields
  for (const root of [roots.query, roots.mutation]) {
    const rootDef = schemaInfo.types.get(root);
    for (const f of rootDef?.fields ?? []) {
      if (f.name.value === 'runtime') schemaInfo.runtimeTypes.add(namedTypeOf(f.type));
    }
  }
  // CK entity names = types reachable through the runtime fields (XConnection / XMutations)
  const names = new Set();
  for (const rt of schemaInfo.runtimeTypes) {
    for (const f of schemaInfo.types.get(rt)?.fields ?? []) {
      const t = namedTypeOf(f.type);
      const base = t.replace(/(Connection|Mutations)$/, '');
      if (base !== t && schemaInfo.types.has(base) && !isGenericGraphQlType(base)) names.add(base);
    }
  }
  for (const f of schemaInfo.types.get(roots.subscription)?.fields ?? []) {
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

function checkGraphQlDocument(file, text) {
  let doc;
  try {
    doc = graphql.parse(text);
  } catch (e) {
    report(file, text, 0, file, `GraphQL parse error: ${e.message}`, 'error');
    return;
  }
  const schema = loadSchema();
  const offsetOf = (node) => node.loc?.start ?? 0;

  graphql.visit(doc, {
    NamedType(node) {
      const name = node.name.value;
      const entity = foreignCkType(name, file);
      if (entity) {
        report(file, text, offsetOf(node), name, `type '${name}' belongs to non-System CK type '${entity}'`, 'error');
      } else if (schema.types.size > 0 && !schema.types.has(name) && !builtinScalars.has(name)) {
        report(file, text, offsetOf(node), name, `type '${name}' is not defined in ${config.schema} (only System CK types are available)`, 'error');
      }
    },
    StringValue(node) {
      scanText(file, text, [{ start: node.loc.start, end: node.loc.end, kind: 'code' }]);
    },
  });

  const checkFieldNames = (selectionSet) => {
    for (const sel of selectionSet?.selections ?? []) {
      if (sel.kind !== 'Field') continue;
      const name = sel.name.value;
      const entity = foreignCkType(pascal(name), file);
      if (entity) report(file, text, offsetOf(sel), name, `field '${name}' resolves to non-System CK type '${entity}'`, 'error');
    }
  };
  const walk = (selectionSet, depth) => {
    for (const sel of selectionSet?.selections ?? []) {
      if (sel.kind === 'Field' && sel.name.value === 'runtime') checkFieldNames(sel.selectionSet);
      if (sel.selectionSet && depth < 3) walk(sel.selectionSet, depth + 1);
    }
  };
  for (const def of doc.definitions) {
    if (def.kind === 'OperationDefinition') {
      if (def.operation === 'subscription') checkFieldNames(def.selectionSet);
      walk(def.selectionSet, 0);
    } else if (def.kind === 'FragmentDefinition') {
      walk(def.selectionSet, 0);
    }
  }
}

// Generated GraphQL TypeScript (possibleTypes, operation types): type names of non-System CK types
function checkGeneratedGraphQlTs(file, text) {
  const seen = new Set();
  const WORD = /\b[A-Z][A-Za-z0-9_]*\b/g;
  let m;
  while ((m = WORD.exec(text))) {
    const name = m[0];
    if (seen.has(name)) continue;
    const entity = foreignCkType(name, file);
    if (!entity) continue;
    seen.add(name);
    report(file, text, m.index, name, `generated code references '${name}' of non-System CK type '${entity}'`, 'error');
  }
}

function checkSchema(file) {
  const schema = loadSchema();
  if (!schema.doc) return;
  for (const def of schema.doc.definitions) {
    if (!def.name) continue;
    const name = def.name.value;
    const entity = foreignCkType(name, file);
    if (entity) report(file, schema.text, def.name.loc.start, name, `schema defines '${name}' of non-System CK type '${entity}'`, 'error');
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
// Main
// ---------------------------------------------------------------------------------------------
const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\n')
  .filter(Boolean)
  .filter((f) => matchesAny(f, config.include) && !matchesAny(f, config.exclude));

const QUICK = /[A-Z][A-Za-z0-9.]*(?:-\d[\d.]*)?\/[A-Z]/;
let scanned = 0;
for (const file of files) {
  const abs = path.join(repoRoot, file);
  if (!existsSync(abs)) continue; // deleted but not yet staged
  const text = readFileSync(abs, 'utf8');
  scanned++;
  if (config.schema && file === config.schema) {
    checkSchema(file);
    continue;
  }
  const ext = path.extname(file);
  if (ext === '.graphql') {
    checkGraphQlDocument(file, text);
    if (QUICK.test(text)) scanText(file, text, graphQlCommentRanges(text).filter((r) => r.kind === 'comment'));
    continue;
  }
  if (ext === '.ts') checkImports(file, text);
  if (ext === '.ts' && matchesAny(file, config.generatedGraphQlFiles)) checkGeneratedGraphQlTs(file, text);
  if (!QUICK.test(text)) continue;
  if (ext === '.ts') scanText(file, text, tsLiteralRanges(file, text));
  else if (ext === '.html') scanText(file, text, markupCommentRanges(text, '<!--', '-->'));
  else scanText(file, text, null);
}

// Apply exceptions
let errors = 0;
let warnings = 0;
let excepted = 0;
const out = [];
for (const f of findings) {
  const ex = f.severity === 'info' ? null : exceptionFor(f);
  if (ex) {
    ex.used++;
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
  }
}

if (out.length) console.log(out.join('\n'));
if (verbose) {
  const byException = exceptionState.filter((e) => e.used).map((e) => `  ${e.used.toString().padStart(5)}  ${e.workItem}  ${e.path}${e.pattern ? ` /${e.pattern}/` : ''}`);
  if (byException.length) console.log('Excepted findings:\n' + byException.join('\n'));
}
console.log(
  `check-system-ck-only: ${scanned} files, ${errors} error(s), ${warnings} warning(s), ${excepted} excepted by ${exceptions.length} exception(s), ${weakMatches} prose match(es) ignored in ${Date.now() - started} ms`,
);
process.exitCode = errors > 0 ? 1 : 0;
