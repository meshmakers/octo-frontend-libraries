#!/usr/bin/env node
// i18n check of the libraries (Studio i18n concept §9, AB#6163).
//
// Every library that ships translations has `projects/meshmakers/<lib>/i18n/en.json` + `de.json`
// (packaged as an asset, merged by the host app's translation loader). This script fails when
//   1. a key exists in one language but not in the other (parity),
//   2. a key's placeholders (`{{ name }}` of ngx-translate, `{name}` of the *_MESSAGES defaults)
//      differ between the languages,
//   3. a value is not a string / an object (arrays, numbers, null),
//   4. a key lies outside the library's namespace `MM.<LIB>.` (e.g. `MM.SHARED_UI.`).
// Usage: node scripts/i18n-check.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libsDir = path.join(root, 'projects', 'meshmakers');
const LANGUAGES = ['en', 'de'];

function flatten(node, prefix, out, errors, file) {
  for (const [key, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out.set(full, value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, full, out, errors, file);
    } else {
      errors.push(`${file}: ${full} must be a string or an object`);
    }
  }
  return out;
}

function placeholders(text) {
  const names = new Set();
  for (const m of text.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) names.add(`{{${m[1]}}}`);
  for (const m of text.replace(/\{\{[^}]*\}\}/g, '').matchAll(/\{(\w+)\}/g)) names.add(`{${m[1]}}`);
  return [...names].sort().join(',');
}

const errors = [];
let checked = 0;
for (const lib of readdirSync(libsDir)) {
  const dir = path.join(libsDir, lib, 'i18n');
  if (!existsSync(dir)) continue;
  const namespace = `MM.${lib.replace(/-/g, '_').toUpperCase()}.`;
  const tables = {};
  for (const lang of LANGUAGES) {
    const file = path.join(dir, `${lang}.json`);
    const rel = path.relative(root, file);
    if (!existsSync(file)) {
      errors.push(`${rel}: missing`);
      continue;
    }
    try {
      tables[lang] = flatten(JSON.parse(readFileSync(file, 'utf8')), '', new Map(), errors, rel);
    } catch (e) {
      errors.push(`${rel}: invalid JSON (${e.message})`);
    }
  }
  if (!tables.en || !tables.de) continue;
  checked++;
  for (const [a, b] of [['en', 'de'], ['de', 'en']]) {
    for (const key of tables[a].keys()) {
      if (!tables[b].has(key)) errors.push(`${lib}: "${key}" is in ${a}.json but not in ${b}.json`);
    }
  }
  for (const [key, en] of tables.en) {
    if (!key.startsWith(namespace)) errors.push(`${lib}: "${key}" is outside the namespace ${namespace}*`);
    const de = tables.de.get(key);
    if (de !== undefined && placeholders(en) !== placeholders(de)) {
      errors.push(`${lib}: "${key}" placeholders differ (en: ${placeholders(en) || '-'}, de: ${placeholders(de) || '-'})`);
    }
  }
}

if (errors.length) {
  console.error(`i18n-check: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`i18n-check: OK (${checked} librar${checked === 1 ? 'y' : 'ies'} with translations)`);
