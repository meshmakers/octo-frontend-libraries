import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { QueryFamily } from '../../utils/query-family';
import { EntitySelectorConfig } from '../../models/meshboard.models';

/** Internal option shape for the scope dropdown (a "None" row plus one row per selector). */
interface ScopeOption {
  label: string;
  /** `undefined` for the "None" row (no asset-scope binding). */
  value: string | undefined;
}

/**
 * Per-widget asset-scope binding for stream-data persistent-query widgets.
 *
 * Stream-data archives are keyed by their source rtIds, so a widget is scoped
 * to a picked asset by passing those source rtIds as `streamDataArgs.rtIds`
 * (see `MeshBoardStateService.resolveStreamDataRtIds` and the backend
 * `StreamDataArguments.rtIds` override). This control lets the designer bind a
 * single widget to one of the MeshBoard's entity selectors: when the selector's
 * entity is picked, its resolved source rtIds (the selector's `childScope`
 * one-hop, or the picked entity itself) scope this widget's query.
 *
 * The control renders only when the selected query is a stream-data query
 * (`family === 'streamData'`); for runtime queries the binding has no effect and
 * the picker stays hidden (mirrors `SdTimeFilterToggleComponent`).
 *
 * Two-way bindable:
 * ```html
 * <mm-entity-selector-scope-picker
 *   [family]="selectedQueryFamily"
 *   [selectors]="availableEntitySelectors"
 *   [(entitySelectorId)]="entitySelectorId">
 * </mm-entity-selector-scope-picker>
 * ```
 */
@Component({
  selector: 'mm-entity-selector-scope-picker',
  standalone: true,
  imports: [FormsModule, DropDownsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (visible) {
      <div class="form-field entity-selector-scope-picker">
        <label>Scope to entity selector</label>
        <kendo-dropdownlist
          [data]="options"
          textField="label"
          valueField="value"
          [valuePrimitive]="true"
          [ngModel]="entitySelectorId ?? null"
          (valueChange)="onSelect($event)">
        </kendo-dropdownlist>
        <p class="field-hint">
          Scopes this widget's stream-data query to the rtIds resolved from the
          selected asset. Leave unset to use the saved query's own scope.
        </p>
      </div>
    }
  `,
  styles: [`
    .entity-selector-scope-picker .field-hint {
      font-size: 0.85em;
      margin-top: 4px;
      opacity: 0.7;
    }
  `]
})
export class EntitySelectorScopePickerComponent {
  /** Family of the currently selected query. Picker is shown only for 'streamData'. */
  @Input() family?: QueryFamily | null;

  /** Currently bound entity selector id (`undefined` ⇒ no binding). */
  @Input() entitySelectorId?: string;

  /** Available entity selectors to choose from. */
  @Input()
  set selectors(value: EntitySelectorConfig[] | null | undefined) {
    this._selectors = value ?? [];
  }
  get selectors(): EntitySelectorConfig[] {
    return this._selectors;
  }
  private _selectors: EntitySelectorConfig[] = [];

  /** Emits on change (enables `[(entitySelectorId)]` two-way binding). */
  @Output() entitySelectorIdChange = new EventEmitter<string | undefined>();

  get visible(): boolean {
    return this.family === 'streamData';
  }

  /** "None" row first, then one row per available selector. */
  get options(): ScopeOption[] {
    return [
      { label: '— None —', value: undefined },
      ...this._selectors.map(s => ({ label: s.label || s.id, value: s.id }))
    ];
  }

  onSelect(value: string | null | undefined): void {
    this.entitySelectorId = value ?? undefined;
    this.entitySelectorIdChange.emit(this.entitySelectorId);
  }
}
