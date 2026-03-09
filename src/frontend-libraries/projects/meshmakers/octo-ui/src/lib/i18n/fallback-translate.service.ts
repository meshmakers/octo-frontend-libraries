import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConstantService } from '../runtime-browser/services/constant.service';
import { TranslateServiceLike } from './translate-service-like.interface';

@Injectable({
  providedIn: 'root',
})
export class FallbackTranslateService implements TranslateServiceLike {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly constantService = inject(ConstantService);
  private translations: Record<string, string> | null = null;
  private loadPromise: Promise<Record<string, string>> | null = null;

  private async loadTranslations(): Promise<Record<string, string>> {
    if (this.translations) {
      return this.translations;
    }

    if (!this.http) {
      return {};
    }

    if (!this.loadPromise) {
      const url = `${this.constantService.OCTO_UI_I18N_PREFIX}${this.constantService.DEFAULT_LOCALE}.json`;
      this.loadPromise = firstValueFrom(
        this.http.get<Record<string, string>>(url),
      )
        .catch(() => ({}) as Record<string, string>)
        .then((data) => {
          this.translations = data ?? {};
          return this.translations;
        })
        .finally(() => {
          this.loadPromise = null;
        });
    }

    return this.loadPromise;
  }

  instant(key: string): string {
    if (!this.translations) {
      return key;
    }

    return this.translations[key] ?? key;
  }

  async use(languageCode: string): Promise<void> {
    if (languageCode !== this.constantService.DEFAULT_LOCALE) {
      return;
    }

    await this.loadTranslations();
  }
}
