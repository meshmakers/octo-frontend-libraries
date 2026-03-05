import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Translation service for Runtime Browser.
 * Delegates to host app's TranslateService (ngx-translate).
 * Library translations loaded via HTTP from /octo-ui/i18n/ (use createMergedTranslateLoader in app config).
 */
@Injectable({
  providedIn: 'root',
})
export class AppTranslateService {
  private readonly translateService = inject(TranslateService);

  instant(key: string): string {
    return this.translateService.instant(key) ?? key;
  }

  setLanguage(languageCode: string): void {
    this.translateService.use(languageCode);
  }
}
