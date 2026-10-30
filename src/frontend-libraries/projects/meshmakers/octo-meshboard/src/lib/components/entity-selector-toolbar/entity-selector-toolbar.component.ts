import { Component, Input, Output, EventEmitter, inject, OnChanges, OnDestroy, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, type Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import type { FieldFilterDto } from '@meshmakers/octo-services';
import { KENDO_LABELS } from '@progress/kendo-angular-label';
import { EntitySelectInputComponent, EntitySelectInputMessages } from '@meshmakers/shared-ui';
import { RuntimeEntitySelectDataSource, RuntimeEntityDialogDataSource, RuntimeEntityItem } from '../../utils/runtime-entity-data-sources';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { EntitySelectorConfig, MeshBoardVariable } from '../../models/meshboard.models';
import { showsInToolbar } from '../../utils/entity-selector-follow';
import {
  filteredDialogTitle,
  filteredNoEntitiesMessage,
  pickerFieldFilters,
  pickerFilterSentence,
  unresolvedFilterVariables,
  withPickerFilters
} from '../../utils/entity-selector-filter';
import {
  deferredPickerQuery,
  leaderDisplayName,
  pickerScopeEmptyMessage,
  pickerScopeFailedMessage,
  pickerScopeView,
  withoutListing,
  type PickerScopeView
} from '../../utils/entity-selector-scope-source';
import type { EntitySelectorScopeState } from '../../utils/stream-data-scope';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { QueryExecutorService } from '../../services/query-executor.service';

/**
 * Event emitted when an entity is selected in a selector.
 */
export interface EntitySelectorEvent {
  selectorId: string;
  entity: RuntimeEntityItem;
}

/**
 * Event emitted when a selector is cleared.
 */
export interface EntitySelectorClearEvent {
  selectorId: string;
}

/**
 * Toolbar component that renders entity select inputs for each configured entity selector.
 * Creates data sources per CK type, picker filter (AB#7724) and picker scope (AB#7915) and emits
 * selection/clear events.
 */
@Component({
  selector: 'mm-entity-selector-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    KENDO_LABELS,
    EntitySelectInputComponent
  ],
  templateUrl: './entity-selector-toolbar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './entity-selector-toolbar.component.scss'
})
export class EntitySelectorToolbarComponent implements OnChanges, OnDestroy {
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);
  private readonly variableService = inject(MeshBoardVariableService);

  @Input() entitySelectors: EntitySelectorConfig[] = [];
  /**
   * Board variables substituted into the selectors' picker filters (AB#7724),
   * the same substitution widget filters get.
   */
  @Input() variables: MeshBoardVariable[] = [];
  /**
   * Picker scopes of dependent selectors (AB#7915), keyed by selector id
   * (`MeshBoardStateService.pickerScopes`). No entry = the leader has no pick.
   */
  @Input() pickerScopes: Record<string, EntitySelectorScopeState> = {};
  @Output() entitySelected = new EventEmitter<EntitySelectorEvent>();
  @Output() entityCleared = new EventEmitter<EntitySelectorClearEvent>();

  // Cached data sources per CK type and resolved picker filter
  private dataSourceCache = new Map<string, RuntimeEntitySelectDataSource>();
  private dialogDataSourceCache = new Map<string, RuntimeEntityDialogDataSource>();

  // Map of selector ID -> data sources for template
  protected selectorDataSources = new Map<string, RuntimeEntitySelectDataSource>();
  protected selectorDialogDataSources = new Map<string, RuntimeEntityDialogDataSource>();
  // Picker texts of filtered or dependent selectors (absent ⇒ the input's defaults)
  protected selectorMessages = new Map<string, Partial<EntitySelectInputMessages>>();
  // Selectors whose picker carries a filter (AB#7724): their dialog title says so
  private filteredSelectorIds = new Set<string>();
  // Latest picker state per dependent selector; a pending picker's fetch waits on it (AB#7915)
  private readonly settledPickers$ = new BehaviorSubject<Map<string, { view: PickerScopeView; filters: FieldFilterDto[] | undefined }>>(new Map());

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entitySelectors'] || changes['variables'] || changes['pickerScopes']) {
      this.updateDataSources();
    }
  }

  ngOnDestroy(): void {
    this.settledPickers$.complete();
  }

  /** Texts of the selector's picker: a filtered picker explains its empty list (AB#7724). */
  getMessages(selector: EntitySelectorConfig): Partial<EntitySelectInputMessages> {
    return this.selectorMessages.get(selector.id) ?? NO_MESSAGES;
  }

  /** Title of the selector's search dialog; marks a filtered picker (AB#7724). */
  getDialogTitle(selector: EntitySelectorConfig): string {
    return this.filteredSelectorIds.has(selector.id) ? filteredDialogTitle(selector.label) : 'Select ' + selector.label;
  }

  /**
   * True when the selector renders a picker. Hidden selectors and followers
   * (AB#7722) never do; a follower's pick is derived from its leader.
   */
  showsInToolbar(selector: EntitySelectorConfig): boolean {
    return showsInToolbar(selector);
  }

  /**
   * Returns the data source for a selector.
   */
  getDataSource(selector: EntitySelectorConfig): RuntimeEntitySelectDataSource {
    return this.selectorDataSources.get(selector.id)!;
  }

  /**
   * Returns the dialog data source for a selector.
   */
  getDialogDataSource(selector: EntitySelectorConfig): RuntimeEntityDialogDataSource {
    return this.selectorDialogDataSources.get(selector.id)!;
  }

  /**
   * Handles entity selection from the input component.
   */
  onEntitySelected(selectorId: string, entity: RuntimeEntityItem): void {
    this.entitySelected.emit({ selectorId, entity });
  }

  /**
   * Handles entity cleared from the input component.
   */
  onEntityCleared(selectorId: string): void {
    this.entityCleared.emit({ selectorId });
  }

  /**
   * Creates or retrieves cached data sources for each selector. Selectors of
   * the same CK type, the same resolved filter and the same picker scope share
   * their data sources; a selector without filter and scope source uses the
   * plain query, exactly as before AB#7724. The cache key changes with the
   * picker scope (AB#7915), so a leader change gives the dependent fresh data
   * sources. Entries no selector uses any more are dropped, so the caches never
   * outgrow the current selectors.
   */
  private updateDataSources(): void {
    this.selectorMessages = new Map();
    this.filteredSelectorIds = new Set();
    const settled = new Map<string, { view: PickerScopeView; filters: FieldFilterDto[] | undefined }>();
    const usedKeys = new Set<string>();
    for (const selector of this.entitySelectors) {
      const filters = pickerFieldFilters(selector, this.variables, this.variableService);
      const view = pickerScopeView(this.entitySelectors, selector, this.pickerScopes[selector.id]);
      if (view.kind !== 'unscoped') {
        settled.set(selector.id, { view, filters });
      }
      const filterKey = filters ? `${selector.ckTypeId}|${JSON.stringify(filters)}` : selector.ckTypeId;
      const scopeKey = pickerScopeKey(selector.id, view);
      const key = scopeKey ? `${filterKey}|${scopeKey}` : filterKey;
      usedKeys.add(key);
      if (!this.dataSourceCache.has(key) || !this.dialogDataSourceCache.has(key)) {
        const gql = this.pickerQuery(selector.id, view, filters);
        this.dataSourceCache.set(key, new RuntimeEntitySelectDataSource(gql, selector.ckTypeId));
        this.dialogDataSourceCache.set(key, new RuntimeEntityDialogDataSource(gql, selector.ckTypeId));
      }

      this.selectorDataSources.set(selector.id, this.dataSourceCache.get(key)!);
      this.selectorDialogDataSources.set(selector.id, this.dialogDataSourceCache.get(key)!);
      if (filters) {
        this.filteredSelectorIds.add(selector.id);
      }
      const messages = this.pickerMessages(selector, view, filters);
      if (messages) {
        this.selectorMessages.set(selector.id, messages);
      }
    }
    for (const key of [...this.dataSourceCache.keys()]) {
      if (!usedKeys.has(key)) {
        this.dataSourceCache.delete(key);
        this.dialogDataSourceCache.delete(key);
      }
    }
    this.settledPickers$.next(settled);
  }

  /**
   * The query service of a picker: filter rows (AB#7724) plus, for a dependent
   * selector, the picker scope `rtId IN (…)` (AB#7915). Empty and failed scopes
   * list nothing without a request; a pending scope waits until it settled.
   */
  private pickerQuery(selectorId: string, view: PickerScopeView, filters: FieldFilterDto[] | undefined): GetEntitiesByCkTypeDtoGQL {
    switch (view.kind) {
      case 'unscoped':
        return withPickerFilters(this.getEntitiesByCkTypeGQL, filters);
      case 'scoped':
        return withPickerFilters(this.getEntitiesByCkTypeGQL, QueryExecutorService.withRtIdScope(filters, view.rtIds));
      case 'empty':
      case 'failed':
        return withoutListing(this.getEntitiesByCkTypeGQL);
      case 'pending':
        return deferredPickerQuery(this.getEntitiesByCkTypeGQL, this.settledPicker(selectorId));
    }
  }

  /** The query of `selectorId` once its picker scope is no longer pending (`null` = list nothing). */
  private settledPicker(selectorId: string): Observable<GetEntitiesByCkTypeDtoGQL | null> {
    return this.settledPickers$.pipe(
      map(pickers => pickers.get(selectorId) ?? { view: { kind: 'unscoped' } as PickerScopeView, filters: undefined }),
      filter(picker => picker.view.kind !== 'pending'),
      map(picker => picker.view.kind === 'empty' || picker.view.kind === 'failed'
        ? null
        : this.pickerQuery(selectorId, picker.view, picker.filters))
    );
  }

  /**
   * Picker texts (wording agreed with the Studio PO): a dependent picker with
   * nothing in scope or a failed scope says so right away (also before the
   * user types); a filtered picker explains an empty search result (AB#7724).
   */
  private pickerMessages(
    selector: EntitySelectorConfig,
    view: PickerScopeView,
    filters: FieldFilterDto[] | undefined
  ): Partial<EntitySelectInputMessages> | null {
    if (view.kind === 'empty' || view.kind === 'failed') {
      const leaderName = leaderDisplayName(this.entitySelectors, selector);
      const text = view.kind === 'failed'
        ? pickerScopeFailedMessage(selector.label, leaderName)
        : filters
          ? `${pickerScopeEmptyMessage(selector.label, leaderName)} ${pickerFilterSentence(selector.label)}`
          : pickerScopeEmptyMessage(selector.label, leaderName);
      return { noEntitiesFound: text, minCharactersHint: text };
    }
    if (filters) {
      return { noEntitiesFound: filteredNoEntitiesMessage(selector.label, unresolvedFilterVariables(filters)) };
    }
    return null;
  }

  /** Number of cached data source pairs (for tests). */
  get cachedDataSourceCount(): number {
    return this.dataSourceCache.size;
  }
}

const NO_MESSAGES: Partial<EntitySelectInputMessages> = {};

/**
 * Cache-key part of a picker scope (AB#7915): `null` for an unscoped picker
 * (key unchanged from before), otherwise the state and, for a scoped picker,
 * its rtIds — so the data sources change whenever the scope changes. A pending
 * data source watches its own selector, hence the selector id.
 */
function pickerScopeKey(selectorId: string, view: PickerScopeView): string | null {
  switch (view.kind) {
    case 'unscoped':
      return null;
    case 'pending':
      return `pending:${selectorId}`;
    case 'scoped':
      return `in:${view.rtIds.join(',')}`;
    case 'empty':
    case 'failed':
      return 'none';
  }
}
