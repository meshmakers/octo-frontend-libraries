import { CommonModule } from "@angular/common";
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from "@angular/core";
import { CommandItemExecuteEventArgs } from "@meshmakers/shared-services";
import { ListViewComponent } from "@meshmakers/shared-ui";
import { ButtonModule } from "@progress/kendo-angular-buttons";
import { DropDownListModule } from "@progress/kendo-angular-dropdowns";
import { SVGIconModule } from "@progress/kendo-angular-icons";
import { TextBoxModule } from "@progress/kendo-angular-inputs";
import {
  CardModule,
  SelectEvent,
  TabStripModule,
} from "@progress/kendo-angular-layout";
import { NotificationService } from "@progress/kendo-angular-notification";
import {
  copyIcon,
  eyeIcon,
  gearIcon,
  infoCircleIcon,
} from "@progress/kendo-svg-icons";
import { firstValueFrom } from "rxjs";
import {
  BinaryDownloadEvent,
  PropertyConverterService,
  PropertyGridComponent,
  PropertyGridConfig,
  PropertyGridItem,
} from "../../property-grid";
import {
  AssociationDisplayItem,
  EntityAssociationsDataSourceDirective,
} from "../data-sources/entity-associations-data-source.directive";
import { GetBinaryInfoDtoGQL } from "../graphQL/getBinaryInfo";
import { GraphDirectionDto, RtEntityDto } from "../graphQL/globalTypes";

interface DirectionOption {
  text: string;
  value: GraphDirectionDto;
}

@Component({
  selector: "mm-entity-detail-view",
  standalone: true,
  imports: [
    CommonModule,
    TabStripModule,
    ButtonModule,
    SVGIconModule,
    CardModule,
    DropDownListModule,
    TextBoxModule,
    PropertyGridComponent,
    ListViewComponent,
    EntityAssociationsDataSourceDirective,
  ],
  template: `
    @if (loading) {
      <div class="loading-state">
        <p>Loading entity details...</p>
      </div>
    }

    @if (error) {
      <div class="error-state">
        <p class="error-message">{{ error }}</p>
        <button kendoButton (click)="retry.emit()">Retry</button>
      </div>
    }

    @if (entity && !loading) {
      <div class="entity-content">
        <!-- Basic Info Card -->
        <kendo-card class="basic-info-card" width="100%">
          <kendo-card-header>
            <h3>
              <kendo-svgicon [icon]="infoCircleIcon"></kendo-svgicon>
              Entity Information
            </h3>
          </kendo-card-header>
          <kendo-card-body>
            <div class="basic-info-grid">
              <div class="info-item with-action">
                <label>Runtime ID:</label>
                <div class="value-with-action">
                  <span class="value">{{ entity.rtId }}</span>
                  <button
                    kendoButton
                    fillMode="flat"
                    size="small"
                    [svgIcon]="copyIcon"
                    title="Copy to clipboard"
                    (click)="copyToClipboard(entity.rtId, 'Runtime ID')"
                  ></button>
                </div>
              </div>
              <div class="info-item with-action">
                <label>Type ID:</label>
                <div class="value-with-action">
                  <span class="value">{{ entity.ckTypeId }}</span>
                  <button
                    kendoButton
                    fillMode="flat"
                    size="small"
                    [svgIcon]="copyIcon"
                    title="Copy to clipboard"
                    (click)="copyToClipboard(entity.ckTypeId, 'Type ID')"
                  ></button>
                </div>
              </div>
              <div class="info-item with-action">
                <label>Entity Identifier:</label>
                <div class="value-with-action">
                  <span class="value">{{ getEntityIdentifier() }}</span>
                  <button
                    kendoButton
                    fillMode="flat"
                    size="small"
                    [svgIcon]="copyIcon"
                    title="Copy entity identifier to clipboard"
                    (click)="
                      copyToClipboard(
                        getEntityIdentifier(),
                        'Entity Identifier'
                      )
                    "
                  ></button>
                </div>
              </div>
              @if (entity.rtWellKnownName) {
                <div class="info-item">
                  <label>Well Known Name:</label>
                  <span class="value">{{ entity.rtWellKnownName }}</span>
                </div>
              }
            </div>
          </kendo-card-body>
        </kendo-card>

        <!-- Tab Strip for Detailed Information -->
        <kendo-tabstrip class="entity-tabs" (tabSelect)="onTabSelect($event)">
          <kendo-tabstrip-tab
            [title]="'Attributes (' + getPropertyCount() + ')'"
            [selected]="true"
          >
            <ng-template kendoTabContent>
              <div class="tab-content properties-tab">
                @if (!hasProperties()) {
                  <div class="empty-state">
                    <kendo-svgicon [icon]="propertiesIcon"></kendo-svgicon>
                    <p>No properties available for this entity</p>
                  </div>
                }

                @if (hasProperties()) {
                  <mm-property-grid
                    [data]="propertyGridItems"
                    [config]="propertyGridConfig"
                    [showTypeColumn]="true"
                    (propertyChange)="propertyChange.emit($event)"
                    (binaryDownload)="onBinaryDownload($event)"
                  >
                  </mm-property-grid>
                }
              </div>
            </ng-template>
          </kendo-tabstrip-tab>

          <kendo-tabstrip-tab
            [title]="'Associations (' + getAssociationCount() + ')'"
          >
            <ng-template kendoTabContent>
              <div class="tab-content associations-tab">
                <div class="associations-toolbar">
                  <div class="filter-group">
                    <label>Direction:</label>
                    <kendo-dropdownlist
                      [data]="directionOptions"
                      [value]="selectedDirection"
                      textField="text"
                      valueField="value"
                      [valuePrimitive]="true"
                      (valueChange)="onDirectionChange($event)"
                    >
                    </kendo-dropdownlist>
                  </div>
                  <div class="filter-group">
                    <label>Role:</label>
                    <kendo-textbox
                      [value]="selectedRoleId ?? ''"
                      [clearButton]="true"
                      placeholder="All roles"
                      (valueChange)="onRoleIdChange($event)"
                    >
                    </kendo-textbox>
                  </div>
                  <div class="filter-group">
                    <label>Related Type:</label>
                    <kendo-textbox
                      [value]="selectedRelatedRtCkId ?? ''"
                      [clearButton]="true"
                      placeholder="All types"
                      (valueChange)="onRelatedRtCkIdChange($event)"
                    >
                    </kendo-textbox>
                  </div>
                  <div class="filter-group">
                    <label>Related Entity:</label>
                    <kendo-textbox
                      [value]="selectedRelatedRtId ?? ''"
                      [clearButton]="true"
                      placeholder="Entity ID"
                      (valueChange)="onRelatedRtIdChange($event)"
                    >
                    </kendo-textbox>
                  </div>
                </div>

                <mm-list-view
                  mmEntityAssociationsDataSource
                  #associationsDir="mmEntityAssociationsDataSource"
                  [sortable]="true"
                  [pageable]="{ buttonCount: 3, pageSizes: [10, 20, 50] }"
                  [pageSize]="20"
                  [selectable]="{ mode: 'single', enabled: true }"
                  [columns]="[
                    {
                      field: 'ckAssociationRoleId',
                      displayName: 'Role',
                      dataType: 'text',
                    },
                    {
                      field: 'direction',
                      displayName: 'Direction',
                      dataType: 'text',
                    },
                    {
                      field: 'relatedRtId',
                      displayName: 'Related Entity',
                      dataType: 'text',
                    },
                    {
                      field: 'relatedCkTypeId',
                      displayName: 'Related Type',
                      dataType: 'text',
                    },
                  ]"
                  [actionCommandItems]="[
                    {
                      id: 'view',
                      type: 'link',
                      text: 'View Details',
                      svgIcon: detailsIcon,
                      onClick: onViewAssociationDetails,
                    },
                  ]"
                >
                </mm-list-view>
              </div>
            </ng-template>
          </kendo-tabstrip-tab>
        </kendo-tabstrip>
      </div>
    }
  `,
  styleUrls: ["./entity-detail-view.component.scss"],
})
export class EntityDetailViewComponent implements OnChanges {
  @Input() entity: RtEntityDto | null = null;
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() showHeader = true;

  @Output() retry = new EventEmitter<void>();
  @Output() propertyChange = new EventEmitter<any>();
  @Output() navigateToEntity = new EventEmitter<{
    rtId: string;
    ckTypeId: string;
  }>();

  @ViewChild("associationsDir", { static: false })
  associationsDataSource?: EntityAssociationsDataSourceDirective;

  private readonly notificationService = inject(NotificationService);
  private readonly propertyConverter = inject(PropertyConverterService);
  private readonly getBinaryInfoGQL = inject(GetBinaryInfoDtoGQL);

  protected readonly infoCircleIcon = infoCircleIcon;
  protected readonly propertiesIcon = gearIcon;
  protected readonly copyIcon = copyIcon;
  protected readonly detailsIcon = eyeIcon;

  propertyGridItems: PropertyGridItem[] = [];
  propertyGridConfig: PropertyGridConfig = {
    readOnlyMode: false,
    showTypeIcons: true,
    height: "500px",
    showSearch: true,
  };

  // Direction filter
  protected readonly directionOptions: DirectionOption[] = [
    { text: "All", value: GraphDirectionDto.AnyDto },
    { text: "Inbound", value: GraphDirectionDto.InboundDto },
    { text: "Outbound", value: GraphDirectionDto.OutboundDto },
  ];
  protected selectedDirection: GraphDirectionDto = GraphDirectionDto.AnyDto;

  // Role filter
  protected selectedRoleId: string | null = null;

  // Related Type filter
  protected selectedRelatedRtCkId: string | null = null;

  // Related Entity filter
  protected selectedRelatedRtId: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["entity"] && this.entity) {
      this.updatePropertyGrid();
    }
  }

  private updatePropertyGrid(): void {
    if (!this.entity) {
      this.propertyGridItems = [];
      return;
    }

    // Convert entity to property grid items using the converter service
    this.propertyConverter.convertRtEntityToProperties(this.entity).subscribe({
      next: (items: PropertyGridItem[]) => {
        this.propertyGridItems = items;
      },
      error: (err: unknown) => {
        console.error("Error converting entity to properties:", err);
        this.propertyGridItems = [];
      },
    });
  }

  protected onTabSelect(event: SelectEvent): void {
    // Tab 0 = Attributes, Tab 1 = Associations
    if (event.index === 1) {
      this.loadAssociations();
    }
  }

  private loadAssociations(): void {
    // Use setTimeout to ensure ViewChild is initialized
    setTimeout(() => {
      if (this.associationsDataSource && this.entity) {
        this.associationsDataSource.setEntityId(
          this.entity.rtId,
          this.entity.ckTypeId,
        );
        this.associationsDataSource.setDirection(this.selectedDirection);
      }
    }, 0);
  }

  protected onDirectionChange(direction: GraphDirectionDto): void {
    this.selectedDirection = direction;
    if (
      this.associationsDataSource &&
      this.entity?.rtId &&
      this.entity?.ckTypeId
    ) {
      this.associationsDataSource.setDirection(direction);
    }
  }

  protected onRoleIdChange(roleId: string | null): void {
    this.selectedRoleId = roleId || null;
    if (
      this.associationsDataSource &&
      this.entity?.rtId &&
      this.entity?.ckTypeId
    ) {
      this.associationsDataSource.setRoleId(this.selectedRoleId);
    }
  }

  protected onRelatedRtCkIdChange(relatedRtCkId: string | null): void {
    this.selectedRelatedRtCkId = relatedRtCkId || null;
    if (
      this.associationsDataSource &&
      this.entity?.rtId &&
      this.entity?.ckTypeId
    ) {
      this.associationsDataSource.setRelatedRtCkId(this.selectedRelatedRtCkId);
    }
  }

  protected onRelatedRtIdChange(relatedRtId: string | null): void {
    this.selectedRelatedRtId = relatedRtId || null;
    if (
      this.associationsDataSource &&
      this.entity?.rtId &&
      this.entity?.ckTypeId
    ) {
      this.associationsDataSource.setRelatedRtId(this.selectedRelatedRtId);
    }
  }

  protected onViewAssociationDetails = async (
    eventArgs: CommandItemExecuteEventArgs,
  ): Promise<void> => {
    const assoc = eventArgs.data as AssociationDisplayItem;
    if (assoc?.relatedRtId && assoc?.relatedCkTypeId) {
      this.navigateToEntity.emit({
        rtId: assoc.relatedRtId,
        ckTypeId: assoc.relatedCkTypeId,
      });
    }
  };

  getEntityIdentifier(): string {
    if (!this.entity?.ckTypeId || !this.entity?.rtId) {
      return "Unknown";
    }
    return `${this.entity.ckTypeId}@${this.entity.rtId}`;
  }

  hasProperties(): boolean {
    return this.propertyGridItems.length > 0;
  }

  getPropertyCount(): number {
    return this.propertyGridItems.length;
  }

  getAssociationCount(): number {
    return this.entity?.associations?.definitions?.totalCount ?? 0;
  }

  protected copyToClipboard(
    value: string | null | undefined,
    label: string,
  ): void {
    if (!value) return;

    navigator.clipboard
      .writeText(value)
      .then(() => {
        this.notificationService.show({
          content: `${label} copied to clipboard`,
          type: { style: "success", icon: true },
          position: { horizontal: "right", vertical: "top" },
          hideAfter: 2000,
          animation: { type: "fade", duration: 400 },
        });
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
        this.notificationService.show({
          content: "Failed to copy to clipboard",
          type: { style: "error", icon: true },
          position: { horizontal: "right", vertical: "top" },
          hideAfter: 3000,
          animation: { type: "fade", duration: 400 },
        });
      });
  }

  /**
   * Handle binary download request from property grid.
   * Loads the full binary info including downloadUri and opens the download.
   */
  protected async onBinaryDownload(_event: BinaryDownloadEvent): Promise<void> {
    if (!this.entity?.rtId) {
      console.warn("Cannot download: no entity rtId available");
      return;
    }

    try {
      // Load binary info with downloadUri using the entity's rtId
      const result = await firstValueFrom(
        this.getBinaryInfoGQL.fetch({
          variables: { rtId: this.entity.rtId },
        }),
      );

      const item =
        result.data?.runtime?.systemReportingFileSystemItem?.items?.[0];
      if (item?.content?.downloadUri) {
        // Open download in new tab
        window.open(item.content.downloadUri, "_blank", "noopener,noreferrer");
      } else {
        console.warn("No downloadUri found for binary");
        this.notificationService.show({
          content: "Download not available for this file",
          type: { style: "warning", icon: true },
          position: { horizontal: "right", vertical: "top" },
          hideAfter: 3000,
          animation: { type: "fade", duration: 400 },
        });
      }
    } catch (error) {
      console.error("Failed to load binary info:", error);
      this.notificationService.show({
        content: "Failed to load download information",
        type: { style: "error", icon: true },
        position: { horizontal: "right", vertical: "top" },
        hideAfter: 3000,
        animation: { type: "fade", duration: 400 },
      });
    }
  }
}
