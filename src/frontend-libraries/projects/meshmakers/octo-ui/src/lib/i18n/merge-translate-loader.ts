import { HttpClient } from '@angular/common/http';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

const OCTO_UI_I18N_PREFIX = '/octo-ui/i18n/';

/**
 * Merges translations from app loader (e.g. backend) with octo-ui translations loaded via HTTP.
 * Library translations are served from /octo-ui/i18n/{lang}.json - host app must copy
 * node_modules/@meshmakers/octo-ui/i18n to its assets (see README).
 */
export function createMergedTranslateLoader(
  appLoader: TranslateLoader,
  http: HttpClient
): TranslateLoader {
  return {
    getTranslation(lang: string): Observable<TranslationObject> {
      const octoUiUrl = `${OCTO_UI_I18N_PREFIX}${lang}.json`;
      const octoUiTranslations$ = http
        .get<TranslationObject>(octoUiUrl)
        .pipe(catchError(() => of({})));

      return appLoader.getTranslation(lang).pipe(
        switchMap((appTranslations) =>
          octoUiTranslations$.pipe(
            map((octoTranslations) => ({
              ...octoTranslations,
              ...appTranslations,
            }))
          )
        )
      );
    },
  };
}
