#!/usr/bin/env node
// Rewrites Jasmine done-callback tests into explicit Promises so that Vitest keeps
// waiting for `done()`:  it('x', (done) => { BODY })  ->  it('x', () => new Promise<void>((done) => { BODY }))
// The test body is left byte-identical. Usage: node scripts/codemod-done-to-promise.mjs <dir> [<dir>...]
import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

function transform(source) {
  const sf = ts.createSourceFile('spec.ts', source, ts.ScriptTarget.Latest, true);
  const edits = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === 'it' || node.expression.text === 'test') &&
      node.arguments.length >= 2
    ) {
      const fn = node.arguments[1];
      if (
        (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) &&
        fn.parameters.length === 1 &&
        ts.isIdentifier(fn.parameters[0].name) &&
        fn.parameters[0].name.text === 'done' &&
        !fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) &&
        ts.isBlock(fn.body)
      ) {
        edits.push({ start: fn.getStart(sf), end: fn.body.getStart(sf), text: '() => new Promise<void>((done) => ' });
        edits.push({ start: fn.body.getEnd(), end: fn.body.getEnd(), text: ')' });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  edits.sort((a, b) => b.start - a.start);
  let out = source;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return { out, count: edits.length / 2 };
}

let total = 0;
for (const dir of process.argv.slice(2)) {
  let listing = '';
  try {
    listing = execFileSync('grep', ['-rl', '--include=*.spec.ts', '--', '(done', dir], { encoding: 'utf8' }); // no shell: the directory argument is never interpreted
  } catch (e) {
    if (e.status !== 1) throw e; // grep exit 1 = no matches (fine); 2 = real error (bad path)
  }
  const files = listing.trim().split('\n').filter(Boolean);
  for (const file of files) {
    const { out, count } = transform(readFileSync(file, 'utf8'));
    if (count === 0) continue;
    const diags = ts.transpileModule(out, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022 } }).diagnostics;
    if (diags.length) throw new Error(`Syntax error after codemod in ${file}: ${diags[0].messageText}`);
    writeFileSync(file, out);
    total += count;
    console.log(`${file}: ${count}`);
  }
}
console.log(`converted ${total} done-callback tests`);
