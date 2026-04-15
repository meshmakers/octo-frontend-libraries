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
import { GraphDirectionDto, CkModelDto, CkTypeDto, RtEntityDto } from "../../graphQL/globalTypes";
import { GetRuntimeEntityAssociationsByIdDtoGQL } from "../../graphQL/getRuntimeEntityAssociationsById";
import { UpdateRuntimeEntitiesDtoGQL } from "../../graphQL/updateRuntimeEntities";
import { AttributeSelectorDialogService } from "../../attribute-selector-dialog";
import { EntitySelectorDialogService } from "../../entity-selector-dialog";
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
                [mappingTarget]="mappingTarget"
                [sourceAttributePath]="sourceAttributePath"
                [mappingExpression]="mappingExpression"
                [targetAttributePath]="targetAttributePath"
                (retry)="loadFullEntityDetails()"
                (navigateToEntity)="
                  navigateToEntity($event.rtId, $event.ckTypeId)
                "
                (selectMappingTarget)="onSelectMappingTarget()"
                (saveMappingRequested)="onSaveMapping($event)"
                (removeMappingRequested)="onRemoveMapping()"
                (selectSourceAttribute)="onSelectSourceAttribute()"
                (selectTargetAttribute)="onSelectTargetAttribute()"
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
  private readonly updateEntitiesGQL = inject(UpdateRuntimeEntitiesDtoGQL);
  private readonly entitySelectorDialog = inject(EntitySelectorDialogService);
  private readonly attributeSelectorDialog = inject(AttributeSelectorDialogService);

  // Data Mapping state
  mappingTarget: { rtId: string; ckTypeId: string; name?: string } | null = null;
  sourceAttributePath = '';
  mappingExpression = '';
  targetAttributePath = '';
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
        await this.loadMapping();
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

  async loadMapping(): Promise<void> {
    const entity = this.getEntityForDisplay();
    if (!entity?.rtId || !entity?.ckTypeId) return;

    try {
      const result = await firstValueFrom(
        this.getAssociationsGQL.fetch({
          variables: {
            rtId: entity.rtId,
            ckTypeId: entity.ckTypeId,
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

      const sourceAttr = entity.attributes?.items?.find(
        (a) => a?.attributeName === 'sourceAttributePath',
      );
      this.sourceAttributePath = (sourceAttr?.value as string) ?? '';

      const exprAttr = entity.attributes?.items?.filter(Boolean).find(
        (a) => a?.attributeName === 'mappingExpression',
      );
      this.mappingExpression = (exprAttr?.value as string) ?? '';

      const targetAttr = entity.attributes?.items?.find(
        (a) => a?.attributeName === 'targetAttributePath',
      );
      this.targetAttributePath = (targetAttr?.value as string) ?? '';
    } catch (error) {
      console.error('Failed to load mapping:', error);
    }
  }

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

  async onSaveMapping(event: {
    targetRtId: string;
    targetCkTypeId: string;
    sourceAttributePath: string;
    mappingExpression: string;
    targetAttributePath: string;
  }): Promise<void> {
    const entity = this.getEntityForDisplay();
    if (!entity?.rtId || !entity?.ckTypeId) return;

    try {
      await firstValueFrom(
        this.updateEntitiesGQL.mutate({
          variables: {
            entities: [{
              rtId: entity.rtId,
              item: {
                ckTypeId: entity.ckTypeId,
                attributes: [
                  { attributeName: 'sourceAttributePath', value: event.sourceAttributePath || null },
                  { attributeName: 'mappingExpression', value: event.mappingExpression || null },
                  { attributeName: 'targetAttributePath', value: event.targetAttributePath },
                  {
                    attributeName: 'mappedFrom',
                    value: [{ target: { rtId: event.targetRtId, ckTypeId: event.targetCkTypeId } }],
                  },
                ],
              },
            }],
          },
        }),
      );

      this.targetAttributePath = event.targetAttributePath;
      this.notificationService.show({
        content: this._messages.mappingSaved,
        type: { style: 'success', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 3000,
        animation: { type: 'fade', duration: 400 },
      });
    } catch (error) {
      console.error('Failed to save mapping:', error);
      this.notificationService.show({
        content: this._messages.failedToSaveMapping,
        type: { style: 'error', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 3000,
        animation: { type: 'fade', duration: 400 },
      });
    }
  }

  async onRemoveMapping(): Promise<void> {
    const entity = this.getEntityForDisplay();
    if (!entity?.rtId || !entity?.ckTypeId || !this.mappingTarget) return;

    try {
      await firstValueFrom(
        this.updateEntitiesGQL.mutate({
          variables: {
            entities: [{
              rtId: entity.rtId,
              item: {
                ckTypeId: entity.ckTypeId,
                attributes: [
                  { attributeName: 'sourceAttributePath', value: null },
                  { attributeName: 'mappingExpression', value: null },
                  { attributeName: 'targetAttributePath', value: null },
                  {
                    attributeName: 'mappedFrom',
                    value: [{
                      target: { rtId: this.mappingTarget.rtId, ckTypeId: this.mappingTarget.ckTypeId },
                      modOption: 'DELETE',
                    }],
                  },
                ],
              },
            }],
          },
        }),
      );

      this.mappingTarget = null;
      this.sourceAttributePath = '';
      this.mappingExpression = '';
      this.targetAttributePath = '';
      this.notificationService.show({
        content: this._messages.mappingRemoved,
        type: { style: 'success', icon: true },
        position: { horizontal: 'right', vertical: 'top' },
        hideAfter: 3000,
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

  async onSelectSourceAttribute(): Promise<void> {
    const entity = this.getEntityForDisplay();
    if (!entity?.ckTypeId) return;

    const result = await this.attributeSelectorDialog.openAttributeSelector(
      entity.ckTypeId,
      this.sourceAttributePath ? [this.sourceAttributePath] : undefined,
      'Select Source Attribute',
      true,
      undefined,
      false,
      undefined,
      true,
    );

    if (result.confirmed && result.selectedAttributes.length > 0) {
      this.sourceAttributePath = result.selectedAttributes[0].attributePath;
    }
  }

  async onSelectTargetAttribute(): Promise<void> {
    if (!this.mappingTarget?.ckTypeId) return;

    const result = await this.attributeSelectorDialog.openAttributeSelector(
      this.mappingTarget.ckTypeId,
      this.targetAttributePath ? [this.targetAttributePath] : undefined,
      'Select Target Attribute',
      true,
      undefined,
      false,
      undefined,
      true,
    );

    if (result.confirmed && result.selectedAttributes.length > 0) {
      this.targetAttributePath = result.selectedAttributes[0].attributePath;
    }
  }
}

