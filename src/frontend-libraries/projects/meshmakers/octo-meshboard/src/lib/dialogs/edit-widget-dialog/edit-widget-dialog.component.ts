import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from '@progress/kendo-angular-dialog';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { AnyWidgetConfig, WidgetZone } from '../../models/meshboard.models';

export interface WidgetPositionUpdate {
  id: string;
  title: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  chromeless?: boolean;
  zone?: WidgetZone;
}

interface ZoneOption {
  text: string;
  value: WidgetZone;
}

@Component({
  selector: 'mm-edit-widget-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    InputsModule,
    ButtonsModule,
    DropDownsModule
  ],
  template: `
    <kendo-dialog
      title="Edit Widget"
      [minWidth]="350"
      [width]="400"
      (close)="onCancel()">

      <div class="edit-widget-form">
        <div class="form-field">
          <label for="editWidgetTitle">Title</label>
          <kendo-textbox
            id="editWidgetTitle"
            [(ngModel)]="form.title"
            placeholder="Enter widget title">
          </kendo-textbox>
        </div>

        <div class="form-field">
          <label for="editWidgetZone">Zone</label>
          <kendo-dropdownlist
            id="editWidgetZone"
            [data]="zoneOptions"
            textField="text"
            valueField="value"
            [value]="selectedZoneOption"
            (valueChange)="onZoneChange($event)">
          </kendo-dropdownlist>
        </div>

        @if (form.zone !== 'banner') {
          <div class="form-row">
            <div class="form-field">
              <label for="editWidgetCol">Column</label>
              <kendo-numerictextbox
                id="editWidgetCol"
                [(value)]="form.col"
                [min]="1"
                [max]="maxColumns"
                [decimals]="0"
                [format]="'n0'">
              </kendo-numerictextbox>
            </div>
            <div class="form-field">
              <label for="editWidgetRow">Row</label>
              <kendo-numerictextbox
                id="editWidgetRow"
                [(value)]="form.row"
                [min]="1"
                [decimals]="0"
                [format]="'n0'">
              </kendo-numerictextbox>
            </div>
          </div>

          <div class="form-row">
            <div class="form-field">
              <label for="editWidgetColSpan">Width (columns)</label>
              <kendo-numerictextbox
                id="editWidgetColSpan"
                [(value)]="form.colSpan"
                [min]="1"
                [max]="maxColumns"
                [decimals]="0"
                [format]="'n0'">
              </kendo-numerictextbox>
            </div>
            <div class="form-field">
              <label for="editWidgetRowSpan">Height (rows)</label>
              <kendo-numerictextbox
                id="editWidgetRowSpan"
                [(value)]="form.rowSpan"
                [min]="1"
                [decimals]="0"
                [format]="'n0'">
              </kendo-numerictextbox>
            </div>
          </div>
        } @else {
          <div class="form-hint">
            Banner widgets are rendered as a full-width stack above the grid.
          </div>
        }

        <div class="form-field form-field-checkbox">
          <input type="checkbox" id="editWidgetChromeless" [(ngModel)]="form.chromeless" />
          <label for="editWidgetChromeless">Hide title bar and border in view mode</label>
        </div>

        @if (error) {
          <div class="form-error">{{ error }}</div>
        }
      </div>

      <kendo-dialog-actions class="mm-dialog-actions">
        <button kendoButton fillMode="flat" (click)="onCancel()">Cancel</button>
        <button
          kendoButton
          themeColor="primary"
          (click)="onSave()">
          Save
        </button>
      </kendo-dialog-actions>

    </kendo-dialog>
  `,
  styles: [`
    .edit-widget-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 8px 0;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 4px;

      label {
        font-weight: 500;
        font-size: 0.875rem;
        color: var(--kendo-color-on-app-surface, #212529);
      }
    }

    .form-row {
      display: flex;
      gap: 16px;

      .form-field {
        flex: 1;
      }
    }

    .form-field-checkbox {
      flex-direction: row;
      align-items: center;
      gap: 8px;

      label {
        font-weight: 400;
      }
    }

    .form-hint {
      font-size: 0.8rem;
      opacity: 0.7;
      padding: 8px 12px;
      border-left: 3px solid var(--kendo-color-primary, #0d6efd);
      background: var(--kendo-color-surface-alt, rgba(0, 0, 0, 0.05));
      border-radius: 2px;
    }

    .form-error {
      color: var(--kendo-color-error, #dc3545);
      font-size: 0.875rem;
      padding: 8px;
      background: var(--kendo-color-error-subtle, rgba(220, 53, 69, 0.1));
      border-radius: 4px;
    }
  `]
})
export class EditWidgetDialogComponent implements OnInit {
  @Input() widget!: AnyWidgetConfig;
  @Input() widgets: AnyWidgetConfig[] = [];
  @Input() maxColumns = 6;
  @Input() gridService!: MeshBoardGridService;

  @Output() save = new EventEmitter<WidgetPositionUpdate>();
  @Output() cancelled = new EventEmitter<void>();

  readonly zoneOptions: ZoneOption[] = [
    { text: 'Grid', value: 'grid' },
    { text: 'Banner', value: 'banner' }
  ];

  selectedZoneOption: ZoneOption = this.zoneOptions[0];

  form: WidgetPositionUpdate = {
    id: '',
    title: '',
    col: 1,
    row: 1,
    colSpan: 1,
    rowSpan: 1
  };

  error = '';

  ngOnInit(): void {
    const zone = this.widget.zone ?? 'grid';
    this.form = {
      id: this.widget.id,
      title: this.widget.title,
      col: this.widget.col,
      row: this.widget.row,
      colSpan: this.widget.colSpan,
      rowSpan: this.widget.rowSpan,
      chromeless: this.widget.chromeless ?? false,
      zone
    };
    this.selectedZoneOption = this.zoneOptions.find(o => o.value === zone) ?? this.zoneOptions[0];
  }

  onZoneChange(option: ZoneOption): void {
    this.selectedZoneOption = option;
    this.form.zone = option.value;
    this.error = '';
  }

  onSave(): void {
    // Skip grid validation for banner zone widgets
    if (this.form.zone !== 'banner') {
      // Validate: check for overlaps
      const wouldOverlap = this.gridService.wouldCauseOverlap(
        this.widgets,
        this.form.id,
        this.form.col,
        this.form.row,
        this.form.colSpan,
        this.form.rowSpan
      );

      if (wouldOverlap) {
        this.error = 'Position overlaps with another widget. Please choose a different position.';
        return;
      }

      // Validate: check bounds
      if (this.gridService.isOutOfBounds(this.form.col, this.form.colSpan, this.maxColumns)) {
        this.error = 'Widget extends beyond the grid. Reduce column or width.';
        return;
      }
    }

    this.save.emit(this.form);
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
