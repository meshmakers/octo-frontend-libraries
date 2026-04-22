import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  CommandItemExecuteEventArgs,
  TreeItemDataTyped,
} from "@meshmakers/shared-services";
import { ListViewComponent } from "@meshmakers/shared-ui";
import { ButtonModule } from "@progress/kendo-angular-buttons";
import { SVGIconModule } from "@progress/kendo-angular-icons";
import { NotificationService } from "@progress/kendo-angular-notification";
import { eyeIcon } from "@progress/kendo-svg-icons";
import { firstValueFrom } from "rxjs";
import {
  DeleteStrategiesDto,
  GraphDirectionDto,
  CkModelDto,
  CkTypeDto,
  RtEntityDto,
} from "../../graphQL/globalTypes";
import { CreateEntitiesDtoGQL } from "../../graphQL/createEntities";
import { DeleteEntitiesDtoGQL } from "../../graphQL/deleteEntities";
import { GetRuntimeEntityAssociationsByIdDtoGQL } from "../../graphQL/getRuntimeEntityAssociationsById";
import { GetRuntimeEntityByIdDtoGQL } from "../../graphQL/getRuntimeEntityById";
import { UpdateRuntimeEntitiesDtoGQL } from "../../graphQL/updateRuntimeEntities";
import { AttributeSelectorDialogService } from "../../attribute-selector-dialog";
import { EntitySelectorDialogService } from "../../entity-selector-dialog";
import { DataPointMappingItem } from "./data-mapping/data-mapping-list.component";
import { CkTypeEntitiesDataSourceDirective } from "../data-sources/ck-type-entities-data-source.directive";
import { EntityDetailDataSource } from "../data-sources/entity-detail-data-source.service";
import { RtEntityIdHelper } from "../models/rt-entity-id";
import {
  DEFAULT_RUNTIME_BROWSER_MESSAGES,
  RuntimeBrowserMessages,
} from "../runtime-browser.model";
import { RuntimeBrowserStateService } from "../services/runtime-browser-state.service";
import { TypeHelperService } from "../services/type-helper.service";
import {
  CreateEditorComponent,
  CreateInput,
  CreateOutput,
} from "./create-editor/create-editor-component";
import { EntityDetailViewComponent } from "./entity-detail-view.component";
import {
  UpdateEditorComponent,
  UpdateInput,
  UpdateOutput,
} from "./update-editor/update-editor-component";

// Extended type to handle both Runtime Entities and CK Models/Types
type BrowserItem =
  | RtEntityDto
  | CkModelDto
  | CkTypeDto
  | { isCkModelsRoot?: boolean; ckModelId?: string };

/** Payload emitted when create or update finishes; parent uses it to refresh tree and optionally reload detail view. */
export interface EntitySavedEvent {
  parentCkTypeId?: string;
  parentRtId?: string;
  /** True when save was an update; parent should reload detail view after tree refresh. */
  isUpdate?: boolean;
}

@Component({
  selector: "mm-runtime-browser-details",
  imports: [
    CommonModule,
    ButtonModule,
    SVGIconModule,
    EntityDetailViewComponent,
    ListViewComponent,
    CkTypeEntitiesDataSourceDirective,
    CreateEditorComponent,
    UpdateEditorComponent,
  ],
  template: `
    <div class="runtime-browser-details">
      @if (isCreateModeEnabled) {
        <mm-create-editor-component
          [createInput]="createInput!"
          [messages]="_messages"
          (cancelRequested)="onCancel()"
          (createOutput)="onEntityCreationFinished($event)"
        >
        </mm-create-editor-component>
      } @else if (isUpdateModeEnabled) {
        <mm-update-editor-component
          [updateInput]="updateInput!"
          [messages]="_messages"
          (cancelRequested)="onCancel()"
          (updateOutput)="onEntityUpdateFinished($event)"
        >
        </mm-update-editor-component>
      } @else {
        @if (!selectedItem) {
          <div class="no-selection">
            <div class="placeholder-content">
              <div class="placeholder-icon">
                <span class="k-icon k-i-information"></span>
              </div>
              <h3>{{ _messages.title }}</h3>
              <p>{{ _messages.selectItem }}</p>
            </div>
          </div>
        }

        @if (selectedItem) {
          <div class="entity-details">
            @if (typeHelperService.isRuntimeEntity(selectedItem.item)) {
              <mm-entity-detail-view
                [entity]="getEntityForDisplay()"
                [loading]="loading"
                [error]="error"
                [messages]="_messages"
                [dataMappings]="dataMappings"
                [sourceDataPoints]="sourceDataPoints"
                (retry)="loadFullEntityDetails()"
                (navigateToEntity)="
                  navigateToEntity($event.rtId, $event.ckTypeId)
                "
                (addMappingRequested)="onAddMapping()"
                (removeMappingRequested)="onRemoveMapping($event)"
                (selectMappingTarget)="onSelectMappingTarget($event)"
                (selectSourceAttributeRequested)="onSelectSourceAttribute($event)"
                (selectTargetAttributeRequested)="onSelectTargetAttribute($event)"
                (mappingChanged)="onMappingChanged($event)"
                (saveAllMappingsRequested)="onSaveAllMappings()"
              >
              </mm-entity-detail-view>
            } @else if (isCkModel(selectedItem.item)) {
              <div class="ck-model-details">
                <h3>
                  {{ _messages.constructionKitModel }}
                </h3>
                <p>
                  <strong>{{ _messages.fullName }}:</strong>
                  {{ getCkModelIdFullName(selectedItem.item) }}
                </p>
                <p>
                  <strong>{{ _messages.semanticName }}:</strong>
                  {{ getCkModelIdSemanticName(selectedItem.item) }}
                </p>
                <p>
                  <strong>{{ _messages.modelName }}:</strong>
                  {{ getCkModelIdName(selectedItem.item) }}
                </p>
                <p>
                  <strong>{{ _messages.version }}:</strong>
                  {{ getCkModelIdVersion(selectedItem.item) }}
                </p>
                <p>
                  <strong>{{ _messages.state }}:</strong>
                  {{ getCkModelState(selectedItem.item) }}
                </p>
                <p class="info-text">
                  {{ _messages.selectTypeFromTree }}
                </p>
              </div>
            } @else if (isCkType(selectedItem.item)) {
              <div class="ck-type-details">
                <div class="type-header">
                  <h3>
                    {{ _messages.type }}:
                    {{ getCkTypeId(selectedItem.item) }}
                  </h3>
                  <div class="type-metadata">
                    @if (isCkTypeAbstract(selectedItem.item)) {
                      <span class="badge abstract">{{
                        _messages.abstract
                      }}</span>
                    }
                    @if (isCkTypeFinal(selectedItem.item)) {
                      <span class="badge final">{{ _messages.final }}</span>
                    }
                    @if (getCkTypeBaseType(selectedItem.item)) {
                      <span class="base-type"
                        >{{ _messages.base }}:
                        {{ getCkTypeBaseType(selectedItem.item) }}</span
                      >
                    }
                  </div>
                </div>

                <div class="entities-table">
                  <h4>
                    {{ _messages.runtimeEntities }}
                  </h4>
                  <mm-list-view
                    mmCkTypeEntitiesDataSource
                    #dir="mmCkTypeEntitiesDataSource"
                    [sortable]="true"
                    [pageable]="{ buttonCount: 3, pageSizes: [10, 20, 50] }"
                    [pageSize]="20"
                    [selectable]="{ mode: 'single', enabled: true }"
                    [columns]="ckTypeColumns"
                    [actionCommandItems]="[ckTypeViewDetailsCommand]"
                  >
                  </mm-list-view>
                </div>
              </div>
            } @else if (isCkModelsRoot(selectedItem.item)) {
              <div class="ck-models-root">
                <h3>
                  {{ _messages.constructionKitModels }}
                </h3>
                <p class="info-text">
                  {{ _messages.browseModelsAndTypes }}
                </p>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styleUrls: ["./runtime-browser-details.component.scss"],
})
export class RuntimeBrowserDetailsComponent
  implements OnChanges, AfterViewInit
{
  @Input() selectedItem: TreeItemDataTyped<BrowserItem> | null = null;
  @Input() set messages(value: Partial<RuntimeBrowserMessages>) {
    this._messages = { ...DEFAULT_RUNTIME_BROWSER_MESSAGES, ...value };
  }
  protected _messages: RuntimeBrowserMessages = {
    ...DEFAULT_RUNTIME_BROWSER_MESSAGES,
  };
  @Output() entitySaved = new EventEmitter<EntitySavedEvent | void>();
  @ViewChild("dir", { static: false })
  dataSourceDirective?: CkTypeEntitiesDataSourceDirective;

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly entityDataSource = inject(EntityDetailDataSource);
  private readonly stateService = inject(RuntimeBrowserStateService);

  protected readonly typeHelperService = inject(TypeHelperService);
  private readonly notificationService = inject(NotificationService);
  private readonly getAssociationsGQL = inject(GetRuntimeEntityAssociationsByIdDtoGQL);
  private readonly getEntityByIdGQL = inject(GetRuntimeEntityByIdDtoGQL);
  private readonly createEntitiesGQL = inject(CreateEntitiesDtoGQL);
  private readonly updateEntitiesGQL = inject(UpdateRuntimeEntitiesDtoGQL);
  private readonly deleteEntitiesGQL = inject(DeleteEntitiesDtoGQL);
  private readonly entitySelectorDialog = inject(EntitySelectorDialogService);
  private readonly attributeSelectorDialog = inject(AttributeSelectorDialogService);

  // Data Mapping state (list of DataPointMapping entities)
  dataMappings: DataPointMappingItem[] = [];
  sourceDataPoints: string[] = [];
  protected readonly detailsIcon = eyeIcon;
  protected fullEntity: RtEntityDto | null = null;

  protected get ckTypeColumns() {
    return [
      {
        field: "rtId",
        displayName: this._messages.runtimeId,
        dataType: "text" as const,
      },
      {
        field: "ckTypeId",
        displayName: this._messages.typeId,
        dataType: "text" as const,
      },
      {
        field: "rtWellKnownName",
        displayName: this._messages.wellKnownName,
        dataType: "text" as const,
      },
      {
        field: "rtCreationDateTime",
        displayName: this._messages.created,
        format: "short" as const,
        dataType: "iso8601" as const,
      },
      {
        field: "rtChangedDateTime",
        displayName: this._messages.modified,
        format: "short" as const,
        dataType: "iso8601" as const,
      },
    ];
  }

  protected get ckTypeViewDetailsCommand() {
    return {
      id: "view",
      type: "link" as const,
      text: this._messages.viewDetails,
      svgIcon: this.detailsIcon,
      onClick: this.onViewEntityDetails,
    };
  }

  protected loading = false;
  protected error: string | null = null;
  private pendingRtCkTypeId: string | null = null;

  protected isCreateModeEnabled = false;
  protected isUpdateModeEnabled = false;
  protected createInput: CreateInput | undefined = undefined;
  protected updateInput: UpdateInput | undefined = undefined;

  ngAfterViewInit(): void {
    // If we have a pending CK type ID, set it now
    if (this.pendingRtCkTypeId && this.dataSourceDirective) {
      console.debug(
        "AfterViewInit: Setting pending CK Type ID:",
        this.pendingRtCkTypeId,
      );
      this.dataSourceDirective.setRtCkTypeId(this.pendingRtCkTypeId);
      this.pendingRtCkTypeId = null;
    }
  }

  public async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes["selectedItem"] && this.selectedItem) {
      console.debug("Selected item changed:", this.selectedItem);

      // If it's a CK Type, update the data source with the type ID
      if (this.isCkType(this.selectedItem.item)) {
        const rtCkTypeId = this.getRtCkTypeId(this.selectedItem.item);
        console.debug("Setting CK Type ID:", rtCkTypeId);

        // Use setTimeout to ensure ViewChild is initialized
        setTimeout(() => {
          if (this.dataSourceDirective) {
            console.debug(
              "ngOnChanges: ViewChild ready, setting CK Type ID:",
              rtCkTypeId,
            );
            this.dataSourceDirective.setRtCkTypeId(rtCkTypeId);
          } else {
            console.debug(
              "ngOnChanges: ViewChild not ready, storing pending CK Type ID:",
              rtCkTypeId,
            );
            this.pendingRtCkTypeId = rtCkTypeId;
          }
        }, 0);
      } else {
        // Load full entity details for runtime entities
        await this.loadFullEntityDetails();
        // Clear any pending CK type ID
        this.pendingRtCkTypeId = null;
      }
    } else if (changes["selectedItem"] && !this.selectedItem) {
      this.fullEntity = null;
      this.error = null;
      this.pendingRtCkTypeId = null;
    }
  }

  protected async loadFullEntityDetails(): Promise<void> {
    // Only load full details for runtime entities
    const item = this.selectedItem?.item;
    if (!this.typeHelperService.isRuntimeEntity(item)) {
      // Not a runtime entity, clear the full entity
      this.fullEntity = null;
      this.loading = false;
      this.error = null;
      return;
    }

    const runtimeEntity = item as RtEntityDto;
    this.loading = true;
    this.error = null;

    try {
      this.fullEntity = await this.entityDataSource.fetchEntityDetails(
        runtimeEntity.rtId,
        runtimeEntity.ckTypeId!,
      );

      if (!this.fullEntity) {
        this.error = this._messages.couldNotLoadEntityDetails;
      } else {
        this.extractSourceDataPoints();
        await this.loadDataMappings();
      }
    } catch (error) {
      console.error("Failed to load full entity details:", error);
      this.error = this._messages.failedToLoadEntityDetails;
      // Fall back to the basic entity data
      this.fullEntity = runtimeEntity;
    } finally {
      this.loading = false;
    }
  }

  protected async navigateToDetails(): Promise<void> {
    const item = this.selectedItem?.item;
    if (!this.typeHelperService.isRuntimeEntity(item)) {
      return;
    }

    const runtimeEntity = item as RtEntityDto;

    // Save current state before navigating
    this.stateService.saveState(this.selectedItem);

    const encodedId = RtEntityIdHelper.encode(
      runtimeEntity.rtId,
      runtimeEntity.ckTypeId,
    );

    await this.router.navigate(["entity", encodedId], {
      relativeTo: this.route,
    });
  }

  protected async navigateToEntity(
    rtId: string,
    ckTypeId: string,
  ): Promise<void> {
    if (!rtId || !ckTypeId || rtId === "Unknown" || ckTypeId === "Unknown") {
      return;
    }

    const encodedId = RtEntityIdHelper.encode(rtId, ckTypeId);
    await this.router.navigate(["entity", encodedId], {
      relativeTo: this.route,
    });
  }

  protected getEntityForDisplay(): RtEntityDto | null {
    if (this.fullEntity) {
      return this.fullEntity;
    }

    const item = this.selectedItem?.item;
    if (this.typeHelperService.isRuntimeEntity(item)) {
      return item as RtEntityDto;
    }

    return null;
  }

  protected isCkModel(item: BrowserItem): item is CkModelDto {
    return !!item && "id" in item && !("rtId" in item) && !("ckTypeId" in item);
  }

  protected isCkType(item: BrowserItem): item is CkTypeDto {
    return !!item && "ckTypeId" in item && !("rtId" in item) && !("id" in item);
  }

  protected isCkModelsRoot(
    item: BrowserItem,
  ): item is { isCkModelsRoot?: boolean; ckModelId?: string } {
    return !!item && "isCkModelsRoot" in item;
  }

  // Helper methods to get CK Model properties
  protected getCkModelIdFullName(item: BrowserItem): string {
    if (!this.isCkModel(item)) return "Unknown";
    return item.id.fullName || "Unknown";
  }

  protected getCkModelIdName(item: BrowserItem): string {
    if (!this.isCkModel(item)) return "Unknown";
    return item.id.name || "Unknown";
  }

  protected getCkModelIdVersion(item: BrowserItem): string {
    if (!this.isCkModel(item)) return "Unknown";
    return item.id.version || "Unknown";
  }

  protected getCkModelIdSemanticName(item: BrowserItem): string {
    if (!this.isCkModel(item)) return "Unknown";
    return item.id.semanticVersionedFullName || "Unknown";
  }

  protected getCkModelState(item: BrowserItem): string {
    if (!this.isCkModel(item)) return "Unknown";
    return item.modelState || "Unknown";
  }

  // Helper methods to get CK Type properties
  protected getCkTypeId(item: BrowserItem): string {
    if (!this.isCkType(item)) return "Unknown";
    return item.ckTypeId.fullName || "Unknown";
  }

  protected getRtCkTypeId(item: BrowserItem): string {
    if (!this.isCkType(item)) return "Unknown";
    return item.rtCkTypeId || "Unknown";
  }

  protected isCkTypeAbstract(item: BrowserItem): boolean {
    return this.isCkType(item) && item.isAbstract === true;
  }

  protected isCkTypeFinal(item: BrowserItem): boolean {
    return this.isCkType(item) && item.isFinal === true;
  }

  protected getCkTypeBaseType(item: BrowserItem): string | null {
    if (!this.isCkType(item)) return null;
    return item.baseType?.ckTypeId.fullName || null;
  }

  protected onViewEntityDetails = async (
    eventArgs: CommandItemExecuteEventArgs,
  ): Promise<void> => {
    const entity = eventArgs.data;
    if (this.typeHelperService.isRuntimeEntity(entity)) {
      await this.navigateToEntity(entity.rtId, entity.ckTypeId);
    }
  };

  /**
   * Activates the creation UI and provides necessary data
   * @param parentNode The tree node under which the new entity will be created, or null for root-level creation
   * @param derivedFromRtCkTypeId Base type ID to filter the type selector (e.g. 'Basic/TreeNode' or 'Basic/Tree')
   */
  public enterCreateMode(
    parentNode: TreeItemDataTyped<BrowserItem> | null,
    derivedFromRtCkTypeId?: string,
  ): void {
    const rtEntityDto = parentNode as TreeItemDataTyped<RtEntityDto>;

    this.createInput = {
      parent: {
        ckTypeId: rtEntityDto?.item.ckTypeId,
        rtId: rtEntityDto?.item.rtId,
        name: parentNode?.text ?? "",
      },
      derivedFromRtCkTypeId,
    };

    // Toggle the UI state to show the creation form
    this.isCreateModeEnabled = true;
    this.isUpdateModeEnabled = false;
  }

  public enterEditMode(
    selectedItem: TreeItemDataTyped<BrowserItem> | null,
    rtCkTypeId: string | undefined,
  ): void {
    const rtEntityDto = selectedItem as TreeItemDataTyped<RtEntityDto>;
    const rtId = rtEntityDto?.item?.rtId ?? "";
    const ckTypeId = rtEntityDto?.item?.ckTypeId;

    if (!rtId || !ckTypeId || !rtCkTypeId) {
      console.warn(
        "Enter edit mode skipped: missing rtId, ckTypeId or rtCkTypeId.",
        { rtId, ckTypeId, rtCkTypeId },
      );
      return;
    }

    const name = rtEntityDto?.text ?? "";
    this.updateInput = {
      name,
      rtId,
      rtCkTypeId,
      ckTypeId,
    };

    this.isCreateModeEnabled = false;
    this.isUpdateModeEnabled = true;
    console.debug("Entered update mode with input:", this.updateInput);
  }

  /**
   * Handles the result of the save operation from the child component
   * @param result Object containing success status and new entity details
   */
  public onEntityCreationFinished(result: CreateOutput): void {
    if (result.success) {
      // Use the parent under which we created (from createInput), not the new entity's ID
      const parentRtId = this.createInput?.parent?.rtId;
      if (parentRtId) {
        this.entitySaved.emit({ parentRtId });
      } else {
        // If parent is null or not a runtime entity (e.g., CK Type or Tree root),
        // emit without parent info to refresh entire tree
        this.entitySaved.emit();
      }
    } else {
      // Emit event even on failure to allow cleanup
      this.entitySaved.emit();
    }

    this.isCreateModeEnabled = false;
  }

  /**
   * Called when update editor saves. Emits so parent refreshes tree, then parent will call
   * reloadCurrentEntityDetails() after refresh so the detail view shows fresh data.
   */
  public onEntityUpdateFinished(result: UpdateOutput): void {
    if (result.success) {
      this.entitySaved.emit({ isUpdate: true });
    } else {
      this.entitySaved.emit();
    }
    this.isUpdateModeEnabled = false;
  }

  /**
   * Reloads full entity details for the currently selected item.
   * Called by parent after tree refresh so the detail view shows data after create/update.
   */
  public reloadCurrentEntityDetails(): void {
    this.loadFullEntityDetails();
  }

  onCancel() {
    console.debug("Creation or update cancelled, resetting state.");

    this.isCreateModeEnabled = false;
    this.isUpdateModeEnabled = false;
    this.createInput = undefined;
    this.updateInput = undefined;
  }

  private static readonly DATA_POINT_MAPPING_CK_TYPE = 'System.Communication/DataPointMapping';
  private static readonly MAPS_FROM_ROLE = 'System.Communication/MapsFrom';
  private static readonly MAPS_TO_ROLE = 'System.Communication/MapsTo';

  /**
   * Loads all DataPointMapping entities associated with the current entity via MapsFrom.
   * For each mapping, fetches its attributes and MapsTo target.
   */
  async loadDataMappings(): Promise<void> {
    const entity = this.getEntityForDisplay();
    if (!entity?.rtId || !entity?.ckTypeId) {
      this.dataMappings = [];
      return;
    }

    try {
      // Find inbound MapsFrom associations → these are DataPointMapping entities
      const assocResult = await firstValueFrom(
        this.getAssociationsGQL.fetch({
          variables: {
            rtId: entity.rtId,
            ckTypeId: entity.ckTypeId,
            direction: GraphDirectionDto.InboundDto,
            roleId: RuntimeBrowserDetailsComponent.MAPS_FROM_ROLE,
            first: 100,
          },
        }),
      );

      const associations = assocResult.data?.runtime?.runtimeEntities?.items?.[0]
        ?.associations?.definitions?.items ?? [];

      // For each DataPointMapping, load its details
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

  /**
   * Loads a single DataPointMapping entity's attributes and MapsTo target.
   */
  private async loadMappingDetails(
    rtId: string,
    ckTypeId: string,
  ): Promise<DataPointMappingItem | null> {
    try {
      // Load entity attributes
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

      // Load MapsTo target association
      const targetResult = await firstValueFrom(
        this.getAssociationsGQL.fetch({
          variables: {
            rtId,
            ckTypeId,
            direction: GraphDirectionDto.OutboundDto,
            roleId: RuntimeBrowserDetailsComponent.MAPS_TO_ROLE,
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

  /**
   * Creates a new DataPointMapping entity and associates it with the current entity.
   */
  async onAddMapping(): Promise<void> {
    const entity = this.getEntityForDisplay();
    if (!entity?.rtId || !entity?.ckTypeId) return;

    try {
      const createResult = await firstValueFrom(
        this.createEntitiesGQL.mutate({
          variables: {
            entities: [{
              ckTypeId: RuntimeBrowserDetailsComponent.DATA_POINT_MAPPING_CK_TYPE,
              attributes: [
                { attributeName: 'name', value: `Mapping ${this.dataMappings.length + 1}` },
                { attributeName: 'enabled', value: true },
              ],
              associations: [{
                roleName: 'mappedAsSource',
                targets: [{ target: { rtId: entity.rtId, ckTypeId: entity.ckTypeId } }],
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
        content: this._messages.mappingSaved,
        type: { style: 'success', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 2000,
        animation: { type: 'fade', duration: 400 },
      });
    } catch (error) {
      console.error('Failed to add mapping:', error);
      this.notificationService.show({
        content: this._messages.failedToSaveMapping,
        type: { style: 'error', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 3000,
        animation: { type: 'fade', duration: 400 },
      });
    }
  }

  /**
   * Deletes a DataPointMapping entity.
   */
  async onRemoveMapping(mapping: DataPointMappingItem): Promise<void> {
    if (!mapping.rtId) return;

    try {
      await firstValueFrom(
        this.deleteEntitiesGQL.mutate({
          variables: {
            rtEntityIds: [{
              rtId: mapping.rtId,
              ckTypeId: RuntimeBrowserDetailsComponent.DATA_POINT_MAPPING_CK_TYPE,
            }],
            deleteStrategy: DeleteStrategiesDto.EraseDto,
          },
        }),
      );

      this.dataMappings = this.dataMappings.filter((m) => m.rtId !== mapping.rtId);

      this.notificationService.show({
        content: this._messages.mappingRemoved,
        type: { style: 'success', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 2000,
        animation: { type: 'fade', duration: 400 },
      });
    } catch (error) {
      console.error('Failed to remove mapping:', error);
      this.notificationService.show({
        content: this._messages.failedToSaveMapping,
        type: { style: 'error', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 3000,
        animation: { type: 'fade', duration: 400 },
      });
    }
  }

  /**
   * Opens entity selector for a specific mapping's target.
   */
  async onSelectMappingTarget(mapping: DataPointMappingItem): Promise<void> {
    const result = await this.entitySelectorDialog.openEntitySelector({
      title: this._messages.selectTargetEntity,
      currentTargetRtId: mapping.targetRtId,
      currentTargetCkTypeId: mapping.targetCkTypeId,
    });

    if (result.confirmed && result.entity) {
      mapping.targetRtId = result.entity.rtId;
      mapping.targetCkTypeId = result.entity.ckTypeId;
      mapping.targetName = result.entity.name;
      // Trigger change detection
      this.dataMappings = [...this.dataMappings];
    }
  }

  /**
   * Tracks in-memory changes to a mapping (no server save yet).
   */
  onMappingChanged(_mapping: DataPointMappingItem): void {
    // Changes are tracked in the dataMappings array via two-way binding in the list component.
    // Actual persistence happens on "Save All".
  }

  /**
   * Extracts DataPoint names from the entity's States/DataPoints RecordArray attribute.
   * Provides them as dropdown options for sourceAttributePath selection.
   */
  private extractSourceDataPoints(): void {
    this.sourceDataPoints = ['currentValue'];

    const entity = this.getEntityForDisplay();
    if (!entity?.attributes?.items) return;

    // Look for a RecordArray attribute (States, DataPoints, etc.) - case insensitive
    const statesAttr = entity.attributes.items.find(
      (a) => {
        const name = a?.attributeName?.toLowerCase();
        return name === 'states' || name === 'datapoints';
      },
    );

    if (!statesAttr?.value) return;

    let records: unknown[];

    if (Array.isArray(statesAttr.value)) {
      records = statesAttr.value;
    } else if (typeof statesAttr.value === 'string') {
      // RecordArray might come as JSON string from GraphQL
      try {
        const parsed = JSON.parse(statesAttr.value);
        if (Array.isArray(parsed)) {
          records = parsed;
        } else {
          return;
        }
      } catch {
        return;
      }
    } else {
      return;
    }

    // Extract Name from each record.
    // GraphQL returns records as: { ckRecordId, attributes: [{attributeName, value}, ...] }
    const names: string[] = [];
    for (const record of records) {
      if (record && typeof record === 'object') {
        const r = record as Record<string, unknown>;
        const attrs = r['attributes'];

        let name: string | undefined;

        if (Array.isArray(attrs)) {
          // GraphQL format: attributes is array of {attributeName, value}
          const nameEntry = (attrs as { attributeName?: string; value?: unknown }[])
            .find((a) => a.attributeName === 'name' || a.attributeName === 'Name');
          if (nameEntry?.value && typeof nameEntry.value === 'string') {
            name = nameEntry.value;
          }
        } else if (attrs && typeof attrs === 'object') {
          // Pipeline/MongoDB format: attributes is object {Name: "...", ...}
          const attrObj = attrs as Record<string, unknown>;
          name = (attrObj['Name'] ?? attrObj['name'] ?? attrObj['stateName']) as string | undefined;
        }

        if (!name) {
          // Flat format: {name: "...", ...}
          name = (r['Name'] ?? r['name']) as string | undefined;
        }

        if (typeof name === 'string' && name.length > 0) {
          names.push(name);
        }
      }
    }

    if (names.length > 0) {
      this.sourceDataPoints = ['currentValue', ...names.sort()];
    }
  }

  /**
   * Opens attribute selector for the source entity's attributes.
   */
  async onSelectSourceAttribute(mapping: DataPointMappingItem): Promise<void> {
    const entity = this.getEntityForDisplay();
    if (!entity?.ckTypeId) return;

    const result = await this.attributeSelectorDialog.openAttributeSelector(
      entity.ckTypeId,
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

  /**
   * Opens attribute selector for the target entity's attributes.
   */
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

  /**
   * Saves all DataPointMapping entities (attributes + MapsTo associations).
   */
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
              ckTypeId: RuntimeBrowserDetailsComponent.DATA_POINT_MAPPING_CK_TYPE,
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
        content: this._messages.mappingSaved,
        type: { style: 'success', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 2000,
        animation: { type: 'fade', duration: 400 },
      });
    } catch (error) {
      console.error('Failed to save mappings:', error);
      this.notificationService.show({
        content: this._messages.failedToSaveMapping,
        type: { style: 'error', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 3000,
        animation: { type: 'fade', duration: 400 },
      });
    }
  }
}

