import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ConstantService } from '../runtime-browser/services/constant.service';

export interface TranslateLoaderLike {
  getTranslation(lang: string): Observable<Record<string, unknown>>;
}

/**
 * Merges translations from app loader (e.g. backend) with octo-ui translations loaded via HTTP.
 * Library translations are served from /octo-ui/i18n/{lang}.json - host app must copy
 * node_modules/@meshmakers/octo-ui/i18n to its assets (see README).
 */
export function createMergedTranslateLoader(
  appLoader: TranslateLoaderLike,
  http: HttpClient,
  constants: ConstantService,
): TranslateLoaderLike {
  return {
    getTranslation(lang: string): Observable<Record<string, unknown>> {
      const octoUiUrl = `${constants.OCTO_UI_I18N_PREFIX}${lang}.json`;
      const octoUiTranslations$ = http
        .get<Record<string, unknown>>(octoUiUrl)
        .pipe(catchError(() => of({})));

      return appLoader.getTranslation(lang).pipe(
        switchMap((appTranslations) =>
          octoUiTranslations$.pipe(
            map((octoTranslations) => ({
              ...octoTranslations,
              ...appTranslations,
            })),
          ),
        ),
      );
    },
  };
}
