import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Shared component to display a consistent "widget not configured" message.
 * Used by all widget types when they are not properly configured.
 */
@Component({
  selector: 'mm-widget-not-configured',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="widget-not-configured">
      <span class="warning-icon">!</span>
      <span class="message">Widget not configured</span>
    </div>
  `,
  styles: [`
    .widget-not-configured {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 8px;
      color: var(--kendo-color-error, #dc3545);
    }

    .warning-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(220, 53, 69, 0.1);
      font-weight: bold;
      font-size: 1.25rem;
    }

    .message {
      font-size: 0.875rem;
      text-align: center;
    }
  `]
})
export class WidgetNotConfiguredComponent {}
