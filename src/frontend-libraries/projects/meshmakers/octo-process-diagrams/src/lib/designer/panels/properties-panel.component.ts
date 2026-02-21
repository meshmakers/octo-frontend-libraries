/**
 * Properties Panel Component (Dockview Wrapper)
 *
 * Wraps the PropertyInspectorComponent for use in dockview panels.
 * Displays and edits properties of selected elements/primitives.
 */

import { Component, Input, computed, Signal, signal, effect, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PropertyInspectorComponent, PropertyChangeEvent } from '../property-inspector.component';
import { ProcessElement, ProcessConnection } from '../../process-widget.models';
import { PrimitiveBase, StyleClass } from '../../primitives';
import { SymbolInstance, SymbolDefinition } from '../../primitives/models/symbol.model';

/**
 * Parameters passed from dockview to this panel
 */
export interface PropertiesPanelParams {
  selectedElements?: Signal<ProcessElement[]>;
  selectedConnections?: Signal<ProcessConnection[]>;
  selectedPrimitives?: Signal<PrimitiveBase[]>;
  selectedSymbolInstances?: Signal<SymbolInstance[]>;
  symbolDefinitions?: Signal<Map<string, SymbolDefinition>>;
  availableStyleClasses?: Signal<StyleClass[]>;
  onPropertyChange?: (event: PropertyChangeEvent) => void;
}

@Component({
  selector: 'mm-properties-panel',
  standalone: true,
  imports: [CommonModule, PropertyInspectorComponent],
  template: `
    <div class="panel-container">
      <mm-property-inspector
        [selectedElements]="selectedElements()"
        [selectedConnections]="selectedConnections()"
        [selectedPrimitives]="selectedPrimitives()"
        [selectedSymbolInstances]="selectedSymbolInstances()"
        [symbolDefinitions]="symbolDefinitions()"
        [availableStyleClasses]="availableStyleClasses()"
        (propertyChange)="onPropertyChange($event)">
      </mm-property-inspector>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .panel-container {
      height: 100%;
      overflow: hidden;
      background: var(--dv-pane-background-color, #1f2e40);
    }
  `]
})
export class PropertiesPanelComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  // Use signal-based params to ensure reactivity when dockview sets params after init
  private readonly _params = signal<PropertiesPanelParams>({});

  @Input()
  set params(value: PropertiesPanelParams) {
    this._params.set(value);
  }

  // Computed properties that safely access signals from params
  readonly selectedElements = computed(() =>
    this._params().selectedElements?.() ?? []
  );

  readonly selectedConnections = computed(() =>
    this._params().selectedConnections?.() ?? []
  );

  readonly selectedPrimitives = computed(() =>
    this._params().selectedPrimitives?.() ?? []
  );

  readonly selectedSymbolInstances = computed(() =>
    this._params().selectedSymbolInstances?.() ?? []
  );

  readonly symbolDefinitions = computed(() =>
    this._params().symbolDefinitions?.() ?? new Map()
  );

  readonly availableStyleClasses = computed(() =>
    this._params().availableStyleClasses?.() ?? []
  );

  // Effect to trigger change detection when signals update
  // This is needed because dockview creates components dynamically outside Angular's normal flow
  private readonly selectionEffect = effect(() => {
    // Read all signals to track them
    this.selectedElements();
    this.selectedConnections();
    this.selectedPrimitives();
    this.selectedSymbolInstances();
    this.symbolDefinitions();
    this.availableStyleClasses();
    // Trigger change detection
    this.cdr.markForCheck();
  });

  onPropertyChange(event: PropertyChangeEvent): void {
    this._params().onPropertyChange?.(event);
  }
}
