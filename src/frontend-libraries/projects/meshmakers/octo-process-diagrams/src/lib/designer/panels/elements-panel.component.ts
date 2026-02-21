/**
 * Elements Panel Component (Dockview Wrapper)
 *
 * Wraps the ElementPaletteComponent for use in dockview panels.
 * Provides the element/primitive palette for drag & drop.
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ElementPaletteComponent, PaletteItem } from '../element-palette.component';

/**
 * Parameters passed from dockview to this panel
 */
export interface ElementsPanelParams {
  onElementDragStart?: (item: PaletteItem) => void;
  onElementDragEnd?: (item: PaletteItem) => void;
}

@Component({
  selector: 'mm-elements-panel',
  standalone: true,
  imports: [CommonModule, ElementPaletteComponent],
  template: `
    <div class="panel-container">
      <mm-element-palette
        (elementDragStart)="onDragStart($event)"
        (elementDragEnd)="onDragEnd($event)">
      </mm-element-palette>
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
export class ElementsPanelComponent {
  @Input() params: ElementsPanelParams = {};

  onDragStart(item: PaletteItem): void {
    this.params.onElementDragStart?.(item);
  }

  onDragEnd(item: PaletteItem): void {
    this.params.onElementDragEnd?.(item);
  }
}
