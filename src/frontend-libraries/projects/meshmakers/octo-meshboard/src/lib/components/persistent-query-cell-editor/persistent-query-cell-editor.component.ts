import { Component, EventEmitter, Input, OnInit, Output, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { firstValueFrom } from 'rxjs';
import { GetSystemPersistentQueriesDtoGQL } from '../../graphQL/getSystemPersistentQueries';
import { EntitySelectorConfig, PersistentQueryCellMode, PersistentQueryCellSource } from '../../models/meshboard.models';
import { QueryFamily, queryFamily } from '../../utils/query-family';
import { SdTimeFilterToggleComponent } from '../sd-time-filter-toggle/sd-time-filter-toggle.component';
import { EntitySelectorScopePickerComponent } from '../entity-selector-scope-picker/entity-selector-scope-picker.component';

/**
 * Persistent-query item for the combobox. `ckTypeId` is the query's own CK type
 * (carries the family marker, e.g. `SimpleSdQuery`); `queryCkTypeId` is the type
 * the query queries against (label only).
 */
interface QueryItem {
  rtId: string;
  name: string;
  description?: string | null;
  ckTypeId?: string | null;
  queryCkTypeId?: string | null;
}

/**
 * Reusable editor for a {@link PersistentQueryCellSource} (a single-value
 * persistent-query data source). Shared by the stats-grid stat editor and the
 * summary-card tile editor so both surface the identical runtime/stream-data
 * configuration UX (query picker, SD time-filter opt-out + asset-scope, query
 * mode and value/category fields). The runtime ↔ stream-data choice is derived
 * from the picked query's family — the SD-only controls hide for runtime queries.
 */
@Component({
  selector: 'mm-persistent-query-cell-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, InputsModule, DropDownsModule, SdTimeFilterToggleComponent, EntitySelectorScopePickerComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="pq-editor">
      <div class="pq-field">
        <label>Persistent Query <span class="required">*</span></label>
        <kendo-combobox
          [data]="queries"
          [textField]="'name'"
          [valueField]="'rtId'"
          [valuePrimitive]="false"
          [(ngModel)]="selectedQuery"
          [filterable]="true"
          (filterChange)="onFilter($event)"
          (valueChange)="onQuerySelected($event)"
          [loading]="isLoading"
          placeholder="Select a query...">
        </kendo-combobox>
      </div>

      <!-- Stream-data-only options (hidden for runtime queries) -->
      <mm-sd-time-filter-toggle
        [family]="family"
        [(ignoreTimeFilter)]="ignoreTimeFilter"
        (ignoreTimeFilterChange)="emit()">
      </mm-sd-time-filter-toggle>
      <mm-entity-selector-scope-picker
        [family]="family"
        [selectors]="selectors"
        [(entitySelectorId)]="entitySelectorId"
        (entitySelectorIdChange)="emit()">
      </mm-entity-selector-scope-picker>

      <div class="pq-field">
        <label>Query Mode</label>
        <kendo-dropdownlist
          [data]="queryModeOptions"
          textField="label"
          valueField="value"
          [valuePrimitive]="true"
          [(ngModel)]="queryMode"
          (valueChange)="emit()">
        </kendo-dropdownlist>
      </div>

      @if (queryMode === 'aggregation' || queryMode === 'groupedAggregation') {
        <div class="pq-field">
          <label>Value Field</label>
          <kendo-textbox [(ngModel)]="queryValueField" (valueChange)="emit()" placeholder="e.g. amountvalue_sum"></kendo-textbox>
        </div>
      }

      @if (queryMode === 'groupedAggregation') {
        <div class="pq-field">
          <label>Category Field</label>
          <kendo-textbox [(ngModel)]="queryCategoryField" (valueChange)="emit()" placeholder="e.g. operatingstatus"></kendo-textbox>
        </div>
        <div class="pq-field">
          <label>Category Value</label>
          <kendo-textbox [(ngModel)]="queryCategoryValue" (valueChange)="emit()" placeholder="value to match"></kendo-textbox>
        </div>
      }
    </div>
  `,
  styles: [`
    .pq-editor { display: flex; flex-direction: column; gap: 8px; }
    .pq-field { display: flex; flex-direction: column; gap: 4px; }
    .pq-field label { font-weight: 600; font-size: 0.85rem; }
    .required { color: var(--kendo-color-error, #dc3545); }
  `]
})
export class PersistentQueryCellEditorComponent implements OnInit {
  private readonly getQueriesGQL = inject(GetSystemPersistentQueriesDtoGQL);

  @Input() initialSource?: PersistentQueryCellSource;
  @Input() selectors: EntitySelectorConfig[] = [];
  @Output() sourceChange = new EventEmitter<PersistentQueryCellSource>();

  queries: QueryItem[] = [];
  selectedQuery: QueryItem | null = null;
  isLoading = false;

  ignoreTimeFilter = false;
  entitySelectorId?: string;
  queryMode: PersistentQueryCellMode = 'simpleCount';
  queryValueField?: string;
  queryCategoryField?: string;
  queryCategoryValue?: string;

  readonly queryModeOptions = [
    { value: 'simpleCount', label: 'Simple (total count)' },
    { value: 'aggregation', label: 'Aggregation (single value)' },
    { value: 'groupedAggregation', label: 'Grouped aggregation' }
  ];

  /** Family of the picked query, derived from its own CK type. */
  get family(): QueryFamily | undefined {
    return queryFamily(this.selectedQuery?.ckTypeId) ?? undefined;
  }

  async ngOnInit(): Promise<void> {
    const src = this.initialSource;
    if (src) {
      this.ignoreTimeFilter = src.ignoreTimeFilter ?? false;
      this.entitySelectorId = src.entitySelectorId;
      this.queryMode = src.queryMode ?? 'simpleCount';
      this.queryValueField = src.queryValueField;
      this.queryCategoryField = src.queryCategoryField;
      this.queryCategoryValue = src.queryCategoryValue;
    }
    await this.loadQueries();
    if (src?.queryRtId) {
      this.selectedQuery = this.queries.find(q => q.rtId === src.queryRtId)
        ?? { rtId: src.queryRtId, name: src.queryName ?? src.queryRtId, ckTypeId: undefined, queryCkTypeId: undefined };
    }
  }

  async onFilter(text: string): Promise<void> {
    await this.loadQueries(text);
  }

  onQuerySelected(query: QueryItem | null): void {
    this.selectedQuery = query;
    // Reset SD-only state when the picked query is not a stream-data query.
    if (this.family !== 'streamData') {
      this.ignoreTimeFilter = false;
      this.entitySelectorId = undefined;
    }
    this.emit();
  }

  emit(): void {
    if (!this.selectedQuery) {
      // Emit an empty-rtId source so the parent can flag the cell invalid.
      this.sourceChange.emit({ queryRtId: '', queryMode: this.queryMode });
      return;
    }
    const family = this.family;
    const source: PersistentQueryCellSource = {
      queryRtId: this.selectedQuery.rtId,
      queryName: this.selectedQuery.name,
      queryFamily: family,
      queryMode: this.queryMode,
      queryValueField: this.queryValueField || undefined,
      queryCategoryField: this.queryCategoryField || undefined,
      queryCategoryValue: this.queryCategoryValue || undefined,
      filters: this.initialSource?.filters
    };
    if (family === 'streamData') {
      if (this.ignoreTimeFilter) source.ignoreTimeFilter = true;
      if (this.entitySelectorId) source.entitySelectorId = this.entitySelectorId;
    }
    this.sourceChange.emit(source);
  }

  private async loadQueries(searchText?: string): Promise<void> {
    this.isLoading = true;
    try {
      const result = await firstValueFrom(
        this.getQueriesGQL.fetch({
          first: 100,
          searchFilter: searchText ? { searchTerm: searchText, language: 'de' } : undefined
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Apollo fetch requires flexible variable typing
        } as any)
      );
      this.queries = (result.data?.runtime?.systemPersistentQuery?.items ?? [])
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .map(item => ({
          rtId: item.rtId,
          name: item.name,
          description: item.description,
          ckTypeId: item.ckTypeId,
          queryCkTypeId: item.queryCkTypeId
        }));
    } finally {
      this.isLoading = false;
    }
  }
}
