import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule, CheckBoxModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { CkTypeSelectorInputComponent } from '@meshmakers/octo-ui';
import { CkTypeSelectorItem, CkTypeSelectorService, FieldFilterOperatorsDto } from '@meshmakers/octo-services';
import {
  EntitySelectInputComponent,
  EntitySelectDialogDataSource,
  DialogFetchOptions,
  DialogFetchResult,
  ColumnDefinition
} from '@meshmakers/shared-ui';
import { EntitySelectDataSource, EntitySelectResult } from '@meshmakers/shared-services';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { GetCkTypeAssociationRolesDtoGQL } from '../../graphQL/getCkTypeAssociationRoles';
import { LoadingOverlayComponent } from '../../components/loading-overlay/loading-overlay.component';
import { firstValueFrom, Observable, from, map } from 'rxjs';

/**
 * Represents a runtime entity for selection
 */
export interface RuntimeEntityItem {
  rtId: string;
  ckTypeId: string;
  rtWellKnownName?: string;
  displayName: string;
}

/**
 * Represents an association role for selection
 */
export interface AssociationRoleItem {
  roleId: string;
  navigationPropertyName: string;
  direction: 'in' | 'out';
  targetCkTypeId: string;
  multiplicity: string;
  displayName: string;
}

/**
 * Configuration result from the dialog
 */
export interface AssociationsConfigResult {
  ckTypeId: string;
  rtId: string;
  showIncoming: boolean;
  showOutgoing: boolean;
  roleFilter: string[];
  displayMode: 'count' | 'expandable';
}

/**
 * Data source for entity autocomplete - filters by ckTypeId
 */
class RuntimeEntitySelectDataSource implements EntitySelectDataSource<RuntimeEntityItem> {
  constructor(
    private getEntitiesByCkTypeGQL: GetEntitiesByCkTypeDtoGQL,
    private ckTypeId: string
  ) {}

  async onFilter(filter: string, take?: number): Promise<EntitySelectResult<RuntimeEntityItem>> {
    const result = await firstValueFrom(
      this.getEntitiesByCkTypeGQL.fetch({
        variables: {
          ckTypeId: this.ckTypeId,
          first: take ?? 10,
          fieldFilters: [
            { attributePath: 'rtId', operator: FieldFilterOperatorsDto.LikeDto, comparisonValue: filter }
          ]
        }
      })
    );

    const items = (result.data?.runtime?.runtimeEntities?.items ?? [])
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map(item => ({
        rtId: item.rtId,
        ckTypeId: item.ckTypeId,
        rtWellKnownName: item.rtWellKnownName ?? undefined,
        displayName: item.rtWellKnownName || item.rtId
      }));

    return {
      totalCount: result.data?.runtime?.runtimeEntities?.totalCount ?? 0,
      items
    };
  }

  onDisplayEntity(entity: RuntimeEntityItem): string {
    return entity.displayName;
  }

  getIdEntity(entity: RuntimeEntityItem): string {
    return entity.rtId;
  }
}

/**
 * Dialog data source for entity selection grid
 */
class RuntimeEntityDialogDataSource implements EntitySelectDialogDataSource<RuntimeEntityItem> {
  constructor(
    private getEntitiesByCkTypeGQL: GetEntitiesByCkTypeDtoGQL,
    private ckTypeId: string
  ) {}

  getColumns(): ColumnDefinition[] {
    return [
      { field: 'rtId', displayName: 'RT-ID' },
      { field: 'rtWellKnownName', displayName: 'Name' },
      { field: 'ckTypeId', displayName: 'CK Type' }
    ];
  }

  fetchData(options: DialogFetchOptions): Observable<DialogFetchResult<RuntimeEntityItem>> {
    // Build field filters for text search
    const fieldFilters: { attributePath: string; operator: FieldFilterOperatorsDto; comparisonValue: string }[] = [];
    if (options.textSearch && options.textSearch.trim()) {
      fieldFilters.push({
        attributePath: 'rtId',
        operator: FieldFilterOperatorsDto.LikeDto,
        comparisonValue: options.textSearch.trim()
      });
    }

    return from(
      this.getEntitiesByCkTypeGQL.fetch({
        variables: {
          ckTypeId: this.ckTypeId,
          first: options.take,
          after: options.skip > 0 ? btoa(`arrayconnection:${options.skip - 1}`) : undefined,
          fieldFilters: fieldFilters.length > 0 ? fieldFilters : undefined
        }
      })
    ).pipe(
      map(result => {
        const items = (result.data?.runtime?.runtimeEntities?.items ?? [])
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .map(item => ({
            rtId: item.rtId,
            ckTypeId: item.ckTypeId,
            rtWellKnownName: item.rtWellKnownName ?? undefined,
            displayName: item.rtWellKnownName || item.rtId
          }));

        return {
          data: items,
          totalCount: result.data?.runtime?.runtimeEntities?.totalCount ?? 0
        };
      })
    );
  }

  onDisplayEntity(entity: RuntimeEntityItem): string {
    return entity.displayName;
  }

  getIdEntity(entity: RuntimeEntityItem): string {
    return entity.rtId;
  }
}

/**
 * Configuration dialog for EntityWithAssociations widget.
 * Allows selecting a CK Type, runtime entity, direction filters, and role filters.
 */
@Component({
  selector: 'mm-associations-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonsModule,
    InputsModule,
    CheckBoxModule,
    DropDownsModule,
    CkTypeSelectorInputComponent,
    EntitySelectInputComponent,
    LoadingOverlayComponent
  ],
  template: `
    <div class="config-container">

      <div class="config-form" [class.loading]="isLoadingInitial">
        <mm-loading-overlay [loading]="isLoadingInitial" />

        <!-- CK Type Selection -->
        <div class="form-field">
          <label>CK Type</label>
          <mm-ck-type-selector-input
            placeholder="Select a CK Type..."
            [minSearchLength]="2"
            dialogTitle="Select CK Type"
            [ngModel]="selectedCkType"
            (ckTypeSelected)="onCkTypeSelected($event)"
            (ckTypeCleared)="onCkTypeCleared()">
          </mm-ck-type-selector-input>
          <p class="field-hint">Select the Construction Kit Type for the source entity.</p>
        </div>

        <!-- Entity Selection -->
        <div class="form-field" [class.disabled]="!selectedCkType">
          <label>Entity</label>
          @if (selectedCkType && entityDataSource) {
            <mm-entity-select-input
              [dataSource]="entityDataSource"
              [dialogDataSource]="entityDialogDataSource"
              placeholder="Search for an entity..."
              dialogTitle="Select Entity"
              [minSearchLength]="1"
              [ngModel]="selectedEntity"
              (entitySelected)="onEntitySelected($event)"
              (entityCleared)="onEntityCleared()">
            </mm-entity-select-input>
          } @else {
            <kendo-textbox
              [disabled]="true"
              placeholder="First select a CK Type...">
            </kendo-textbox>
          }
          <p class="field-hint">Select the source entity whose associations to display.</p>
        </div>

        <!-- Direction Filters -->
        <div class="form-field">
          <label>Direction Filter</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" kendoCheckBox [(ngModel)]="showIncoming" />
              <span>Incoming associations</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" kendoCheckBox [(ngModel)]="showOutgoing" />
              <span>Outgoing associations</span>
            </label>
          </div>
          <p class="field-hint">Filter which direction of associations to show.</p>
        </div>

        <!-- Role Filter -->
        <div class="form-field" [class.disabled]="!selectedCkType || availableRoles().length === 0">
          <label>Role Filter (optional)</label>
          @if (isLoadingRoles()) {
            <div class="loading-roles">Loading available roles...</div>
          } @else if (availableRoles().length > 0) {
            <kendo-multiselect
              [data]="filteredRoles()"
              [textField]="'displayName'"
              [valueField]="'roleId'"
              [(ngModel)]="selectedRoles"
              placeholder="All roles (no filter)"
              [filterable]="true"
              (filterChange)="onRoleFilterChange($event)">
            </kendo-multiselect>
          } @else {
            <kendo-textbox
              [disabled]="true"
              placeholder="No roles available">
            </kendo-textbox>
          }
          <p class="field-hint">Optionally filter to specific association roles.</p>
        </div>

        <!-- Display Mode -->
        <div class="form-field">
          <label>Display Mode</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" name="displayMode" value="expandable" [(ngModel)]="displayMode" />
              <span>Expandable groups</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="displayMode" value="count" [(ngModel)]="displayMode" />
              <span>Count only</span>
            </label>
          </div>
          <p class="field-hint">How to display association targets.</p>
        </div>

        <!-- Selection Preview -->
        @if (selectedEntity) {
          <div class="selection-preview">
            <h4>Selected Entity</h4>
            <div class="preview-content">
              <p><strong>CK Type:</strong> {{ selectedCkType?.rtCkTypeId }}</p>
              <p><strong>RT-ID:</strong> {{ selectedEntity.rtId }}</p>
              @if (selectedEntity.rtWellKnownName) {
                <p><strong>Name:</strong> {{ selectedEntity.rtWellKnownName }}</p>
              }
            </div>
          </div>
        }
      </div>

      <div class="action-bar">
        <button kendoButton fillMode="flat" (click)="onCancel()">Cancel</button>
        <button
          kendoButton
          themeColor="primary"
          [disabled]="!isValid"
          (click)="onSave()">
          Save
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .config-container { display: flex; flex-direction: column; height: 100%; }
    .action-bar { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 16px; border-top: 1px solid var(--kendo-color-border, #dee2e6); }

    .config-form {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow-y: auto;
      gap: 16px;
      padding: 16px;
      position: relative;
    }

    .config-form.loading {
      pointer-events: none;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-field.disabled {
      opacity: 0.6;
    }

    .form-field label {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--kendo-color-on-app-surface, #212529);
    }

    .field-hint {
      margin: 0;
      font-size: 0.8rem;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .checkbox-group, .radio-group {
      display: flex;
      gap: 16px;
    }

    .checkbox-label, .radio-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: normal;
      cursor: pointer;
    }

    .loading-roles {
      padding: 8px;
      color: var(--kendo-color-subtle, #6c757d);
      font-style: italic;
    }

    .selection-preview {
      padding: 12px;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
    }

    .selection-preview h4 {
      margin: 0 0 8px 0;
      font-size: 0.9rem;
      color: var(--kendo-color-primary, #0d6efd);
    }

    .preview-content p {
      margin: 4px 0;
      font-size: 0.85rem;
    }
  `]
})
export class AssociationsConfigDialogComponent implements OnInit {
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);
  private readonly getCkTypeAssociationRolesGQL = inject(GetCkTypeAssociationRolesDtoGQL);
  private readonly ckTypeSelectorService = inject(CkTypeSelectorService);
  private readonly windowRef = inject(WindowRef);

  @Input() initialCkTypeId?: string;
  @Input() initialRtId?: string;
  @Input() initialShowIncoming?: boolean;
  @Input() initialShowOutgoing?: boolean;
  @Input() initialRoleFilter?: string[];
  @Input() initialDisplayMode?: 'count' | 'expandable';

  selectedCkType: CkTypeSelectorItem | null = null;
  selectedEntity: RuntimeEntityItem | null = null;
  entityDataSource?: RuntimeEntitySelectDataSource;
  entityDialogDataSource?: RuntimeEntityDialogDataSource;

  showIncoming = true;
  showOutgoing = true;
  selectedRoles: AssociationRoleItem[] = [];
  displayMode: 'count' | 'expandable' = 'expandable';

  isLoadingInitial = false;
  readonly isLoadingRoles = signal(false);
  readonly availableRoles = signal<AssociationRoleItem[]>([]);
  readonly filteredRoles = signal<AssociationRoleItem[]>([]);

  private roleFilterText = '';

  get isValid(): boolean {
    return this.selectedCkType !== null &&
           this.selectedEntity !== null &&
           (this.showIncoming || this.showOutgoing);
  }

  async ngOnInit(): Promise<void> {
    // Set initial values
    if (this.initialShowIncoming !== undefined) {
      this.showIncoming = this.initialShowIncoming;
    }
    if (this.initialShowOutgoing !== undefined) {
      this.showOutgoing = this.initialShowOutgoing;
    }
    if (this.initialDisplayMode) {
      this.displayMode = this.initialDisplayMode;
    }

    if (this.initialCkTypeId) {
      await this.loadInitialValues();
    }
  }

  private async loadInitialValues(): Promise<void> {
    if (!this.initialCkTypeId) {
      return;
    }

    this.isLoadingInitial = true;

    try {
      const ckType = await firstValueFrom(
        this.ckTypeSelectorService.getCkTypeByRtCkTypeId(this.initialCkTypeId)
      );

      if (ckType) {
        await this.onCkTypeSelected(ckType);

        if (this.initialRtId && this.entityDataSource) {
          await this.loadInitialEntity();
        }

        // Set initial role filter after roles are loaded
        if (this.initialRoleFilter && this.initialRoleFilter.length > 0) {
          const allRoles = this.availableRoles();
          this.selectedRoles = allRoles.filter(r =>
            this.initialRoleFilter!.includes(r.roleId)
          );
        }
      }
    } catch (error) {
      console.error('Error loading initial values:', error);
    } finally {
      this.isLoadingInitial = false;
    }
  }

  private async loadInitialEntity(): Promise<void> {
    if (!this.initialRtId || !this.initialCkTypeId) {
      return;
    }

    try {
      const result = await firstValueFrom(
        this.getEntitiesByCkTypeGQL.fetch({
          variables: {
            ckTypeId: this.initialCkTypeId,
            rtId: this.initialRtId
          }
        })
      );

      const items = result.data?.runtime?.runtimeEntities?.items ?? [];
      const entity = items
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .find(item => item.rtId === this.initialRtId);

      if (entity) {
        this.selectedEntity = {
          rtId: entity.rtId,
          ckTypeId: entity.ckTypeId,
          rtWellKnownName: entity.rtWellKnownName ?? undefined,
          displayName: entity.rtWellKnownName || entity.rtId
        };
      }
    } catch (error) {
      console.error('Error loading initial entity:', error);
    }
  }

  async onCkTypeSelected(ckType: CkTypeSelectorItem): Promise<void> {
    this.selectedCkType = ckType;
    this.selectedEntity = null;
    this.selectedRoles = [];

    // Create data sources for entity selection
    this.entityDataSource = new RuntimeEntitySelectDataSource(
      this.getEntitiesByCkTypeGQL,
      ckType.rtCkTypeId
    );
    this.entityDialogDataSource = new RuntimeEntityDialogDataSource(
      this.getEntitiesByCkTypeGQL,
      ckType.rtCkTypeId
    );

    // Load available association roles
    await this.loadAssociationRoles(ckType.rtCkTypeId);
  }

  onCkTypeCleared(): void {
    this.selectedCkType = null;
    this.selectedEntity = null;
    this.entityDataSource = undefined;
    this.entityDialogDataSource = undefined;
    this.availableRoles.set([]);
    this.filteredRoles.set([]);
    this.selectedRoles = [];
  }

  onEntitySelected(entity: RuntimeEntityItem): void {
    this.selectedEntity = entity;
  }

  onEntityCleared(): void {
    this.selectedEntity = null;
  }

  onRoleFilterChange(filter: string): void {
    this.roleFilterText = filter.toLowerCase();
    this.updateFilteredRoles();
  }

  private updateFilteredRoles(): void {
    const all = this.availableRoles();
    if (!this.roleFilterText) {
      this.filteredRoles.set(all);
    } else {
      this.filteredRoles.set(
        all.filter(r => r.displayName.toLowerCase().includes(this.roleFilterText))
      );
    }
  }

  private async loadAssociationRoles(ckTypeId: string): Promise<void> {
    this.isLoadingRoles.set(true);
    this.availableRoles.set([]);
    this.filteredRoles.set([]);

    try {
      const result = await firstValueFrom(
        this.getCkTypeAssociationRolesGQL.fetch({
          variables: { ckTypeId }
        })
      );

      const ckType = result.data?.constructionKit?.types?.items?.[0];
      if (!ckType?.associations) {
        return;
      }

      const roles: AssociationRoleItem[] = [];

      // Process incoming associations
      const inAssocs = ckType.associations.in?.all ?? [];
      for (const assoc of inAssocs) {
        if (!assoc) continue;
        roles.push({
          roleId: assoc.roleId.semanticVersionedFullName,
          navigationPropertyName: assoc.navigationPropertyName,
          direction: 'in',
          targetCkTypeId: assoc.targetCkTypeId.fullName,
          multiplicity: assoc.multiplicity,
          displayName: `[IN] ${assoc.navigationPropertyName} (${this.formatTypeName(assoc.targetCkTypeId.fullName)})`
        });
      }

      // Process outgoing associations
      const outAssocs = ckType.associations.out?.all ?? [];
      for (const assoc of outAssocs) {
        if (!assoc) continue;
        roles.push({
          roleId: assoc.roleId.semanticVersionedFullName,
          navigationPropertyName: assoc.navigationPropertyName,
          direction: 'out',
          targetCkTypeId: assoc.targetCkTypeId.fullName,
          multiplicity: assoc.multiplicity,
          displayName: `[OUT] ${assoc.navigationPropertyName} (${this.formatTypeName(assoc.targetCkTypeId.fullName)})`
        });
      }

      this.availableRoles.set(roles);
      this.filteredRoles.set(roles);
    } catch (error) {
      console.error('Error loading association roles:', error);
    } finally {
      this.isLoadingRoles.set(false);
    }
  }

  private formatTypeName(fullName: string): string {
    const parts = fullName.split('/');
    return parts[parts.length - 1];
  }

  onSave(): void {
    if (this.selectedCkType && this.selectedEntity) {
      this.windowRef.close({
        ckTypeId: this.selectedCkType.rtCkTypeId,
        rtId: this.selectedEntity.rtId,
        showIncoming: this.showIncoming,
        showOutgoing: this.showOutgoing,
        roleFilter: this.selectedRoles.map(r => r.roleId),
        displayMode: this.displayMode
      });
    }
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
