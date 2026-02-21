import { Component, Input, Output, EventEmitter, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogsModule } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { PropertyGridComponent, PropertyGridItem, PropertyGridConfig, AttributeValueTypeDto } from '@meshmakers/octo-ui';
import { GetDashboardEntityDtoGQL } from '../../graphQL/getDashboardEntity';
import { firstValueFrom } from 'rxjs';

/**
 * Dialog component for displaying entity details using property grid.
 * Shows all attributes of an entity with their names, values, and types.
 */
@Component({
  selector: 'mm-entity-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DialogsModule,
    ButtonsModule,
    PropertyGridComponent
  ],
  template: `
    <kendo-dialog
      [title]="dialogTitle"
      [minWidth]="600"
      [width]="700"
      (close)="onClose()">

      <div class="entity-detail-content">
        @if (isLoading()) {
          <div class="loading-indicator">Loading entity details...</div>
        } @else if (error()) {
          <div class="error-message">{{ error() }}</div>
        } @else {
          <div class="entity-header">
            <div class="entity-info">
              <div class="info-row">
                <span class="label">RT-ID:</span>
                <span class="value">{{ rtId }}</span>
              </div>
              <div class="info-row">
                <span class="label">CK Type:</span>
                <span class="value">{{ formatCkTypeId(ckTypeId) }}</span>
              </div>
              @if (rtWellKnownName()) {
                <div class="info-row">
                  <span class="label">Name:</span>
                  <span class="value">{{ rtWellKnownName() }}</span>
                </div>
              }
            </div>
          </div>

          <div class="attributes-section">
            <h4>Attributes</h4>
            <mm-property-grid
              [data]="propertyGridData()"
              [config]="propertyGridConfig"
              [showTypeColumn]="true">
            </mm-property-grid>
          </div>
        }
      </div>

      <kendo-dialog-actions>
        <button kendoButton (click)="onClose()">Close</button>
      </kendo-dialog-actions>
    </kendo-dialog>
  `,
  styles: [`
    .entity-detail-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 400px;
    }

    .loading-indicator, .error-message {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .error-message {
      color: var(--kendo-color-error, #dc3545);
    }

    .entity-header {
      padding: 12px;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
    }

    .entity-info {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .info-row {
      display: flex;
      gap: 8px;
      font-size: 0.875rem;
    }

    .info-row .label {
      font-weight: 600;
      color: var(--kendo-color-subtle, #6c757d);
      min-width: 80px;
    }

    .info-row .value {
      color: var(--kendo-color-on-surface, #212529);
      word-break: break-all;
    }

    .attributes-section {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .attributes-section h4 {
      margin: 0 0 8px 0;
      font-size: 0.9rem;
      color: var(--kendo-color-primary, #0d6efd);
    }
  `]
})
export class EntityDetailDialogComponent implements OnInit {
  private readonly getDashboardEntityGQL = inject(GetDashboardEntityDtoGQL);

  @Input() rtId!: string;
  @Input() ckTypeId!: string;

  @Output() closed = new EventEmitter<void>();

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly rtWellKnownName = signal<string | null>(null);
  readonly propertyGridData = signal<PropertyGridItem[]>([]);

  readonly propertyGridConfig: PropertyGridConfig = {
    readOnlyMode: true,
    showSearch: true,
    showTypeIcons: true,
    height: '350px'
  };

  get dialogTitle(): string {
    return `Entity Details: ${this.formatCkTypeId(this.ckTypeId)}`;
  }

  async ngOnInit(): Promise<void> {
    await this.loadEntityDetails();
  }

  formatCkTypeId(ckTypeId: string): string {
    if (!ckTypeId) return '';
    const parts = ckTypeId.split('/');
    return parts[parts.length - 1];
  }

  private async loadEntityDetails(): Promise<void> {
    if (!this.rtId || !this.ckTypeId) {
      this.error.set('No entity specified');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.getDashboardEntityGQL.fetch({
          variables: {
            rtId: this.rtId,
            ckTypeId: this.ckTypeId
          }
        })
      );

      const entity = result.data?.runtime?.runtimeEntities?.items?.[0];

      if (!entity) {
        this.error.set('Entity not found');
        return;
      }

      this.rtWellKnownName.set(entity.rtWellKnownName ?? null);

      // Map attributes to PropertyGridItem format
      const attributes = entity.attributes?.items ?? [];
      const gridItems: PropertyGridItem[] = attributes
        .filter((attr): attr is NonNullable<typeof attr> => attr !== null && attr.attributeName !== null)
        .map((attr, index) => ({
          id: `attr-${index}`,
          name: attr.attributeName!,
          displayName: this.formatAttributeName(attr.attributeName!),
          value: attr.value,
          type: this.inferAttributeType(attr.value),
          readOnly: true
        }));

      this.propertyGridData.set(gridItems);
    } catch (err) {
      console.error('Error loading entity details:', err);
      this.error.set('Failed to load entity details');
    } finally {
      this.isLoading.set(false);
    }
  }

  private formatAttributeName(name: string): string {
    // Convert camelCase to Title Case with spaces
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  private inferAttributeType(value: unknown): AttributeValueTypeDto {
    if (value === null || value === undefined) {
      return AttributeValueTypeDto.StringDto;
    }

    if (typeof value === 'boolean') {
      return AttributeValueTypeDto.BooleanDto;
    }

    if (typeof value === 'number') {
      return Number.isInteger(value) ? AttributeValueTypeDto.IntegerDto : AttributeValueTypeDto.DoubleDto;
    }

    if (typeof value === 'string') {
      // Check for date patterns
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        return AttributeValueTypeDto.DateTimeDto;
      }
      return AttributeValueTypeDto.StringDto;
    }

    if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === 'object') {
        return AttributeValueTypeDto.RecordArrayDto;
      }
      if (value.length > 0 && typeof value[0] === 'string') {
        return AttributeValueTypeDto.StringArrayDto;
      }
      if (value.length > 0 && typeof value[0] === 'number') {
        return AttributeValueTypeDto.IntegerArrayDto;
      }
      return AttributeValueTypeDto.StringArrayDto;
    }

    if (typeof value === 'object') {
      return AttributeValueTypeDto.RecordDto;
    }

    return AttributeValueTypeDto.StringDto;
  }

  onClose(): void {
    this.closed.emit();
  }
}
