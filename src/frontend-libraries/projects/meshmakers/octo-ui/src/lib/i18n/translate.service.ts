import { Injectable, signal } from '@angular/core';
import deAT from '../../i18n/de-AT.json';
import enGB from '../../i18n/en-GB.json';

const BUNDLED_TRANSLATIONS: Record<string, Record<string, string>> = {
  'en-GB': enGB as Record<string, string>,
  'de-AT': deAT as Record<string, string>,
};

const FALLBACK_LANG = 'en-GB';

/**
 * Self-contained translation service for Runtime Browser.
 * Uses bundled JSON translations (en-GB, de-AT) - no dependency on host app's localization.
 */
@Injectable({
  providedIn: 'root',
})
export class AppTranslateService {
  private readonly currentLanguage = signal<string>(FALLBACK_LANG);

  instant(key: string): string {
    const lang = this.currentLanguage();
    const translations =
      BUNDLED_TRANSLATIONS[lang] ?? BUNDLED_TRANSLATIONS[FALLBACK_LANG];
    return translations[key] ?? key;
  }

  setLanguage(languageCode: string): void {
    this.currentLanguage.set(
      languageCode in BUNDLED_TRANSLATIONS ? languageCode : FALLBACK_LANG
    );
  }
}
