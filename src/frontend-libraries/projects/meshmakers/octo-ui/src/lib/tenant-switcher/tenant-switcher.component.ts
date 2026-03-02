import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { ButtonComponent } from '@progress/kendo-angular-buttons';
import { PopupComponent } from '@progress/kendo-angular-popup';
import { SVGIconComponent } from '@progress/kendo-angular-icons';
import { circleIcon, exclamationCircleIcon } from '@progress/kendo-svg-icons';

@Component({
  selector: 'mm-tenant-switcher',
  standalone: true,
  imports: [
    ButtonComponent,
    PopupComponent,
    SVGIconComponent
  ],
  template: `
    @if (currentTenantId) {
      <button kendoButton #badgeBtn fillMode="flat" class="tenant-badge" [class.denied]="isDenied"
              (click)="onToggle()">
        <kendo-svgicon [icon]="isDenied ? exclamationCircleIcon : circleIcon"
                       class="tenant-icon"></kendo-svgicon>
        <span class="tenant-name">{{ currentTenantId }}</span>
        @if (isDenied) {
          <span class="denied-label">NO ACCESS</span>
        }
      </button>

      @if (showPopup && !isDenied) {
        <kendo-popup #popupContent [anchor]="badgeBtn.element"
                     (anchorViewportLeave)="showPopup = false">
          <div class="tenant-popup">
            <div class="tenant-popup-header">Switch Tenant</div>
            <ul class="tenant-list">
              @for (tenant of allowedTenants; track tenant) {
                <li class="tenant-list-item" [class.active]="tenant === currentTenantId"
                    (click)="onSelectTenant(tenant)">
                  <kendo-svgicon [icon]="circleIcon" class="tenant-list-icon"></kendo-svgicon>
                  <span>{{ tenant }}</span>
                </li>
              }
            </ul>
          </div>
        </kendo-popup>
      }
    }
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
    }

    .tenant-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px 16px 16px 4px;
      cursor: pointer;
      transition: all 0.2s ease;
      background: var(--kendo-color-surface, transparent);

      &:hover {
        background: var(--kendo-color-base-hover, rgba(0, 0, 0, 0.04));
      }
    }

    .tenant-icon {
      font-size: 0.7rem;
      color: var(--kendo-color-primary, #ff6358);
    }

    .tenant-name {
      font-size: 0.85rem;
      font-weight: 600;
      letter-spacing: 1px;
      color: var(--kendo-color-primary, #ff6358);
      text-transform: uppercase;
    }

    .denied .tenant-icon,
    .denied .tenant-name {
      color: var(--kendo-color-error, #d9534f);
    }

    .denied {
      border-color: var(--kendo-color-error, #d9534f);
    }

    .denied-label {
      font-size: 0.55rem;
      font-weight: 700;
      letter-spacing: 1px;
      color: var(--kendo-color-error, #d9534f);
      background: color-mix(in srgb, var(--kendo-color-error, #d9534f) 15%, transparent);
      padding: 2px 6px;
      border-radius: 3px;
    }

    .tenant-popup {
      min-width: 220px;
      padding: 8px 0;
      background: var(--kendo-color-surface, #fff);
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
    }

    .tenant-popup-header {
      padding: 8px 16px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--kendo-color-subtle, #666);
      border-bottom: 1px solid var(--kendo-color-border, #dee2e6);
      margin-bottom: 4px;
    }

    .tenant-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .tenant-list-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: background 0.15s ease;

      &:hover {
        background: var(--kendo-color-base-hover, rgba(0, 0, 0, 0.04));
      }

      &.active {
        color: var(--kendo-color-primary, #ff6358);
        font-weight: 600;
      }
    }

    .tenant-list-icon {
      font-size: 0.5rem;
      color: var(--kendo-color-subtle, #666);
    }

    .tenant-list-item.active .tenant-list-icon {
      color: var(--kendo-color-primary, #ff6358);
    }
  `]
})
export class TenantSwitcherComponent {
  protected readonly circleIcon = circleIcon;
  protected readonly exclamationCircleIcon = exclamationCircleIcon;

  @Input() currentTenantId: string | null = null;
  @Input() allowedTenants: string[] = [];
  @Input() isDenied = false;

  @Output() tenantSelected = new EventEmitter<string>();

  @ViewChild('badgeBtn', { read: ElementRef })
  private anchor: ElementRef | null = null;

  @ViewChild('popupContent', { read: ElementRef })
  private popup: ElementRef | null = null;

  showPopup = false;

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.code === 'Escape') {
      this.showPopup = false;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.contains(event.target)) {
      this.showPopup = false;
    }
  }

  onToggle(): void {
    if (!this.isDenied) {
      this.showPopup = !this.showPopup;
    }
  }

  onSelectTenant(tenantId: string): void {
    if (tenantId !== this.currentTenantId) {
      this.tenantSelected.emit(tenantId);
    }
    this.showPopup = false;
  }

  private contains(target: EventTarget | null): boolean {
    return (
      (this.anchor?.nativeElement.contains(target) ?? false) ||
      (this.popup?.nativeElement.contains(target) ?? false)
    );
  }
}
