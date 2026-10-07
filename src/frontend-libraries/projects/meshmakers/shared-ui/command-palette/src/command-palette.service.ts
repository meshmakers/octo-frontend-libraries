import { Injectable, signal } from '@angular/core';

/** A request to show the palette with a query; a new object per call so effects re-run. */
export interface PaletteOpenRequest {
  query: string;
}

/**
 * Opens and closes the command palette (Cmd/Ctrl+K). The host (AppComponent) renders
 * the overlay and binds the global hotkey; anything else — the top bar's
 * "Search ⌘K" trigger, a Home tile, an empty state — calls {@link open}.
 *
 * Focus returns to the element that had it when the palette opened.
 */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly _isOpen = signal(false);
  private readonly _request = signal<PaletteOpenRequest>({ query: '' });
  private returnFocusTo: HTMLElement | null = null;

  /** Whether the palette is shown. */
  readonly isOpen = this._isOpen.asReadonly();
  /** The latest open request; the palette adopts its query (also while already open). */
  readonly request = this._request.asReadonly();

  /**
   * Shows the palette. `initialQuery` pre-fills the input, e.g. `'>'` for
   * actions or `'/'` for the tenant list. Calling it while open replaces the query.
   */
  open(initialQuery = ''): void {
    if (!this._isOpen()) {
      const active = document.activeElement;
      this.returnFocusTo = active instanceof HTMLElement && active !== document.body ? active : null;
    }
    this._request.set({ query: initialQuery });
    this._isOpen.set(true);
  }

  /** Hides the palette and gives focus back to where it was. */
  close(): void {
    if (!this._isOpen()) {
      return;
    }
    this._isOpen.set(false);
    const target = this.returnFocusTo;
    this.returnFocusTo = null;
    if (target?.isConnected) {
      target.focus();
    }
  }

  /** Opens when closed, closes when open. */
  toggle(initialQuery = ''): void {
    if (this._isOpen()) {
      this.close();
    } else {
      this.open(initialQuery);
    }
  }
}

/** What a global keydown should do to the palette. */
export type PaletteHotkeyAction = 'toggle' | 'open';

/**
 * Maps a document keydown to a palette action (ui-concept §4.3):
 *
 * - Cmd+K (macOS) / Ctrl+K toggles — except inside a Monaco code editor,
 *   whose own Cmd+K chords (comment, format …) must keep working;
 * - `/` opens when no text field, text role, grid or Kendo widget is focused;
 * - everything else, and events another handler already consumed, is ignored.
 */
export function paletteHotkeyAction(event: KeyboardEvent, isOpen: boolean): PaletteHotkeyAction | null {
  if (event.defaultPrevented || event.isComposing) {
    return null;
  }
  const key = event.key?.toLowerCase();
  const target = event.target instanceof Element ? event.target : null;
  if (key === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
    return target?.closest('.monaco-editor') ? null : 'toggle';
  }
  if (event.key === '/' && !isOpen && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditable(target)) {
    return 'open';
  }
  return null;
}

/**
 * Targets where `/` is typed or means something else: text fields, ARIA text
 * roles, grids (Kendo grid keyboard navigation) and Kendo widgets.
 */
const TEXT_ENTRY_SELECTOR = [
  'input', 'textarea', 'select', '[contenteditable=""]', '[contenteditable="true"]',
  '[role="combobox"]', '[role="textbox"]', '[role="searchbox"]', '[role="spinbutton"]',
  '[role="grid"]', '[role="gridcell"]', '[role="treegrid"]',
  '.k-grid', 'kendo-grid', '.k-input', '.k-widget', '.monaco-editor'
].join(', ');

function isEditable(element: Element | null): boolean {
  if (!element) {
    return false;
  }
  if (element instanceof HTMLElement && element.isContentEditable) {
    return true;
  }
  return element.closest(TEXT_ENTRY_SELECTOR) !== null;
}
