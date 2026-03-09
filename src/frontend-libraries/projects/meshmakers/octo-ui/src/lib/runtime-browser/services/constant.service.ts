import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ConstantService {
  OCTO_UI_I18N_PREFIX = '/octo-ui/i18n/';
  DEFAULT_LOCALE = 'en-GB';
}
