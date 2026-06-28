import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EntityCardWidgetConfig, RuntimeEntityData, RuntimeEntityDataSource } from '../../models/meshboard.models';
import { DashboardDataService } from '../../services/meshboard-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { PropertyValueDisplayComponent, AttributeValueTypeDto } from '@meshmakers/octo-ui';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'mm-entity-card-widget',
  standalone: true,
  imports: [CommonModule, WidgetNotConfiguredComponent, PropertyValueDisplayComponent],
  templateUrl: './entity-card-widget.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './entity-card-widget.component.scss'
})
export class EntityCardWidgetComponent implements DashboardWidget<EntityCardWidgetConfig, RuntimeEntityData>, OnInit, OnChanges {
  private readonly dataService = inject(DashboardDataService);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly variableService = inject(MeshBoardVariableService);

  @Input() config!: EntityCardWidgetConfig;

  // Widget state signals
  private readonly _isLoading = signal(false);
  private readonly _data = signal<RuntimeEntityData | null>(null);
  private readonly _error = signal<string | null>(null);

  readonly isLoading = this._isLoading.asReadonly();
  readonly data = this._data.asReadonly();
  readonly error = this._error.asReadonly();

  /**
   * Check if widget is not configured (needs data source setup).
   * This is a method (not computed) to ensure it re-evaluates when config changes via @Input.
   */
  isNotConfigured(): boolean {
    const dataSource = this.config?.dataSource;
    if (!dataSource) return true;
    if (dataSource.type === 'runtimeEntity') {
      // A selector binding or a variable-bearing rtId/ckTypeId counts as
      // configured even before a board-level selection has resolved a value —
      // the empty/loading display is handled by loadData(), not here.
      return !dataSource.entitySelectorId && !dataSource.rtId && !dataSource.ckTypeId;
    }
    if (dataSource.type === 'static') {
      return false; // Static data is always "configured"
    }
    return false;
  }

  // Computed properties for template
  readonly entityTypeName = computed(() => {
    const data = this._data();
    if (!data?.ckTypeId) return 'Unknown';
    const parts = data.ckTypeId.split('/');
    return parts[parts.length - 1];
  });

  readonly displayName = computed(() => {
    const data = this._data();
    return data?.rtWellKnownName || data?.rtId || 'No Name';
  });

  readonly filteredAttributes = computed(() => {
    const data = this._data();
    if (!data?.attributes) return [];

    let attrs = data.attributes;

    if (this.config?.attributeFilter?.length) {
      attrs = attrs.filter(attr =>
        this.config.attributeFilter!.includes(attr.attributeName)
      );
    }

    if (this.config?.hideEmptyAttributes) {
      attrs = attrs.filter(attr => !this.isEmptyValue(attr.value));
    }

    return attrs;
  });

  /**
   * Treat null, undefined, empty string, empty array and empty object as
   * "no value". Numeric 0, boolean false and valid dates remain visible —
   * those are real values that the user typically still wants to see.
   */
  private isEmptyValue(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (value === '') return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value as object).length === 0;
    return false;
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reload data when config changes (e.g., after configuration dialog)
    if (changes['config'] && !changes['config'].firstChange) {
      this.loadData();
    }
  }

  refresh(): void {
    this.loadData();
  }

  private loadData(): void {
    // Skip loading if widget is not configured - isNotConfigured() handles the display
    if (this.isNotConfigured()) {
      return;
    }

    const dataSource = this.config.dataSource;

    // Handle static data
    if (dataSource.type === 'static') {
      const staticData = dataSource.data as RuntimeEntityData;
      this._data.set(staticData);
      this._error.set(null);
      return;
    }

    // Handle runtime entity data source
    if (dataSource.type === 'runtimeEntity') {
      // Resolve the effective entity reference: an entity-selector binding or
      // MeshBoard variables (e.g. $mp_rtId / $mp_rtCkTypeId) may supply the
      // rtId/ckTypeId from a board-level selection.
      const { rtId, ckTypeId } = this.resolveEntityRef(dataSource);

      // No resolvable selection yet (selector unpicked or variable unresolved) —
      // show nothing rather than fetching with a placeholder string.
      if (!rtId || !ckTypeId || this.variableService.hasUnresolvedVariables(rtId) ||
        this.variableService.hasUnresolvedVariables(ckTypeId)) {
        this._data.set(null);
        this._error.set(null);
        this._isLoading.set(false);
        return;
      }

      this._isLoading.set(true);
      this._error.set(null);

      this.dataService.fetchEntityWithAssociations(rtId, ckTypeId)
        .pipe(
          catchError(err => {
            console.error('Error loading entity card data:', err);
            this._error.set('Failed to load data');
            return of(null);
          })
        )
        .subscribe(entityData => {
          this._data.set(entityData);
          this._isLoading.set(false);
        });
    }
  }

  /**
   * Message for the neutral empty state — shown when the widget IS configured
   * but no entity is currently resolved (e.g. a bound selector hasn't been
   * picked yet, or a variable is still unresolved). This is deliberately not the
   * red "not configured" placeholder, which would wrongly imply the widget needs
   * setup.
   */
  emptyMessage(): string {
    const dataSource = this.config?.dataSource;
    if (dataSource?.type === 'runtimeEntity') {
      if (dataSource.entitySelectorId) {
        return 'No entity selected';
      }
      if ((dataSource.rtId?.includes('$')) || (dataSource.ckTypeId?.includes('$'))) {
        return 'Waiting for selection';
      }
    }
    return 'No data';
  }

  /**
   * Resolves the effective `{ rtId, ckTypeId }` to fetch from a runtime-entity
   * data source.
   *
   * - When `entitySelectorId` is set, the bound MeshBoard entity selector's
   *   current `selectedRtId` and the picked entity's type
   *   (`$<selectorId>_rtCkTypeId`, falling back to the selector's configured
   *   `ckTypeId`) win — so the card follows the asset picked at board level.
   * - Otherwise the configured `rtId`/`ckTypeId` are resolved against the active
   *   MeshBoard variables, allowing values like `$mp_rtId` / `$mp_rtCkTypeId`.
   */
  private resolveEntityRef(dataSource: RuntimeEntityDataSource): { rtId?: string; ckTypeId?: string } {
    const variables = this.stateService.getVariables();

    if (dataSource.entitySelectorId) {
      const selector = this.stateService.getEntitySelector(dataSource.entitySelectorId);
      const rtCkTypeIdVar = variables.find(v => v.name === `${dataSource.entitySelectorId}_rtCkTypeId`);
      return {
        rtId: selector?.selectedRtId,
        ckTypeId: rtCkTypeIdVar?.value || selector?.ckTypeId
      };
    }

    return {
      rtId: dataSource.rtId ? this.variableService.resolveVariables(dataSource.rtId, variables) : undefined,
      ckTypeId: dataSource.ckTypeId ? this.variableService.resolveVariables(dataSource.ckTypeId, variables) : undefined
    };
  }

  inferAttributeType(value: unknown): AttributeValueTypeDto {
    if (value === null || value === undefined) return AttributeValueTypeDto.StringDto;
    if (typeof value === 'boolean') return AttributeValueTypeDto.BooleanDto;
    if (typeof value === 'number') {
      return Number.isInteger(value) ? AttributeValueTypeDto.IntegerDto : AttributeValueTypeDto.DoubleDto;
    }
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return AttributeValueTypeDto.DateTimeDto;
      return AttributeValueTypeDto.StringDto;
    }
    if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === 'object') return AttributeValueTypeDto.RecordArrayDto;
      if (value.length > 0 && typeof value[0] === 'string') return AttributeValueTypeDto.StringArrayDto;
      if (value.length > 0 && typeof value[0] === 'number') return AttributeValueTypeDto.IntegerArrayDto;
      return AttributeValueTypeDto.StringArrayDto;
    }
    if (typeof value === 'object') return AttributeValueTypeDto.RecordDto;
    return AttributeValueTypeDto.StringDto;
  }

  formatAttributeName(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}
