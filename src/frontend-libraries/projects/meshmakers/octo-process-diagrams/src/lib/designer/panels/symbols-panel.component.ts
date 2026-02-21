/**
 * Symbols Panel Component (Dockview Wrapper)
 *
 * Wraps the SymbolLibraryPanelComponent for use in dockview panels.
 * Provides the symbol library browser for drag & drop.
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SymbolLibraryPanelComponent, SymbolPaletteItem } from '../symbol-library-panel.component';

/**
 * Parameters passed from dockview to this panel
 */
export interface SymbolsPanelParams {
  onSymbolDragStart?: (item: SymbolPaletteItem) => void;
  onSymbolDragEnd?: () => void;
}

@Component({
  selector: 'mm-symbols-panel',
  standalone: true,
  imports: [CommonModule, SymbolLibraryPanelComponent],
  template: `
    <div class="panel-container">
      <mm-symbol-library-panel
        (symbolDragStart)="onDragStart($event)"
        (symbolDragEnd)="onDragEnd()">
      </mm-symbol-library-panel>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .panel-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
      background: var(--dv-pane-background-color, #1f2e40);
    }
  `]
})
export class SymbolsPanelComponent {
  @Input() params: SymbolsPanelParams = {};

  onDragStart(item: SymbolPaletteItem): void {
    this.params.onSymbolDragStart?.(item);
  }

  onDragEnd(): void {
    this.params.onSymbolDragEnd?.();
  }
}
