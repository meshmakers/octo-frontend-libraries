import { inject, Pipe, PipeTransform } from '@angular/core';
import { AppTranslateService } from './translate.service';

/**
 * Translation pipe for runtime-browser.
 * Uses JSON translations (en, en-GB, de-AT) with English fallback when ngx-translate is not provided.
 */
@Pipe({ name: 'appTranslate' })
export class AppTranslatePipe implements PipeTransform {
  private readonly translateService = inject(AppTranslateService);

  transform(key: string): string {
    return this.translateService.instant(key);
  }
}
