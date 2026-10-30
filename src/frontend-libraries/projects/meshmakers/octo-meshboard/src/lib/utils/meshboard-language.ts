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
  return normalised === '' ? null : normalised;
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
 * Picks the text for `language` from a per-language map (AB#7655). Lookup order: the exact culture
 * (`de-AT`, case-insensitive), then a key equal to its language part (`de`). A culture never picks a
 * sibling culture (`de-DE` does not take `de-AT`). Returns `undefined` when there is no language, no
 * map or no match, so the caller applies its own fallback (e.g. the column `title`).
 */
export function pickLocalizedText(texts: Readonly<Record<string, string>> | null | undefined, language: string | null | undefined): string | undefined {
  if (!texts || !language) {
    return undefined;
  }
  const wanted = language.toLowerCase();
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
    if (languageMatch === undefined && candidate === languagePart) {
      languageMatch = text;
    }
  }
  return languageMatch;
}
