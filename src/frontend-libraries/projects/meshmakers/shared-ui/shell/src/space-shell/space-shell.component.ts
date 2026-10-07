import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';
import { ShellNavNode } from '../shell-navigation.service';
import { SpaceStatusChip } from '../space-header.service';
import { SpaceMetaItem } from '../home-greeting';
import { formatShellMessage, ShellMessages, shellMessages } from '../shell.messages';

interface MenuPosition {
  top: number;
  left: number;
}

/**
 * The header of a space (concept §3.3): breadcrumbs, the area title with
 * optional status chips and a primary-action slot, and the tab strip built
 * from the area's children — the same entries the rail flyout lists.
 *
 * Content projection:
 * - `[spaceCrumbs]` — the breadcrumb line above the title
 * - `[spaceActions]` — primary actions, right of the title
 *
 * Tabs are navigation, not ARIA tabs (there is no tab panel): a `nav` with
 * buttons and `aria-current="page"` on the active one. A grouping tab
 * without its own page (e.g. Swagger) is a menu button: opening moves focus
 * into the menu, Arrow Up/Down/Home/End move, Escape (on the button or in the
 * menu) closes and returns focus to the button, Tab / focus leaving / a click
 * outside / scrolling or resizing closes it. The menu is positioned `fixed`
 * from the button's bounding box, so the scrollable tab strip cannot clip it.
 * Without an area (a page outside the current mode's navigation) only the
 * breadcrumbs and actions are shown. A `heading` replaces the area name and a `meta` line
 * follows it (Home greets the user and names the tenant, wireframe screen 1).
 *
 * On an object detail page (`objectDetail`, AB#5547) the page's own object header
 * (name, chips, actions, object tabs) replaces the area title, the status chips and
 * the tab strip: the space header shrinks to one line with a back link to the list
 * the object belongs to (`backTarget`, e.g. "Adapters"), the breadcrumbs and the
 * actions slot.
 */
@Component({
  selector: 'mm-space-shell',
  templateUrl: './space-shell.component.html',
  styleUrl: './space-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpaceShellComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly area = input<ShellNavNode | null>(null);
  readonly activeTabId = input<string | null>(null);
  readonly chips = input<SpaceStatusChip[]>([]);
  /** Replaces the area name as the title (Home: the greeting, AB#5558). */
  readonly heading = input<string | null>(null);
  /** A short meta line right of the title (Home: the tenant), hidden on phones. */
  readonly meta = input<SpaceMetaItem[]>([]);
  /** The page renders its own object header; area title, chips and tabs are left out. */
  readonly objectDetail = input(false);
  /** Show the area's tab strip; false when the page lists the same entries itself (Settings home). */
  readonly showTabs = input(true);
  /** Target of the back link on an object detail page (the list of the object). */
  readonly backTarget = input<ShellNavNode | null>(null);
  /** Translations; members left out fall back to {@link SHELL_MESSAGES}, then English. */
  readonly messages = input<Partial<ShellMessages> | null>(null);
  protected readonly m = shellMessages(this.messages);

  readonly tabSelected = output<ShellNavNode>();

  /** The grouping tab whose menu is open. */
  protected readonly openMenuId = signal<string | null>(null);
  protected readonly menuPosition = signal<MenuPosition>({ top: 0, left: 0 });

  protected readonly tabs = computed(() => this.area()?.children ?? []);

  constructor() {
    // A tab strip wider than the screen (phones) scrolls sideways: keep the active tab visible.
    afterRenderEffect(() => {
      const id = this.activeTabId();
      this.tabs();
      if (id) {
        this.revealTab(id);
      }
    });
  }

  /** Scrolls the tab strip (only it, never the page) so the tab is fully visible. */
  revealTab(id: string): void {
    const strip = this.host.nativeElement.querySelector<HTMLElement>('.space-tabs');
    const tab = Array.from(strip?.querySelectorAll<HTMLElement>('[data-tab-id]') ?? [])
      .find(button => button.getAttribute('data-tab-id') === id);
    if (!strip || !tab) {
      return;
    }
    const stripRect = strip.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const margin = 16;
    if (tabRect.left < stripRect.left) {
      strip.scrollLeft += tabRect.left - stripRect.left - margin;
    } else if (tabRect.right > stripRect.right) {
      strip.scrollLeft += tabRect.right - stripRect.right + margin;
    }
  }

  protected format(message: string, values: Record<string, string>): string {
    return formatShellMessage(message, values);
  }

  protected onBackClick(target: ShellNavNode): void {
    this.tabSelected.emit(target);
  }

  protected isGroup(tab: ShellNavNode): boolean {
    return !tab.navigable && tab.children.some(child => !child.separator);
  }

  protected menuId(tab: ShellNavNode): string {
    return `space-tab-menu-${tab.id}`;
  }

  protected onTabClick(tab: ShellNavNode, button: HTMLElement): void {
    if (this.isGroup(tab)) {
      if (this.openMenuId() === tab.id) {
        this.closeMenu(false);
      } else {
        this.openMenu(tab, button);
      }
      return;
    }
    this.closeMenu(false);
    this.tabSelected.emit(tab);
  }

  protected onTabKeydown(tab: ShellNavNode, button: HTMLElement, event: KeyboardEvent): void {
    if (!this.isGroup(tab)) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.openMenu(tab, button);
    } else if (event.key === 'Escape' && this.openMenuId() === tab.id) {
      event.preventDefault();
      this.closeMenu(true);
    }
  }

  protected onMenuItemClick(item: ShellNavNode): void {
    this.closeMenu(true);
    this.tabSelected.emit(item);
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const items = this.menuItems();
    const index = items.indexOf(event.target as HTMLElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
        break;
      case 'Home':
        event.preventDefault();
        items[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        items[items.length - 1]?.focus();
        break;
      case 'Escape':
        event.preventDefault();
        this.closeMenu(true);
        break;
      case 'Tab':
        this.closeMenu(false);
        break;
    }
  }

  protected onWrapperFocusOut(tab: ShellNavNode, event: FocusEvent): void {
    const next = event.relatedTarget;
    const wrapper = event.currentTarget as HTMLElement;
    if (this.openMenuId() === tab.id && !(next instanceof Node && wrapper.contains(next))) {
      this.openMenuId.set(null);
    }
  }

  @HostListener('document:click', ['$event.target'])
  protected onDocumentClick(target: EventTarget | null): void {
    if (!this.openMenuId()) {
      return;
    }
    const wrapper = this.openWrapper();
    if (!(target instanceof Node && wrapper?.contains(target))) {
      this.openMenuId.set(null);
    }
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  protected onViewportChange(): void {
    this.openMenuId.set(null);
  }

  private openMenu(tab: ShellNavNode, button: HTMLElement): void {
    const rect = button.getBoundingClientRect();
    this.menuPosition.set({ top: rect.bottom + 4, left: rect.left });
    this.openMenuId.set(tab.id);
    // The menu renders on the next change detection; focus its first entry then.
    setTimeout(() => this.menuItems()[0]?.focus());
  }

  private closeMenu(returnFocus: boolean): void {
    const wrapper = this.openWrapper();
    this.openMenuId.set(null);
    if (returnFocus) {
      wrapper?.querySelector<HTMLElement>('.space-tab')?.focus();
    }
  }

  private openWrapper(): HTMLElement | null {
    const id = this.openMenuId();
    if (!id) {
      return null;
    }
    const wrappers = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-wrapper-id]');
    return Array.from(wrappers).find(wrapper => wrapper.getAttribute('data-wrapper-id') === id) ?? null;
  }

  private menuItems(): HTMLElement[] {
    return Array.from(this.openWrapper()?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }
}
