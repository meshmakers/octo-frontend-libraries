import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { PopupComponent } from '@progress/kendo-angular-popup';

@Component({
  selector: 'mm-tenant-switcher',
  standalone: true,
  imports: [
    PopupComponent
  ],
  template: `
    @if (currentTenantId) {
      <div #badgeEl class="tenant-badge" [class.denied]="isDenied" (click)="onToggle()">
        <span class="tenant-icon">{{ isDenied ? '\u26A0' : '\u25C6' }}</span>
        <span class="tenant-name">{{ currentTenantId }}</span>
        @if (isDenied) {
          <span class="denied-label">NO ACCESS</span>
        }
      </div>

      @if (showPopup && !isDenied) {
        <kendo-popup #popupContent [anchor]="badgeEl"
                     (anchorViewportLeave)="showPopup = false">
          <div class="tenant-popup">
            <div class="tenant-popup-header">Switch Tenant</div>
            <ul class="tenant-list">
              @for (tenant of allowedTenants; track tenant) {
                <li class="tenant-list-item" [class.active]="tenant === currentTenantId"
                    (click)="onSelectTenant(tenant)">
                  <span class="tenant-list-icon">&#9670;</span>
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
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: var(--mm-tenant-switcher-bg, var(--kendo-color-surface, transparent));
      border: 1px solid var(--mm-tenant-switcher-border, var(--kendo-color-border, #dee2e6));
      border-radius: var(--mm-tenant-switcher-radius, 4px 16px 16px 4px);
      box-shadow: var(--mm-tenant-switcher-shadow, none);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: var(--mm-tenant-switcher-bg-hover, var(--kendo-color-base-hover, rgba(0, 0, 0, 0.04)));
        box-shadow: var(--mm-tenant-switcher-shadow-hover, var(--mm-tenant-switcher-shadow, none));
      }
    }

    .tenant-icon {
      font-size: 0.7rem;
      color: var(--mm-tenant-switcher-accent, var(--kendo-color-primary, #ff6358));
      animation: var(--mm-tenant-switcher-icon-animation, none);
    }

    .tenant-name {
      font-family: var(--mm-tenant-switcher-font, inherit);
      font-size: 0.85rem;
      font-weight: 600;
      letter-spacing: 1px;
      color: var(--mm-tenant-switcher-accent, var(--kendo-color-primary, #ff6358));
      text-transform: uppercase;
      text-shadow: var(--mm-tenant-switcher-text-shadow, none);
    }

    .denied {
      background: var(--mm-tenant-switcher-denied-bg, var(--mm-tenant-switcher-bg, var(--kendo-color-surface, transparent)));
      border-color: var(--mm-tenant-switcher-denied-border, var(--kendo-color-error, #d9534f));
      box-shadow: var(--mm-tenant-switcher-denied-shadow, none);
    }

    .denied .tenant-icon,
    .denied .tenant-name {
      color: var(--mm-tenant-switcher-denied-accent, var(--kendo-color-error, #d9534f));
      text-shadow: var(--mm-tenant-switcher-denied-text-shadow, none);
    }

    .denied-label {
      font-family: var(--mm-tenant-switcher-font, inherit);
      font-size: 0.55rem;
      font-weight: 700;
      letter-spacing: 1px;
      color: var(--mm-tenant-switcher-denied-accent, var(--kendo-color-error, #d9534f));
      background: var(--mm-tenant-switcher-denied-label-bg, color-mix(in srgb, var(--kendo-color-error, #d9534f) 15%, transparent));
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

    @keyframes mm-icon-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.1); }
    }
  `]
})
export class TenantSwitcherComponent {
  @Input() currentTenantId: string | null = null;
  @Input() allowedTenants: string[] = [];
  @Input() isDenied = false;

  @Output() tenantSelected = new EventEmitter<string>();

  @ViewChild('badgeEl', { read: ElementRef })
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
