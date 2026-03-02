import { Component, Input } from '@angular/core';
import { LoaderModule } from '@progress/kendo-angular-indicators';

/**
 * Shared loading overlay component for config dialogs.
 * Displays a centered Kendo pulsing loader over the parent container.
 *
 * Usage:
 * ```html
 * <div class="config-form" [class.loading]="isLoadingInitial" style="position: relative;">
 *   <mm-loading-overlay [loading]="isLoadingInitial" />
 *   <!-- form content -->
 * </div>
 * ```
 *
 * The parent element must have `position: relative` for the overlay to be positioned correctly.
 */
@Component({
  selector: 'mm-loading-overlay',
  standalone: true,
  imports: [LoaderModule],
  host: {
    '[class.active]': 'loading',
  },
  template: `
    @if (loading) {
      <kendo-loader type="pulsing" size="medium"></kendo-loader>
    }
  `,
  styles: [`
    :host {
      display: none;
    }

    :host.active {
      display: flex;
      position: absolute;
      inset: 0;
      align-items: center;
      justify-content: center;
      z-index: 100;
      background: var(--kendo-color-surface-alt, #f8f9fa);
    }
  `]
})
export class LoadingOverlayComponent {
  @Input() loading = false;
}
