/**
 * Simulation Panel Component (Dockview Wrapper)
 *
 * Wraps the SimulationPanelComponent for use in dockview panels.
 * Provides sliders and inputs for simulating transform property values.
 */

import { Component, Input, computed, Signal, signal, effect, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  SimulationPanelComponent as SimulationPanelInner,
  SimulationValueChange
} from '../simulation-panel.component';
import { TransformProperty } from '../../primitives/models/transform-property.models';

/**
 * Parameters passed from dockview to this panel
 */
export interface SimulationPanelParams {
  properties?: Signal<TransformProperty[]>;
  values?: Signal<Record<string, unknown>>;
  onValueChange?: (event: SimulationValueChange) => void;
  onResetValues?: () => void;
}

@Component({
  selector: 'mm-simulation-panel-wrapper',
  standalone: true,
  imports: [CommonModule, SimulationPanelInner],
  template: `
    <div class="panel-container">
      @if (properties().length > 0) {
        <mm-simulation-panel
          [properties]="properties()"
          [values]="values()"
          (valueChange)="onValueChange($event)"
          (resetValues)="onResetValues()">
        </mm-simulation-panel>
      } @else {
        <div class="no-properties">
          <p>No exposed properties defined</p>
          <p class="hint">Add properties in the Exposures panel to simulate them here</p>
        </div>
      }
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

    .no-properties {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 1rem;
      text-align: center;
      color: var(--text-secondary, #9292a6);
    }

    .no-properties p {
      margin: 0;
    }

    .no-properties .hint {
      margin-top: 0.5rem;
      font-size: 0.85rem;
      opacity: 0.7;
    }
  `]
})
export class SimulationPanelWrapperComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  // Use signal-based params to ensure reactivity when dockview sets params after init
  private readonly _params = signal<SimulationPanelParams>({});

  @Input()
  set params(value: SimulationPanelParams) {
    this._params.set(value);
  }

  readonly properties = computed(() =>
    this._params().properties?.() ?? []
  );

  readonly values = computed(() =>
    this._params().values?.() ?? {}
  );

  // Effect to trigger change detection when signals update
  private readonly selectionEffect = effect(() => {
    this.properties();
    this.values();
    this.cdr.markForCheck();
  });

  onValueChange(event: SimulationValueChange): void {
    this._params().onValueChange?.(event);
  }

  onResetValues(): void {
    this._params().onResetValues?.();
  }
}
