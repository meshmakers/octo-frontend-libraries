import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { copyIcon } from '@progress/kendo-svg-icons';
import { NotificationDisplayService } from '../services/notification-display.service';

/**
 * A component that displays a read-only text value with a copy-to-clipboard button.
 *
 * @example
 * ```html
 * <mm-copyable-text
 *   [value]="rtId"
 *   label="Runtime ID"
 *   copyLabel="Runtime ID">
 * </mm-copyable-text>
 * ```
 */
@Component({
  selector: 'mm-copyable-text',
  standalone: true,
  imports: [CommonModule, ButtonModule, SVGIconModule],
  templateUrl: './copyable-text.component.html',
  styleUrl: './copyable-text.component.scss'
})
export class CopyableTextComponent {
  /** The value to display and copy. Displays an em-dash when null/undefined/empty. */
  @Input({ required: true }) value!: string | null | undefined;

  /** Optional label displayed above the value. */
  @Input() label?: string;

  /** Label used in the notification message. Falls back to label, then 'Value'. */
  @Input() copyLabel?: string;

  /** Tooltip for the copy button. */
  @Input() buttonTitle = 'Copy to clipboard';

  /** Emitted when the value is successfully copied to clipboard. */
  @Output() copied = new EventEmitter<string>();

  protected readonly copyIcon = copyIcon;
  private readonly notificationService = inject(NotificationDisplayService);

  /** Returns true if the value is non-empty and can be copied. */
  protected get hasValue(): boolean {
    return !!this.value && this.value.trim().length > 0;
  }

  /** Copies the value to clipboard and shows a notification. */
  protected copyToClipboard(): void {
    if (!this.hasValue) {
      return;
    }

    navigator.clipboard.writeText(this.value!).then(() => {
      const label = this.copyLabel || this.label || 'Value';
      this.notificationService.showSuccess(`${label} copied to clipboard`, 2000);
      this.copied.emit(this.value!);
    }).catch(err => {
      console.error('Failed to copy:', err);
      this.notificationService.showError('Failed to copy to clipboard');
    });
  }
}
