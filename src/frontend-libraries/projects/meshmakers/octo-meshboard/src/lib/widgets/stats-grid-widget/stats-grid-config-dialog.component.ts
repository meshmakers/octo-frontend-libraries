import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogsModule } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { WidgetConfigResult } from '../../services/widget-registry.service';
import { StatItem, StatColor, AggregationQuery, AggregationType } from '../../models/meshboard.models';

export interface StatsGridConfigResult extends WidgetConfigResult {
  ckTypeId: string;
  stats: StatItem[];
  queries: AggregationQuery[];
  columns: number;
}

interface ColorOption {
  value: StatColor;
  label: string;
  color: string;
}

interface CkTypeOption {
  value: string;
  label: string;
}

interface EditableStat {
  id: string;
  label: string;
  ckTypeId: string;
  aggregation: AggregationType;
  color: StatColor;
  prefix?: string;
  suffix?: string;
}

@Component({
  selector: 'mm-stats-grid-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogsModule,
    ButtonsModule,
    InputsModule,
    DropDownsModule
  ],
  template: `
    <kendo-dialog
      title="Stats Grid Configuration"
      [minWidth]="600"
      [width]="700"
      (close)="onCancel()">

      <div class="config-form">
        <!-- Grid Columns -->
        <div class="form-field">
          <label>Grid Columns</label>
          <kendo-numerictextbox
            [(ngModel)]="form.columns"
            [min]="1"
            [max]="6"
            [step]="1"
            [format]="'n0'">
          </kendo-numerictextbox>
          <p class="field-hint">Number of columns in the grid (1-6).</p>
        </div>

        <!-- Stats List -->
        <div class="form-section">
          <div class="section-header">
            <h4>Statistics</h4>
            <button kendoButton [icon]="'plus'" (click)="addStat()">Add Stat</button>
          </div>

          @if (form.stats.length === 0) {
            <div class="empty-state">
              No statistics configured. Click "Add Stat" to add one.
            </div>
          }

          @for (stat of form.stats; track stat.id; let i = $index) {
            <div class="stat-item">
              <div class="stat-header">
                <span class="stat-number">#{{ i + 1 }}</span>
                <button
                  kendoButton
                  [icon]="'trash'"
                  [fillMode]="'flat'"
                  [themeColor]="'error'"
                  (click)="removeStat(i)">
                </button>
              </div>

              <div class="stat-form">
                <div class="form-row">
                  <div class="form-field flex-2">
                    <label>Label <span class="required">*</span></label>
                    <kendo-textbox
                      [(ngModel)]="stat.label"
                      placeholder="e.g., Types">
                    </kendo-textbox>
                  </div>
                  <div class="form-field flex-1">
                    <label>Color</label>
                    <kendo-dropdownlist
                      [data]="colorOptions"
                      textField="label"
                      valueField="value"
                      [valuePrimitive]="true"
                      [(ngModel)]="stat.color">
                      <ng-template kendoDropDownListItemTemplate let-dataItem>
                        <div class="color-item">
                          <span class="color-swatch" [style.background]="dataItem.color"></span>
                          <span>{{ dataItem.label }}</span>
                        </div>
                      </ng-template>
                      <ng-template kendoDropDownListValueTemplate let-dataItem>
                        @if (dataItem) {
                          <div class="color-item">
                            <span class="color-swatch" [style.background]="dataItem.color"></span>
                            <span>{{ dataItem.label }}</span>
                          </div>
                        }
                      </ng-template>
                    </kendo-dropdownlist>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-field flex-2">
                    <label>CK Type <span class="required">*</span></label>
                    <kendo-dropdownlist
                      [data]="ckTypeOptions"
                      textField="label"
                      valueField="value"
                      [valuePrimitive]="true"
                      [(ngModel)]="stat.ckTypeId"
                      [filterable]="true"
                      (filterChange)="onCkTypeFilter($event)">
                    </kendo-dropdownlist>
                  </div>
                  <div class="form-field flex-1">
                    <label>Aggregation</label>
                    <kendo-dropdownlist
                      [data]="aggregationOptions"
                      [valuePrimitive]="true"
                      [(ngModel)]="stat.aggregation">
                    </kendo-dropdownlist>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-field flex-1">
                    <label>Prefix</label>
                    <kendo-textbox
                      [(ngModel)]="stat.prefix"
                      placeholder="e.g., $">
                    </kendo-textbox>
                  </div>
                  <div class="form-field flex-1">
                    <label>Suffix</label>
                    <kendo-textbox
                      [(ngModel)]="stat.suffix"
                      placeholder="e.g., %">
                    </kendo-textbox>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      </div>

      <kendo-dialog-actions>
        <button kendoButton fillMode="flat" (click)="onCancel()">Cancel</button>
        <button
          kendoButton
          themeColor="primary"
          [disabled]="!isValid"
          (click)="onSave()">
          Save
        </button>
      </kendo-dialog-actions>
    </kendo-dialog>
  `,
  styles: [`
    .config-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 16px 0;
      max-height: 60vh;
      overflow-y: auto;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-field.flex-1 {
      flex: 1;
    }

    .form-field.flex-2 {
      flex: 2;
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

    .form-section {
      padding: 16px;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .section-header h4 {
      margin: 0;
      font-size: 0.95rem;
      color: var(--kendo-color-primary, #0d6efd);
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .required {
      color: var(--kendo-color-error, #dc3545);
    }

    .empty-state {
      text-align: center;
      padding: 24px;
      color: var(--kendo-color-subtle, #6c757d);
      font-style: italic;
    }

    .stat-item {
      padding: 16px;
      margin-bottom: 12px;
      background: var(--kendo-color-surface, #ffffff);
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
    }

    .stat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .stat-number {
      font-weight: 600;
      color: var(--kendo-color-primary, #0d6efd);
    }

    .stat-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .color-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .color-swatch {
      width: 16px;
      height: 16px;
      border-radius: 3px;
      border: 1px solid rgba(0,0,0,0.1);
    }
  `]
})
export class StatsGridConfigDialogComponent implements OnInit {
  @Input() initialStats?: StatItem[];
  @Input() initialQueries?: AggregationQuery[];
  @Input() initialColumns?: number;

  @Output() save = new EventEmitter<StatsGridConfigResult>();
  @Output() cancelled = new EventEmitter<void>();

  colorOptions: ColorOption[] = [
    { value: 'mint', label: 'Mint', color: '#98d9c2' },
    { value: 'cyan', label: 'Cyan', color: '#5bc0be' },
    { value: 'violet', label: 'Violet', color: '#9b5de5' },
    { value: 'toffee', label: 'Toffee', color: '#f4a261' },
    { value: 'lilac', label: 'Lilac', color: '#c9b1ff' },
    { value: 'bubblegum', label: 'Bubblegum', color: '#ff99c8' },
    { value: 'default', label: 'Default', color: '#6c757d' }
  ];

  ckTypeOptions: CkTypeOption[] = [
    { value: 'ConstructionKit/CkModel', label: 'CK Models' },
    { value: 'ConstructionKit/CkType', label: 'CK Types' },
    { value: 'ConstructionKit/CkAttribute', label: 'CK Attributes' },
    { value: 'ConstructionKit/CkAssociationRole', label: 'CK Association Roles' },
    { value: 'ConstructionKit/CkEnum', label: 'CK Enums' },
    { value: 'ConstructionKit/CkRecord', label: 'CK Records' }
  ];

  filteredCkTypeOptions: CkTypeOption[] = [];

  aggregationOptions: AggregationType[] = ['count', 'sum', 'avg', 'min', 'max'];

  form = {
    columns: 3,
    stats: [] as EditableStat[]
  };

  private nextId = 1;

  get isValid(): boolean {
    if (this.form.stats.length === 0) return false;
    return this.form.stats.every(stat =>
      stat.label?.trim() && stat.ckTypeId?.trim()
    );
  }

  ngOnInit(): void {
    this.filteredCkTypeOptions = [...this.ckTypeOptions];
    this.form.columns = this.initialColumns ?? 3;

    // Convert initial stats and queries to editable format
    if (this.initialStats && this.initialQueries) {
      this.form.stats = this.initialStats.map(stat => {
        const query = this.initialQueries?.find(q => q.id === stat.queryId);
        return {
          id: `stat-${this.nextId++}`,
          label: stat.label,
          ckTypeId: query?.ckTypeId ?? '',
          aggregation: query?.aggregation ?? 'count',
          color: stat.color ?? 'default',
          prefix: stat.prefix,
          suffix: stat.suffix
        };
      });
    }
  }

  onCkTypeFilter(filter: string): void {
    const filterLower = filter.toLowerCase();
    this.filteredCkTypeOptions = this.ckTypeOptions.filter(opt =>
      opt.label.toLowerCase().includes(filterLower) ||
      opt.value.toLowerCase().includes(filterLower)
    );
  }

  addStat(): void {
    this.form.stats.push({
      id: `stat-${this.nextId++}`,
      label: '',
      ckTypeId: 'ConstructionKit/CkType',
      aggregation: 'count',
      color: 'default'
    });
  }

  removeStat(index: number): void {
    this.form.stats.splice(index, 1);
  }

  onSave(): void {
    // Build stats and queries from form
    const stats: StatItem[] = [];
    const queries: AggregationQuery[] = [];

    for (const stat of this.form.stats) {
      const queryId = `query-${stat.id}`;

      stats.push({
        label: stat.label,
        queryId,
        color: stat.color,
        prefix: stat.prefix,
        suffix: stat.suffix
      });

      queries.push({
        id: queryId,
        ckTypeId: stat.ckTypeId,
        aggregation: stat.aggregation
      });
    }

    this.save.emit({
      ckTypeId: '',
      stats,
      queries,
      columns: this.form.columns
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
