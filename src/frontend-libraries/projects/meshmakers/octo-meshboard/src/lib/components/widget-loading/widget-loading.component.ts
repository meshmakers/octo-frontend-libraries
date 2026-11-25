import { Component, ChangeDetectionStrategy } from '@angular/core';
import { injectMeshBoardMessages } from '../../utils/meshboard-messages';

/**
 * Shared loading indicator of the widgets while their data loads (AB#9735).
 * Renders the Kendo Grid's loading mask (`.k-loading-mask`), the indicator the table widget shows
 * through `mm-list-view`, so every widget shows the same spinner. It covers its nearest positioned
 * ancestor; the widget root carries `position: relative`.
 *
 * ```html
 * @if (isLoading()) {
 *   <mm-widget-loading />
 * }
 * ```
 */
@Component({
  selector: 'mm-widget-loading',
  standalone: true,
  host: {
    class: 'k-loading-mask',
    role: 'status'
  },
  template: `
    <span class="k-loading-text">{{ messages().loading }}</span>
    <div class="k-loading-image"></div>
    <div class="k-loading-color"></div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetLoadingComponent {
  protected readonly messages: ReturnType<typeof injectMeshBoardMessages>;

  constructor() {
    this.messages = injectMeshBoardMessages();
  }
}
