import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { KENDO_DROPDOWNS } from '@progress/kendo-angular-dropdowns';
import { KENDO_LABELS } from '@progress/kendo-angular-label';
import { KENDO_INPUTS } from '@progress/kendo-angular-inputs';
import { GetSdkCustomersDtoGQL, GetSdkCustomersQueryVariablesDto } from '../../../graphQL/getSdkCustomers';
import { OctoSdkDemoCustomerDto, SearchFilterTypesDto } from '../../../graphQL/globalTypes';
import { firstValueFrom } from 'rxjs';

// Mock entity interface
interface Employee {
  id: number;
  name: string;
  email: string;
  department: string;
  active: boolean;
}

// Sample mock data
const MOCK_EMPLOYEES: Employee[] = [
  { id: 1, name: 'John Doe', email: 'john.doe@company.com', department: 'Engineering', active: true },
  { id: 2, name: 'Jane Smith', email: 'jane.smith@company.com', department: 'Marketing', active: true },
  { id: 3, name: 'Bob Johnson', email: 'bob.johnson@company.com', department: 'Sales', active: false },
  { id: 4, name: 'Alice Williams', email: 'alice.williams@company.com', department: 'Engineering', active: true },
  { id: 5, name: 'Charlie Brown', email: 'charlie.brown@company.com', department: 'HR', active: true },
  { id: 6, name: 'Diana Prince', email: 'diana.prince@company.com', department: 'Legal', active: true },
  { id: 7, name: 'Frank Miller', email: 'frank.miller@company.com', department: 'Finance', active: true },
  { id: 8, name: 'Grace Lee', email: 'grace.lee@company.com', department: 'Engineering', active: true },
  { id: 9, name: 'Henry Ford', email: 'henry.ford@company.com', department: 'Operations', active: false },
  { id: 10, name: 'Ivy Chen', email: 'ivy.chen@company.com', department: 'Design', active: true },
  { id: 11, name: 'Jack Wilson', email: 'jack.wilson@company.com', department: 'Engineering', active: true },
  { id: 12, name: 'Kate Anderson', email: 'kate.anderson@company.com', department: 'Marketing', active: true },
  { id: 13, name: 'Liam O\'Connor', email: 'liam.oconnor@company.com', department: 'Sales', active: true },
  { id: 14, name: 'Mia Rodriguez', email: 'mia.rodriguez@company.com', department: 'Support', active: true },
  { id: 15, name: 'Noah Davis', email: 'noah.davis@company.com', department: 'Engineering', active: true }
];

// Sports list for basic demo
const SPORTS: string[] = [
  'Baseball',
  'Basketball',
  'Cricket',
  'Field Hockey',
  'Football',
  'Golf',
  'Rugby',
  'Soccer',
  'Swimming',
  'Table Tennis',
  'Tennis',
  'Volleyball'
];

// Grouped data for grouping demo
const GROUPED_EMPLOYEES = MOCK_EMPLOYEES.map(emp => ({
  ...emp,
  departmentGroup: emp.department
}));

@Component({
  selector: 'app-multiselect-demo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonsModule,
    KENDO_DROPDOWNS,
    KENDO_LABELS,
    KENDO_INPUTS
  ],
  template: `
    <div class="demo-container">
      <h2>Kendo MultiSelect Demo</h2>

      <!-- Basic Usage -->
      <div class="demo-section">
        <h3>Basic Usage (String Array)</h3>
        <p>Simple MultiSelect with a string array. Select your favorite sports.</p>

        <div class="form-group">
          <kendo-label text="Favorite Sports:">
            <kendo-multiselect
              [data]="sports"
              [(ngModel)]="selectedSports"
              placeholder="Select sports..."
              (valueChange)="onSportsChange($event)">
            </kendo-multiselect>
          </kendo-label>

          <div class="selected-info" *ngIf="selectedSports.length > 0">
            <strong>Selected ({{ selectedSports.length }}):</strong> {{ selectedSports.join(', ') }}
          </div>
        </div>
      </div>

      <!-- Object Binding -->
      <div class="demo-section">
        <h3>Object Binding</h3>
        <p>MultiSelect with complex objects using valueField and textField.</p>

        <div class="form-group">
          <kendo-label text="Select Employees:">
            <kendo-multiselect
              [data]="employees"
              [(ngModel)]="selectedEmployees"
              textField="name"
              valueField="id"
              placeholder="Select employees..."
              [filterable]="true"
              (filterChange)="onEmployeeFilter($event)"
              (valueChange)="onEmployeesChange($event)">
            </kendo-multiselect>
          </kendo-label>

          <div class="selected-info" *ngIf="selectedEmployees.length > 0">
            <strong>Selected Employees ({{ selectedEmployees.length }}):</strong>
            <div class="employee-list">
              <div *ngFor="let emp of selectedEmployees" class="employee-item">
                {{ emp.name }} - {{ emp.department }}
                <span class="status" [class.active]="emp.active" [class.inactive]="!emp.active">
                  {{ emp.active ? 'Active' : 'Inactive' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Octo Mesh Customer Search -->
      <div class="demo-section">
        <h3>Octo Mesh Customer Search</h3>
        <p>Server-side filtering with GraphQL integration. Type to search customers.</p>

        <div class="form-group">
          <kendo-label text="Select Customers:">
            <kendo-multiselect
              [data]="filteredCustomers"
              [(ngModel)]="selectedCustomers"
              textField="displayName"
              valueField="rtId"
              placeholder="Search by name or city..."
              [filterable]="true"
              [loading]="customersLoading"
              (filterChange)="onCustomerFilter($event)"
              (valueChange)="onCustomersChange($event)">
            </kendo-multiselect>
          </kendo-label>

          <div class="selected-info" *ngIf="selectedCustomers.length > 0">
            <strong>Selected Customers ({{ selectedCustomers.length }}):</strong>
            <div class="customer-list">
              <div *ngFor="let customer of selectedCustomers" class="customer-item">
                <div><strong>{{ customer.contact.firstName }} {{ customer.contact.lastName }}</strong></div>
                <div class="customer-detail">{{ customer.contact.companyName }} - {{ customer.contact.address?.cityTown }}, {{ customer.contact.address?.nationalCode }}</div>
                <div class="rt-id">RT-ID: {{ customer.rtId }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Form Integration -->
      <div class="demo-section">
        <h3>Form Integration</h3>
        <p>MultiSelect integrated with Angular Reactive Forms with validation.</p>

        <form [formGroup]="demoForm" class="demo-form">
          <div class="form-group">
            <kendo-label text="Team Members * (Required):">
              <kendo-multiselect
                [data]="employees"
                formControlName="teamMembers"
                textField="name"
                valueField="id"
                placeholder="Select team members..."
                [filterable]="true"
                (filterChange)="onEmployeeFilter($event)">
              </kendo-multiselect>
            </kendo-label>

            <div class="validation-error" *ngIf="demoForm.get('teamMembers')?.invalid && demoForm.get('teamMembers')?.touched">
              <span *ngIf="demoForm.get('teamMembers')?.errors?.['required']">At least one team member is required</span>
            </div>
          </div>

          <div class="form-group">
            <kendo-label text="Skills:">
              <kendo-multiselect
                [data]="skills"
                formControlName="skills"
                placeholder="Select skills (optional)..."
                [allowCustom]="true">
              </kendo-multiselect>
            </kendo-label>
            <kendo-formhint>You can add custom skills not in the list</kendo-formhint>
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

      <!-- Disabled State -->
      <div class="demo-section">
        <h3>Disabled State</h3>
        <p>MultiSelect in disabled state with pre-selected values.</p>

        <div class="form-group">
          <kendo-label text="Disabled MultiSelect:">
            <kendo-multiselect
              [data]="sports"
              [value]="['Tennis', 'Golf']"
              [disabled]="true"
              placeholder="This is disabled...">
            </kendo-multiselect>
          </kendo-label>
        </div>
      </div>

      <!-- Custom Item Template -->
      <div class="demo-section">
        <h3>Custom Item Template</h3>
        <p>MultiSelect with custom item and tag templates.</p>

        <div class="form-group">
          <kendo-label text="Select Employees (Custom Template):">
            <kendo-multiselect
              [data]="employees"
              [(ngModel)]="selectedEmployeesCustom"
              textField="name"
              valueField="id"
              placeholder="Select employees..."
              [filterable]="true"
              (filterChange)="onEmployeeFilter($event)">
              <ng-template kendoMultiSelectItemTemplate let-dataItem>
                <div class="custom-item">
                  <span class="custom-item-name">{{ dataItem.name }}</span>
                  <span class="custom-item-dept">{{ dataItem.department }}</span>
                  <span class="custom-item-status" [class.active]="dataItem.active">
                    {{ dataItem.active ? '●' : '○' }}
                  </span>
                </div>
              </ng-template>
              <ng-template kendoMultiSelectTagTemplate let-dataItem>
                <span class="custom-tag">
                  {{ dataItem.name.split(' ')[0] }}
                  <span class="custom-tag-dept">({{ dataItem.department.substring(0, 3) }})</span>
                </span>
              </ng-template>
            </kendo-multiselect>
          </kendo-label>
        </div>
      </div>

      <!-- Grouping -->
      <div class="demo-section">
        <h3>Grouping</h3>
        <p>MultiSelect with items grouped by department.</p>

        <div class="form-group">
          <kendo-label text="Select by Department:">
            <kendo-multiselect
              [data]="groupedEmployees"
              [(ngModel)]="selectedGroupedEmployees"
              textField="name"
              valueField="id"
              groupField="departmentGroup"
              placeholder="Select employees..."
              [filterable]="true"
              (filterChange)="onGroupedEmployeeFilter($event)">
            </kendo-multiselect>
          </kendo-label>

          <div class="selected-info" *ngIf="selectedGroupedEmployees.length > 0">
            <strong>Selected ({{ selectedGroupedEmployees.length }}):</strong>
            {{ getGroupedEmployeeNames() }}
          </div>
        </div>
      </div>

      <!-- Allow Custom -->
      <div class="demo-section">
        <h3>Allow Custom Values</h3>
        <p>MultiSelect that allows entering custom values not in the list.</p>

        <div class="form-group">
          <kendo-label text="Tags:">
            <kendo-multiselect
              [data]="availableTags"
              [(ngModel)]="selectedTags"
              placeholder="Select or enter tags..."
              [allowCustom]="true"
              (valueChange)="onTagsChange($event)">
            </kendo-multiselect>
          </kendo-label>
          <kendo-formhint>Type and press Enter to add custom tags</kendo-formhint>

          <div class="selected-info" *ngIf="selectedTags.length > 0">
            <strong>Tags:</strong>
            <span *ngFor="let tag of selectedTags; let last = last" class="tag-badge">
              {{ tag }}{{ !last ? '' : '' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Instructions -->
      <div class="demo-section">
        <h3>Instructions</h3>
        <ul>
          <li><strong>Selection:</strong> Click items to add them to the selection</li>
          <li><strong>Remove:</strong> Click the X on a tag or use backspace to remove items</li>
          <li><strong>Filter:</strong> Type to filter the dropdown list</li>
          <li><strong>Keyboard:</strong> Use arrow keys to navigate, Enter to select, Escape to close</li>
          <li><strong>Clear All:</strong> Click the clear button (X) to remove all selections</li>
          <li><strong>Custom Values:</strong> When allowCustom is enabled, type and press Enter to add new values</li>
          <li><strong>Server-side Filtering:</strong> The Octo Mesh section demonstrates async data loading</li>
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

    kendo-label {
      display: block;
      margin-bottom: 8px;
    }

    kendo-multiselect {
      width: 100%;
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

    .employee-list, .customer-list {
      margin-top: 8px;
    }

    .employee-item, .customer-item {
      padding: 8px 0;
      border-bottom: 1px solid #ddd;
    }

    .employee-item:last-child, .customer-item:last-child {
      border-bottom: none;
    }

    .customer-detail {
      font-size: 13px;
      color: #666;
    }

    .rt-id {
      font-size: 11px;
      color: #999;
      font-family: monospace;
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

    /* Custom item template styles */
    .custom-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
    }

    .custom-item-name {
      flex: 1;
      font-weight: 500;
    }

    .custom-item-dept {
      color: #666;
      font-size: 12px;
    }

    .custom-item-status {
      font-size: 10px;
      color: #ccc;
    }

    .custom-item-status.active {
      color: #4caf50;
    }

    .custom-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .custom-tag-dept {
      font-size: 10px;
      color: #666;
    }

    /* Tag badge styles */
    .tag-badge {
      display: inline-block;
      background: #1976d2;
      color: white;
      padding: 4px 10px;
      border-radius: 16px;
      margin: 4px 4px 4px 0;
      font-size: 13px;
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
export class MultiselectDemoComponent implements OnInit {
  // Injected services
  private fb = inject(FormBuilder);
  private getSdkCustomersDtoGQL = inject(GetSdkCustomersDtoGQL);

  // Basic usage data
  public sports: string[] = [...SPORTS];
  public selectedSports: string[] = ['Tennis', 'Soccer'];

  // Object binding data
  public employees: Employee[] = [...MOCK_EMPLOYEES];
  public selectedEmployees: Employee[] = [];

  // Customer data (GraphQL)
  public filteredCustomers: (OctoSdkDemoCustomerDto & { displayName: string })[] = [];
  public selectedCustomers: (OctoSdkDemoCustomerDto & { displayName: string })[] = [];
  public customersLoading = false;

  // Form data
  public demoForm: FormGroup;
  public skills: string[] = ['Angular', 'React', 'Vue', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'Java', 'C#', 'Go'];

  // Custom template data
  public selectedEmployeesCustom: Employee[] = [];

  // Grouping data
  public groupedEmployees = [...GROUPED_EMPLOYEES];
  public selectedGroupedEmployees: typeof GROUPED_EMPLOYEES = [];

  // Allow custom data
  public availableTags: string[] = ['Important', 'Urgent', 'Review', 'Documentation', 'Bug', 'Feature', 'Enhancement'];
  public selectedTags: string[] = [];

  constructor() {
    this.demoForm = this.fb.group({
      teamMembers: [[], Validators.required],
      skills: [[]]
    });
  }

  ngOnInit(): void {
    // Initial customer load
    this.loadCustomers('');
  }

  // Event handlers - Basic
  public onSportsChange(value: string[]): void {
    console.log('Sports changed:', value);
  }

  // Event handlers - Object Binding
  public onEmployeesChange(value: Employee[]): void {
    console.log('Employees changed:', value);
  }

  public onEmployeeFilter(filter: string): void {
    const lowercaseFilter = filter.toLowerCase();
    this.employees = MOCK_EMPLOYEES.filter(emp =>
      emp.name.toLowerCase().includes(lowercaseFilter) ||
      emp.department.toLowerCase().includes(lowercaseFilter)
    );
  }

  // Event handlers - Customer (GraphQL)
  public onCustomersChange(value: (OctoSdkDemoCustomerDto & { displayName: string })[]): void {
    console.log('Customers changed:', value);
  }

  public async onCustomerFilter(filter: string): Promise<void> {
    await this.loadCustomers(filter);
  }

  private async loadCustomers(filter: string): Promise<void> {
    if (filter.length < 2 && filter.length > 0) {
      return;
    }

    this.customersLoading = true;

    try {
      const variables: GetSdkCustomersQueryVariablesDto = {
        first: 50,
        searchFilter: filter ? {
          type: SearchFilterTypesDto.AttributeFilterDto,
          attributePaths: ['contact.firstName', 'contact.lastName', 'contact.address.cityTown', 'contact.companyName'],
          searchTerm: filter
        } : undefined
      };

      const result = await firstValueFrom(this.getSdkCustomersDtoGQL.fetch({ variables }));

      const items = (result.data?.runtime?.octoSdkDemoCustomer?.items ?? [])
        .filter((item): item is OctoSdkDemoCustomerDto => item !== null)
        .map(item => ({
          ...item,
          displayName: `${item.contact?.firstName ?? ''} ${item.contact?.lastName ?? ''} (${item.contact?.address?.cityTown ?? ''})`
        }));

      this.filteredCustomers = items;
    } catch (error) {
      console.error('Error loading customers:', error);
      this.filteredCustomers = [];
    } finally {
      this.customersLoading = false;
    }
  }

  // Event handlers - Grouping
  public onGroupedEmployeeFilter(filter: string): void {
    const lowercaseFilter = filter.toLowerCase();
    this.groupedEmployees = GROUPED_EMPLOYEES.filter(emp =>
      emp.name.toLowerCase().includes(lowercaseFilter) ||
      emp.department.toLowerCase().includes(lowercaseFilter)
    );
  }

  public getGroupedEmployeeNames(): string {
    return this.selectedGroupedEmployees.map(e => e.name).join(', ');
  }

  // Event handlers - Tags
  public onTagsChange(value: string[]): void {
    console.log('Tags changed:', value);
  }

  // Form methods
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
    this.demoForm.reset({ teamMembers: [], skills: [] });
  }

  public getFormValues(): string {
    const values = {
      teamMembers: this.demoForm.value.teamMembers?.map((e: Employee) => ({
        id: e.id,
        name: e.name,
        department: e.department
      })) ?? [],
      skills: this.demoForm.value.skills ?? []
    };
    return JSON.stringify(values, null, 2);
  }
}
