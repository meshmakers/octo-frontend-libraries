import { InjectionToken } from '@angular/core';
import { RuntimeBrowserMessages } from './runtime-browser.model';

/**
 * Injection token for RuntimeBrowser messages.
 * Provide this at route or component level to override default English messages (e.g. for i18n).
 */
export const RUNTIME_BROWSER_MESSAGES = new InjectionToken<RuntimeBrowserMessages>(
  'RUNTIME_BROWSER_MESSAGES',
);
