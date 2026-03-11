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
import { eyeIcon } from "@progress/kendo-svg-icons";
import { RUNTIME_BROWSER_KEYS } from "../../../i18n/keys";
import { AppTranslatePipe } from "../../i18n/translate.pipe";
import { AppTranslateService } from "../../i18n/translate.service";
import { CkTypeEntitiesDataSourceDirective } from "../data-sources/ck-type-entities-data-source.directive";
import { EntityDetailDataSource } from "../data-sources/entity-detail-data-source.service";
import { CkModelDto, CkTypeDto, RtEntityDto } from "../graphQL/globalTypes";
import { RtEntityIdHelper } from "../models/rt-entity-id";
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
    AppTranslatePipe,
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
          (cancelRequested)="onCancel()"
          (createOutput)="onEntityCreationFinished($event)"
        >
        </mm-create-editor-component>
      } @else if (isUpdateModeEnabled) {
        <mm-update-editor-component
          [updateInput]="updateInput!"
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
              <h3>{{ RUNTIME_BROWSER_KEYS.Title | appTranslate }}</h3>
              <p>{{ RUNTIME_BROWSER_KEYS.SelectItem | appTranslate }}</p>
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
                (retry)="loadFullEntityDetails()"
                (navigateToEntity)="
                  navigateToEntity($event.rtId, $event.ckTypeId)
                "
              >
              </mm-entity-detail-view>
            } @else if (isCkModel(selectedItem.item)) {
              <div class="ck-model-details">
                <h3>
                  {{ RUNTIME_BROWSER_KEYS.ConstructionKitModel | appTranslate }}
                </h3>
                <p>
                  <strong
                    >{{ RUNTIME_BROWSER_KEYS.FullName | appTranslate }}:</strong
                  >
                  {{ getCkModelIdFullName(selectedItem.item) }}
                </p>
                <p>
                  <strong
                    >{{
                      RUNTIME_BROWSER_KEYS.SemanticName | appTranslate
                    }}:</strong
                  >
                  {{ getCkModelIdSemanticName(selectedItem.item) }}
                </p>
                <p>
                  <strong
                    >{{
                      RUNTIME_BROWSER_KEYS.ModelName | appTranslate
                    }}:</strong
                  >
                  {{ getCkModelIdName(selectedItem.item) }}
                </p>
                <p>
                  <strong
                    >{{ RUNTIME_BROWSER_KEYS.Version | appTranslate }}:</strong
                  >
                  {{ getCkModelIdVersion(selectedItem.item) }}
                </p>
                <p>
                  <strong
                    >{{ RUNTIME_BROWSER_KEYS.State | appTranslate }}:</strong
                  >
                  {{ getCkModelState(selectedItem.item) }}
                </p>
                <p class="info-text">
                  {{ RUNTIME_BROWSER_KEYS.SelectTypeFromTree | appTranslate }}
                </p>
              </div>
            } @else if (isCkType(selectedItem.item)) {
              <div class="ck-type-details">
                <div class="type-header">
                  <h3>
                    {{ RUNTIME_BROWSER_KEYS.Type | appTranslate }}:
                    {{ getCkTypeId(selectedItem.item) }}
                  </h3>
                  <div class="type-metadata">
                    @if (isCkTypeAbstract(selectedItem.item)) {
                      <span class="badge abstract">{{
                        RUNTIME_BROWSER_KEYS.Abstract | appTranslate
                      }}</span>
                    }
                    @if (isCkTypeFinal(selectedItem.item)) {
                      <span class="badge final">{{
                        RUNTIME_BROWSER_KEYS.Final | appTranslate
                      }}</span>
                    }
                    @if (getCkTypeBaseType(selectedItem.item)) {
                      <span class="base-type"
                        >{{ RUNTIME_BROWSER_KEYS.Base | appTranslate }}:
                        {{ getCkTypeBaseType(selectedItem.item) }}</span
                      >
                    }
                  </div>
                </div>

                <div class="entities-table">
                  <h4>
                    {{ RUNTIME_BROWSER_KEYS.RuntimeEntities | appTranslate }}
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
                  {{
                    RUNTIME_BROWSER_KEYS.ConstructionKitModels | appTranslate
                  }}
                </h3>
                <p class="info-text">
                  {{ RUNTIME_BROWSER_KEYS.BrowseModelsAndTypes | appTranslate }}
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
  @Output() entitySaved = new EventEmitter<EntitySavedEvent | void>();
  @ViewChild("dir", { static: false })
  dataSourceDirective?: CkTypeEntitiesDataSourceDirective;

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly entityDataSource = inject(EntityDetailDataSource);
  private readonly stateService = inject(RuntimeBrowserStateService);

  protected readonly typeHelperService = inject(TypeHelperService);
  protected readonly RUNTIME_BROWSER_KEYS = RUNTIME_BROWSER_KEYS;
  private readonly translation = inject(AppTranslateService);

  protected readonly detailsIcon = eyeIcon;
  protected fullEntity: RtEntityDto | null = null;

  protected get ckTypeColumns() {
    return [
      {
        field: "rtId",
        displayName: this.translation.instant(RUNTIME_BROWSER_KEYS.RuntimeId),
        dataType: "text" as const,
      },
      {
        field: "ckTypeId",
        displayName: this.translation.instant(RUNTIME_BROWSER_KEYS.TypeId),
        dataType: "text" as const,
      },
      {
        field: "rtWellKnownName",
        displayName: this.translation.instant(
          RUNTIME_BROWSER_KEYS.WellKnownName,
        ),
        dataType: "text" as const,
      },
      {
        field: "rtCreationDateTime",
        displayName: this.translation.instant(RUNTIME_BROWSER_KEYS.Created),
        format: "short" as const,
        dataType: "iso8601" as const,
      },
      {
        field: "rtChangedDateTime",
        displayName: this.translation.instant(RUNTIME_BROWSER_KEYS.Modified),
        format: "short" as const,
        dataType: "iso8601" as const,
      },
    ];
  }

  protected get ckTypeViewDetailsCommand() {
    return {
      id: "view",
      type: "link" as const,
      text: this.translation.instant(RUNTIME_BROWSER_KEYS.ViewDetails),
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
        this.error = this.translation.instant(
          RUNTIME_BROWSER_KEYS.CouldNotLoadEntityDetails,
        );
      }
    } catch (error) {
      console.error("Failed to load full entity details:", error);
      this.error = this.translation.instant(
        RUNTIME_BROWSER_KEYS.FailedToLoadEntityDetails,
      );
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

  protected isCkModel(item: any): boolean {
    return item && item.id && !item.rtId && !item.ckTypeId;
  }

  protected isCkType(item: any): boolean {
    return item && item.ckTypeId && !item.rtId && !item.id;
  }

  protected isCkModelsRoot(item: any): boolean {
    return item && item.isCkModelsRoot;
  }

  // Helper methods to get CK Model properties
  protected getCkModelIdFullName(item: any): string {
    return item?.id.fullName || "Unknown";
  }

  protected getCkModelIdName(item: any): string {
    return item?.id.name || "Unknown";
  }

  protected getCkModelIdVersion(item: any): string {
    return item?.id.version || "Unknown";
  }

  protected getCkModelIdSemanticName(item: any): string {
    return item?.id.semanticVersionedFullName || "Unknown";
  }

  protected getCkModelState(item: any): string {
    return item?.modelState || "Unknown";
  }

  // Helper methods to get CK Type properties
  protected getCkTypeId(item: any): string {
    return item?.ckTypeId.fullName || "Unknown";
  }

  protected getRtCkTypeId(item: any): string {
    return item?.rtCkTypeId || "Unknown";
  }

  protected isCkTypeAbstract(item: any): boolean {
    return item?.isAbstract === true;
  }

  protected isCkTypeFinal(item: any): boolean {
    return item?.isFinal === true;
  }

  protected getCkTypeBaseType(item: any): string | null {
    return item?.baseType?.ckTypeId.fullName || null;
  }

  protected onViewEntityDetails = async (
    eventArgs: CommandItemExecuteEventArgs,
  ): Promise<void> => {
    const entity = eventArgs.data;
    if (entity?.rtId && entity?.ckTypeId) {
      await this.navigateToEntity(entity.rtId, entity.ckTypeId);
    }
  };

  /**
   * Activates the creation UI and provides necessary data
   * @param parentNode The tree node under which the new entity will be created, or null for root-level creation
   * @param allowedTypes List of compatible entity types for the new node
   */
  public enterCreateMode(
    parentNode: TreeItemDataTyped<BrowserItem> | null,
    allowedTypes: CkTypeDto[],
  ): void {
    const rtEntityDto = parentNode as TreeItemDataTyped<RtEntityDto>;

    this.createInput = {
      parent: {
        ckTypeId: rtEntityDto?.item.ckTypeId,
        rtId: rtEntityDto?.item.rtId,
        name: parentNode?.text ?? "",
      },
      ckTypes: allowedTypes,
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
}
