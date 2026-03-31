import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { WidgetConfigResult } from '../../services/widget-registry.service';
import { SummaryCardTile } from '../../models/meshboard.models';

export interface SummaryCardConfigResult extends WidgetConfigResult {
  columns: number;
  tiles: SummaryCardTile[];
}

interface EditableTile {
  id: string;
  label: string;
  prefix: string;
  suffix: string;
  color: string;
  size: string;
  sourceType: 'entity' | 'aggregation';
  rtId: string;
  ckTypeId: string;
  attributePath: string;
  aggregation: string;
  aggAttribute: string;
}

@Component({
  selector: 'mm-summary-card-config-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonsModule, InputsModule, DropDownsModule],
  template: `
    <div class="config-container">
      <div class="config-form">
        <div class="form-field">
          <label>Grid Columns</label>
          <kendo-numerictextbox [(ngModel)]="form.columns" [min]="1" [max]="6" [format]="'n0'" [spinners]="true"></kendo-numerictextbox>
        </div>

        <h4>Tiles</h4>
        @for (tile of form.tiles; track $index) {
          <div class="tile-config">
            <div class="tile-header">
              <strong>Tile {{ $index + 1 }}</strong>
              <button kendoButton fillMode="flat" (click)="removeTile($index)">Remove</button>
            </div>
            <div class="tile-row">
              <kendo-textbox [(ngModel)]="tile.label" placeholder="Label" style="flex: 1;"></kendo-textbox>
              <kendo-textbox [(ngModel)]="tile.prefix" placeholder="Prefix" style="width: 60px;"></kendo-textbox>
              <kendo-textbox [(ngModel)]="tile.suffix" placeholder="Suffix" style="width: 80px;"></kendo-textbox>
            </div>
            <div class="tile-row">
              <kendo-dropdownlist [data]="colorOptions" [valuePrimitive]="true" [(ngModel)]="tile.color" style="width: 110px;"></kendo-dropdownlist>
              <kendo-dropdownlist [data]="sizeOptions" [valuePrimitive]="true" [(ngModel)]="tile.size" style="width: 110px;"></kendo-dropdownlist>
              <kendo-dropdownlist [data]="sourceTypeOptions" [valuePrimitive]="true" [(ngModel)]="tile.sourceType" style="width: 120px;"></kendo-dropdownlist>
            </div>
            @if (tile.sourceType === 'entity') {
              <div class="tile-row">
                <kendo-textbox [(ngModel)]="tile.ckTypeId" placeholder="CK Type ID" style="flex: 1;"></kendo-textbox>
                <kendo-textbox [(ngModel)]="tile.rtId" placeholder="Runtime ID" style="flex: 1;"></kendo-textbox>
                <kendo-textbox [(ngModel)]="tile.attributePath" placeholder="Attribute" style="width: 120px;"></kendo-textbox>
              </div>
            }
            @if (tile.sourceType === 'aggregation') {
              <div class="tile-row">
                <kendo-textbox [(ngModel)]="tile.ckTypeId" placeholder="CK Type ID" style="flex: 1;"></kendo-textbox>
                <kendo-dropdownlist [data]="aggregationOptions" [valuePrimitive]="true" [(ngModel)]="tile.aggregation" style="width: 100px;"></kendo-dropdownlist>
                <kendo-textbox [(ngModel)]="tile.aggAttribute" placeholder="Attribute (for sum/avg)" style="flex: 1;"></kendo-textbox>
              </div>
            }
          </div>
        }
        <button kendoButton fillMode="flat" (click)="addTile()">+ Add Tile</button>
      </div>

      <div class="action-bar mm-dialog-actions">
        <button kendoButton fillMode="flat" (click)="onCancel()">Cancel</button>
        <button kendoButton themeColor="primary" [disabled]="!isValid" (click)="onSave()">Save</button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .config-container { display: flex; flex-direction: column; height: 100%; }
    .config-form { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .action-bar { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 16px; border-top: 1px solid var(--kendo-color-border, #dee2e6); }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field label { font-weight: 600; font-size: 0.9rem; }
    h4 { margin: 8px 0 4px; font-size: 0.95rem; }
    .tile-config { border: 1px solid var(--kendo-color-border, #dee2e6); border-radius: 4px; padding: 10px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px; }
    .tile-header { display: flex; justify-content: space-between; align-items: center; }
    .tile-row { display: flex; gap: 6px; align-items: center; }
  `]
})
export class SummaryCardConfigDialogComponent implements OnInit {
  private readonly windowRef = inject(WindowRef);

  @Input() initialColumns?: number;
  @Input() initialTiles?: SummaryCardTile[];

  form = {
    columns: 2,
    tiles: [] as EditableTile[]
  };

  colorOptions = ['default', 'primary', 'success', 'warning', 'error'];
  sizeOptions = ['normal', 'full'];
  sourceTypeOptions = ['entity', 'aggregation'];
  aggregationOptions = ['count', 'sum', 'avg', 'min', 'max'];

  get isValid(): boolean {
    return this.form.tiles.length > 0 && this.form.tiles.every(t => t.label && t.ckTypeId);
  }

  ngOnInit(): void {
    this.form.columns = this.initialColumns ?? 2;
    if (this.initialTiles) {
      this.form.tiles = this.initialTiles.map((t, i) => ({
        id: t.id || `tile-${i}`,
        label: t.label,
        prefix: t.prefix ?? '',
        suffix: t.suffix ?? '',
        color: t.color ?? 'default',
        size: t.size ?? 'normal',
        sourceType: t.entitySource ? 'entity' : 'aggregation',
        rtId: t.entitySource?.rtId ?? '',
        ckTypeId: t.entitySource?.ckTypeId ?? t.aggregationSource?.ckTypeId ?? '',
        attributePath: t.entitySource?.attributePath ?? '',
        aggregation: t.aggregationSource?.aggregation ?? 'count',
        aggAttribute: t.aggregationSource?.attribute ?? ''
      }));
    }
  }

  addTile(): void {
    this.form.tiles.push({
      id: `tile-${Date.now()}`,
      label: '', prefix: '', suffix: '',
      color: 'default', size: 'normal',
      sourceType: 'entity',
      rtId: '', ckTypeId: '', attributePath: '',
      aggregation: 'count', aggAttribute: ''
    });
  }

  removeTile(index: number): void {
    this.form.tiles.splice(index, 1);
  }

  onSave(): void {
    const tiles: SummaryCardTile[] = this.form.tiles.map(t => {
      const tile: SummaryCardTile = {
        id: t.id,
        label: t.label,
        prefix: t.prefix || undefined,
        suffix: t.suffix || undefined,
        color: (t.color as SummaryCardTile['color']) || undefined,
        size: (t.size as SummaryCardTile['size']) || undefined
      };

      if (t.sourceType === 'entity') {
        tile.entitySource = { rtId: t.rtId, ckTypeId: t.ckTypeId, attributePath: t.attributePath };
      } else {
        tile.aggregationSource = {
          ckTypeId: t.ckTypeId,
          aggregation: t.aggregation as 'count',
          attribute: t.aggAttribute || undefined
        };
      }
      return tile;
    });

    this.windowRef.close({
      ckTypeId: '',
      columns: this.form.columns,
      tiles
    } as SummaryCardConfigResult);
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
