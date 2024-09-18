import { Component, Input } from "@angular/core";
import {
  MatCell, MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable
} from "@angular/material/table";
import { NgForOf } from "@angular/common";
 import { MatSort, MatSortHeader } from '@angular/material/sort';
import {MatFormFieldModule} from '@angular/material/form-field';

@Component({
  selector: 'mm-table-simple',
  standalone: true,
  imports: [
    MatTable,
    MatColumnDef,
    MatHeaderCell,
    MatCell,
    MatHeaderRow,
    MatRow,
    MatHeaderRowDef,
    MatRowDef,
    MatHeaderCellDef,
    MatCellDef,
    NgForOf,
    MatSort,
    MatSortHeader,
    MatFormFieldModule
  ],
  templateUrl: './mm-table-simple.component.html',
  styleUrl: './mm-table-simple.component.scss'
})
export class MmTableSimpleComponent {
  @Input() sortColumn  = '';
  @Input() items: any[] = [];
  @Input() columns: { key: string, header: string }[] = [];

  get displayedColumns(): string[] {
    return this.columns.map(col => col.key);
  }

}
