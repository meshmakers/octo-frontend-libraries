import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BaseFormComponent, BaseFormConfig, ResponsiveFormBreakPoint } from '@meshmakers/shared-ui';
import { KENDO_FORM } from '@progress/kendo-angular-inputs';
import { KENDO_LABELS } from '@progress/kendo-angular-label';
import { KENDO_DROPDOWNS } from '@progress/kendo-angular-dropdowns';
import { KENDO_DATEINPUTS } from '@progress/kendo-angular-dateinputs';
import { KENDO_BUTTONS } from '@progress/kendo-angular-buttons';
import { TextBoxModule } from '@progress/kendo-angular-inputs';

@Component({
  selector: 'app-form-demo',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BaseFormComponent,
    KENDO_FORM,
    KENDO_LABELS,
    KENDO_DROPDOWNS,
    KENDO_DATEINPUTS,
    KENDO_BUTTONS,
    TextBoxModule
  ],
  template: `
    <div class="demo-container">
      <h2>Base Form Demo</h2>
      <p>Demonstrating the mm-base-form component with Kendo UI Form integration.</p>

      <!-- Demo 1: Basic Form with Card -->
      <div class="demo-section">
        <h3>1. Basic Form (with Card)</h3>
        <p>A simple customer form using mm-base-form with card wrapper and kendoForm grid layout.</p>

        <mm-base-form
          [form]="customerForm"
          [config]="basicFormConfig"
          (saveForm)="onSaveCustomer()"
          (cancelForm)="onCancel()">

          <form kendoForm [formGroup]="customerForm" [cols]="2">
            <fieldset kendoFormFieldSet legend="Personal Information" [colSpan]="2">
              <kendo-formfield [colSpan]="responsiveColSpan">
                <kendo-label text="First Name"></kendo-label>
                <kendo-textbox formControlName="firstName" placeholder="Enter first name"></kendo-textbox>
                <kendo-formerror>First name is required</kendo-formerror>
              </kendo-formfield>

              <kendo-formfield [colSpan]="responsiveColSpan">
                <kendo-label text="Last Name"></kendo-label>
                <kendo-textbox formControlName="lastName" placeholder="Enter last name"></kendo-textbox>
                <kendo-formerror>Last name is required</kendo-formerror>
              </kendo-formfield>

              <kendo-formfield [colSpan]="responsiveColSpan">
                <kendo-label text="Email"></kendo-label>
                <kendo-textbox formControlName="email" placeholder="your@email.com"></kendo-textbox>
                @if (customerForm.controls['email'].errors?.['required']) {
                  <kendo-formerror>Email is required</kendo-formerror>
                }
                @if (customerForm.controls['email'].errors?.['email']) {
                  <kendo-formerror>Invalid email format</kendo-formerror>
                }
              </kendo-formfield>

              <kendo-formfield [colSpan]="responsiveColSpan">
                <kendo-label text="Phone" [optional]="true"></kendo-label>
                <kendo-textbox formControlName="phone" placeholder="+1 (555) 000-0000"></kendo-textbox>
                <kendo-formhint>Optional contact number</kendo-formhint>
              </kendo-formfield>
            </fieldset>

            <fieldset kendoFormFieldSet legend="Address" [colSpan]="2">
              <kendo-formfield [colSpan]="2">
                <kendo-label text="Street"></kendo-label>
                <kendo-textbox formControlName="street" placeholder="Street address"></kendo-textbox>
              </kendo-formfield>

              <kendo-formfield [colSpan]="responsiveColSpan">
                <kendo-label text="City"></kendo-label>
                <kendo-textbox formControlName="city" placeholder="City"></kendo-textbox>
              </kendo-formfield>

              <kendo-formfield [colSpan]="responsiveColSpan">
                <kendo-label text="Country"></kendo-label>
                <kendo-dropdownlist
                  formControlName="country"
                  [data]="countries"
                  [defaultItem]="'Select country...'">
                </kendo-dropdownlist>
              </kendo-formfield>
            </fieldset>

            <fieldset kendoFormFieldSet legend="Preferences" [colSpan]="2">
              <kendo-formfield [colSpan]="responsiveColSpan">
                <kendo-label text="Birth Date" [optional]="true"></kendo-label>
                <kendo-datepicker formControlName="birthDate"></kendo-datepicker>
              </kendo-formfield>

              <kendo-formfield [colSpan]="responsiveColSpan">
                <kendo-label text="Interests" [optional]="true"></kendo-label>
                <kendo-multiselect
                  formControlName="interests"
                  [data]="interestOptions"
                  placeholder="Select interests...">
                </kendo-multiselect>
              </kendo-formfield>
            </fieldset>
          </form>

        </mm-base-form>

        <div class="form-output" *ngIf="lastSubmittedData">
          <h4>Last Submitted Data:</h4>
          <pre>{{ lastSubmittedData | json }}</pre>
        </div>
      </div>

      <!-- Demo 2: View Mode -->
      <div class="demo-section">
        <h3>2. View Mode (Read-only)</h3>
        <p>Form in view mode - no save button, cancel becomes "Back".</p>

        <mm-base-form
          [form]="viewForm"
          [config]="viewFormConfig"
          (cancelForm)="onBack()">

          <form kendoForm [formGroup]="viewForm" [cols]="2">
            <kendo-formfield [colSpan]="responsiveColSpan">
              <kendo-label text="Customer Name"></kendo-label>
              <kendo-textbox formControlName="customerName" [readonly]="true"></kendo-textbox>
            </kendo-formfield>

            <kendo-formfield [colSpan]="responsiveColSpan">
              <kendo-label text="Email"></kendo-label>
              <kendo-textbox formControlName="email" [readonly]="true"></kendo-textbox>
            </kendo-formfield>

            <kendo-formfield [colSpan]="responsiveColSpan">
              <kendo-label text="Status"></kendo-label>
              <kendo-textbox formControlName="status" [readonly]="true"></kendo-textbox>
            </kendo-formfield>
          </form>

        </mm-base-form>
      </div>

      <!-- Demo 3: Loading State -->
      <div class="demo-section">
        <h3>3. Loading State</h3>
        <p>Form with loading overlay.</p>

        <div class="button-row">
          <button kendoButton (click)="toggleLoading()">
            {{ loadingFormConfig.isLoading ? 'Stop Loading' : 'Start Loading' }}
          </button>
        </div>

        <mm-base-form
          [form]="loadingForm"
          [config]="loadingFormConfig"
          (saveForm)="onSaveLoading()"
          (cancelForm)="onCancel()">

          <form kendoForm [formGroup]="loadingForm" [cols]="1">
            <kendo-formfield [colSpan]="2">
              <kendo-label text="Name"></kendo-label>
              <kendo-textbox formControlName="name" placeholder="Enter name"></kendo-textbox>
            </kendo-formfield>
          </form>

        </mm-base-form>
      </div>

      <!-- Demo 4: Without Card -->
      <div class="demo-section">
        <h3>4. Without Card Wrapper</h3>
        <p>Form without the card wrapper, useful for embedded forms.</p>

        <mm-base-form
          [form]="simpleForm"
          [config]="noCardFormConfig"
          (saveForm)="onSaveSimple()"
          (cancelForm)="onCancel()">

          <form kendoForm [formGroup]="simpleForm" [cols]="2">
            <kendo-formfield [colSpan]="responsiveColSpan">
              <kendo-label text="Username"></kendo-label>
              <kendo-textbox formControlName="username" placeholder="Enter username"></kendo-textbox>
              <kendo-formerror>Username is required</kendo-formerror>
            </kendo-formfield>

            <kendo-formfield [colSpan]="responsiveColSpan">
              <kendo-label text="Department"></kendo-label>
              <kendo-dropdownlist
                formControlName="department"
                [data]="departments"
                [defaultItem]="'Select department...'">
              </kendo-dropdownlist>
            </kendo-formfield>
          </form>

        </mm-base-form>
      </div>

      <!-- Instructions -->
      <div class="demo-section">
        <h3>Instructions</h3>
        <ul>
          <li><strong>mm-base-form:</strong> Wrapper component providing card layout, buttons, and loading state</li>
          <li><strong>form kendoForm:</strong> User provides the form element with kendoForm directive and formGroup</li>
          <li><strong>kendoFormFieldSet:</strong> Groups related fields with a legend</li>
          <li><strong>kendo-formfield:</strong> Wraps label, input, hints, and errors</li>
          <li><strong>colSpan:</strong> Controls how many columns a field spans (supports responsive breakpoints)</li>
          <li><strong>Config options:</strong> title, showCard, isViewMode, isLoading, cols, orientation</li>
        </ul>

        <h4>Usage Pattern:</h4>
        <pre class="code-example">
&lt;mm-base-form [form]="myForm" [config]="config"
              (saveForm)="onSave()" (cancelForm)="onCancel()"&gt;

  &lt;form kendoForm [formGroup]="myForm" [cols]="2"&gt;
    &lt;kendo-formfield&gt;
      &lt;kendo-label text="Field"&gt;&lt;/kendo-label&gt;
      &lt;kendo-textbox formControlName="field"&gt;&lt;/kendo-textbox&gt;
      &lt;kendo-formerror&gt;Error&lt;/kendo-formerror&gt;
    &lt;/kendo-formfield&gt;
  &lt;/form&gt;

&lt;/mm-base-form&gt;</pre>
      </div>
    </div>
  `,
  styles: [`
    .demo-container {
      padding: 20px;
      max-width: 1200px;
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

    .form-output {
      margin-top: 20px;
      padding: 16px;
      background: #e8f5e8;
      border: 1px solid #4caf50;
      border-radius: 4px;

      h4 {
        margin-top: 0;
        color: #2e7d32;
      }

      pre {
        background: #fff;
        padding: 12px;
        border-radius: 4px;
        overflow-x: auto;
        font-size: 12px;
      }
    }

    .button-row {
      margin-bottom: 16px;
    }

    .status-indicator {
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;

      &.success {
        background: #e8f5e9;
        color: #2e7d32;
      }
    }

    .code-example {
      background: #263238;
      color: #aed581;
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 13px;
      line-height: 1.5;
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
export class FormDemoComponent {
  private fb = inject(FormBuilder);

  // Responsive column span - full width on mobile
  public responsiveColSpan: ResponsiveFormBreakPoint[] = [
    { maxWidth: 768, value: 2 }
  ];

  // Countries dropdown data
  public countries: string[] = ['Austria', 'Germany', 'Switzerland', 'USA', 'UK', 'France', 'Italy'];
  public departments: string[] = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations'];
  public interestOptions: string[] = ['Technology', 'Sports', 'Music', 'Travel', 'Reading', 'Gaming'];

  // Form configs
  public basicFormConfig: BaseFormConfig = {
    title: 'New Customer',
    showCard: true,
    cardWidth: '900px'
  };

  public viewFormConfig: BaseFormConfig = {
    title: 'Customer Details',
    showCard: true,
    cardWidth: '600px',
    isViewMode: true
  };

  public loadingFormConfig: BaseFormConfig = {
    title: 'Loading Demo',
    showCard: true,
    cardWidth: '500px',
    isLoading: false
  };

  public noCardFormConfig: BaseFormConfig = {
    title: 'Quick Entry',
    showCard: false
  };

  // Forms
  public customerForm: FormGroup;
  public viewForm: FormGroup;
  public loadingForm: FormGroup;
  public simpleForm: FormGroup;

  // State
  public lastSubmittedData: unknown = null;

  constructor() {
    this.customerForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      street: [''],
      city: [''],
      country: [''],
      birthDate: [null],
      interests: [[]]
    });

    this.viewForm = this.fb.group({
      customerName: ['John Doe'],
      email: ['john.doe@example.com'],
      status: ['Active']
    });

    this.loadingForm = this.fb.group({
      name: ['']
    });

    this.simpleForm = this.fb.group({
      username: ['', Validators.required],
      department: ['']
    });
  }

  public onSaveCustomer(): void {
    if (this.customerForm.valid) {
      this.lastSubmittedData = this.customerForm.value;
      console.log('Customer saved:', this.customerForm.value);
      alert('Customer saved successfully!');
    }
  }

  public onSaveLoading(): void {
    console.log('Loading form saved');
  }

  public onSaveSimple(): void {
    if (this.simpleForm.valid) {
      console.log('Simple form saved:', this.simpleForm.value);
      alert('Form saved!');
    }
  }

  public onCancel(): void {
    console.log('Form cancelled');
  }

  public onBack(): void {
    console.log('Going back');
  }

  public toggleLoading(): void {
    this.loadingFormConfig = {
      ...this.loadingFormConfig,
      isLoading: !this.loadingFormConfig.isLoading
    };
  }
}
