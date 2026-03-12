import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EntitySelectInputComponent } from '@meshmakers/shared-ui';
import { RuntimeEntitySelectDataSource, RuntimeEntityDialogDataSource, RuntimeEntityItem } from '../../utils/runtime-entity-data-sources';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { EntitySelectorConfig } from '../../models/meshboard.models';

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
 * Creates data sources per CK type and emits selection/clear events.
 */
@Component({
  selector: 'mm-entity-selector-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    EntitySelectInputComponent
  ],
  templateUrl: './entity-selector-toolbar.component.html',
  styleUrl: './entity-selector-toolbar.component.scss'
})
export class EntitySelectorToolbarComponent implements OnChanges {
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);

  @Input() entitySelectors: EntitySelectorConfig[] = [];
  @Output() entitySelected = new EventEmitter<EntitySelectorEvent>();
  @Output() entityCleared = new EventEmitter<EntitySelectorClearEvent>();

  // Cached data sources per CK type
  private dataSourceCache = new Map<string, RuntimeEntitySelectDataSource>();
  private dialogDataSourceCache = new Map<string, RuntimeEntityDialogDataSource>();

  // Map of selector ID -> data sources for template
  protected selectorDataSources = new Map<string, RuntimeEntitySelectDataSource>();
  protected selectorDialogDataSources = new Map<string, RuntimeEntityDialogDataSource>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entitySelectors']) {
      this.updateDataSources();
    }
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
   * Creates or retrieves cached data sources for each selector.
   */
  private updateDataSources(): void {
    for (const selector of this.entitySelectors) {
      // Reuse cached data source if same CK type
      if (!this.dataSourceCache.has(selector.ckTypeId)) {
        this.dataSourceCache.set(
          selector.ckTypeId,
          new RuntimeEntitySelectDataSource(this.getEntitiesByCkTypeGQL, selector.ckTypeId)
        );
      }
      if (!this.dialogDataSourceCache.has(selector.ckTypeId)) {
        this.dialogDataSourceCache.set(
          selector.ckTypeId,
          new RuntimeEntityDialogDataSource(this.getEntitiesByCkTypeGQL, selector.ckTypeId)
        );
      }

      this.selectorDataSources.set(selector.id, this.dataSourceCache.get(selector.ckTypeId)!);
      this.selectorDialogDataSources.set(selector.id, this.dialogDataSourceCache.get(selector.ckTypeId)!);
    }
  }
}
