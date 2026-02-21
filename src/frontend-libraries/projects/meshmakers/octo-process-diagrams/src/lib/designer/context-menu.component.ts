import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  HostListener,
  OnInit,
  OnDestroy,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Context menu item
 */
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  separator?: boolean;
  shortcut?: string;
}

/**
 * Context menu action event
 */
export interface ContextMenuAction {
  action: string;
  position: { x: number; y: number };
}

/**
 * Context Menu Component
 *
 * A floating context menu that appears on right-click.
 * Closes when clicking outside or selecting an item.
 */
@Component({
  selector: 'mm-context-menu',
  standalone: true,
  imports: [CommonModule],
  host: {
    '[style.left.px]': 'position.x',
    '[style.top.px]': 'position.y'
  },
  template: `
    <div class="context-menu"
         (click)="$event.stopPropagation()">
      @for (item of items; track item.id) {
        @if (item.separator) {
          <div class="menu-separator"></div>
        } @else {
          <button class="menu-item"
                  [class.disabled]="item.disabled"
                  [disabled]="item.disabled"
                  (click)="onItemClick(item)">
            @if (item.icon) {
              <span class="menu-icon">{{ item.icon }}</span>
            }
            <span class="menu-label">{{ item.label }}</span>
            @if (item.shortcut) {
              <span class="menu-shortcut">{{ item.shortcut }}</span>
            }
          </button>
        }
      }
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      z-index: 10000;
    }

    .context-menu {
      min-width: 180px;
      background: var(--context-menu-bg, #1a2332);
      border: 1px solid var(--context-menu-border, rgba(100, 206, 185, 0.3));
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      padding: 4px 0;
      font-size: 13px;
    }

    .menu-item {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: none;
      text-align: left;
      cursor: pointer;
      color: var(--context-menu-text, #e0e0e0);
      gap: 8px;
    }

    .menu-item:hover:not(.disabled) {
      background: var(--context-menu-hover, rgba(100, 206, 185, 0.15));
    }

    .menu-item.disabled {
      color: var(--context-menu-disabled, #666);
      cursor: not-allowed;
    }

    .menu-icon {
      width: 20px;
      text-align: center;
      flex-shrink: 0;
    }

    .menu-label {
      flex: 1;
    }

    .menu-shortcut {
      color: var(--context-menu-shortcut, #888);
      font-size: 11px;
      margin-left: 16px;
    }

    .menu-separator {
      height: 1px;
      background: var(--context-menu-separator, rgba(100, 206, 185, 0.2));
      margin: 4px 8px;
    }
  `]
})
export class ContextMenuComponent implements OnInit, OnDestroy {

  @Input() position: { x: number; y: number } = { x: 0, y: 0 };
  @Input() items: ContextMenuItem[] = [];

  @Output() action = new EventEmitter<ContextMenuAction>();
  @Output() closed = new EventEmitter<void>();

  private clickListener: ((e: MouseEvent) => void) | null = null;
  private readonly elementRef = inject(ElementRef);

  ngOnInit(): void {
    // Close menu when clicking outside
    setTimeout(() => {
      this.clickListener = (event: MouseEvent) => {
        if (!this.elementRef.nativeElement.contains(event.target)) {
          this.close();
        }
      };
      document.addEventListener('click', this.clickListener);
      document.addEventListener('contextmenu', this.clickListener);
    });
  }

  ngOnDestroy(): void {
    if (this.clickListener) {
      document.removeEventListener('click', this.clickListener);
      document.removeEventListener('contextmenu', this.clickListener);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  onItemClick(item: ContextMenuItem): void {
    if (item.disabled) return;

    this.action.emit({
      action: item.id,
      position: this.position
    });
    this.close();
  }

  private close(): void {
    this.closed.emit();
  }
}
