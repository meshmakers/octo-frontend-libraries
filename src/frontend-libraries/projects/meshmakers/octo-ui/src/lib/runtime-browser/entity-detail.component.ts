import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { NotificationService } from '@progress/kendo-angular-notification';
import { arrowLeftIcon } from '@progress/kendo-svg-icons';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { GraphDirectionDto, RtEntityDto } from '../graphQL/globalTypes';
import { GetRuntimeEntityAssociationsByIdDtoGQL } from '../graphQL/getRuntimeEntityAssociationsById';
import { UpdateRuntimeEntitiesDtoGQL } from '../graphQL/updateRuntimeEntities';
import { EntitySelectorDialogService } from '../entity-selector-dialog';
import { EntityDetailViewComponent } from './components/entity-detail-view.component';
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
        [mappingTarget]="mappingTarget"
        [sourceAttributeName]="sourceAttributeName"
        [targetAttributeName]="targetAttributeName"
        (retry)="loadEntity()"
        (propertyChange)="onPropertyChange($event)"
        (navigateToEntity)="navigateToEntity($event.rtId, $event.ckTypeId)"
        (selectMappingTarget)="onSelectMappingTarget()"
        (saveMappingRequested)="onSaveMapping($event)"
        (removeMappingRequested)="onRemoveMapping()"
      >
      </mm-entity-detail-view>
    </div>
  `,
  styleUrls: ['./entity-detail.component.scss'],
})
export class EntityDetailComponent implements OnInit, OnDestroy {
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dataSource = inject(EntityDetailDataSource);
  private readonly notificationService = inject(NotificationService);
  private readonly getAssociationsGQL = inject(GetRuntimeEntityAssociationsByIdDtoGQL);
  private readonly updateEntitiesGQL = inject(UpdateRuntimeEntitiesDtoGQL);
  private readonly entitySelectorDialog = inject(EntitySelectorDialogService);
  private readonly destroy$ = new Subject<void>();

  protected readonly arrowLeftIcon = arrowLeftIcon;

  entity: RtEntityDto | null = null;
  loading = false;
  error: string | null = null;
  entityId: RtEntityId | null = null;

  // Data Mapping state
  mappingTarget: { rtId: string; ckTypeId: string; name?: string } | null = null;
  sourceAttributeName = '';
  targetAttributeName = '';

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
        await this.loadMapping();
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
    // Navigate to another entity detail page
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

  /**
   * Handle property value changes from the property grid
   */
  onPropertyChange(event: unknown): void {
    console.debug('Property changed:', event);
  }

  /**
   * Load existing MapsToEntity mapping for current entity
   */
  async loadMapping(): Promise<void> {
    if (!this.entity?.rtId || !this.entity?.ckTypeId) return;

    try {
      const result = await firstValueFrom(
        this.getAssociationsGQL.fetch({
          variables: {
            rtId: this.entity.rtId,
            ckTypeId: this.entity.ckTypeId,
            direction: GraphDirectionDto.OutboundDto,
            first: 10,
          },
        }),
      );

      const entityItem = result.data?.runtime?.runtimeEntities?.items?.[0];
      const associations = entityItem?.associations?.definitions?.items ?? [];
      const mapsToAssoc = associations.filter(Boolean).find(
        (a) => a?.ckAssociationRoleId?.includes('MapsToEntity'),
      );

      if (mapsToAssoc && 'targetRtId' in mapsToAssoc && 'targetCkTypeId' in mapsToAssoc) {
        this.mappingTarget = {
          rtId: mapsToAssoc.targetRtId as string,
          ckTypeId: mapsToAssoc.targetCkTypeId as string,
        };
      } else {
        this.mappingTarget = null;
      }

      // Read mapping attributes from entity
      const sourceAttr = this.entity.attributes?.items?.find(
        (a) => a?.attributeName === 'sourceAttributeName',
      );
      this.sourceAttributeName = (sourceAttr?.value as string) ?? '';

      const targetAttr = this.entity.attributes?.items?.find(
        (a) => a?.attributeName === 'targetAttributeName',
      );
      this.targetAttributeName = (targetAttr?.value as string) ?? '';
    } catch (error) {
      console.error('Failed to load mapping:', error);
    }
  }

  /**
   * Open target entity selector dialog
   */
  async onSelectMappingTarget(): Promise<void> {
    const result = await this.entitySelectorDialog.openEntitySelector({
      title: 'Select Mapping Target Entity',
      currentTargetRtId: this.mappingTarget?.rtId,
      currentTargetCkTypeId: this.mappingTarget?.ckTypeId,
    });

    if (result.confirmed && result.entity) {
      this.mappingTarget = {
        rtId: result.entity.rtId,
        ckTypeId: result.entity.ckTypeId,
        name: result.entity.name,
      };
    }
  }

  /**
   * Save mapping: update TargetAttributeName + create MapsToEntity association
   */
  async onSaveMapping(event: {
    targetRtId: string;
    targetCkTypeId: string;
    sourceAttributeName: string;
    targetAttributeName: string;
  }): Promise<void> {
    if (!this.entity?.rtId || !this.entity?.ckTypeId) return;

    try {
      await firstValueFrom(
        this.updateEntitiesGQL.mutate({
          variables: {
            entities: [
              {
                rtId: this.entity.rtId,
                item: {
                  ckTypeId: this.entity.ckTypeId,
                  attributes: [
                    {
                      attributeName: 'sourceAttributeName',
                      value: event.sourceAttributeName || null,
                    },
                    {
                      attributeName: 'targetAttributeName',
                      value: event.targetAttributeName,
                    },
                    {
                      attributeName: 'mapsTo',
                      value: [
                        {
                          target: {
                            rtId: event.targetRtId,
                            ckTypeId: event.targetCkTypeId,
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        }),
      );

      this.targetAttributeName = event.targetAttributeName;
      this.notificationService.show({
        content: 'Data mapping saved successfully',
        type: { style: 'success', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 3000,
        animation: { type: 'fade', duration: 400 },
      });
    } catch (error) {
      console.error('Failed to save mapping:', error);
      this.notificationService.show({
        content: 'Failed to save data mapping',
        type: { style: 'error', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 3000,
        animation: { type: 'fade', duration: 400 },
      });
    }
  }

  /**
   * Remove mapping: clear TargetAttributeName + delete MapsToEntity association
   */
  async onRemoveMapping(): Promise<void> {
    if (!this.entity?.rtId || !this.entity?.ckTypeId || !this.mappingTarget)
      return;

    try {
      await firstValueFrom(
        this.updateEntitiesGQL.mutate({
          variables: {
            entities: [
              {
                rtId: this.entity.rtId,
                item: {
                  ckTypeId: this.entity.ckTypeId,
                  attributes: [
                    {
                      attributeName: 'sourceAttributeName',
                      value: null,
                    },
                    {
                      attributeName: 'targetAttributeName',
                      value: null,
                    },
                    {
                      attributeName: 'mapsTo',
                      value: [
                        {
                          target: {
                            rtId: this.mappingTarget.rtId,
                            ckTypeId: this.mappingTarget.ckTypeId,
                          },
                          modOption: 'DELETE',
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        }),
      );

      this.mappingTarget = null;
      this.sourceAttributeName = '';
      this.targetAttributeName = '';
      this.notificationService.show({
        content: 'Data mapping removed',
        type: { style: 'success', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 3000,
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
}
