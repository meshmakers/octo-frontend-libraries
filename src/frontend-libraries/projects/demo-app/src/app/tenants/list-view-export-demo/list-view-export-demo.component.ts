import { ChangeDetectionStrategy, Component, signal, ViewChild } from '@angular/core';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { ListViewComponent, TableColumn } from '@meshmakers/shared-ui';
import { ServerPagedDataSourceDirective } from './server-paged-data-source.directive';

/** Demo of the list view export of all rows with server-side paging (AB#8122) and the PDF limit (AB#8630). */
@Component({
  selector: 'app-list-view-export-demo',
  imports: [ListViewComponent, ServerPagedDataSourceDirective, ButtonsModule],
  templateUrl: './list-view-export-demo.component.html',
  styleUrl: './list-view-export-demo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListViewExportDemoComponent {
  @ViewChild(ServerPagedDataSourceDirective) private dataSource?: ServerPagedDataSourceDirective;

  protected readonly columns: TableColumn[] = [
    { field: 'timestamp', displayName: 'Timestamp', dataType: 'date' },
    { field: 'register', displayName: 'Register', dataType: 'text' },
    { field: 'value', displayName: 'Value', dataType: 'numeric' },
    { field: 'unit', displayName: 'Unit', dataType: 'text' }
  ];
  protected readonly rowCount = signal(35040);
  /** PDF row limits to compare the PDF rendering time (AB#8630); 1000 is the library default. */
  protected readonly pdfLimits = [500, 1000, 2000, 5000];
  protected readonly pdfExportRowLimit = signal(1000);

  protected setRowCount(count: number): void {
    this.rowCount.set(count);
    this.dataSource?.resize(count);
    this.dataSource?.fetchAgain({ resetSkip: true });
  }

  protected failNextRequest(): void {
    if (this.dataSource) {
      this.dataSource.failNextRequest = true;
    }
  }
}
