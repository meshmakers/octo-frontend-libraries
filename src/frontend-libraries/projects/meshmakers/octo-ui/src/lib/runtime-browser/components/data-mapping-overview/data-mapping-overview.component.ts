import { CommonModule } from '@angular/common';
import { Component, computed, EventEmitter, inject, OnInit, Output, signal } from '@angular/core';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { GridModule, PageChangeEvent, CellClickEvent } from '@progress/kendo-angular-grid';
import { BadgeModule } from '@progress/kendo-angular-indicators';
import { SwitchModule } from '@progress/kendo-angular-inputs';
import { arrowRotateCwIcon, checkCircleIcon, exclamationCircleIcon, trashIcon, xCircleIcon } from '@progress/kendo-svg-icons';
import { firstValueFrom } from 'rxjs';
import { GetDataPointMappingsDtoGQL } from '../../../graphQL/getDataPointMappings';
import { GetRuntimeEntityByIdDtoGQL } from '../../../graphQL/getRuntimeEntityById';
import { UpdateRuntimeEntitiesDtoGQL } from '../../../graphQL/updateRuntimeEntities';
import { DeleteEntitiesDtoGQL } from '../../../graphQL/deleteEntities';
import { DeleteStrategiesDto } from '@meshmakers/octo-services';
import {
  DataPointMappingOverviewItem,
  MappingOverviewSummary,
  ValidationMessage,
} from './data-mapping-overview.models';

const DATA_POINT_MAPPING_CK_TYPE = 'System.Communication/DataPointMapping';

@Component({
  selector: 'mm-data-mapping-overview',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    SVGIconModule,
    GridModule,
    BadgeModule,
    SwitchModule,
  ],
  template: `
    <div class="mapping-overview">
      <!-- Summary Bar -->
      <div class="summary-bar">
        <div class="summary-item">
          <span class="summary-count">{{ summary().total }}</span>
          <span class="summary-label">Total</span>
        </div>
        <div class="summary-item summary-valid">
          <span class="summary-count">{{ summary().valid }}</span>
          <span class="summary-label">Valid</span>
        </div>
        <div class="summary-item summary-warnings">
          <span class="summary-count">{{ summary().warnings }}</span>
          <span class="summary-label">Warnings</span>
        </div>
        <div class="summary-item summary-errors">
          <span class="summary-count">{{ summary().errors }}</span>
          <span class="summary-label">Errors</span>
        </div>
        <div class="summary-item summary-disabled">
          <span class="summary-count">{{ summary().disabled }}</span>
          <span class="summary-label">Disabled</span>
        </div>
        <div class="summary-spacer"></div>
        <button kendoButton fillMode="flat" size="small" [svgIcon]="refreshIcon"
          (click)="loadMappings()">Refresh</button>
      </div>

      <!-- Mapping Grid -->
      <kendo-grid
        [data]="gridData()"
        [pageSize]="pageSize"
        [skip]="skip"
        [pageable]="{ buttonCount: 3, pageSizes: [10, 20, 50] }"
        [sortable]="true"
        [height]="500"
        (pageChange)="onPageChange($event)"
        (cellClick)="onCellClick($event)"
      >
        <kendo-grid-column title="" field="validationStatus" [width]="40" [sortable]="false">
          <ng-template kendoGridCellTemplate let-dataItem>
            @if (dataItem.validationStatus === 'valid') {
              <kendo-svgicon [icon]="checkIcon" class="status-valid"></kendo-svgicon>
            } @else if (dataItem.validationStatus === 'warning') {
              <kendo-svgicon [icon]="warnIcon" class="status-warning"></kendo-svgicon>
            } @else {
              <kendo-svgicon [icon]="errorIcon" class="status-error"></kendo-svgicon>
            }
          </ng-template>
        </kendo-grid-column>

        <kendo-grid-column title="Mapping Name" field="name" [width]="200">
        </kendo-grid-column>

        <kendo-grid-column title="Source" field="sourceName" [width]="200">
          <ng-template kendoGridCellTemplate let-dataItem>
            <span class="entity-ref" (click)="navigateToEntity.emit({ rtId: dataItem.sourceRtId, ckTypeId: dataItem.sourceCkTypeId })">
              {{ dataItem.sourceName || dataItem.sourceRtId | slice:-8 }}
            </span>
            <div class="entity-type-hint">{{ dataItem.sourceCkTypeId }}</div>
          </ng-template>
        </kendo-grid-column>

        <kendo-grid-column title="Source Attr" field="sourceAttributePath" [width]="120">
        </kendo-grid-column>

        <kendo-grid-column title="Expression" field="mappingExpression" [width]="160">
          <ng-template kendoGridCellTemplate let-dataItem>
            @if (dataItem.mappingExpression) {
              <code class="expression-cell">{{ dataItem.mappingExpression }}</code>
            }
          </ng-template>
        </kendo-grid-column>

        <kendo-grid-column title="Target" field="targetName" [width]="200">
          <ng-template kendoGridCellTemplate let-dataItem>
            @if (dataItem.targetRtId) {
              <span class="entity-ref" (click)="navigateToEntity.emit({ rtId: dataItem.targetRtId, ckTypeId: dataItem.targetCkTypeId })">
                {{ dataItem.targetName || dataItem.targetRtId | slice:-8 }}
              </span>
              <div class="entity-type-hint">{{ dataItem.targetCkTypeId }}</div>
            } @else {
              <span class="no-target">(no target)</span>
            }
          </ng-template>
        </kendo-grid-column>

        <kendo-grid-column title="Target Attr" field="targetAttributePath" [width]="120">
        </kendo-grid-column>

        <kendo-grid-column title="Enabled" field="enabled" [width]="80">
          <ng-template kendoGridCellTemplate let-dataItem>
            <kendo-switch [checked]="dataItem.enabled" size="small"
              (valueChange)="onToggleEnabled(dataItem, $event)">
            </kendo-switch>
          </ng-template>
        </kendo-grid-column>

        <kendo-grid-column title="" [width]="50" [sortable]="false">
          <ng-template kendoGridCellTemplate let-dataItem>
            <button kendoButton fillMode="flat" size="small" [svgIcon]="deleteIcon"
              (click)="onDeleteMapping(dataItem); $event.stopPropagation()">
            </button>
          </ng-template>
        </kendo-grid-column>
      </kendo-grid>

      <!-- Detail Panel (selected mapping) -->
      @if (selectedMapping()) {
        <div class="detail-panel">
          <h4>{{ selectedMapping()!.name || 'Mapping Details' }}</h4>
          <div class="detail-grid">
            <div class="detail-row">
              <label>Source Entity</label>
              <span class="entity-ref" (click)="navigateToEntity.emit({ rtId: selectedMapping()!.sourceRtId, ckTypeId: selectedMapping()!.sourceCkTypeId })">
                {{ selectedMapping()!.sourceName || selectedMapping()!.sourceRtId }}
              </span>
              <span class="entity-type-hint">{{ selectedMapping()!.sourceCkTypeId }}</span>
            </div>
            <div class="detail-row">
              <label>Source Attribute</label>
              <span>{{ selectedMapping()!.sourceAttributePath || '(default)' }}</span>
            </div>
            <div class="detail-row">
              <label>Expression</label>
              <code>{{ selectedMapping()!.mappingExpression || '(none — pass through)' }}</code>
            </div>
            <div class="detail-row">
              <label>Target Entity</label>
              @if (selectedMapping()!.targetRtId) {
                <span class="entity-ref" (click)="navigateToEntity.emit({ rtId: selectedMapping()!.targetRtId, ckTypeId: selectedMapping()!.targetCkTypeId })">
                  {{ selectedMapping()!.targetName || selectedMapping()!.targetRtId }}
                </span>
                <span class="entity-type-hint">{{ selectedMapping()!.targetCkTypeId }}</span>
              } @else {
                <span class="no-target">(no target configured)</span>
              }
            </div>
            <div class="detail-row">
              <label>Target Attribute</label>
              <span>{{ selectedMapping()!.targetAttributePath || '(not set)' }}</span>
            </div>
            <div class="detail-row">
              <label>Enabled</label>
              <span>{{ selectedMapping()!.enabled ? 'Yes' : 'No' }}</span>
            </div>
          </div>

          @if (selectedMapping()!.validationMessages.length > 0) {
            <div class="validation-section">
              <h5>Validation</h5>
              @for (msg of selectedMapping()!.validationMessages; track msg.code) {
                <div class="validation-msg" [class]="'validation-' + msg.level">
                  {{ msg.message }}
                </div>
              }
            </div>
          }
        </div>
      }

      @if (loading()) {
        <div class="loading-overlay">Loading mappings...</div>
      }
    </div>
  `,
  styles: [`
    .mapping-overview {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
    }

    .summary-bar {
      display: flex;
      gap: 16px;
      align-items: center;
      padding: 8px 12px;
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 6px;
      background: var(--kendo-color-surface-alt, #f8f9fa);
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 60px;
    }

    .summary-count {
      font-size: 1.2rem;
      font-weight: 700;
    }

    .summary-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .summary-valid .summary-count { color: var(--kendo-color-success, #28a745); }
    .summary-warnings .summary-count { color: var(--kendo-color-warning, #ffc107); }
    .summary-errors .summary-count { color: var(--kendo-color-error, #dc3545); }
    .summary-disabled .summary-count { color: var(--kendo-color-subtle, #6c757d); }
    .summary-spacer { flex: 1; }

    .status-valid { color: var(--kendo-color-success, #28a745); }
    .status-warning { color: var(--kendo-color-warning, #ffc107); }
    .status-error { color: var(--kendo-color-error, #dc3545); }

    .entity-ref {
      cursor: pointer;
      color: var(--kendo-color-primary, #ff6358);
      font-family: monospace;
      font-size: 0.85rem;
    }

    .entity-ref:hover {
      text-decoration: underline;
    }

    .no-target {
      color: var(--kendo-color-subtle, #6c757d);
      font-style: italic;
    }

    .entity-type-hint {
      font-size: 0.7rem;
      color: var(--kendo-color-subtle, #6c757d);
      font-family: monospace;
    }

    .expression-cell {
      font-size: 0.85rem;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      padding: 2px 4px;
      border-radius: 3px;
    }

    .detail-panel {
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 6px;
      padding: 12px 16px;
    }

    .detail-panel h4 {
      margin: 0 0 12px;
      font-size: 0.9rem;
      font-weight: 600;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: 6px 12px;
    }

    .detail-row {
      display: contents;
    }

    .detail-row label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--kendo-color-subtle, #6c757d);
      padding-top: 2px;
    }

    .detail-row span, .detail-row code {
      font-size: 0.85rem;
    }

    .validation-section {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid var(--kendo-color-border, #dee2e6);
    }

    .validation-section h5 {
      margin: 0 0 6px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .validation-msg {
      font-size: 0.8rem;
      padding: 2px 0;
    }

    .validation-error { color: var(--kendo-color-error, #dc3545); }
    .validation-warning { color: var(--kendo-color-warning, #ffc107); }
    .validation-info { color: var(--kendo-color-info, #17a2b8); }

    .loading-overlay {
      text-align: center;
      padding: 20px;
      color: var(--kendo-color-subtle, #6c757d);
    }
  `],
})
export class DataMappingOverviewComponent implements OnInit {
  private readonly getMappingsGQL = inject(GetDataPointMappingsDtoGQL);
  private readonly getEntityByIdGQL = inject(GetRuntimeEntityByIdDtoGQL);
  private readonly updateEntitiesGQL = inject(UpdateRuntimeEntitiesDtoGQL);
  private readonly deleteEntitiesGQL = inject(DeleteEntitiesDtoGQL);

  @Output() navigateToEntity = new EventEmitter<{ rtId: string; ckTypeId: string }>();

  // State
  readonly mappings = signal<DataPointMappingOverviewItem[]>([]);
  readonly loading = signal(false);
  readonly selectedMapping = signal<DataPointMappingOverviewItem | null>(null);

  pageSize = 20;
  skip = 0;

  readonly gridData = computed(() => ({
    data: this.mappings().slice(this.skip, this.skip + this.pageSize),
    total: this.mappings().length,
  }));

  readonly summary = computed<MappingOverviewSummary>(() => {
    const items = this.mappings();
    return {
      total: items.length,
      valid: items.filter(m => m.validationStatus === 'valid').length,
      warnings: items.filter(m => m.validationStatus === 'warning').length,
      errors: items.filter(m => m.validationStatus === 'error').length,
      disabled: items.filter(m => !m.enabled).length,
    };
  });

  protected readonly refreshIcon = arrowRotateCwIcon;
  protected readonly checkIcon = checkCircleIcon;
  protected readonly warnIcon = exclamationCircleIcon;
  protected readonly errorIcon = xCircleIcon;
  protected readonly deleteIcon = trashIcon;

  ngOnInit(): void {
    this.loadMappings();
  }

  async loadMappings(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await firstValueFrom(
        this.getMappingsGQL.fetch({
          variables: {
            ckTypeId: DATA_POINT_MAPPING_CK_TYPE,
            first: 500,
          },
          fetchPolicy: 'network-only',
        })
      );

      const entities = result.data?.runtime?.runtimeEntities?.items ?? [];
      const items: DataPointMappingOverviewItem[] = entities
        .filter((e): e is NonNullable<typeof e> => e != null)
        .map(entity => this.mapEntityToOverviewItem(entity));

      // Run validation
      items.forEach(item => this.validateMapping(item, items));

      this.mappings.set(items);

      // Resolve entity names in background (non-blocking)
      this.resolveEntityNames(items);
    } catch (err) {
      console.error('Error loading DataPointMappings:', err);
    } finally {
      this.loading.set(false);
    }
  }

  onPageChange(event: PageChangeEvent): void {
    this.skip = event.skip;
    this.pageSize = event.take;
  }

  onCellClick(event: CellClickEvent): void {
    this.selectedMapping.set(event.dataItem as DataPointMappingOverviewItem);
  }

  async onToggleEnabled(item: DataPointMappingOverviewItem, enabled: boolean): Promise<void> {
    try {
      await firstValueFrom(
        this.updateEntitiesGQL.mutate({
          variables: {
            entities: [{
              rtId: item.rtId,
              item: {
                ckTypeId: DATA_POINT_MAPPING_CK_TYPE,
                attributes: [{ attributeName: 'Enabled', value: enabled }],
              },
            }],
          },
        })
      );
      item.enabled = enabled;
      this.mappings.set([...this.mappings()]);
    } catch (err) {
      console.error('Error toggling mapping enabled state:', err);
    }
  }

  async onDeleteMapping(item: DataPointMappingOverviewItem): Promise<void> {
    try {
      await firstValueFrom(
        this.deleteEntitiesGQL.mutate({
          variables: {
            rtEntityIds: [{ rtId: item.rtId, ckTypeId: DATA_POINT_MAPPING_CK_TYPE }],
            deleteStrategy: DeleteStrategiesDto.EraseDto,
          },
        })
      );
      const updated = this.mappings().filter(m => m.rtId !== item.rtId);
      this.mappings.set(updated);
      if (this.selectedMapping()?.rtId === item.rtId) {
        this.selectedMapping.set(null);
      }
    } catch (err) {
      console.error('Error deleting mapping:', err);
    }
  }

  private mapEntityToOverviewItem(entity: {
    rtId: unknown;
    ckTypeId: unknown;
    attributes?: { items?: ({ attributeName?: string | null; value?: unknown } | null)[] | null } | null;
    associations?: { definitions?: { items?: ({ targetRtId: unknown; targetCkTypeId: unknown; ckAssociationRoleId: unknown } | null)[] | null } | null } | null;
  }): DataPointMappingOverviewItem {
    const attrs = entity.attributes?.items ?? [];
    const assocs = entity.associations?.definitions?.items ?? [];

    const getAttr = (name: string): string =>
      (attrs.find(a => a?.attributeName === name)?.value as string) ?? '';

    const mapsFrom = assocs.find(a => a && String(a.ckAssociationRoleId).includes('MapsFrom'));
    const mapsTo = assocs.find(a => a && String(a.ckAssociationRoleId).includes('MapsTo'));

    const enabledRaw = attrs.find(a => a?.attributeName === 'Enabled')?.value;
    const enabled = enabledRaw === true || enabledRaw === 'true' || enabledRaw === 'True';

    return {
      rtId: String(entity.rtId),
      name: getAttr('Name') || `Mapping ${String(entity.rtId).slice(-6)}`,
      enabled,
      sourceAttributePath: getAttr('SourceAttributePath'),
      mappingExpression: getAttr('MappingExpression'),
      targetAttributePath: getAttr('TargetAttributePath'),
      sourceRtId: mapsFrom ? String(mapsFrom.targetRtId) : '',
      sourceCkTypeId: mapsFrom ? String(mapsFrom.targetCkTypeId) : '',
      sourceName: '',
      targetRtId: mapsTo ? String(mapsTo.targetRtId) : '',
      targetCkTypeId: mapsTo ? String(mapsTo.targetCkTypeId) : '',
      targetName: '',
      validationStatus: 'valid',
      validationMessages: [],
    };
  }

  private validateMapping(item: DataPointMappingOverviewItem, allItems: DataPointMappingOverviewItem[]): void {
    const messages: ValidationMessage[] = [];

    // Error: No source entity
    if (!item.sourceRtId) {
      messages.push({ level: 'error', code: 'SOURCE_MISSING', message: 'No MapsFrom source entity configured' });
    }

    // Error: No target entity
    if (!item.targetRtId) {
      messages.push({ level: 'error', code: 'TARGET_MISSING', message: 'No MapsTo target entity configured' });
    }

    // Error: No target attribute
    if (!item.targetAttributePath) {
      messages.push({ level: 'error', code: 'TARGET_ATTR_MISSING', message: 'TargetAttributePath is not set' });
    }

    // Warning: Duplicate mapping (same source → same target + attribute)
    const duplicates = allItems.filter(m =>
      m.rtId !== item.rtId &&
      m.sourceRtId === item.sourceRtId &&
      m.sourceAttributePath === item.sourceAttributePath &&
      m.targetRtId === item.targetRtId &&
      m.targetAttributePath === item.targetAttributePath
    );
    if (duplicates.length > 0) {
      messages.push({ level: 'warning', code: 'DUPLICATE', message: 'Duplicate mapping — same source and target attribute' });
    }

    item.validationMessages = messages;
    item.validationStatus = messages.some(m => m.level === 'error')
      ? 'error'
      : messages.some(m => m.level === 'warning')
        ? 'warning'
        : 'valid';
  }

  /**
   * Resolves entity names for all unique source/target rtIds.
   * Updates items in-place and triggers signal update.
   */
  private async resolveEntityNames(items: DataPointMappingOverviewItem[]): Promise<void> {
    // Collect unique entity references (rtId + ckTypeId pairs)
    const entityRefs = new Map<string, { rtId: string; ckTypeId: string }>();
    for (const item of items) {
      if (item.sourceRtId && item.sourceCkTypeId) {
        entityRefs.set(item.sourceRtId, { rtId: item.sourceRtId, ckTypeId: item.sourceCkTypeId });
      }
      if (item.targetRtId && item.targetCkTypeId) {
        entityRefs.set(item.targetRtId, { rtId: item.targetRtId, ckTypeId: item.targetCkTypeId });
      }
    }

    // Load entity names in parallel
    const nameMap = new Map<string, string>();
    const loadPromises = [...entityRefs.values()].map(async (ref) => {
      try {
        const result = await firstValueFrom(
          this.getEntityByIdGQL.fetch({
            variables: { rtId: ref.rtId, ckTypeId: ref.ckTypeId },
          })
        );
        const entity = result.data?.runtime?.runtimeEntities?.items?.[0];
        if (entity) {
          const nameAttr = entity.attributes?.items?.find(
            a => a?.attributeName === 'Name'
          );
          const name = nameAttr?.value as string
            ?? entity.rtWellKnownName
            ?? '';
          if (name) {
            nameMap.set(ref.rtId, name);
          }
        }
      } catch {
        // Entity not found or access denied — leave name empty
      }
    });

    await Promise.all(loadPromises);

    // Update items with resolved names
    let changed = false;
    for (const item of items) {
      const sourceName = nameMap.get(item.sourceRtId);
      if (sourceName && sourceName !== item.sourceName) {
        item.sourceName = sourceName;
        changed = true;
      }
      const targetName = nameMap.get(item.targetRtId);
      if (targetName && targetName !== item.targetName) {
        item.targetName = targetName;
        changed = true;
      }
    }

    // Trigger signal update to refresh the grid
    if (changed) {
      this.mappings.set([...items]);
    }
  }
}
