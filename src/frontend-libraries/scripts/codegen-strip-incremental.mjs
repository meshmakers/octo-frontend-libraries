// Removes the per-file `export type Incremental<T>` that typescript-operations >= 6 emits into every operation file
// (it collides in `export *` barrels, TS2308).
import { readFileSync, writeFileSync } from 'node:fs';
for (const file of process.argv.slice(2)) {
  if (!file.endsWith('.ts')) continue;
  const src = readFileSync(file, 'utf8');
  const out = src.replace(/\/\*\* Internal type\. DO NOT USE DIRECTLY\. \*\/\nexport type Incremental<T>[^\n]*\n/g, '');
  if (out !== src) writeFileSync(file, out);
}
