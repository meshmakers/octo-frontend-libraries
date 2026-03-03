import { Component, Input, Output, EventEmitter, ViewChild, AfterViewInit, inject, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { EntitySelectInputComponent } from '@meshmakers/shared-ui';
import { FieldFilterOperatorsDto } from '@meshmakers/octo-services';
import { GetSystemPersistentQueriesDtoGQL } from '../../graphQL/getSystemPersistentQueries';
import { PersistentQueryItem } from '../../utils/runtime-entity-data-sources';
import {
  PersistentQueryAutocompleteDataSource,
  PersistentQueryDialogDataSource
} from './persistent-query-data-sources';

/**
 * Reusable component for selecting a persistent query.
 * Uses entity-select-input with autocomplete filtering and a dialog for detailed selection.
 *
 * Usage:
 * ```html
 * <mm-query-selector
 *   [(ngModel)]="selectedQuery"
 *   (querySelected)="onQuerySelected($event)"
 *   placeholder="Select a Query..."
 *   hint="Select a query to provide data for this widget.">
 * </mm-query-selector>
 * ```
 */
@Component({
  selector: 'mm-query-selector',
  standalone: true,
  imports: [
    EntitySelectInputComponent
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => QuerySelectorComponent),
      multi: true
    }
  ],
  template: `
    <div class="query-selector">
      <mm-entity-select-input
        #entitySelect
        [dataSource]="queryDataSource"
        [dialogDataSource]="queryDialogDataSource"
        [placeholder]="placeholder"
        [disabled]="disabled"
        [minSearchLength]="1"
        dialogTitle="Select Query"
        advancedSearchLabel="Browse Queries..."
        (entitySelected)="onEntitySelected($event)"
        (entityCleared)="onEntityCleared()">
      </mm-entity-select-input>
      @if (hint) {
        <p class="field-hint">{{ hint }}</p>
      }
    </div>
  `,
  styles: [`
    .query-selector {
      width: 100%;
    }

    .field-hint {
      font-size: 0.85em;
      margin-top: 4px;
      opacity: 0.7;
    }
  `]
})
export class QuerySelectorComponent implements ControlValueAccessor, AfterViewInit {
  private readonly getSystemPersistentQueriesGQL = inject(GetSystemPersistentQueriesDtoGQL);

  @ViewChild('entitySelect') entitySelect!: EntitySelectInputComponent;

  /** Placeholder text for the input */
  @Input() placeholder = 'Select a Query...';

  /** Hint text shown below the input */
  @Input() hint?: string;

  /** Whether the component is disabled */
  @Input() disabled = false;

  /** Emitted when a query is selected */
  @Output() querySelected = new EventEmitter<PersistentQueryItem | null>();

  /** Emitted when queries are loaded (emits the selected query in a single-item array for compatibility) */
  @Output() queriesLoaded = new EventEmitter<PersistentQueryItem[]>();

  readonly queryDataSource: PersistentQueryAutocompleteDataSource;
  readonly queryDialogDataSource: PersistentQueryDialogDataSource;

  private selectedQuery: PersistentQueryItem | null = null;

  // ControlValueAccessor callbacks
  private onChange: (value: PersistentQueryItem | null) => void = () => { /* noop */ };
  private onTouched: () => void = () => { /* noop */ };

  constructor() {
    this.queryDataSource = new PersistentQueryAutocompleteDataSource(this.getSystemPersistentQueriesGQL);
    this.queryDialogDataSource = new PersistentQueryDialogDataSource(this.getSystemPersistentQueriesGQL);
  }

  ngAfterViewInit(): void {
    // Forward any value that was set via writeValue() before the ViewChild was available
    if (this.selectedQuery && this.entitySelect) {
      this.entitySelect.writeValue(this.selectedQuery);
    }
  }

  /**
   * Called when an entity is selected from the autocomplete or dialog
   */
  onEntitySelected(entity: PersistentQueryItem): void {
    this.selectedQuery = entity;
    this.onChange(entity);
    this.onTouched();
    this.querySelected.emit(entity);
    this.queriesLoaded.emit([entity]);
  }

  /**
   * Called when the entity selection is cleared
   */
  onEntityCleared(): void {
    this.selectedQuery = null;
    this.onChange(null);
    this.onTouched();
    this.querySelected.emit(null);
  }

  /**
   * Sets the selected query by rtId (useful for loading existing config).
   * Fetches the query via GraphQL and populates the input.
   */
  async selectByRtId(rtId: string): Promise<PersistentQueryItem | null> {
    const result = await firstValueFrom(this.getSystemPersistentQueriesGQL.fetch({
      variables: {
        first: 1,
        fieldFilters: [{ attributePath: 'rtId', operator: FieldFilterOperatorsDto.EqualsDto, comparisonValue: rtId }]
      }
    }));

    const items = (result.data?.runtime?.systemPersistentQuery?.items ?? [])
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map(item => ({
        rtId: item.rtId,
        name: item.name ?? '',
        description: item.description,
        queryCkTypeId: item.queryCkTypeId
      }));

    const query = items[0] ?? null;

    if (query) {
      this.selectedQuery = query;
      this.onChange(query);
      this.entitySelect.writeValue(query);
    }

    return query;
  }

  // ControlValueAccessor implementation
  writeValue(value: PersistentQueryItem | null): void {
    this.selectedQuery = value;
    if (this.entitySelect) {
      this.entitySelect.writeValue(value);
    }
  }

  registerOnChange(fn: (value: PersistentQueryItem | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
