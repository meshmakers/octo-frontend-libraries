import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { NotificationService } from '@progress/kendo-angular-notification';
import { arrowLeftIcon } from '@progress/kendo-svg-icons';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import {
  DeleteStrategiesDto,
  GraphDirectionDto,
  RtEntityDto,
} from '../graphQL/globalTypes';
import { CreateEntitiesDtoGQL } from '../graphQL/createEntities';
import { DeleteEntitiesDtoGQL } from '../graphQL/deleteEntities';
import { GetRuntimeEntityAssociationsByIdDtoGQL } from '../graphQL/getRuntimeEntityAssociationsById';
import { GetRuntimeEntityByIdDtoGQL } from '../graphQL/getRuntimeEntityById';
import { UpdateRuntimeEntitiesDtoGQL } from '../graphQL/updateRuntimeEntities';
import { AttributeSelectorDialogService } from '../attribute-selector-dialog';
import { EntitySelectorDialogService } from '../entity-selector-dialog';
import { EntityDetailViewComponent } from './components/entity-detail-view.component';
import { DataPointMappingItem } from './components/data-mapping/data-mapping-list.component';
import { EntityDetailDataSource } from './data-sources/entity-detail-data-source.service';
import { RtEntityId, RtEntityIdHelper } from './models/rt-entity-id';

@Component({
  selector: 'mm-entity-detail',
  imports: [
    CommonModule,
    ButtonModule,
    SVGIconModule,
    EntityDetailViewComponent,
  ],
  template: `
    <div class="entity-detail">
      <div class="entity-detail-header">
        <button
          kendoButton
          size="small"
          [svgIcon]="arrowLeftIcon"
          (click)="navigateBack()"
        >
          Back
        </button>

        @if (entity) {
          <div class="header-info">
            <div class="entity-title">
              <h2>{{ getEntityDisplayName() }}</h2>
              <p class="entity-type">{{ entity.ckTypeId }}</p>
            </div>
          </div>
        }
      </div>

      <mm-entity-detail-view
        [entity]="entity"
        [loading]="loading"
        [error]="error"
        [showDataMapping]="showDataMapping"
        [dataMappings]="dataMappings"
        (retry)="loadEntity()"
        (propertyChange)="onPropertyChange($event)"
        (navigateToEntity)="navigateToEntity($event.rtId, $event.ckTypeId)"
        (addMappingRequested)="onAddMapping()"
        (removeMappingRequested)="onRemoveMapping($event)"
        (selectMappingTarget)="onSelectMappingTarget($event)"
        (selectSourceAttributeRequested)="onSelectSourceAttribute($event)"
        (selectTargetAttributeRequested)="onSelectTargetAttribute($event)"
        (mappingChanged)="onMappingChanged($event)"
        (saveAllMappingsRequested)="onSaveAllMappings()"
      >
      </mm-entity-detail-view>
    </div>
  `,
  styleUrls: ['./entity-detail.component.scss'],
})
export class EntityDetailComponent implements OnInit, OnDestroy {
  private static readonly DATA_POINT_MAPPING_CK_TYPE = 'System.Communication/DataPointMapping';
  private static readonly MAPS_FROM_ROLE = 'System.Communication/MapsFrom';
  private static readonly MAPS_TO_ROLE = 'System.Communication/MapsTo';

  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dataSource = inject(EntityDetailDataSource);
  private readonly notificationService = inject(NotificationService);
  private readonly getAssociationsGQL = inject(GetRuntimeEntityAssociationsByIdDtoGQL);
  private readonly getEntityByIdGQL = inject(GetRuntimeEntityByIdDtoGQL);
  private readonly createEntitiesGQL = inject(CreateEntitiesDtoGQL);
  private readonly updateEntitiesGQL = inject(UpdateRuntimeEntitiesDtoGQL);
  private readonly deleteEntitiesGQL = inject(DeleteEntitiesDtoGQL);
  private readonly entitySelectorDialog = inject(EntitySelectorDialogService);
  private readonly attributeSelectorDialog = inject(AttributeSelectorDialogService);
  private readonly destroy$ = new Subject<void>();

  protected readonly arrowLeftIcon = arrowLeftIcon;

  showDataMapping = true;
  entity: RtEntityDto | null = null;
  loading = false;
  error: string | null = null;
  entityId: RtEntityId | null = null;

  // Data Mapping state (list of DataPointMapping entities)
  dataMappings: DataPointMappingItem[] = [];

  async ngOnInit(): Promise<void> {
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (params) => {
        const encodedId = params['id'];
        if (encodedId) {
          try {
            this.entityId = RtEntityIdHelper.decode(encodedId);
            await this.loadEntity();
          } catch (error) {
            this.error = 'Invalid entity ID format';
            console.error('Failed to decode entity ID:', error);
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadEntity(): Promise<void> {
    if (!this.entityId) {
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      this.entity = await this.dataSource.fetchEntityDetails(
        this.entityId.rtId,
        this.entityId.ckTypeId,
      );
      if (!this.entity) {
        this.error = 'Entity not found';
      } else {
        await this.loadDataMappings();
      }
    } catch (error) {
      console.error('Failed to load entity:', error);
      this.error = 'Failed to load entity details';
    } finally {
      this.loading = false;
    }
  }

  navigateBack(): void {
    this.location.back();
  }

  async navigateToEntity(rtId: string, ckTypeId: string): Promise<void> {
    if (!rtId || !ckTypeId || rtId === 'Unknown' || ckTypeId === 'Unknown')
      return;

    const encodedId = RtEntityIdHelper.encode(rtId, ckTypeId);
    const currentUrl = this.router.url;
    const newEntityUrl = currentUrl.replace(
      /\/browser\/entity\/[^/]+$/,
      `/browser/entity/${encodedId}`,
    );
    await this.router.navigateByUrl(newEntityUrl);
  }

  getEntityDisplayName(): string {
    if (!this.entity) return 'Unknown Entity';

    const nameAttr = this.entity.attributes?.items?.find(
      (attr) =>
        attr?.attributeName === 'name' || attr?.attributeName === 'displayName',
    );

    if (nameAttr?.value && typeof nameAttr.value === 'string') {
      return nameAttr.value;
    }

    return (
      this.entity.rtWellKnownName || this.entity.ckTypeId || 'Unknown Entity'
    );
  }

  onPropertyChange(event: unknown): void {
    console.debug('Property changed:', event);
  }

  async loadDataMappings(): Promise<void> {
    if (!this.entity?.rtId || !this.entity?.ckTypeId) {
      this.dataMappings = [];
      return;
    }

    try {
      const assocResult = await firstValueFrom(
        this.getAssociationsGQL.fetch({
          variables: {
            rtId: this.entity.rtId,
            ckTypeId: this.entity.ckTypeId,
            direction: GraphDirectionDto.InboundDto,
            roleId: EntityDetailComponent.MAPS_FROM_ROLE,
            first: 100,
          },
        }),
      );

      const associations = assocResult.data?.runtime?.runtimeEntities?.items?.[0]
        ?.associations?.definitions?.items ?? [];

      const mappings: DataPointMappingItem[] = [];
      for (const assoc of associations) {
        if (!assoc?.originRtId || !assoc?.originCkTypeId) continue;

        const mappingItem = await this.loadMappingDetails(
          assoc.originRtId,
          assoc.originCkTypeId,
        );
        if (mappingItem) {
          mappings.push(mappingItem);
        }
      }

      this.dataMappings = mappings;
    } catch (error) {
      console.error('Failed to load data mappings:', error);
      this.dataMappings = [];
    }
  }

  private async loadMappingDetails(
    rtId: string,
    ckTypeId: string,
  ): Promise<DataPointMappingItem | null> {
    try {
      const entityResult = await firstValueFrom(
        this.getEntityByIdGQL.fetch({
          variables: { rtId, ckTypeId },
        }),
      );

      const mappingEntity = entityResult.data?.runtime?.runtimeEntities?.items?.[0];
      if (!mappingEntity) return null;

      const attrs = mappingEntity.attributes?.items ?? [];
      const getAttr = (name: string): string =>
        (attrs.find((a) => a?.attributeName === name)?.value as string) ?? '';

      const targetResult = await firstValueFrom(
        this.getAssociationsGQL.fetch({
          variables: {
            rtId,
            ckTypeId,
            direction: GraphDirectionDto.OutboundDto,
            roleId: EntityDetailComponent.MAPS_TO_ROLE,
            first: 1,
          },
        }),
      );

      const targetAssoc = targetResult.data?.runtime?.runtimeEntities?.items?.[0]
        ?.associations?.definitions?.items?.[0];

      const targetRtId = targetAssoc?.targetRtId ?? undefined;
      return {
        rtId,
        name: getAttr('name') || undefined,
        sourceAttributePath: getAttr('sourceAttributePath'),
        mappingExpression: getAttr('mappingExpression'),
        targetAttributePath: getAttr('targetAttributePath'),
        targetRtId,
        targetCkTypeId: targetAssoc?.targetCkTypeId ?? undefined,
        enabled: getAttr('enabled') !== 'false',
        _originalTargetRtId: targetRtId,
      };
    } catch (error) {
      console.error(`Failed to load mapping details for ${rtId}:`, error);
      return null;
    }
  }

  async onAddMapping(): Promise<void> {
    if (!this.entity?.rtId || !this.entity?.ckTypeId) return;

    try {
      const createResult = await firstValueFrom(
        this.createEntitiesGQL.mutate({
          variables: {
            entities: [{
              ckTypeId: EntityDetailComponent.DATA_POINT_MAPPING_CK_TYPE,
              attributes: [
                { attributeName: 'name', value: `Mapping ${this.dataMappings.length + 1}` },
                { attributeName: 'enabled', value: true },
              ],
              associations: [{
                roleName: 'mappedAsSource',
                targets: [{ target: { rtId: this.entity.rtId, ckTypeId: this.entity.ckTypeId } }],
              }],
            }],
          },
        }),
      );

      const newRtId = createResult.data?.runtime?.runtimeEntities?.create?.[0]?.rtId;
      if (newRtId) {
        this.dataMappings = [
          ...this.dataMappings,
          {
            rtId: newRtId,
            name: `Mapping ${this.dataMappings.length + 1}`,
            sourceAttributePath: '',
            mappingExpression: '',
            targetAttributePath: '',
            enabled: true,
          },
        ];
      }

      this.notificationService.show({
        content: 'Data mapping created',
        type: { style: 'success', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 2000,
        animation: { type: 'fade', duration: 400 },
      });
    } catch (error) {
      console.error('Failed to add mapping:', error);
      this.notificationService.show({
        content: 'Failed to create data mapping',
        type: { style: 'error', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 3000,
        animation: { type: 'fade', duration: 400 },
      });
    }
  }

  async onRemoveMapping(mapping: DataPointMappingItem): Promise<void> {
    if (!mapping.rtId) return;

    try {
      await firstValueFrom(
        this.deleteEntitiesGQL.mutate({
          variables: {
            rtEntityIds: [{
              rtId: mapping.rtId,
              ckTypeId: EntityDetailComponent.DATA_POINT_MAPPING_CK_TYPE,
            }],
            deleteStrategy: DeleteStrategiesDto.EraseDto,
          },
        }),
      );

      this.dataMappings = this.dataMappings.filter((m) => m.rtId !== mapping.rtId);

      this.notificationService.show({
        content: 'Data mapping removed',
        type: { style: 'success', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 2000,
        animation: { type: 'fade', duration: 400 },
      });
    } catch (error) {
      console.error('Failed to remove mapping:', error);
      this.notificationService.show({
        content: 'Failed to remove data mapping',
        type: { style: 'error', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 3000,
        animation: { type: 'fade', duration: 400 },
      });
    }
  }

  async onSelectMappingTarget(mapping: DataPointMappingItem): Promise<void> {
    const result = await this.entitySelectorDialog.openEntitySelector({
      title: 'Select Mapping Target Entity',
      currentTargetRtId: mapping.targetRtId,
      currentTargetCkTypeId: mapping.targetCkTypeId,
    });

    if (result.confirmed && result.entity) {
      mapping.targetRtId = result.entity.rtId;
      mapping.targetCkTypeId = result.entity.ckTypeId;
      mapping.targetName = result.entity.name;
      this.dataMappings = [...this.dataMappings];
    }
  }

  onMappingChanged(_mapping: DataPointMappingItem): void {
    // Changes tracked in-memory; persisted on "Save All"
  }

  async onSelectSourceAttribute(mapping: DataPointMappingItem): Promise<void> {
    if (!this.entity?.ckTypeId) return;

    const result = await this.attributeSelectorDialog.openAttributeSelector(
      this.entity.ckTypeId,
      mapping.sourceAttributePath ? [mapping.sourceAttributePath] : undefined,
      'Select Source Attribute',
      true,
      undefined,
      false,
      undefined,
      true,
    );

    if (result.confirmed && result.selectedAttributes.length > 0) {
      mapping.sourceAttributePath = result.selectedAttributes[0].attributePath;
      this.dataMappings = [...this.dataMappings];
    }
  }

  async onSelectTargetAttribute(mapping: DataPointMappingItem): Promise<void> {
    if (!mapping.targetCkTypeId) return;

    const result = await this.attributeSelectorDialog.openAttributeSelector(
      mapping.targetCkTypeId,
      mapping.targetAttributePath ? [mapping.targetAttributePath] : undefined,
      'Select Target Attribute',
      true,
      undefined,
      false,
      undefined,
      true,
    );

    if (result.confirmed && result.selectedAttributes.length > 0) {
      mapping.targetAttributePath = result.selectedAttributes[0].attributePath;
      this.dataMappings = [...this.dataMappings];
    }
  }

  async onSaveAllMappings(): Promise<void> {
    try {
      const updateEntities = this.dataMappings
        .filter((m) => m.rtId)
        .map((m) => {
          const attributes: { attributeName: string; value: unknown }[] = [
            { attributeName: 'name', value: m.name || null },
            { attributeName: 'sourceAttributePath', value: m.sourceAttributePath || null },
            { attributeName: 'mappingExpression', value: m.mappingExpression || null },
            { attributeName: 'targetAttributePath', value: m.targetAttributePath || null },
            { attributeName: 'enabled', value: m.enabled ?? true },
          ];

          const associations: { roleName: string; targets: { target: { rtId: string; ckTypeId: string } }[] }[] = [];

          const targetChanged = m.targetRtId !== m._originalTargetRtId;
          if (targetChanged && m.targetRtId && m.targetCkTypeId) {
            associations.push({
              roleName: 'mappedAsTarget',
              targets: [{ target: { rtId: m.targetRtId, ckTypeId: m.targetCkTypeId } }],
            });
          }

          return {
            rtId: m.rtId,
            item: {
              ckTypeId: EntityDetailComponent.DATA_POINT_MAPPING_CK_TYPE,
              attributes,
              associations: associations.length > 0 ? associations : undefined,
            },
          };
        });

      if (updateEntities.length > 0) {
        await firstValueFrom(
          this.updateEntitiesGQL.mutate({
            variables: { entities: updateEntities },
          }),
        );
      }

      // Update original target tracking after successful save
      for (const m of this.dataMappings) {
        m._originalTargetRtId = m.targetRtId;
      }

      this.notificationService.show({
        content: 'All data mappings saved',
        type: { style: 'success', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 2000,
        animation: { type: 'fade', duration: 400 },
      });
    } catch (error) {
      console.error('Failed to save mappings:', error);
      this.notificationService.show({
        content: 'Failed to save data mappings',
        type: { style: 'error', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 3000,
        animation: { type: 'fade', duration: 400 },
      });
    }
  }
}
