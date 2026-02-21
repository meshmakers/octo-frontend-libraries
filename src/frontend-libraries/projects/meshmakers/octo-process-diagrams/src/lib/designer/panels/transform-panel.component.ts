/**
 * Transform Panel Component (Dockview Wrapper)
 *
 * Wraps the TransformPropertyEditorComponent for use in dockview panels.
 * Allows editing transform properties on symbol definitions.
 */

import { Component, Input, computed, Signal, signal, effect, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  TransformPropertyEditorComponent,
  TransformPropertyChangeEvent
} from '../transform-property-editor.component';
import { TransformProperty, PropertyBinding } from '../../primitives/models/transform-property.models';
import { PrimitiveBase } from '../../primitives';
import { SymbolInstance } from '../../primitives/models/symbol.model';

/**
 * Parameters passed from dockview to this panel
 */
export interface TransformPanelParams {
  transformProperties?: Signal<TransformProperty[]>;
  propertyBindings?: Signal<PropertyBinding[]>;
  primitives?: Signal<PrimitiveBase[]>;
  symbolInstances?: Signal<SymbolInstance[]>;
  onPropertyChange?: (event: TransformPropertyChangeEvent) => void;
  onOpenBindings?: (property: TransformProperty) => void;
}

@Component({
  selector: 'mm-transform-panel',
  standalone: true,
  imports: [CommonModule, TransformPropertyEditorComponent],
  template: `
    <div class="panel-container">
      <mm-transform-property-editor
        [transformProperties]="transformProperties()"
        [propertyBindings]="propertyBindings()"
        [primitives]="primitives()"
        [symbolInstances]="symbolInstances()"
        (propertiesChange)="onPropertyChange($event)"
        (openBindings)="onOpenBindings($event)">
      </mm-transform-property-editor>
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
export class TransformPanelComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  // Use signal-based params to ensure reactivity when dockview sets params after init
  private readonly _params = signal<TransformPanelParams>({});

  @Input()
  set params(value: TransformPanelParams) {
    this._params.set(value);
  }

  readonly transformProperties = computed(() =>
    this._params().transformProperties?.() ?? []
  );

  readonly propertyBindings = computed(() =>
    this._params().propertyBindings?.() ?? []
  );

  readonly primitives = computed(() =>
    this._params().primitives?.() ?? []
  );

  readonly symbolInstances = computed(() =>
    this._params().symbolInstances?.() ?? []
  );

  // Effect to trigger change detection when signals update
  private readonly selectionEffect = effect(() => {
    this.transformProperties();
    this.propertyBindings();
    this.primitives();
    this.symbolInstances();
    this.cdr.markForCheck();
  });

  onPropertyChange(event: TransformPropertyChangeEvent): void {
    this._params().onPropertyChange?.(event);
  }

  onOpenBindings(property: TransformProperty): void {
    this._params().onOpenBindings?.(property);
  }
}
