import { Pipe, PipeTransform, inject } from '@angular/core';
import {
  MM_TRANSLATE,
  MM_TRANSLATE_DEFAULTS,
  MmTranslateParams,
  injectMmLanguage,
  resolveMmTranslation,
} from './mm-translate';

/**
 * `{{ 'MM.SHARED_UI.LIST_VIEW.refresh' | mmT }}` — a library text in the host's language
 * (see `mm-translate.ts`). Optional arguments: interpolation params and an English fallback:
 * `{{ 'MM.X.count' | mmT: { count: n } : '{{ count }} items' }}`.
 *
 * Impure on purpose, but cached: the pipe reads the {@link MM_LANGUAGE} signal, so the template
 * (also an OnPush one) re-renders on a language switch, and it recomputes only when the language,
 * key, params or fallback change. Without host providers it returns the English default.
 */
@Pipe({ name: 'mmT', pure: false })
export class MmTranslatePipe implements PipeTransform {
  private readonly host = inject(MM_TRANSLATE, { optional: true });
  private readonly defaults = inject(MM_TRANSLATE_DEFAULTS, { optional: true }) ?? [];
  private readonly language = injectMmLanguage();

  private lastLanguage: string | null = null;
  private lastKey: string | null = null;
  private lastParams: MmTranslateParams | null | undefined = undefined;
  private lastParamsJson = '';
  private lastFallback: string | undefined = undefined;
  private lastValue = '';

  transform(key: string | null | undefined, params?: MmTranslateParams | null, fallback?: string): string {
    if (!key) {
      return '';
    }
    const language = this.language();
    const paramsJson = params === this.lastParams ? this.lastParamsJson : safeJson(params);
    if (language === this.lastLanguage && key === this.lastKey && paramsJson === this.lastParamsJson
      && fallback === this.lastFallback) {
      this.lastParams = params;
      return this.lastValue;
    }
    this.lastLanguage = language;
    this.lastKey = key;
    this.lastParams = params;
    this.lastParamsJson = paramsJson;
    this.lastFallback = fallback;
    this.lastValue = resolveMmTranslation(this.host, this.defaults, key, params, fallback);
    return this.lastValue;
  }
}

let unserializable = 0;

/** Params as a comparable string; params that cannot be serialised never hit the cache. */
function safeJson(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return `\u0000${++unserializable}`;
  }
}
