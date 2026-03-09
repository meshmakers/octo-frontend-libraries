import { inject, Injectable, Injector, LOCALE_ID } from '@angular/core';
import { firstValueFrom, isObservable } from 'rxjs';
import { ConstantService } from '../runtime-browser/services/constant.service';
import { FallbackTranslateService } from './fallback-translate.service';
import { TranslateServiceLike } from './translate-service-like.interface';

type TranslateServiceCtor = new (...args: never[]) => TranslateServiceLike;

const loadTranslateModule = async (): Promise<{
  TranslateService?: TranslateServiceCtor;
}> => {
  try {
    return await import('@ngx-translate/core');
  } catch {
    return { TranslateService: FallbackTranslateService };
  }
};

/**
 * Translation service for Runtime Browser.
 * Delegates to host app's TranslateService (ngx-translate).
 * Library translations loaded via HTTP from /octo-ui/i18n/ (use createMergedTranslateLoader in app config).
 */
@Injectable({
  providedIn: 'root',
})
export class AppTranslateService {
  private readonly injector = inject(Injector);
  private readonly fallbackTranslateService = inject(FallbackTranslateService);
  private readonly constantService = inject(ConstantService);
  private readonly localeId = inject(LOCALE_ID);
  private translateService: TranslateServiceLike | null = null;
  private translateServicePromise: Promise<void> | null = null;
  private currentLanguage: string | null = null;

  private async ensureTranslateService(): Promise<void> {
    if (this.translateService) {
      return;
    }

    if (this.translateServicePromise) {
      return this.translateServicePromise;
    }

    this.translateServicePromise = (async () => {
      const module = await loadTranslateModule();
      const TranslateService = module?.TranslateService;
      if (TranslateService) {
        this.translateService =
          this.injector.get(TranslateService, null) ??
          this.fallbackTranslateService;
        return;
      }

      this.translateService = this.fallbackTranslateService;
    })().finally(() => {
      this.translateServicePromise = null;
    });

    return this.translateServicePromise;
  }

  instant(key: string): string {
    if (!this.translateService) {
      return this.fallbackTranslateService.instant(key);
    }

    return this.translateService.instant(key) ?? key;
  }

  private async applyLanguage(languageCode: string): Promise<void> {
    const service = this.translateService ?? this.fallbackTranslateService;
    const result = service.use(languageCode);
    if (isObservable(result)) {
      await firstValueFrom(result);
      return;
    }

    await result;
  }

  private async reloadLanguageIfPossible(languageCode: string): Promise<void> {
    const service = this.translateService as {
      reloadLang?: (lang: string) => unknown;
    } | null;
    const reloadLang = service?.reloadLang;
    if (!reloadLang) {
      return;
    }

    const result = reloadLang.call(service, languageCode);
    if (isObservable(result)) {
      await firstValueFrom(result);
      return;
    }

    await result;
  }

  private resolveLanguage(): string {
    const service = this.translateService as {
      currentLang?: string | null;
      defaultLang?: string | null;
    } | null;
    const language =
      service?.currentLang ??
      service?.defaultLang ??
      this.localeId ??
      (typeof navigator !== 'undefined' ? navigator.language : null) ??
      this.constantService.DEFAULT_LOCALE;

    return language || this.constantService.DEFAULT_LOCALE;
  }

  async initialize(languageCode?: string): Promise<void> {
    await this.ensureTranslateService();
    const resolvedLanguage = languageCode ?? this.resolveLanguage();
    await this.reloadLanguageIfPossible(resolvedLanguage);
    await this.applyLanguage(resolvedLanguage);
    this.currentLanguage = resolvedLanguage;
  }

  async setLanguage(languageCode: string): Promise<void> {
    if (languageCode === this.currentLanguage) {
      return;
    }

    await this.ensureTranslateService();
    await this.applyLanguage(languageCode);
    this.currentLanguage = languageCode;
  }
}
