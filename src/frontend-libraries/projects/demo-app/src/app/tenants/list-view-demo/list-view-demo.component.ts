import {Component, ViewChild, ViewEncapsulation} from '@angular/core';
import {CustomersDataSourceDirective} from '../data-sources/customers-data-source.directive';
import {ListViewComponent, StatusMapping} from '@meshmakers/shared-ui';
import {
  anchorIcon,
  cloudIcon,
  editToolsIcon,
  tableDeleteIcon,
  trashIcon,
  pencilIcon,
  eyeIcon,
  copyIcon,
  downloadIcon,
  checkCircleIcon,
  xCircleIcon,
  clockIcon,
  userIcon,
  buildingsOutlineIcon,
  fileTxtIcon
} from '@progress/kendo-svg-icons';
import {CommandItemExecuteEventArgs, CommandItem} from '../../../../../meshmakers/shared-services/src/lib/models/commandItem';
import {OctoSdkDemoCustomerStatusDto, BasicLegalEntityTypeDto} from '../../graphQL/globalTypes';
import {SelectableSettings} from '@progress/kendo-angular-grid';
import {ContextMenuType, TableColumn} from '../../../../../meshmakers/shared-ui/src/lib/list-view/list-view.model';
import {FormsModule} from '@angular/forms';
import {CheckBoxModule} from '@progress/kendo-angular-inputs';
import {DropDownListModule} from '@progress/kendo-angular-dropdowns';
import {LabelModule} from '@progress/kendo-angular-label';
import {CardModule} from '@progress/kendo-angular-layout';
import {ButtonsModule} from '@progress/kendo-angular-buttons';

@Component({
  selector: 'app-list-view-demo',
  imports: [
    CustomersDataSourceDirective,
    ListViewComponent,
    FormsModule,
    CheckBoxModule,
    DropDownListModule,
    LabelModule,
    CardModule,
    ButtonsModule
  ],
  templateUrl: './list-view-demo.component.html',
  styleUrl: './list-view-demo.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class ListViewDemoComponent {

  protected readonly editToolsIcon = editToolsIcon;
  protected readonly tableDeleteIcon = tableDeleteIcon;
  protected readonly anchorIcon = anchorIcon;
  protected readonly cloudIcon = cloudIcon;
  protected readonly trashIcon = trashIcon;
  protected readonly pencilIcon = pencilIcon;
  protected readonly eyeIcon = eyeIcon;
  protected readonly copyIcon = copyIcon;
  protected readonly downloadIcon = downloadIcon;

  @ViewChild('dir', { static: false }) myDir!: CustomersDataSourceDirective;

  // Feature Demo Options
  showDocumentation = false;

  // Sorting & Filtering
  sortableEnabled = true;
  rowFilterEnabled = true;
  searchTextBoxEnabled = true;

  // Selection
  selectionEnabled = true;
  selectionMode: 'single' | 'multiple' = 'multiple';
  showRowCheckBoxes = true;
  showRowSelectAllCheckBox = true;

  // Context Menu
  contextMenuType: ContextMenuType = 'contextMenu';
  contextMenuTypes: ContextMenuType[] = ['contextMenu', 'actionMenu'];

  // Pagination
  pageSize = 10;
  pageSizes = [5, 10, 20, 50, 100];

  // Export filenames
  excelExportFileName = 'Customers.xlsx';
  pdfExportFileName = 'Customers.pdf';

  // Status Icon Mappings for CustomerStatus
  customerStatusMapping: StatusMapping = {
    [OctoSdkDemoCustomerStatusDto.ActiveDto]: {
      icon: checkCircleIcon,
      tooltip: 'Active - Customer is active',
      color: '#28a745'
    },
    [OctoSdkDemoCustomerStatusDto.PendingDto]: {
      icon: clockIcon,
      tooltip: 'Pending - Awaiting activation',
      color: '#fd7e14'
    },
    [OctoSdkDemoCustomerStatusDto.SuspendedDto]: {
      icon: xCircleIcon,
      tooltip: 'Suspended - Customer is suspended',
      color: '#dc3545'
    }
  };

  // Status Icon Mappings for LegalEntityType
  legalEntityTypeMapping: StatusMapping = {
    [BasicLegalEntityTypeDto.CompanyDto]: {
      icon: buildingsOutlineIcon,
      tooltip: 'Company - Business entity',
      color: '#007bff'
    },
    [BasicLegalEntityTypeDto.LegalPersonDto]: {
      icon: fileTxtIcon,
      tooltip: 'Legal Person - Legal structure',
      color: '#6f42c1'
    },
    [BasicLegalEntityTypeDto.NaturalPersonDto]: {
      icon: userIcon,
      tooltip: 'Natural Person - Individual',
      color: '#17a2b8'
    }
  };

  // Dynamic Columns
  availableColumns: TableColumn[] = [
    {field: 'rtId', displayName: 'ID', dataType: 'text'},
    {field: 'contact.firstName', displayName: 'First Name', dataType: 'text'},
    {field: 'contact.lastName', displayName: 'Last Name', dataType: 'text'},
    {field: 'contact.companyName', displayName: 'Company Name', dataType: 'text'},
    {field: 'contact.address.cityTown', displayName: 'City', dataType: 'text'},
    {field: 'contact.address.nationalCode', displayName: 'Country', dataType: 'text'},
    {
      field: 'status',
      displayName: 'Status',
      dataType: 'statusIcons',
      statusFields: [
        {field: 'customerStatus', statusMapping: this.customerStatusMapping},
        {field: 'contact.legalEntityType', statusMapping: this.legalEntityTypeMapping}
      ]
    },
    {
      field: 'customerStatus',
      displayName: 'Customer Status',
      dataType: 'statusIcons',
      statusMapping: this.customerStatusMapping
    },
    {
      field: 'contact.legalEntityType',
      displayName: 'Entity Type',
      dataType: 'statusIcons',
      statusMapping: this.legalEntityTypeMapping
    },
    {field: 'rtCreationDateTime', displayName: 'Created Date', format: 'medium', dataType: 'iso8601'},
    {field: 'rtChangedDateTime', displayName: 'Changed Date', format: 'medium', dataType: 'iso8601'}
  ];
  private _selectedColumnFields: string[] = ['rtId', 'contact.firstName', 'contact.lastName', 'contact.companyName', 'status'];
  private _cachedColumns: TableColumn[] = [];

  get selectedColumnFields(): string[] {
    return this._selectedColumnFields;
  }

  set selectedColumnFields(value: string[]) {
    this._selectedColumnFields = value;
    this._cachedColumns = this.availableColumns.filter(col => this._selectedColumnFields.includes(col.field));
  }

  get columns(): TableColumn[] {
    if (this._cachedColumns.length === 0 && this._selectedColumnFields.length > 0) {
      this._cachedColumns = this.availableColumns.filter(col => this._selectedColumnFields.includes(col.field));
    }
    return this._cachedColumns;
  }

  get selectable(): SelectableSettings {
    return {
      enabled: this.selectionEnabled,
      mode: this.selectionMode
    };
  }

  // Action Command Items - shown as buttons in each row
  get actionCommandItems(): CommandItem[] {
    return [
      {id: 'edit', type: 'link', text: 'Edit', svgIcon: this.editToolsIcon, link: 'list-view/details/{{rtId}}'},
      {id: 'sep', type: 'separator'},
      {id: 'view', type: 'link', text: 'View', svgIcon: this.eyeIcon, link: 'list-view/view/{{rtId}}'}
    ];
  }

  // Context Menu Command Items - shown on right-click or via action menu button
  get contextMenuCommandItems(): CommandItem[] {
    return [
      {id: 'copy', type: 'link', text: 'Copy', onClick: this.onCopyClicked, svgIcon: this.copyIcon},
      {id: 'download', type: 'link', text: 'Download', onClick: this.onDownloadClicked, svgIcon: this.downloadIcon},
      {id: 'sep', type: 'separator'},
      {id: 'delete', type: 'link', text: 'Delete', onClick: this.onDeleteClicked, svgIcon: this.trashIcon}
    ];
  }

  // Left Toolbar Actions
  get leftToolbarActions(): CommandItem[] {
    return [
      {id: 'add', type: 'link', text: 'Add', svgIcon: this.cloudIcon, link: 'list-view/details/new'},
      {id: 'sep', type: 'separator'},
      {id: 'bulkDelete', type: 'link', text: 'Bulk Delete', svgIcon: this.trashIcon, onClick: this.onBulkDeleteClicked, isDisabled: false}
    ];
  }

  // Right Toolbar Actions
  get rightToolbarActions(): CommandItem[] {
    return [
      {id: 'export', type: 'link', text: 'Custom Export', svgIcon: this.downloadIcon, onClick: this.onExportClicked, isDisabled: false}
    ];
  }

  // Event Handlers
  public async onDeleteClicked(eventArgs: CommandItemExecuteEventArgs): Promise<void> {
    console.debug('onDeleteClicked', eventArgs);

    if (eventArgs.data instanceof Array) {
      const l = eventArgs.data.map((item: unknown) => (item as Record<string, unknown>)?.['rtId']).join(', ');
      alert('Delete clicked for items:\n' + l);
    } else {
      const data = eventArgs.data as Record<string, unknown> | undefined;
      alert('Delete clicked for item:\n' + data?.['rtId']);
    }
  }

  public async onCopyClicked(eventArgs: CommandItemExecuteEventArgs): Promise<void> {
    console.debug('onCopyClicked', eventArgs);
    const data = eventArgs.data as Record<string, unknown> | undefined;
    alert('Copy clicked for: ' + (data?.['rtId'] ?? 'selected items'));
  }

  public async onDownloadClicked(eventArgs: CommandItemExecuteEventArgs): Promise<void> {
    console.debug('onDownloadClicked', eventArgs);
    const data = eventArgs.data as Record<string, unknown> | undefined;
    alert('Download clicked for: ' + (data?.['rtId'] ?? 'selected items'));
  }

  public async onBulkDeleteClicked(eventArgs: CommandItemExecuteEventArgs): Promise<void> {
    console.debug('onBulkDeleteClicked', eventArgs);
    if (eventArgs.data instanceof Array) {
      alert('Bulk delete clicked for ' + eventArgs.data.length + ' items');
    } else {
      alert('Please select items first');
    }
  }

  public async onExportClicked(eventArgs: CommandItemExecuteEventArgs): Promise<void> {
    console.debug('onExportClicked', eventArgs);
    alert('Custom export clicked');
  }

  public onRowClicked(rows: unknown[]): void {
    console.debug('Rows selected:', rows);
  }

  protected onTest(): void {
    console.log('onTest');
    if (this.myDir) {
      console.log('myDir', this.myDir);
      this.myDir.fetchAgain();
    }
  }

  toggleColumn(field: string): void {
    const index = this.selectedColumnFields.indexOf(field);
    if (index > -1) {
      this.selectedColumnFields.splice(index, 1);
    } else {
      this.selectedColumnFields.push(field);
    }
    // Trigger change detection
    this.selectedColumnFields = [...this.selectedColumnFields];
  }

  isColumnSelected(field: string): boolean {
    return this.selectedColumnFields.includes(field);
  }

  // Code example for documentation
  readonly commandItemStructure = `{
  id: string,          // Unique identifier
  type: 'link' | 'separator',
  text?: string,       // Display text
  svgIcon?: SVGIcon,   // Kendo SVG icon
  link?: string,       // Router link (supports {{field}} placeholders)
  onClick?: Function,  // Click handler (receives CommandItemExecuteEventArgs)
  isDisabled?: boolean // Disable state
}`;

  readonly statusIconsExample = `// Single field status icons
{
  field: 'customerStatus',
  displayName: 'Status',
  dataType: 'statusIcons',
  statusMapping: {
    'ACTIVE': { icon: checkCircleIcon, tooltip: 'Active', color: '#28a745' },
    'PENDING': { icon: clockIcon, tooltip: 'Pending', color: '#fd7e14' },
    'SUSPENDED': { icon: xCircleIcon, tooltip: 'Suspended', color: '#dc3545' }
  }
}

// Multiple fields in one column
{
  field: 'status',
  displayName: 'Status',
  dataType: 'statusIcons',
  statusFields: [
    { field: 'customerStatus', statusMapping: customerStatusMapping },
    { field: 'contact.legalEntityType', statusMapping: legalEntityTypeMapping }
  ]
}`;
}
