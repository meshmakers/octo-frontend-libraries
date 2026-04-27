import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EntityCardWidgetConfig, RuntimeEntityData } from '../../models/meshboard.models';
import { DashboardDataService } from '../../services/meshboard-data.service';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { PropertyValueDisplayComponent, AttributeValueTypeDto } from '@meshmakers/octo-ui';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'mm-entity-card-widget',
  standalone: true,
  imports: [CommonModule, WidgetNotConfiguredComponent, PropertyValueDisplayComponent],
  templateUrl: './entity-card-widget.component.html',
  styleUrl: './entity-card-widget.component.scss'
})
export class EntityCardWidgetComponent implements DashboardWidget<EntityCardWidgetConfig, RuntimeEntityData>, OnInit, OnChanges {
  private readonly dataService = inject(DashboardDataService);

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
      return !dataSource.rtId && !dataSource.ckTypeId;
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
    // Note: isNotConfigured() check ensures rtId and ckTypeId are set
    if (dataSource.type === 'runtimeEntity') {
      this._isLoading.set(true);
      this._error.set(null);

      this.dataService.fetchEntityWithAssociations(dataSource.rtId!, dataSource.ckTypeId!)
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
