import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import defaultTranslations from '../../i18n/en-GB.json';

@Injectable({
  providedIn: 'root',
})
export class AppTranslateService {
  private readonly translateService = inject(TranslateService, {
    optional: true,
  });

  constructor() {
    console.log('wtf');
  }

  instant(key: string): string {
    console.log({
      abc: this.translateService,
    });

    if (!this.translateService) {
      return (defaultTranslations as Record<string, string>)[key] ?? key;
    }

    return this.translateService.instant(key);
  }

  setLanguage(languageCode: string): void {
    this.translateService?.use(languageCode).subscribe(() => {
      console.log('Language changed', languageCode);
    });
  }
}
