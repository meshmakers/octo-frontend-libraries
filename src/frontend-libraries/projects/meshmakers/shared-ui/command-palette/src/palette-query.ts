import { PaletteGroup, PaletteQuery } from './command-palette.models';

/** Typed prefixes that force a group (ui-concept §4.2 rule 4). */
export const PALETTE_PREFIXES: Readonly<Record<string, PaletteGroup>> = {
  '>': 'action',
  '@': 'entity',
  '#': 'board',
  '/': 'tenant',
  '?': 'ai'
};

/**
 * Splits the raw input into an optional scope and the search text:
 * `"> theme"` → scope `action`, text `theme`; `"edge"` → no scope.
 * Only the first non-blank character counts as a prefix.
 */
export function parsePaletteQuery(raw: string): PaletteQuery {
  const trimmed = (raw ?? '').trim();
  const first = trimmed.charAt(0);
  const scope = PALETTE_PREFIXES[first] ?? null;
  if (scope) {
    return { raw, prefix: first, scope, text: trimmed.slice(1).trim() };
  }
  return { raw, prefix: null, scope: null, text: trimmed };
}

/** A runtime id: 24 hex characters (MongoDB ObjectId). */
export function isRtId(text: string): boolean {
  return /^[0-9a-f]{24}$/i.test(text);
}
