import { InjectionToken, Provider, Signal, inject, signal } from '@angular/core';

/**
 * Host-agnostic translation hook of the `@meshmakers/*` libraries (Studio i18n concept §2.1,
 * AB#6163). The libraries never depend on a translation framework: they ship English defaults and
 * ask the host app through these tokens. An app that provides nothing keeps the English defaults —
 * there is no behaviour change for apps that do not opt in.
 *
 * - {@link MM_TRANSLATE}: `(key, params?) => string | undefined`. The host answers from its
 *   translation store (e.g. `translate.instant` of ngx-translate) and returns `undefined` for a key
 *   it does not know, so the library default applies.
 * - {@link MM_LANGUAGE}: the active UI language as a signal (`'en'`, `'de'`, …). Reading it inside a
 *   template, `computed()` or the {@link MmTranslatePipe} makes texts follow a language switch
 *   without a reload.
 * - {@link MM_TRANSLATE_DEFAULTS}: the English defaults of a library (its `i18n/en.json`, bundled as
 *   a TS constant), provided with {@link provideMmTranslateDefaults}.
 *
 * Keys follow the concept's D4 style: `MM.<LIB>.<AREA>.<camelCaseLeaf>`, e.g.
 * `MM.SHARED_UI.LIST_VIEW.refresh`. Parameters use the ngx-translate syntax `{{ name }}`.
 */

/** Interpolation parameters of a translation, e.g. `{ count: 3 }` for `'{{ count }} items'`. */
export type MmTranslateParams = Readonly<Record<string, unknown>>;

/** The host's lookup: the translated text, or `undefined` when the host has no translation. */
export type MmTranslateFn = (key: string, params?: MmTranslateParams) => string | undefined;

/** A translation table: flat (`{ 'A.b': 'x' }`) or nested (`{ A: { b: 'x' } }`), or both. */
export interface MmTranslationTable {
  readonly [key: string]: string | MmTranslationTable;
}

/** Host lookup for library texts. Optional — without it the English defaults are used. */
export const MM_TRANSLATE = new InjectionToken<MmTranslateFn>('MM_TRANSLATE');

/** The active UI language. Optional — without it the language is `'en'`. */
export const MM_LANGUAGE = new InjectionToken<Signal<string>>('MM_LANGUAGE');

/** English default tables of the libraries (multi provider, see {@link provideMmTranslateDefaults}). */
export const MM_TRANSLATE_DEFAULTS = new InjectionToken<readonly MmTranslationTable[]>('MM_TRANSLATE_DEFAULTS');

const ENGLISH = signal('en').asReadonly();

/**
 * Registers a library's English defaults. Use it in the library's `provideX()` (environment
 * providers) or in a component's `providers` (element injector).
 */
export function provideMmTranslateDefaults(table: MmTranslationTable): Provider {
  return { provide: MM_TRANSLATE_DEFAULTS, useValue: table, multi: true };
}

/** The value at `key` in a table: the flat entry first, then the dotted path into nested objects. */
export function lookupMmTable(table: MmTranslationTable | null | undefined, key: string): string | undefined {
  if (!table) {
    return undefined;
  }
  const flat = table[key];
  if (typeof flat === 'string') {
    return flat;
  }
  let node: string | MmTranslationTable | undefined = table;
  for (const part of key.split('.')) {
    if (!node || typeof node === 'string') {
      return undefined;
    }
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Replaces `{{ name }}` placeholders (ngx-translate syntax) with `params`; unknown names stay. */
export function interpolateMm(text: string, params?: MmTranslateParams | null): string {
  if (!params) {
    return text;
  }
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined || value === null ? match : String(value);
  });
}

/** Translates a key in the current language. */
export type MmTranslate = (key: string, params?: MmTranslateParams | null, fallback?: string) => string;

/**
 * Resolution order of a library text:
 * 1. the host ({@link MM_TRANSLATE}), unless it returns `undefined`, an empty string or the key;
 * 2. the library defaults (`defaults` argument, then every {@link MM_TRANSLATE_DEFAULTS} table);
 * 3. the explicit `fallback`;
 * 4. the key itself (a visible gap, never an exception).
 * A host lookup that throws counts as "no translation" (fail-safe, concept §6).
 */
export function resolveMmTranslation(
  host: MmTranslateFn | null,
  defaults: readonly MmTranslationTable[],
  key: string,
  params?: MmTranslateParams | null,
  fallback?: string
): string {
  if (host) {
    try {
      const value = host(key, params ?? undefined);
      if (value && value !== key) {
        return value;
      }
    } catch {
      // Fail-safe: a broken host lookup must not break the library UI.
    }
  }
  for (const table of defaults) {
    const value = lookupMmTable(table, key);
    if (value !== undefined) {
      return interpolateMm(value, params);
    }
  }
  return fallback !== undefined ? interpolateMm(fallback, params) : key;
}

/** The active language signal: {@link MM_LANGUAGE}, or a constant `'en'`. Injection context only. */
export function injectMmLanguage(): Signal<string> {
  return inject(MM_LANGUAGE, { optional: true }) ?? ENGLISH;
}

/**
 * A translate function for TS code (injection context only). It reads {@link MM_LANGUAGE}, so a
 * `computed(() => t('MM.X.y'))` re-runs on a language switch.
 *
 * @param defaults the library's English defaults (its bundled `en.json`), checked before the
 *   {@link MM_TRANSLATE_DEFAULTS} tables.
 */
export function injectMmT(defaults?: MmTranslationTable): MmTranslate {
  const host = inject(MM_TRANSLATE, { optional: true });
  const language = injectMmLanguage();
  const tables = [...(defaults ? [defaults] : []), ...(inject(MM_TRANSLATE_DEFAULTS, { optional: true }) ?? [])];
  return (key, params, fallback) => {
    language();
    return resolveMmTranslation(host, tables, key, params, fallback);
  };
}
