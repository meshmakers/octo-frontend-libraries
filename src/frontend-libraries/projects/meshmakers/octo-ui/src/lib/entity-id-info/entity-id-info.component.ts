import {Component, Input, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ButtonsModule} from '@progress/kendo-angular-buttons';
import {SVGIconModule} from '@progress/kendo-angular-icons';
import {copyIcon} from '@progress/kendo-svg-icons';
import {NotificationDisplayService} from '@meshmakers/shared-ui';

interface CopyOption {
  label: string;
  value: string;
  displayText: string;
}

/**
 * A reusable component for displaying and copying entity identifiers.
 * Provides a dropdown button with options to copy:
 * - RtId: The runtime ObjectId
 * - CkTypeId: The full versioned Construction Kit type ID
 * - RtCkTypeId: The runtime CK type ID (unversioned)
 * - RtEntityId: Combined format {RtCkTypeId}@{RtId}
 *
 * @example
 * ```html
 * <mm-entity-id-info
 *   [rtId]="entity.rtId"
 *   [rtCkTypeId]="entity.ckTypeId"
 *   [ckTypeId]="entity.constructionKitType?.ckTypeId?.fullName">
 * </mm-entity-id-info>
 * ```
 */
@Component({
  selector: 'mm-entity-id-info',
  standalone: true,
  imports: [
    CommonModule,
    ButtonsModule,
    SVGIconModule
  ],
  template: `
    <kendo-dropdownbutton
      [data]="copyOptions"
      [svgIcon]="copyIcon"
      look="flat"
      size="small"
      title="Copy Entity ID to clipboard"
      (itemClick)="copyToClipboard($event)">
      <ng-template kendoDropDownButtonItemTemplate let-item>
        <div class="copy-item">
          <span class="copy-label">{{ item.label }}</span>
          <span class="copy-value">{{ item.displayText }}</span>
        </div>
      </ng-template>
      Copy ID
    </kendo-dropdownbutton>
  `,
  styles: [`
    :host {
      display: inline-block;
    }

    kendo-dropdownbutton {
      ::ng-deep {
        .k-button {
          color: var(--kendo-color-primary, #64ceb9) !important;
          border: 1px solid var(--kendo-color-border, rgba(100, 206, 185, 0.3)) !important;

          &:hover {
            background: var(--kendo-color-base-hover, rgba(100, 206, 185, 0.15)) !important;
            border-color: var(--kendo-color-primary, rgba(100, 206, 185, 0.5)) !important;
          }
        }

        .k-popup {
          min-width: 350px;
        }

        .k-menu-item {
          padding: 0 !important;
        }
      }
    }

    .copy-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 12px;
      width: 100%;
    }

    .copy-label {
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--kendo-color-primary, #64ceb9);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .copy-value {
      font-family: 'Roboto Mono', monospace;
      font-size: 0.75rem;
      color: var(--kendo-color-subtle, #9292a6);
      word-break: break-all;
    }
  `]
})
export class EntityIdInfoComponent {
  private readonly notificationService = inject(NotificationDisplayService);

  protected readonly copyIcon = copyIcon;

  /** The RtId (ObjectId) of the entity */
  @Input({ required: true }) rtId!: string;

  /** The RtCkTypeId - runtime CK type ID (e.g., System.Communication/MeshAdapter) */
  @Input({ required: true }) rtCkTypeId!: string;

  /** The CkTypeId - full versioned Construction Kit type ID (e.g., System.Communication-2.0.3/MeshAdapter-1) */
  @Input() ckTypeId?: string;

  protected get copyOptions(): CopyOption[] {
    const fullCkTypeId = this.ckTypeId || this.rtCkTypeId;
    const rtEntityId = `${this.rtCkTypeId}@${this.rtId}`;

    return [
      {
        label: 'RtId',
        value: this.rtId,
        displayText: this.truncateValue(this.rtId, 24)
      },
      {
        label: 'CkTypeId',
        value: fullCkTypeId,
        displayText: this.truncateValue(fullCkTypeId, 40)
      },
      {
        label: 'RtCkTypeId',
        value: this.rtCkTypeId,
        displayText: this.truncateValue(this.rtCkTypeId, 40)
      },
      {
        label: 'RtEntityId',
        value: rtEntityId,
        displayText: this.truncateValue(rtEntityId, 40)
      }
    ];
  }

  private truncateValue(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength - 3) + '...';
  }

  protected async copyToClipboard(option: CopyOption): Promise<void> {
    try {
      await navigator.clipboard.writeText(option.value);
      this.notificationService.showSuccess(`${option.label} copied`, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      this.notificationService.showError('Failed to copy to clipboard');
    }
  }
}
