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

  resolveWindowSize(dialogKey: string, defaults: WindowDimensions): WindowDimensions {
    return this.getDimensions(dialogKey) ?? defaults;
  }

  captureAndSave(dialogKey: string, windowElement: HTMLElement): void {
    const rect = windowElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.saveDimensions(dialogKey, {
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      });
    }
  }

  /**
   * Applies modal behavior to a Kendo WindowRef: shows a dark backdrop overlay
   * that blocks interaction with the background, and removes it when the window closes.
   * Also captures and saves window dimensions on close.
   */
  applyModalBehavior(dialogKey: string, windowRef: WindowRef): void {
    const windowEl = windowRef.window.location.nativeElement;
    this.showBackdrop();

    windowRef.result.subscribe({
      next: () => {
        this.captureAndSave(dialogKey, windowEl);
        this.hideBackdrop();
      },
      error: () => {
        this.captureAndSave(dialogKey, windowEl);
        this.hideBackdrop();
      }
    });
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
