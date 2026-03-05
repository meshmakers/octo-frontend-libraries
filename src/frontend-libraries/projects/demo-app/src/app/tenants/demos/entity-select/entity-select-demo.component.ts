import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import {
  EntitySelectInputComponent,
  EntitySelectDialogDataSource,
  DialogFetchOptions,
  DialogFetchResult
} from '@meshmakers/shared-ui';
import { EntitySelectDataSource, EntitySelectResult } from '@meshmakers/shared-services';
import { GetSdkCustomersDtoGQL, GetSdkCustomersQueryVariablesDto } from '../../../graphQL/getSdkCustomers';
import { OctoSdkDemoCustomerDto, SearchFilterTypesDto } from '../../../graphQL/globalTypes';
import { firstValueFrom, Observable, from, map } from 'rxjs';
import { ColumnDefinition } from '@meshmakers/shared-ui';

// Mock entity interface
interface MockEntity {
  id: string;
  name: string;
  email: string;
  department: string;
  active: boolean;
}

// Sample mock data
const MOCK_ENTITIES: MockEntity[] = [
  { id: '1', name: 'John Doe', email: 'john.doe@company.com', department: 'Engineering', active: true },
  { id: '2', name: 'Jane Smith', email: 'jane.smith@company.com', department: 'Marketing', active: true },
  { id: '3', name: 'Bob Johnson', email: 'bob.johnson@company.com', department: 'Sales', active: false },
  { id: '4', name: 'Alice Williams', email: 'alice.williams@company.com', department: 'Engineering', active: true },
  { id: '5', name: 'Charlie Brown', email: 'charlie.brown@company.com', department: 'HR', active: true },
  { id: '6', name: 'Diana Prince', email: 'diana.prince@company.com', department: 'Legal', active: true },
  { id: '7', name: 'Frank Miller', email: 'frank.miller@company.com', department: 'Finance', active: true },
  { id: '8', name: 'Grace Lee', email: 'grace.lee@company.com', department: 'Engineering', active: true },
  { id: '9', name: 'Henry Ford', email: 'henry.ford@company.com', department: 'Operations', active: false },
  { id: '10', name: 'Ivy Chen', email: 'ivy.chen@company.com', department: 'Design', active: true },
  { id: '11', name: 'Jack Wilson', email: 'jack.wilson@company.com', department: 'Engineering', active: true },
  { id: '12', name: 'Kate Anderson', email: 'kate.anderson@company.com', department: 'Marketing', active: true },
  { id: '13', name: 'Liam O\'Connor', email: 'liam.oconnor@company.com', department: 'Sales', active: true },
  { id: '14', name: 'Mia Rodriguez', email: 'mia.rodriguez@company.com', department: 'Support', active: true },
  { id: '15', name: 'Noah Davis', email: 'noah.davis@company.com', department: 'Engineering', active: true }
];

// Mock data source implementation
class MockEntityDataSource implements EntitySelectDataSource<MockEntity> {

  async onFilter(filter: string, take = 50): Promise<EntitySelectResult<MockEntity>> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const lowercaseFilter = filter.toLowerCase();
    const filtered = MOCK_ENTITIES.filter(entity =>
      entity.name.toLowerCase().includes(lowercaseFilter) ||
      entity.email.toLowerCase().includes(lowercaseFilter) ||
      entity.department.toLowerCase().includes(lowercaseFilter)
    );

    const items = filtered.slice(0, take);

    return {
      totalCount: filtered.length,
      items: items
    };
  }

  onDisplayEntity(entity: MockEntity): string {
    return `${entity.name} (${entity.department})`;
  }

  getIdEntity(entity: MockEntity): string {
    return entity.id;
  }
}

// Octo Mesh Customer data source - searches by contact.firstName, contact.lastName, contact.address.cityTown
class CustomerEntityDataSource implements EntitySelectDataSource<OctoSdkDemoCustomerDto> {
  constructor(private getSdkCustomersDtoGQL: GetSdkCustomersDtoGQL) {}

  async onFilter(filter: string, take = 50): Promise<EntitySelectResult<OctoSdkDemoCustomerDto>> {
    const variables: GetSdkCustomersQueryVariablesDto = {
      first: take,
      searchFilter: {
        type: SearchFilterTypesDto.AttributeFilterDto,
        attributePaths: ['contact.firstName', 'contact.lastName', 'contact.address.cityTown'],
        searchTerm: filter
      }
    };

    const result = await firstValueFrom(this.getSdkCustomersDtoGQL.fetch({ variables }));

    const items = (result.data?.runtime?.octoSdkDemoCustomer?.items ?? [])
      .filter((item): item is OctoSdkDemoCustomerDto => item !== null);

    return {
      totalCount: result.data?.runtime?.octoSdkDemoCustomer?.totalCount ?? 0,
      items: items
    };
  }

  onDisplayEntity(entity: OctoSdkDemoCustomerDto): string {
    return `${entity.contact?.firstName ?? ''} ${entity.contact?.lastName ?? ''} (${entity.contact?.address?.cityTown ?? ''})`;
  }

  getIdEntity(entity: OctoSdkDemoCustomerDto): string {
    return entity.rtId;
  }
}

// Customer Dialog DataSource - for the advanced search dialog with grid
class CustomerDialogDataSource implements EntitySelectDialogDataSource<OctoSdkDemoCustomerDto> {
  constructor(private getSdkCustomersDtoGQL: GetSdkCustomersDtoGQL) {}

  getColumns(): ColumnDefinition[] {
    return [
      { field: 'contact.firstName', displayName: 'First Name' },
      { field: 'contact.lastName', displayName: 'Last Name' },
      { field: 'contact.companyName', displayName: 'Company' },
      { field: 'contact.address.cityTown', displayName: 'City' },
      { field: 'contact.address.nationalCode', displayName: 'Country' }
    ];
  }

  fetchData(options: DialogFetchOptions): Observable<DialogFetchResult<OctoSdkDemoCustomerDto>> {
    // Note: This API uses cursor-based pagination. For demo purposes,
    // we fetch all items up to skip+take and slice client-side.
    // In production, implement proper cursor-based pagination.
    const variables: GetSdkCustomersQueryVariablesDto = {
      first: options.skip + options.take,
      searchFilter: options.textSearch ? {
        type: SearchFilterTypesDto.AttributeFilterDto,
        attributePaths: ['contact.firstName', 'contact.lastName', 'contact.address.cityTown', 'contact.companyName'],
        searchTerm: options.textSearch
      } : undefined
    };

    return from(this.getSdkCustomersDtoGQL.fetch({ variables })).pipe(
      map(result => {
        const allItems = (result.data?.runtime?.octoSdkDemoCustomer?.items ?? [])
          .filter((item): item is OctoSdkDemoCustomerDto => item !== null);

        // Client-side pagination slice
        const pagedItems = allItems.slice(options.skip, options.skip + options.take);

        return {
          data: pagedItems,
          totalCount: result.data?.runtime?.octoSdkDemoCustomer?.totalCount ?? 0
        };
      })
    );
  }

  onDisplayEntity(entity: OctoSdkDemoCustomerDto): string {
    return `${entity.contact?.firstName ?? ''} ${entity.contact?.lastName ?? ''} (${entity.contact?.address?.cityTown ?? ''})`;
  }

  getIdEntity(entity: OctoSdkDemoCustomerDto): string {
    return entity.rtId;
  }
}

@Component({
  selector: 'app-entity-select-demo',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonsModule,
    EntitySelectInputComponent
  ],
  template: `
    <div class="demo-container">
      <h2>Entity Select Input Demo</h2>

      <div class="demo-section">
        <h3>Octo Mesh Customer Search</h3>
        <p>Search for customers from Octo Mesh by first name, last name, or city.</p>

        <div class="form-group">
          <label>Select Customer:</label>
          <mm-entity-select-input
            [dataSource]="customerDataSource"
            placeholder="Search by first name, last name or city..."
            [minSearchLength]="2"
            [maxResults]="10"
            (entitySelected)="onCustomerSelected($event)"
            (entityCleared)="onCustomerCleared()">
          </mm-entity-select-input>

          <div class="selected-info" *ngIf="selectedCustomer">
            <strong>Selected Customer:</strong>
            <div class="customer-details">
              <p><strong>Name:</strong> {{ selectedCustomer.contact.firstName }} {{ selectedCustomer.contact.lastName }}</p>
              <p><strong>Company:</strong> {{ selectedCustomer.contact.companyName }}</p>
              <p><strong>Address:</strong> {{ selectedCustomer.contact.address.street }}, {{ selectedCustomer.contact.address.zipcode }} {{ selectedCustomer.contact.address.cityTown }}, {{ selectedCustomer.contact.address.nationalCode }}</p>
              <p class="rt-id"><strong>RT-ID:</strong> {{ selectedCustomer.rtId }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="demo-section">
        <h3>Basic Usage (Mock Data)</h3>
        <p>Start typing to search for employees by name, email, or department.</p>

        <div class="form-group">
          <label>Select Employee:</label>
          <mm-entity-select-input
            [dataSource]="entityDataSource"
            placeholder="Type to search employees..."
            [minSearchLength]="2"
            [maxResults]="10"
            (entitySelected)="onBasicEntitySelected($event)"
            (entityCleared)="onBasicEntityCleared()">
          </mm-entity-select-input>

          <div class="selected-info" *ngIf="basicSelectedEntity">
            <strong>Selected:</strong> {{ basicSelectedEntity.name }}
            <span class="email">({{ basicSelectedEntity.email }})</span>
            <span class="department">- {{ basicSelectedEntity.department }}</span>
            <span class="status" [class.active]="basicSelectedEntity.active" [class.inactive]="!basicSelectedEntity.active">
              {{ basicSelectedEntity.active ? 'Active' : 'Inactive' }}
            </span>
          </div>
        </div>
      </div>

      <div class="demo-section">
        <h3>Form Integration</h3>
        <p>Entity select integrated with Angular Reactive Forms with validation.</p>

        <form [formGroup]="demoForm" class="demo-form">
          <div class="form-group">
            <label>Employee * (Required):</label>
            <mm-entity-select-input
              [dataSource]="entityDataSource"
              placeholder="Select an employee..."
              [required]="true"
              formControlName="selectedEmployee">
            </mm-entity-select-input>

            <div class="validation-error" *ngIf="demoForm.get('selectedEmployee')?.invalid && demoForm.get('selectedEmployee')?.touched">
              <span *ngIf="demoForm.get('selectedEmployee')?.errors?.['required']">Employee selection is required</span>
              <span *ngIf="demoForm.get('selectedEmployee')?.errors?.['invalidEntity']">Please select a valid employee from the list</span>
            </div>
          </div>

          <div class="form-group">
            <label>Manager:</label>
            <mm-entity-select-input
              [dataSource]="entityDataSource"
              placeholder="Select a manager (optional)..."
              formControlName="selectedManager">
            </mm-entity-select-input>
          </div>

          <div class="form-actions">
            <button kendoButton themeColor="primary" [disabled]="demoForm.invalid" (click)="onSubmitForm()">
              Submit Form
            </button>
            <button kendoButton (click)="onResetForm()">
              Reset
            </button>
          </div>
        </form>

        <div class="form-status">
          <h4>Form Status:</h4>
          <p><strong>Valid:</strong> {{ demoForm.valid }}</p>
          <p><strong>Values:</strong></p>
          <pre>{{ getFormValues() }}</pre>
        </div>
      </div>

      <div class="demo-section">
        <h3>Disabled State</h3>
        <p>Entity select in disabled state.</p>

        <div class="form-group">
          <label>Disabled Employee Select:</label>
          <mm-entity-select-input
            [dataSource]="entityDataSource"
            placeholder="This field is disabled..."
            [disabled]="true">
          </mm-entity-select-input>
        </div>
      </div>

      <div class="demo-section">
        <h3>Prefix/Scanner Mode</h3>
        <p>Configure with a prefix for barcode/QR code scanning. Try typing "EMP001" or "EMP002".</p>

        <div class="form-group">
          <label>Employee Scanner (prefix "EMP"):</label>
          <mm-entity-select-input
            [dataSource]="scannerDataSource"
            placeholder="Scan employee code or type to search..."
            prefix="EMP"
            [minSearchLength]="1"
            (entitySelected)="onScannerEntitySelected($event)">
          </mm-entity-select-input>

          <div class="selected-info" *ngIf="scannerSelectedEntity">
            <strong>Scanned:</strong> {{ scannerSelectedEntity.name }}
            <span class="code">(Code: {{ scannerSelectedEntity.id }})</span>
          </div>
        </div>
      </div>

      <div class="demo-section">
        <h3>Customer Search with Dialog (Single Select)</h3>
        <p>Search with autocomplete or use the "Advanced Search..." link to open a dialog with a grid view.</p>

        <div class="form-group">
          <label>Select Customer (with Dialog):</label>
          <mm-entity-select-input
            [dataSource]="customerDataSource"
            [dialogDataSource]="customerDialogDataSource"
            dialogTitle="Select Customer"
            advancedSearchLabel="Advanced Search..."
            placeholder="Search by first name, last name or city..."
            [minSearchLength]="2"
            [maxResults]="10"
            (entitySelected)="onDialogCustomerSelected($event)"
            (entityCleared)="onDialogCustomerCleared()">
          </mm-entity-select-input>

          <div class="selected-info" *ngIf="dialogSelectedCustomer">
            <strong>Selected Customer:</strong>
            <div class="customer-details">
              <p><strong>Name:</strong> {{ dialogSelectedCustomer.contact.firstName }} {{ dialogSelectedCustomer.contact.lastName }}</p>
              <p><strong>Company:</strong> {{ dialogSelectedCustomer.contact.companyName }}</p>
              <p><strong>Address:</strong> {{ dialogSelectedCustomer.contact.address.street }}, {{ dialogSelectedCustomer.contact.address.zipcode }} {{ dialogSelectedCustomer.contact.address.cityTown }}, {{ dialogSelectedCustomer.contact.address.nationalCode }}</p>
              <p class="rt-id"><strong>RT-ID:</strong> {{ dialogSelectedCustomer.rtId }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="demo-section">
        <h3>Customer Search with Dialog (Multi Select)</h3>
        <p>Select multiple customers using the advanced search dialog.</p>

        <div class="form-group">
          <label>Select Multiple Customers:</label>
          <mm-entity-select-input
            [dataSource]="customerDataSource"
            [dialogDataSource]="customerDialogDataSource"
            dialogTitle="Select Customers"
            advancedSearchLabel="Select Multiple..."
            placeholder="Search or click 'Select Multiple...' for multi-select"
            [minSearchLength]="2"
            [maxResults]="10"
            [multiSelect]="true"
            (entitySelected)="onMultiDialogCustomerSelected($event)"
            (entitiesSelected)="onMultipleCustomersSelected($event)"
            (entityCleared)="onMultiDialogCustomerCleared()">
          </mm-entity-select-input>

          <div class="selected-info" *ngIf="multiSelectedCustomers.length > 0">
            <strong>Selected Customers ({{ multiSelectedCustomers.length }}):</strong>
            <div class="customer-list">
              <div *ngFor="let customer of multiSelectedCustomers" class="customer-item">
                {{ customer.contact.firstName }} {{ customer.contact.lastName }} - {{ customer.contact.companyName }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="demo-section">
        <h3>Instructions</h3>
        <ul>
          <li><strong>Search:</strong> Type at least 2 characters to start searching</li>
          <li><strong>Selection:</strong> Click on an item from the dropdown to select it</li>
          <li><strong>Clear:</strong> Click the X button to clear the selection</li>
          <li><strong>Auto-select:</strong> If there's only one match when you leave the field, it will be auto-selected</li>
          <li><strong>Prefix Mode:</strong> Type a prefix (like "EMP001") for direct selection or barcode scanning</li>
          <li><strong>Validation:</strong> The component supports Angular form validation</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .demo-container {
      padding: 20px;
      max-width: 1000px;
    }

    .demo-section {
      margin-bottom: 40px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      background: #fafafa;
    }

    .demo-section h3 {
      margin-top: 0;
      color: var(--kendo-color-primary, #ff6358);
      border-bottom: 2px solid var(--kendo-color-primary, #ff6358);
      padding-bottom: 8px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      color: #333;
    }

    .selected-info {
      margin-top: 12px;
      padding: 12px;
      background: #e8f5e8;
      border: 1px solid #4caf50;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
    }

    .email {
      color: #666;
      font-style: italic;
    }

    .department {
      color: #1976d2;
      font-weight: 500;
    }

    .code {
      color: #9c27b0;
      font-weight: bold;
    }

    .customer-details {
      margin-top: 8px;
    }

    .customer-details p {
      margin: 4px 0;
    }

    .rt-id {
      font-size: 12px;
      color: #666;
      font-family: monospace;
    }

    .customer-list {
      margin-top: 8px;
    }

    .customer-item {
      padding: 4px 0;
      border-bottom: 1px solid #ddd;
    }

    .customer-item:last-child {
      border-bottom: none;
    }

    .status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      margin-left: 8px;
    }

    .status.active {
      background: #4caf50;
      color: white;
    }

    .status.inactive {
      background: #f44336;
      color: white;
    }

    .demo-form {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      margin-top: 20px;
    }

    .validation-error {
      margin-top: 6px;
      color: #f44336;
      font-size: 14px;
    }

    .form-status {
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 16px;
    }

    .form-status h4 {
      margin-top: 0;
      color: #333;
    }

    .form-status pre {
      background: #f8f8f8;
      padding: 12px;
      border-radius: 4px;
      border: 1px solid #ddd;
      font-size: 12px;
      overflow-x: auto;
    }

    ul {
      list-style-type: disc;
      margin-left: 20px;
    }

    ul li {
      margin-bottom: 8px;
      line-height: 1.5;
    }
  `]
})
export class EntitySelectDemoComponent implements OnInit {
  // Injected services
  private fb = inject(FormBuilder);
  private getSdkCustomersDtoGQL = inject(GetSdkCustomersDtoGQL);

  // Data sources
  public entityDataSource = new MockEntityDataSource();
  public scannerDataSource = new MockEntityDataSource();
  public customerDataSource: CustomerEntityDataSource;
  public customerDialogDataSource: CustomerDialogDataSource;

  // Octo Mesh Customer selection
  public selectedCustomer: OctoSdkDemoCustomerDto | null = null;

  // Basic usage
  public basicSelectedEntity: MockEntity | null = null;

  // Scanner usage
  public scannerSelectedEntity: MockEntity | null = null;

  // Dialog selection
  public dialogSelectedCustomer: OctoSdkDemoCustomerDto | null = null;
  public multiSelectedCustomers: OctoSdkDemoCustomerDto[] = [];

  // Form
  public demoForm: FormGroup;

  constructor() {
    // Initialize Customer data sources with injected GraphQL service
    this.customerDataSource = new CustomerEntityDataSource(this.getSdkCustomersDtoGQL);
    this.customerDialogDataSource = new CustomerDialogDataSource(this.getSdkCustomersDtoGQL);

    this.demoForm = this.fb.group({
      selectedEmployee: [null, Validators.required],
      selectedManager: [null]
    });
  }

  ngOnInit(): void {
    // Set up scanner data source to handle employee codes
    this.setupScannerDataSource();
  }

  // Event handlers - Octo Mesh Customer
  public onCustomerSelected(entity: OctoSdkDemoCustomerDto): void {
    this.selectedCustomer = entity;
    console.log('Customer selected:', entity);
  }

  public onCustomerCleared(): void {
    this.selectedCustomer = null;
    console.log('Customer cleared');
  }

  // Event handlers - Mock Data
  public onBasicEntitySelected(entity: MockEntity): void {
    this.basicSelectedEntity = entity;
    console.log('Basic entity selected:', entity);
  }

  public onBasicEntityCleared(): void {
    this.basicSelectedEntity = null;
    console.log('Basic entity cleared');
  }

  public onScannerEntitySelected(entity: MockEntity): void {
    this.scannerSelectedEntity = entity;
    console.log('Scanner entity selected:', entity);
  }

  // Event handlers - Dialog Customer Selection (Single)
  public onDialogCustomerSelected(entity: OctoSdkDemoCustomerDto): void {
    this.dialogSelectedCustomer = entity;
    console.log('Dialog customer selected:', entity);
  }

  public onDialogCustomerCleared(): void {
    this.dialogSelectedCustomer = null;
    console.log('Dialog customer cleared');
  }

  // Event handlers - Dialog Customer Selection (Multi)
  public onMultiDialogCustomerSelected(entity: OctoSdkDemoCustomerDto): void {
    // Single selection from autocomplete in multi-select mode
    this.multiSelectedCustomers = [entity];
    console.log('Multi-dialog single customer selected:', entity);
  }

  public onMultipleCustomersSelected(entities: OctoSdkDemoCustomerDto[]): void {
    this.multiSelectedCustomers = entities;
    console.log('Multiple customers selected:', entities);
  }

  public onMultiDialogCustomerCleared(): void {
    this.multiSelectedCustomers = [];
    console.log('Multi-dialog customer cleared');
  }

  public onSubmitForm(): void {
    if (this.demoForm.valid) {
      console.log('Form submitted:', this.demoForm.value);
      alert('Form submitted successfully! Check console for values.');
    } else {
      console.log('Form is invalid:', this.demoForm.errors);
      this.demoForm.markAllAsTouched();
    }
  }

  public onResetForm(): void {
    this.demoForm.reset();
  }

  public getFormValues(): string {
    const values = {
      selectedEmployee: this.demoForm.value.selectedEmployee ? {
        id: this.demoForm.value.selectedEmployee.id,
        name: this.demoForm.value.selectedEmployee.name,
        department: this.demoForm.value.selectedEmployee.department
      } : null,
      selectedManager: this.demoForm.value.selectedManager ? {
        id: this.demoForm.value.selectedManager.id,
        name: this.demoForm.value.selectedManager.name,
        department: this.demoForm.value.selectedManager.department
      } : null
    };
    return JSON.stringify(values, null, 2);
  }

  // Private methods
  private setupScannerDataSource(): void {
    // Override the filter method to handle employee codes
    const originalFilter = this.scannerDataSource.onFilter.bind(this.scannerDataSource);

    this.scannerDataSource.onFilter = async (filter: string, take = 50): Promise<EntitySelectResult<MockEntity>> => {
      // Check if it's a direct employee code lookup (EMP001, EMP002, etc.)
      const codeMatch = filter.match(/^(\d+)$/);
      if (codeMatch) {
        const empId = codeMatch[1];
        const entity = MOCK_ENTITIES.find(e => e.id === empId);
        if (entity) {
          return {
            totalCount: 1,
            items: [entity]
          };
        }
      }

      // Fall back to normal text search
      return originalFilter(filter, take);
    };
  }
}
