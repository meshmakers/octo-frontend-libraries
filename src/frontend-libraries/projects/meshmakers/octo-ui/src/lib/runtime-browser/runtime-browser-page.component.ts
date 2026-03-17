import { Component, inject } from '@angular/core';
import { RuntimeBrowserComponent } from './runtime-browser.component';
import {
  DEFAULT_RUNTIME_BROWSER_MESSAGES,
  RuntimeBrowserMessages,
} from './runtime-browser.model';
import { RUNTIME_BROWSER_MESSAGES } from './runtime-browser.tokens';

/**
 * Page component that wraps RuntimeBrowserComponent with optional message override.
 * Use RUNTIME_BROWSER_MESSAGES token to provide custom/translated messages at route level.
 */
@Component({
  selector: 'mm-runtime-browser-page',
  standalone: true,
  imports: [RuntimeBrowserComponent],
  template: `<mm-runtime-browser [messages]="messages" />`,
})
export class RuntimeBrowserPageComponent {
  private readonly injectedMessages = inject(RUNTIME_BROWSER_MESSAGES, {
    optional: true,
  });

  protected readonly messages: RuntimeBrowserMessages = this.injectedMessages
    ? this.injectedMessages
    : DEFAULT_RUNTIME_BROWSER_MESSAGES;
}
