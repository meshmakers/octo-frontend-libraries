import { Injectable } from '@angular/core';
import { WindowRef } from '@progress/kendo-angular-dialog';

export interface WindowDimensions {
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class WindowStateService {
  private readonly storageKey = 'mm-window-states';
  private activeBackdrops = 0;

  getDimensions(dialogKey: string): WindowDimensions | null {
    const states = this.loadStates();
    return states[dialogKey] ?? null;
  }

  saveDimensions(dialogKey: string, dimensions: WindowDimensions): void {
    const states = this.loadStates();
    states[dialogKey] = dimensions;
    this.saveStates(states);
  }

  clearDimensions(dialogKey: string): void {
    const states = this.loadStates();
    delete states[dialogKey];
    this.saveStates(states);
  }

  resolveWindowSize(
    dialogKey: string,
    defaults: WindowDimensions,
    min?: WindowDimensions
  ): WindowDimensions {
    const stored = this.getDimensions(dialogKey);
    let size = defaults;
    // Sub-min stored values are presumed corrupt (e.g. captured before the dialog's current
    // min was raised, or under a CSS zoom that distorted the saved rect). Fall back to the
    // caller's defaults instead of clamping to min — clamping would trap the dialog at min
    // permanently, since the next captureAndSave would store min and resolveWindowSize would
    // happily return it forever after.
    if (stored && !(min && (stored.width < min.width || stored.height < min.height))) {
      size = stored;
    }
    return this.clampToViewport(size);
  }

  /**
   * Keeps a dialog fully on screen: neither a large default nor a size stored
   * on a bigger monitor may exceed the current viewport (minus a margin), or
   * the action bar ends up unreachable below the fold on small resolutions.
   * The clamp deliberately wins over the dialog's minWidth/minHeight — a
   * slightly-too-small dialog is usable, an off-screen one is not. Stored
   * sizes stay untouched, so returning to a larger screen restores them.
   */
  private clampToViewport(size: WindowDimensions): WindowDimensions {
    const viewport = this.viewportSize();
    const margin = 24;
    const maxWidth = Math.max(280, viewport.width - margin * 2);
    const maxHeight = Math.max(240, viewport.height - margin * 2);
    return {
      width: Math.min(size.width, maxWidth),
      height: Math.min(size.height, maxHeight)
    };
  }

  /** Seam for tests — window.innerWidth/innerHeight are not assignable in Karma. */
  protected viewportSize(): WindowDimensions {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  captureAndSave(
    dialogKey: string,
    windowElement: HTMLElement,
    min?: WindowDimensions
  ): void {
    // Inline style holds the document-pixel dimensions Kendo sets when the user resizes;
    // getBoundingClientRect would return zoom-adjusted values (e.g. parent CSS zoom: 0.75
    // shrinks the rect by 25%) and saving those would cause the window to shrink on every
    // open/close cycle.
    const styleW = this.parsePixels(windowElement.style.width);
    const styleH = this.parsePixels(windowElement.style.height);
    if (styleW <= 0 || styleH <= 0) {
      return;
    }
    this.saveDimensions(dialogKey, {
      width: Math.max(Math.round(styleW), min?.width ?? 0),
      height: Math.max(Math.round(styleH), min?.height ?? 0)
    });
  }

  private parsePixels(value: string | null | undefined): number {
    if (!value) return 0;
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Applies modal behavior to a Kendo WindowRef: shows a dark backdrop overlay
   * that blocks interaction with the background, and removes it when the window closes.
   * Also captures and saves window dimensions on close.
   *
   * Reads minWidth/minHeight from the Kendo Window instance and clamps stored sizes
   * accordingly — both on save (so future captures never fall below min) and as a
   * self-healing pass on entry (so a previously-stored size below the current min is
   * cleared on first open, falling back to the dialog's configured defaults next time).
   */
  applyModalBehavior(dialogKey: string, windowRef: WindowRef): void {
    const windowEl = windowRef.window.location.nativeElement;
    const min = this.readMinDimensions(windowRef);
    this.healStaleDimensions(dialogKey, min);
    this.showBackdrop();

    windowRef.result.subscribe({
      next: () => {
        this.captureAndSave(dialogKey, windowEl, min);
        this.hideBackdrop();
      },
      error: () => {
        this.captureAndSave(dialogKey, windowEl, min);
        this.hideBackdrop();
      }
    });
  }

  private readMinDimensions(windowRef: WindowRef): WindowDimensions | undefined {
    const instance = (windowRef.window as { instance?: { minWidth?: number; minHeight?: number } }).instance;
    if (!instance) return undefined;
    const minWidth = instance.minWidth ?? 0;
    const minHeight = instance.minHeight ?? 0;
    if (minWidth <= 0 && minHeight <= 0) return undefined;
    return { width: minWidth, height: minHeight };
  }

  /**
   * Drops stored dimensions that fall below the current minimum so the next open uses
   * the caller's defaults instead of a too-small persisted size. The current open is
   * unaffected (it already resolved at open time), but the next one is healed.
   */
  private healStaleDimensions(dialogKey: string, min: WindowDimensions | undefined): void {
    if (!min) return;
    const stored = this.getDimensions(dialogKey);
    if (!stored) return;
    if (stored.width < min.width || stored.height < min.height) {
      this.clearDimensions(dialogKey);
    }
  }

  private showBackdrop(): void {
    this.activeBackdrops++;
    if (this.activeBackdrops === 1) {
      this.getOrCreateBackdropElement().style.display = 'block';
    }
  }

  private hideBackdrop(): void {
    this.activeBackdrops = Math.max(0, this.activeBackdrops - 1);
    if (this.activeBackdrops === 0) {
      const el = document.querySelector('.mm-window-backdrop') as HTMLElement | null;
      if (el) {
        el.style.display = 'none';
      }
    }
  }

  private getOrCreateBackdropElement(): HTMLElement {
    let el = document.querySelector('.mm-window-backdrop') as HTMLElement | null;
    if (!el) {
      el = document.createElement('div');
      el.className = 'mm-window-backdrop';
      el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:11499;display:none;';
      document.body.appendChild(el);
    }
    return el;
  }

  private loadStates(): Record<string, WindowDimensions> {
    try {
      const raw = sessionStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveStates(states: Record<string, WindowDimensions>): void {
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(states));
    } catch {
      // sessionStorage full or unavailable
    }
  }
}
