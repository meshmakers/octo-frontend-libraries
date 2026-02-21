/**
 * Simulation Panel Component
 *
 * A collapsible bottom panel for simulating transform property values.
 * Provides sliders and inputs for each property type to enable live preview.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { arrowRotateCcwIcon } from '@progress/kendo-svg-icons';

import { TransformProperty } from '../primitives/models/transform-property.models';

/**
 * Simulation value change event
 */
export interface SimulationValueChange {
  propertyId: string;
  value: unknown;
}

/**
 * Simulation Panel Component
 */
@Component({
  selector: 'mm-simulation-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonsModule, InputsModule, DecimalPipe],
  template: `
    @if (hasProperties()) {
      <div class="simulation-panel" data-testid="simulation-panel">
        <div class="panel-toolbar">
          <button kendoButton look="flat" size="small" (click)="resetAll($event)" data-testid="simulation-reset-all">
            Reset All
          </button>
        </div>

        <div class="panel-content">
          <div class="properties-grid">
              @for (property of properties; track property.id) {
                <div class="property-control"
                     [class.color-type]="property.type === 'color'"
                     [attr.data-testid]="'simulation-property-' + property.id">
                  <div class="control-header">
                    <span class="property-name">{{ property.name }}</span>
                    @if (property.unit) {
                      <span class="property-unit">{{ property.unit }}</span>
                    }
                  </div>

                  @switch (property.type) {
                    @case ('number') {
                      <div class="number-control">
                        <input type="range"
                               class="value-slider"
                               [min]="property.min ?? 0"
                               [max]="property.max ?? 100"
                               [step]="property.step ?? 1"
                               [value]="getPropertyValue(property.id, property.defaultValue)"
                               (input)="onValueChange(property.id, +$any($event.target).value)"/>
                        <input type="number"
                               class="value-input"
                               [min]="property.min ?? 0"
                               [max]="property.max ?? 100"
                               [step]="property.step ?? 1"
                               [value]="getPropertyValue(property.id, property.defaultValue)"
                               (input)="onValueChange(property.id, +$any($event.target).value)"/>
                      </div>
                      <div class="value-range">
                        <span>{{ property.min ?? 0 }}</span>
                        <span>{{ property.max ?? 100 }}</span>
                      </div>
                    }
                    @case ('color') {
                      <div class="color-control">
                        <input type="color"
                               [value]="getPropertyValue(property.id, property.defaultValue)"
                               (input)="onValueChange(property.id, $any($event.target).value)"/>
                        <input type="text"
                               class="color-input"
                               [value]="getPropertyValue(property.id, property.defaultValue)"
                               (input)="onValueChange(property.id, $any($event.target).value)"/>
                      </div>
                    }
                    @case ('boolean') {
                      <div class="boolean-control">
                        <label class="toggle-label">
                          <input type="checkbox"
                                 [checked]="getPropertyValue(property.id, property.defaultValue)"
                                 (change)="onValueChange(property.id, $any($event.target).checked)"/>
                          <span class="toggle-text">
                            {{ getPropertyValue(property.id, property.defaultValue) ? 'On' : 'Off' }}
                          </span>
                        </label>
                      </div>
                    }
                    @case ('string') {
                      <div class="string-control">
                        <input type="text"
                               [value]="getPropertyValue(property.id, property.defaultValue)"
                               (input)="onValueChange(property.id, $any($event.target).value)"/>
                      </div>
                    }
                  }

                  <button class="reset-button"
                          kendoButton
                          look="flat"
                          size="small"
                          [svgIcon]="resetIcon"
                          title="Reset to default"
                          (click)="resetProperty(property)">
                  </button>
                </div>
              }
            </div>
          </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .simulation-panel {
      background: #fff;
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .panel-toolbar {
      flex-shrink: 0;
      display: flex;
      justify-content: flex-end;
      padding: 0.5rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .panel-content {
      padding: 1rem;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }

    .properties-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
    }

    .property-control {
      position: relative;
      background: #fafafa;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 0.75rem;
      padding-right: 2rem;
    }

    .property-control:hover {
      border-color: #bdbdbd;
    }

    .property-control.color-type {
      min-width: 180px;
    }

    .control-header {
      display: flex;
      align-items: baseline;
      gap: 0.25rem;
      margin-bottom: 0.5rem;
    }

    .property-name {
      font-size: 12px;
      font-weight: 500;
      color: #333;
    }

    .property-unit {
      font-size: 10px;
      color: #666;
    }

    /* Number Control */
    .number-control {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0; /* Allow flex container to shrink */
    }

    .value-slider {
      flex: 1;
      min-width: 0; /* Allow slider to shrink */
      height: 6px;
      -webkit-appearance: none;
      appearance: none;
      background: linear-gradient(to right, #e3f2fd, #1976d2);
      border-radius: 3px;
      cursor: pointer;
    }

    .value-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #1976d2;
      cursor: pointer;
      border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    }

    .value-slider::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #1976d2;
      cursor: pointer;
      border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    }

    .value-input {
      flex: 0 0 50px; /* Fixed width, don't grow, don't shrink */
      width: 50px;
      padding: 0.25rem 0.375rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 12px;
      text-align: right;
      box-sizing: border-box;
    }

    .value-input:focus {
      outline: none;
      border-color: #1976d2;
    }

    .value-range {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #999;
      margin-top: 0.25rem;
    }

    /* Color Control */
    .color-control {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .color-control input[type="color"] {
      width: 40px;
      height: 32px;
      padding: 2px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      cursor: pointer;
    }

    .color-input {
      flex: 1;
      padding: 0.25rem 0.5rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 11px;
      font-family: 'Consolas', 'Monaco', monospace;
    }

    .color-input:focus {
      outline: none;
      border-color: #1976d2;
    }

    /* Boolean Control */
    .boolean-control {
      display: flex;
      align-items: center;
    }

    .toggle-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .toggle-label input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }

    .toggle-text {
      font-size: 12px;
      color: #666;
    }

    /* String Control */
    .string-control input {
      width: 100%;
      padding: 0.375rem 0.5rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 12px;
    }

    .string-control input:focus {
      outline: none;
      border-color: #1976d2;
    }

    /* Reset Button */
    .reset-button {
      position: absolute;
      top: 0.5rem;
      right: 0.25rem;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .property-control:hover .reset-button {
      opacity: 1;
    }
  `]
})
export class SimulationPanelComponent {
  // SVG Icons
  protected readonly resetIcon = arrowRotateCcwIcon;

  @Input() properties: TransformProperty[] = [];
  @Input() values: Record<string, unknown> = {};

  @Output() valueChange = new EventEmitter<SimulationValueChange>();
  @Output() resetValues = new EventEmitter<void>();

  // Internal state
  private _localValues = signal<Record<string, unknown>>({});

  /**
   * Check if there are any properties to display
   */
  hasProperties(): boolean {
    return this.properties.length > 0;
  }

  /**
   * Get property value (from input values or local state)
   */
  getPropertyValue(propertyId: string, defaultValue: unknown): unknown {
    // Check local values first (for simulation state)
    const localValue = this._localValues()[propertyId];
    if (localValue !== undefined) {
      return localValue;
    }

    // Then check input values
    const inputValue = this.values[propertyId];
    if (inputValue !== undefined) {
      return inputValue;
    }

    // Fall back to default
    return defaultValue;
  }

  /**
   * Handle value change
   */
  onValueChange(propertyId: string, value: unknown): void {
    this._localValues.update(values => ({
      ...values,
      [propertyId]: value
    }));

    this.valueChange.emit({ propertyId, value });
  }

  /**
   * Reset a single property to its default
   */
  resetProperty(property: TransformProperty): void {
    this._localValues.update(values => {
      const newValues = { ...values };
      delete newValues[property.id];
      return newValues;
    });

    this.valueChange.emit({
      propertyId: property.id,
      value: property.defaultValue
    });
  }

  /**
   * Reset all properties to defaults
   */
  resetAll(event: Event): void {
    event.stopPropagation();
    this._localValues.set({});
    this.resetValues.emit();
  }
}
