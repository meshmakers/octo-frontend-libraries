import { Component, Input, Output, EventEmitter, OnInit, inject, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { firstValueFrom } from 'rxjs';
import { GetSystemPersistentQueriesDtoGQL } from '../../graphQL/getSystemPersistentQueries';
import { PersistentQueryItem } from '../../utils/runtime-entity-data-sources';

/**
 * Reusable component for selecting a persistent query.
 * Provides a combobox with filtering and displays query name + description.
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
    CommonModule,
    FormsModule,
    DropDownsModule
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
      <kendo-combobox
        [data]="queries"
        [textField]="'name'"
        [valueField]="'rtId'"
        [valuePrimitive]="false"
        [(ngModel)]="selectedQuery"
        [filterable]="true"
        (filterChange)="onFilterChange($event)"
        (valueChange)="onValueChange($event)"
        [placeholder]="placeholder"
        [loading]="isLoading"
        [disabled]="disabled">
        <ng-template kendoComboBoxItemTemplate let-dataItem>
          <div class="query-item">
            <span class="query-name">{{ dataItem.name }}</span>
            @if (dataItem.description) {
              <span class="query-description">{{ dataItem.description }}</span>
            }
          </div>
        </ng-template>
      </kendo-combobox>
      @if (hint) {
        <p class="field-hint">{{ hint }}</p>
      }
    </div>
  `,
  styles: [`
    .query-selector {
      width: 100%;
    }

    .query-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .query-name {
      font-weight: 500;
    }

    .query-description {
      font-size: 0.85em;
      opacity: 0.7;
    }

    .field-hint {
      font-size: 0.85em;
      margin-top: 4px;
      opacity: 0.7;
    }
  `]
})
export class QuerySelectorComponent implements OnInit, ControlValueAccessor {
  private readonly getSystemPersistentQueriesGQL = inject(GetSystemPersistentQueriesDtoGQL);

  /** Placeholder text for the combobox */
  @Input() placeholder = 'Select a Query...';

  /** Hint text shown below the combobox */
  @Input() hint?: string;

  /** Whether the component is disabled */
  @Input() disabled = false;

  /** Whether to load queries automatically on init */
  @Input() autoLoad = true;

  /** Emitted when a query is selected */
  @Output() querySelected = new EventEmitter<PersistentQueryItem | null>();

  /** Emitted when queries are loaded */
  @Output() queriesLoaded = new EventEmitter<PersistentQueryItem[]>();

  queries: PersistentQueryItem[] = [];
  selectedQuery: PersistentQueryItem | null = null;
  isLoading = false;

  // ControlValueAccessor (initialized as noop, set by registerOnChange/registerOnTouched)
  private onChange: (value: PersistentQueryItem | null) => void = () => { /* noop */ };
  private onTouched: () => void = () => { /* noop */ };

  ngOnInit(): void {
    if (this.autoLoad) {
      this.loadQueries();
    }
  }

  /**
   * Loads persistent queries with optional search text filter
   */
  async loadQueries(searchText?: string): Promise<void> {
    this.isLoading = true;

    try {
      const result = await firstValueFrom(this.getSystemPersistentQueriesGQL.fetch({
        variables: {
          first: 100,
          searchFilter: searchText ? { searchTerm: searchText, language: 'de' } : undefined
        }
      }));

      const items = result.data?.runtime?.systemPersistentQuery?.items || [];
      this.queries = items
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .map(item => ({
          rtId: item.rtId,
          name: item.name ?? '',
          description: item.description,
          queryCkTypeId: item.queryCkTypeId
        }));

      this.queriesLoaded.emit(this.queries);
    } catch (error) {
      console.error('Error loading queries:', error);
      this.queries = [];
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Called when the combobox filter changes (user types)
   */
  onFilterChange(filter: string): void {
    this.loadQueries(filter);
  }

  /**
   * Called when a query is selected
   */
  onValueChange(query: PersistentQueryItem | null): void {
    this.selectedQuery = query;
    this.onChange(query);
    this.onTouched();
    this.querySelected.emit(query);
  }

  /**
   * Sets the selected query by rtId (useful for loading existing config)
   */
  async selectByRtId(rtId: string): Promise<PersistentQueryItem | null> {
    // First ensure queries are loaded
    if (this.queries.length === 0) {
      await this.loadQueries();
    }

    // Try to find in loaded queries
    let query = this.queries.find(q => q.rtId === rtId);

    if (!query) {
      // Query not in initial list, search for it
      await this.loadQueries(rtId);
      query = this.queries.find(q => q.rtId === rtId);
    }

    if (query) {
      this.selectedQuery = query;
      this.onChange(query);
    }

    return query ?? null;
  }

  // ControlValueAccessor implementation
  writeValue(value: PersistentQueryItem | null): void {
    this.selectedQuery = value;
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
