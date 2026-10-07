import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, DestroyRef, ElementRef, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SVGIconComponent } from '@progress/kendo-angular-icons';
import { ShellNavNode } from '../shell-navigation.service';
import { ShellMessages, shellMessages } from '../shell.messages';

/**
 * The rail: one icon per area of the navigation tree, Settings pinned to the
 * bottom. Enter/Space or a click on an icon navigates to the area. The
 * flyout with the area's entries is a disclosure: it opens on hover or with
 * Arrow Right (`aria-expanded` / `aria-controls` on the icon); it never opens
 * on focus alone. On phones (≤ 640 px) the rail is a bottom bar without
 * flyouts — the space shell's tab strip takes over.
 *
 * Pointer: hovering opens the flyout after a short intent delay (at once when
 * another flyout is already showing). It stays open while the pointer is over
 * the icon or the flyout — the flyout host spans the gap between them, so
 * crossing it never counts as leaving — and closes only after a grace delay
 * once the pointer has left both. A mouse click on an icon with a flyout
 * still navigates, and additionally pins the flyout open (as does Arrow
 * Right): a pinned flyout ignores the pointer leaving and closes on an
 * outside click, Escape, choosing an entry, focus leaving the entry, or a
 * second click on the same icon.
 *
 * Keyboard: the rail is one tab stop (roving tabindex). Arrow Up/Down (Left/
 * Right on the bottom bar) move between areas, Home/End jump, Arrow Right
 * opens the flyout and focuses its first entry; inside the flyout Arrow
 * Up/Down move, Escape or Arrow Left return to the icon. After choosing a
 * flyout entry focus returns to the area icon instead of falling to <body>.
 *
 * Pure presentation: the host feeds the areas (`ShellNavigationService.topAreas()` /
 * `bottomAreas()`) and handles the outputs (`openArea` / `open`).
 */
/** Hover intent before a flyout opens when none is showing (ms). */
export const RAIL_FLYOUT_OPEN_DELAY = 120;
/** Grace period after the pointer left both icon and flyout (ms). */
export const RAIL_FLYOUT_CLOSE_DELAY = 300;

@Component({
  selector: 'mm-shell-rail',
  imports: [SVGIconComponent, NgTemplateOutlet],
  templateUrl: './rail.component.html',
  styleUrl: './rail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
    '(document:keydown.escape)': 'onDocumentEscape()'
  }
})
export class ShellRailComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly areas = input<ShellNavNode[]>([]);
  readonly bottomAreas = input<ShellNavNode[]>([]);
  readonly activeAreaId = input<string | null>(null);
  /** Translations; members left out fall back to {@link SHELL_MESSAGES}, then English. */
  readonly messages = input<Partial<ShellMessages> | null>(null);
  protected readonly m = shellMessages(this.messages);

  /** An area icon was activated. */
  readonly areaSelected = output<ShellNavNode>();
  /** An entry in a flyout was activated. */
  readonly itemSelected = output<ShellNavNode>();

  /** The area whose flyout is shown. */
  protected readonly openId = signal<string | null>(null);
  /** Opened by click or keyboard: the pointer leaving does not close it. */
  protected readonly pinned = signal(false);
  private readonly focusedId = signal<string | null>(null);
  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearTimers());
  }

  private readonly allAreas = computed(() => [...this.areas(), ...this.bottomAreas()]);

  /** The one area button in the tab order: the focused one, else the active one, else the first. */
  protected readonly tabStopId = computed(() => {
    const ids = this.allAreas().map(area => area.id);
    const focused = this.focusedId();
    if (focused && ids.includes(focused)) {
      return focused;
    }
    const active = this.activeAreaId();
    return active && ids.includes(active) ? active : ids[0] ?? null;
  });

  protected hasFlyout(area: ShellNavNode): boolean {
    return area.children.some(child => !child.separator);
  }

  protected flyoutId(area: ShellNavNode): string {
    return `rail-flyout-${area.id}`;
  }

  protected onAreaClick(area: ShellNavNode, event?: MouseEvent): void {
    // A click with the pointer (detail ≥ 1) pins the flyout; Enter/Space keep the plain behaviour.
    const byPointer = !!event && event.detail > 0;
    if (byPointer && this.hasFlyout(area) && !this.isBottomBar()) {
      if (this.pinned() && this.openId() === area.id) {
        this.close();
        return;
      }
      this.openNow(area.id, true);
    } else {
      this.close();
    }
    this.areaSelected.emit(area);
  }

  protected onItemClick(area: ShellNavNode, item: ShellNavNode): void {
    // The flyout hides once closed; move focus first so it does not drop to <body>.
    this.focusArea(area.id);
    this.close();
    this.itemSelected.emit(item);
  }

  protected onAreaFocus(area: ShellNavNode): void {
    this.focusedId.set(area.id);
  }

  protected onPointerEnter(area: ShellNavNode): void {
    this.cancelClose();
    if (this.pinned() || !this.hasFlyout(area)) {
      return;
    }
    if (this.openId() !== null) {
      // Moving between areas while a flyout shows: switch without delay.
      this.openNow(area.id, false);
      return;
    }
    this.cancelOpen();
    this.openTimer = setTimeout(() => {
      this.openTimer = null;
      this.openNow(area.id, false);
    }, RAIL_FLYOUT_OPEN_DELAY);
  }

  protected onPointerLeave(area: ShellNavNode): void {
    this.cancelOpen();
    if (this.pinned() || this.openId() !== area.id) {
      return;
    }
    this.cancelClose();
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      if (this.openId() === area.id && !this.pinned() && !this.entryOf(area)?.contains(document.activeElement)) {
        this.openId.set(null);
      }
    }, RAIL_FLYOUT_CLOSE_DELAY);
  }

  protected onEntryFocusOut(area: ShellNavNode, event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && this.entryOf(area)?.contains(next)) {
      return;
    }
    // Focus dropping to nothing (e.g. a click on the flyout title) is not "leaving":
    // a pinned flyout waits for the outside click instead.
    if (next === null && this.pinned()) {
      return;
    }
    if (this.openId() === area.id) {
      this.close();
    }
  }

  protected onDocumentPointerDown(event: Event): void {
    const id = this.openId();
    if (!this.pinned() || id === null) {
      return;
    }
    const target = event.target;
    if (target instanceof Node && this.findByAttribute('data-entry-id', id)?.contains(target)) {
      return;
    }
    this.close();
  }

  protected onDocumentEscape(): void {
    if (this.openId() !== null) {
      this.close();
    }
  }

  protected onAreaKeydown(area: ShellNavNode, event: KeyboardEvent): void {
    const ids = this.allAreas().map(a => a.id);
    const index = ids.indexOf(area.id);
    let target: string | undefined;
    switch (event.key) {
      case 'ArrowDown':
        target = ids[(index + 1) % ids.length];
        break;
      case 'ArrowUp':
        target = ids[(index - 1 + ids.length) % ids.length];
        break;
      case 'Home':
        target = ids[0];
        break;
      case 'End':
        target = ids[ids.length - 1];
        break;
      case 'ArrowRight':
        if (this.isBottomBar()) {
          target = ids[(index + 1) % ids.length];
          break;
        }
        if (this.hasFlyout(area)) {
          event.preventDefault();
          this.openNow(area.id, true);
          // The flyout is hidden by CSS (`display: none`) until the entry carries `.open`; render that
          // class first, otherwise browsers (and jsdom with styles) refuse to focus the hidden entry.
          this.changeDetector.detectChanges();
          this.flyoutItems(area)[0]?.focus();
        }
        return;
      case 'ArrowLeft':
        if (this.isBottomBar()) {
          target = ids[(index - 1 + ids.length) % ids.length];
          break;
        }
        return;
      case 'Escape':
        this.close();
        return;
      default:
        return;
    }
    if (target) {
      event.preventDefault();
      this.focusArea(target);
    }
  }

  protected onFlyoutKeydown(area: ShellNavNode, event: KeyboardEvent): void {
    const items = this.flyoutItems(area);
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
      case 'ArrowLeft':
        event.preventDefault();
        this.focusArea(area.id);
        this.close();
        break;
    }
  }

  private openNow(id: string, pinned: boolean): void {
    this.clearTimers();
    this.openId.set(id);
    this.pinned.set(pinned);
  }

  private close(): void {
    this.clearTimers();
    this.openId.set(null);
    this.pinned.set(false);
  }

  private cancelOpen(): void {
    if (this.openTimer !== null) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }
  }

  private cancelClose(): void {
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  private clearTimers(): void {
    this.cancelOpen();
    this.cancelClose();
  }

  private focusArea(id: string): void {
    this.focusedId.set(id);
    this.findByAttribute('data-area-id', id)?.focus();
  }

  private entryOf(area: ShellNavNode): HTMLElement | null {
    return this.findByAttribute('data-entry-id', area.id);
  }

  private flyoutItems(area: ShellNavNode): HTMLElement[] {
    const flyout = this.findByAttribute('id', this.flyoutId(area));
    return flyout ? Array.from(flyout.querySelectorAll<HTMLElement>('.flyout-item')) : [];
  }

  /** Attribute lookup without building a selector from ids (no escaping needed). */
  private findByAttribute(name: string, value: string): HTMLElement | null {
    const candidates = this.host.nativeElement.querySelectorAll<HTMLElement>(`[${name}]`);
    return Array.from(candidates).find(element => element.getAttribute(name) === value) ?? null;
  }

  /** Below 640 px the rail is laid out horizontally at the bottom. */
  private isBottomBar(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches;
  }
}
