import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { CheckBoxModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { ListViewComponent, ListViewEmptyActionsDirective, MmListEmptyState, TableColumn } from '@meshmakers/shared-ui';
import { EmptyDataSourceDirective } from './empty-data-source.directive';

@Component({
  selector: 'app-list-view-empty-state-demo',
  imports: [ListViewComponent, ListViewEmptyActionsDirective, EmptyDataSourceDirective, FormsModule, ButtonsModule, CheckBoxModule, LabelModule],
  templateUrl: './list-view-empty-state-demo.component.html',
  styleUrl: './list-view-empty-state-demo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListViewEmptyStateDemoComponent {
  protected readonly columns: TableColumn[] = [
    { field: 'name', displayName: 'Name', dataType: 'text' },
    { field: 'city', displayName: 'City', dataType: 'text' }
  ];
  protected readonly emptyState: MmListEmptyState = {
    title: 'No customers yet',
    text: 'Create the first customer to start billing.'
  };
  protected readonly hostFilterActive = signal(false);
  protected readonly createClicks = signal(0);

  protected onCreateCustomer(): void {
    this.createClicks.update(count => count + 1);
  }
}
