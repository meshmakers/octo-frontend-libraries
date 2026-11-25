import { InjectionToken, Signal, computed, inject, isSignal } from '@angular/core';

/**
 * What a host provides on {@link MESHBOARD_LANGUAGE} (AB#7655): the current UI language as a culture
 * code (`de-AT`, `en-GB`, `de`), fixed or as a signal for apps that switch the language at runtime
 * (the widgets follow it without reloading data). `null` / `undefined` / `''` = no language.
 */
export type MeshBoardLanguageSource = string | Signal<string | null | undefined>;

/**
 * Optional: the host's current UI language. MeshBoard does not derive it from `LOCALE_ID` (that is
 * static in many apps); a host that wants per-language texts in board configurations (table column
 * `titles`, `valueLabels`) hands its language over once, via `provideMeshBoard({ language })`,
 * `provideMeshBoardLanguage(language)` or this token directly. Not provided = the configured default
 * texts (e.g. the column `title`).
 *
 * ```ts
 * providers: [provideMeshBoard({ language: languageService.currentLanguage })] // Signal<string>
 * ```
 */
export const MESHBOARD_LANGUAGE = new InjectionToken<MeshBoardLanguageSource>('MESHBOARD_LANGUAGE');

/** Reads a {@link MeshBoardLanguageSource} (fixed or signal) as a normalised culture code, or `null`. */
export function readMeshBoardLanguageSource(source: MeshBoardLanguageSource | null | undefined): string | null {
  if (!source) {
    return null;
  }
  const value = isSignal(source) ? source() : source;
  if (typeof value !== 'string') {
    return null;
  }
  const normalised = value.trim().replace(/_/g, '-');
  return normalised === '' || !isValidLocale(normalised) ? null : normalised;
}

/** A tag `Intl` accepts; a malformed one (e.g. `de AT`) counts as no host language, so formats keep their defaults (AB#9743). */
function isValidLocale(tag: string): boolean {
  try {
    return Intl.getCanonicalLocales(tag).length > 0;
  } catch {
    return false;
  }
}

/** The host language of {@link MESHBOARD_LANGUAGE} as a signal (`null` without one). Call in an injection context. */
export function injectMeshBoardLanguage(): Signal<string | null> {
  const source = inject(MESHBOARD_LANGUAGE, { optional: true });
  return computed(() => readMeshBoardLanguageSource(source));
}

/**
 * Well-formed culture key of a per-language text map: a 2-3 letter language, optionally followed by
 * subtags (`de`, `de-AT`, `en-GB`, `zh-Hant-TW`). Keys such as `german` or `de_AT` are not culture codes.
 */
const CULTURE_KEY = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/;

/** Whether `key` is a well-formed culture key of a per-language text map. */
export function isCultureKey(key: string): boolean {
  return CULTURE_KEY.test(key);
}

/**
 * Picks the text for `language` from a per-language map (AB#7655). Lookup order:
 * 1. the exact culture or language (`de-AT`, `de`; case-insensitive);
 * 2. a culture (`de-AT`) without an exact key: a key equal to its language part (`de`). A culture
 *    never picks a sibling culture (`de-DE` does not take `de-AT`);
 * 3. a bare language (`de`) without an exact key: the first authored key of that language
 *    (`de-AT` in `{ 'en-GB': …, 'de-AT': …, 'de-DE': … }`), in the map's key order.
 * Returns `undefined` when there is no language, no map or no match, so the caller applies its own
 * fallback (e.g. the column `title`).
 */
export function pickLocalizedText(texts: Readonly<Record<string, string>> | null | undefined, language: string | null | undefined): string | undefined {
  if (!texts || !language) {
    return undefined;
  }
  const wanted = language.toLowerCase();
  const isBareLanguage = !wanted.includes('-');
  const languagePart = wanted.split('-')[0];
  let languageMatch: string | undefined;
  for (const [key, text] of Object.entries(texts)) {
    if (typeof text !== 'string' || text === '') {
      continue;
    }
    const candidate = key.toLowerCase();
    if (candidate === wanted) {
      return text;
    }
    if (languageMatch !== undefined) {
      continue;
    }
    if (isBareLanguage ? candidate.split('-')[0] === wanted : candidate === languagePart) {
      languageMatch = text;
    }
  }
  return languageMatch;
}

/**
 * Keeps the usable entries of a per-language text map: culture keys with a non-empty string text.
 * Bad culture keys are pushed to `unknownCultureKeys`; the keys of entries with a non-string or
 * empty text are returned as `malformedKeys`.
 */
export function cleanLocalizedTexts(
  texts: Record<string, unknown>,
  unknownCultureKeys: string[]
): { texts: Record<string, string>; malformedKeys: string[] } {
  const clean: Record<string, string> = {};
  const malformedKeys: string[] = [];
  for (const [key, text] of Object.entries(texts)) {
    if (!isCultureKey(key)) {
      unknownCultureKeys.push(key);
      continue;
    }
    if (typeof text !== 'string' || text === '') {
      malformedKeys.push(key);
      continue;
    }
    clean[key] = text;
  }
  return { texts: clean, malformedKeys };
}

/** An author text resolved for the host language, with the entries that were ignored. */
export interface LocalizedTextResolution {
  /** The text to show: the per-language entry for the language, else the single fallback text. */
  text: string;
  /**
   * Ignored entries of the per-language map: keys that are no culture code, keys with a non-string
   * or empty text, and `'*'` when the map itself is no object. Empty when nothing was ignored.
   */
  ignoredKeys: string[];
}

/**
 * Resolves an author text that has a single default (`title`, `name`, `description`) and an
 * optional per-language map (`titles`, `names`, `descriptions`) for the host language, with
 * {@link pickLocalizedText}. Unusable entries are ignored and reported in `ignoredKeys`; without a
 * language or a matching entry the single text is returned.
 */
export function resolveLocalizedText(fallback: string, texts: unknown, language: string | null | undefined): LocalizedTextResolution {
  if (texts === undefined || texts === null) {
    return { text: fallback, ignoredKeys: [] };
  }
  if (typeof texts !== 'object' || Array.isArray(texts)) {
    return { text: fallback, ignoredKeys: ['*'] };
  }
  const unknownCultureKeys: string[] = [];
  const cleaned = cleanLocalizedTexts(texts as Record<string, unknown>, unknownCultureKeys);
  return {
    text: pickLocalizedText(cleaned.texts, language) ?? fallback,
    ignoredKeys: [...unknownCultureKeys, ...cleaned.malformedKeys]
  };
}
