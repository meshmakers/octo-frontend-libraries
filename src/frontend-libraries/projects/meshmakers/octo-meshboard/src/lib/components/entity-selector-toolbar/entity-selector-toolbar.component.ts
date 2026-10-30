import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  unresolvedFilterVariables,
  withPickerFilters
} from '../../utils/entity-selector-filter';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';

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
 * Creates data sources per CK type and picker filter (AB#7724) and emits selection/clear events.
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
export class EntitySelectorToolbarComponent implements OnChanges {
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);
  private readonly variableService = inject(MeshBoardVariableService);

  @Input() entitySelectors: EntitySelectorConfig[] = [];
  /**
   * Board variables substituted into the selectors' picker filters (AB#7724),
   * the same substitution widget filters get.
   */
  @Input() variables: MeshBoardVariable[] = [];
  @Output() entitySelected = new EventEmitter<EntitySelectorEvent>();
  @Output() entityCleared = new EventEmitter<EntitySelectorClearEvent>();

  // Cached data sources per CK type and resolved picker filter
  private dataSourceCache = new Map<string, RuntimeEntitySelectDataSource>();
  private dialogDataSourceCache = new Map<string, RuntimeEntityDialogDataSource>();

  // Map of selector ID -> data sources for template
  protected selectorDataSources = new Map<string, RuntimeEntitySelectDataSource>();
  protected selectorDialogDataSources = new Map<string, RuntimeEntityDialogDataSource>();
  // Picker texts of filtered selectors (absent ⇒ the input's defaults)
  protected selectorMessages = new Map<string, Partial<EntitySelectInputMessages>>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entitySelectors'] || changes['variables']) {
      this.updateDataSources();
    }
  }

  /** Texts of the selector's picker: a filtered picker explains its empty list (AB#7724). */
  getMessages(selector: EntitySelectorConfig): Partial<EntitySelectInputMessages> {
    return this.selectorMessages.get(selector.id) ?? NO_MESSAGES;
  }

  /** Title of the selector's search dialog; marks a filtered picker (AB#7724). */
  getDialogTitle(selector: EntitySelectorConfig): string {
    return this.selectorMessages.has(selector.id) ? filteredDialogTitle(selector.label) : 'Select ' + selector.label;
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
   * the same CK type and the same resolved filter share their data sources; a
   * selector without filter uses the plain query, exactly as before AB#7724.
   * Entries no selector uses any more (e.g. after a filter variable changed)
   * are dropped, so the caches never outgrow the current selectors.
   */
  private updateDataSources(): void {
    this.selectorMessages = new Map();
    const usedKeys = new Set<string>();
    for (const selector of this.entitySelectors) {
      const filters = pickerFieldFilters(selector, this.variables, this.variableService);
      const key = filters ? `${selector.ckTypeId}|${JSON.stringify(filters)}` : selector.ckTypeId;
      usedKeys.add(key);
      if (!this.dataSourceCache.has(key) || !this.dialogDataSourceCache.has(key)) {
        const gql = withPickerFilters(this.getEntitiesByCkTypeGQL, filters);
        this.dataSourceCache.set(key, new RuntimeEntitySelectDataSource(gql, selector.ckTypeId));
        this.dialogDataSourceCache.set(key, new RuntimeEntityDialogDataSource(gql, selector.ckTypeId));
      }

      this.selectorDataSources.set(selector.id, this.dataSourceCache.get(key)!);
      this.selectorDialogDataSources.set(selector.id, this.dialogDataSourceCache.get(key)!);
      if (filters) {
        this.selectorMessages.set(selector.id, {
          noEntitiesFound: filteredNoEntitiesMessage(selector.label, unresolvedFilterVariables(filters))
        });
      }
    }
    for (const key of [...this.dataSourceCache.keys()]) {
      if (!usedKeys.has(key)) {
        this.dataSourceCache.delete(key);
        this.dialogDataSourceCache.delete(key);
      }
    }
  }

  /** Number of cached data source pairs (for tests). */
  get cachedDataSourceCount(): number {
    return this.dataSourceCache.size;
  }
}

const NO_MESSAGES: Partial<EntitySelectInputMessages> = {};
