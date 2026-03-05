import { inject, Pipe, PipeTransform } from '@angular/core';
import { AppTranslateService } from './translate.service';

/**
 * Translation pipe for runtime-browser.
 * Delegates to host app's TranslateService. Use createMergedTranslateLoader to merge library translations.
 */
@Pipe({ name: 'appTranslate' })
export class AppTranslatePipe implements PipeTransform {
  private readonly translateService = inject(AppTranslateService);

  transform(key: string): string {
    return this.translateService.instant(key);
  }
}
