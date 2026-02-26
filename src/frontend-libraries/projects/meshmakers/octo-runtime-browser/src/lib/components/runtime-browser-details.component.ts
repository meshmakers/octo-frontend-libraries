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
import { CkTypeEntitiesDataSourceDirective } from "../data-sources/ck-type-entities-data-source.directive";
import { EntityDetailDataSource } from "../data-sources/entity-detail-data-source.service";
import { CkModelDto, CkTypeDto, RtEntityDto } from "../graphQL/globalTypes";
import { RtEntityIdHelper } from "../models/rt-entity-id";
import { RuntimeBrowserStateService } from "../services/runtime-browser-state.service";
import { TypeHelperService } from "../services/type-helper.service";
import { EntityDetailViewComponent } from "./entity-detail-view.component";
import {
  EntityCreationResult,
  EntityEditorComponent,
} from "./entity-editor/entity-editor-component";

// Extended type to handle both Runtime Entities and CK Models/Types
type BrowserItem =
  | RtEntityDto
  | CkModelDto
  | CkTypeDto
  | { isCkModelsRoot?: boolean; ckModelId?: string };

@Component({
  selector: "mm-runtime-browser-details",
  imports: [
    CommonModule,
    ButtonModule,
    SVGIconModule,
    EntityDetailViewComponent,
    ListViewComponent,
    CkTypeEntitiesDataSourceDirective,
    EntityEditorComponent,
  ],
  template: `
    <div class="runtime-browser-details">
      @if (isCreateModeEnabled) {
        <mm-entity-editor-component
          [availableCkTypes]="availableCkTypes"
          [parent]="parent"
          (cancelEdit)="isCreateModeEnabled = false"
          (saveEdit)="onEntityCreationFinished($event)"
        >
        </mm-entity-editor-component>
      } @else {
        @if (!selectedItem) {
          <div class="no-selection">
            <div class="placeholder-content">
              <div class="placeholder-icon">
                <span class="k-icon k-i-information"></span>
              </div>
              <h3>Runtime Browser</h3>
              <p>Select an item from the tree to view its details</p>
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
                <h3>Construction Kit Model</h3>
                <p>
                  <strong>Full Name:</strong>
                  {{ getCkModelIdFullName(selectedItem.item) }}
                </p>
                <p>
                  <strong>Semantic Name:</strong>
                  {{ getCkModelIdSemanticName(selectedItem.item) }}
                </p>
                <p>
                  <strong>Model Name:</strong>
                  {{ getCkModelIdName(selectedItem.item) }}
                </p>
                <p>
                  <strong>Version:</strong>
                  {{ getCkModelIdVersion(selectedItem.item) }}
                </p>
                <p>
                  <strong>State:</strong>
                  {{ getCkModelState(selectedItem.item) }}
                </p>
                <p class="info-text">
                  Select a type from the tree to view its details.
                </p>
              </div>
            } @else if (isCkType(selectedItem.item)) {
              <div class="ck-type-details">
                <div class="type-header">
                  <h3>Type: {{ getCkTypeId(selectedItem.item) }}</h3>
                  <div class="type-metadata">
                    @if (isCkTypeAbstract(selectedItem.item)) {
                      <span class="badge abstract">Abstract</span>
                    }
                    @if (isCkTypeFinal(selectedItem.item)) {
                      <span class="badge final">Final</span>
                    }
                    @if (getCkTypeBaseType(selectedItem.item)) {
                      <span class="base-type"
                        >Base: {{ getCkTypeBaseType(selectedItem.item) }}</span
                      >
                    }
                  </div>
                </div>

                <div class="entities-table">
                  <h4>Runtime Entities</h4>
                  <mm-list-view
                    mmCkTypeEntitiesDataSource
                    #dir="mmCkTypeEntitiesDataSource"
                    [sortable]="true"
                    [pageable]="{ buttonCount: 3, pageSizes: [10, 20, 50] }"
                    [pageSize]="20"
                    [selectable]="{ mode: 'single', enabled: true }"
                    [columns]="[
                      {
                        field: 'rtId',
                        displayName: 'Runtime ID',
                        dataType: 'text',
                      },
                      {
                        field: 'ckTypeId',
                        displayName: 'Type ID',
                        dataType: 'text',
                      },
                      {
                        field: 'rtWellKnownName',
                        displayName: 'Well Known Name',
                        dataType: 'text',
                      },
                      {
                        field: 'rtCreationDateTime',
                        displayName: 'Created',
                        format: 'short',
                        dataType: 'iso8601',
                      },
                      {
                        field: 'rtChangedDateTime',
                        displayName: 'Modified',
                        format: 'short',
                        dataType: 'iso8601',
                      },
                    ]"
                    [actionCommandItems]="[
                      {
                        id: 'view',
                        type: 'link',
                        text: 'View Details',
                        svgIcon: detailsIcon,
                        onClick: onViewEntityDetails,
                      },
                    ]"
                  >
                  </mm-list-view>
                </div>
              </div>
            } @else if (isCkModelsRoot(selectedItem.item)) {
              <div class="ck-models-root">
                <h3>Construction Kit Models</h3>
                <p class="info-text">
                  Browse available construction kit models and their types.
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
  @Output() entitySaved = new EventEmitter<{
    parentCkTypeId?: string;
    parentRtId?: string;
  } | void>();
  @ViewChild("dir", { static: false })
  dataSourceDirective?: CkTypeEntitiesDataSourceDirective;

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly entityDataSource = inject(EntityDetailDataSource);
  private readonly stateService = inject(RuntimeBrowserStateService);

  protected readonly typeHelperService = inject(TypeHelperService);

  protected readonly detailsIcon = eyeIcon;
  protected fullEntity: RtEntityDto | null = null;
  protected loading = false;
  protected error: string | null = null;
  private pendingRtCkTypeId: string | null = null;

  protected isCreateModeEnabled = false;
  protected parent: TreeItemDataTyped<BrowserItem> | null = null;
  protected availableCkTypes: CkTypeDto[] = [];

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
        this.error = "Could not load entity details";
      }
    } catch (error) {
      console.error("Failed to load full entity details:", error);
      this.error = "Failed to load entity details";
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
    this.parent = parentNode;
    this.availableCkTypes = allowedTypes;

    // Toggle the UI state to show the creation form
    this.isCreateModeEnabled = true;
  }

  /**
   * Handles the result of the save operation from the child component
   * @param result Object containing success status and new entity details
   */
  public onEntityCreationFinished(result: EntityCreationResult): void {
    if (result.success) {
      // Emit event with parent information for tree refresh
      const parentItem = this.parent?.item;
      if (parentItem && this.typeHelperService.isRuntimeEntity(parentItem)) {
        const parentEntity = parentItem;
        this.entitySaved.emit({
          parentCkTypeId: parentEntity.ckTypeId,
          parentRtId: parentEntity.rtId,
        });
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
}
