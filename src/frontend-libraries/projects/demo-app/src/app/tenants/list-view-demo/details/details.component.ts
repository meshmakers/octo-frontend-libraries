import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BaseFormComponent, BaseFormConfig, ResponsiveFormBreakPoint, HasUnsavedChanges } from '@meshmakers/shared-ui';
import { KENDO_FORM } from '@progress/kendo-angular-inputs';
import { KENDO_LABELS } from '@progress/kendo-angular-label';
import { KENDO_DROPDOWNS } from '@progress/kendo-angular-dropdowns';
import { TextBoxModule } from '@progress/kendo-angular-inputs';
import { firstValueFrom } from 'rxjs';
import { GetSdkCustomerDetailsDtoGQL } from '../../../graphQL/getSdkCustomerDetails';
import { CreateSdkDemoCustomerDtoGQL } from '../../../graphQL/createSdkDemoCustomer';
import { UpdateSdkDemoCustomerDtoGQL } from '../../../graphQL/updateSdkDemoCustomer';
import {OctoSdkDemoCustomerStatusDto, BasicLegalEntityTypeDto} from '@meshmakers/octo-services';

@Component({
  selector: 'app-list-view-details',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BaseFormComponent,
    KENDO_FORM,
    KENDO_LABELS,
    KENDO_DROPDOWNS,
    TextBoxModule
  ],
  templateUrl: './details.component.html',
  styleUrl: './details.component.scss'
})
export class ListViewDetailsComponent implements OnInit, HasUnsavedChanges {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly getCustomerDetailsGQL = inject(GetSdkCustomerDetailsDtoGQL);
  private readonly createCustomerGQL = inject(CreateSdkDemoCustomerDtoGQL);
  private readonly updateCustomerGQL = inject(UpdateSdkDemoCustomerDtoGQL);

  // Form
  public customerForm!: FormGroup;

  // Config
  public formConfig: BaseFormConfig = {
    showCard: true,
    cardWidth: '800px',
    isLoading: false,
    isSaving: false
  };

  // Responsive column span
  public responsiveColSpan: ResponsiveFormBreakPoint[] = [
    { maxWidth: 768, value: 2 }
  ];

  // Dropdown data
  public countries: string[] = [
    'AT', 'DE', 'CH', 'US', 'UK', 'FR', 'IT', 'ES', 'NL', 'BE'
  ];

  public customerStatuses: { value: OctoSdkDemoCustomerStatusDto; text: string }[] = [
    { value: OctoSdkDemoCustomerStatusDto.ActiveDto, text: 'Active' },
    { value: OctoSdkDemoCustomerStatusDto.PendingDto, text: 'Pending' },
    { value: OctoSdkDemoCustomerStatusDto.SuspendedDto, text: 'Suspended' }
  ];

  public legalEntityTypes: { value: BasicLegalEntityTypeDto; text: string }[] = [
    { value: BasicLegalEntityTypeDto.NaturalPersonDto, text: 'Natural Person' },
    { value: BasicLegalEntityTypeDto.CompanyDto, text: 'Company' },
    { value: BasicLegalEntityTypeDto.LegalPersonDto, text: 'Legal Person' },
    { value: BasicLegalEntityTypeDto.LocalAuthorityDto, text: 'Local Authority' }
  ];

  // Mode
  public isEditMode = false;
  public isViewMode = false;
  public customerId: string | null = null;

  constructor() {
    this.initForm();
  }

  async ngOnInit(): Promise<void> {
    this.customerId = this.route.snapshot.paramMap.get('id');
    this.isViewMode = this.route.snapshot.data['isViewMode'] === true;
    this.isEditMode = !this.isViewMode && !!this.customerId && this.customerId !== 'new';

    this.updateFormConfig();

    if ((this.isEditMode || this.isViewMode) && this.customerId) {
      await this.loadCustomer(this.customerId);
    }

    if (this.isViewMode) {
      this.customerForm.disable();
    }
  }

  private initForm(): void {
    this.customerForm = this.fb.group({
      customerStatus: [OctoSdkDemoCustomerStatusDto.ActiveDto, Validators.required],
      legalEntityType: [BasicLegalEntityTypeDto.NaturalPersonDto, Validators.required],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      companyName: [''],
      street: [''],
      postalCode: [''],
      city: [''],
      country: ['']
    });
  }

  private updateFormConfig(): void {
    let title = 'New Customer';
    if (this.isViewMode) {
      title = 'View Customer';
    } else if (this.isEditMode) {
      title = 'Edit Customer';
    }

    this.formConfig = {
      ...this.formConfig,
      title,
      isEditMode: this.isEditMode,
      isViewMode: this.isViewMode
    };
  }

  private async loadCustomer(id: string): Promise<void> {
    this.formConfig = { ...this.formConfig, isLoading: true };

    try {
      const result = await firstValueFrom(
        this.getCustomerDetailsGQL.fetch({ variables: { rtId: id } })
      );

      const customer = result.data?.runtime?.octoSdkDemoCustomer?.items?.[0];

      if (customer) {
        this.customerForm.patchValue({
          customerStatus: customer.customerStatus,
          legalEntityType: customer.contact.legalEntityType,
          firstName: customer.contact.firstName,
          lastName: customer.contact.lastName,
          companyName: customer.contact.companyName ?? '',
          street: customer.contact.address?.street,
          postalCode: customer.contact.address?.zipcode,
          city: customer.contact.address?.cityTown,
          country: customer.contact.address?.nationalCode
        });
      } else {
        console.warn('Customer not found:', id);
      }
    } catch (error) {
      console.error('Error loading customer:', error);
    } finally {
      this.formConfig = { ...this.formConfig, isLoading: false };
    }
  }

  public async onSave(): Promise<void> {
    if (!this.customerForm.valid) {
      this.customerForm.markAllAsTouched();
      return;
    }

    this.formConfig = { ...this.formConfig, isSaving: true };

    try {
      const formValue = this.customerForm.value;

      if (this.isEditMode && this.customerId) {
        // Update existing customer
        await firstValueFrom(
          this.updateCustomerGQL.mutate({
            variables: {
              entities: [{
                rtId: this.customerId,
                item: {
                  customerStatus: formValue.customerStatus,
                  contact : {
                    legalEntityType: formValue.legalEntityType,
                    firstName: formValue.firstName,
                    lastName: formValue.lastName,
                    companyName: formValue.companyName || null,
                    address: {
                      street: formValue.street,
                      zipcode: parseInt(formValue.postalCode),
                      cityTown: formValue.city,
                      nationalCode: formValue.country
                    }
                  }
                }
              }]
            }
          })
        );
      } else {
        // Create new customer
        await firstValueFrom(
          this.createCustomerGQL.mutate({
            variables: {
              entities: [{
                customerStatus: formValue.customerStatus,
                contact : {
                  legalEntityType: formValue.legalEntityType,
                  firstName: formValue.firstName,
                  lastName: formValue.lastName,
                  companyName: formValue.companyName || null,
                  address: {
                    street: formValue.street,
                    zipcode: parseInt(formValue.postalCode),
                    cityTown: formValue.city,
                    nationalCode: formValue.country
                  }
                }
              }]
            }
          })
        );
      }

      // Navigate back to list after successful save
      await this.navigateToList();
    } catch (error) {
      console.error('Error saving customer:', error);
    } finally {
      this.formConfig = { ...this.formConfig, isSaving: false };
    }
  }

  public async onCancel(): Promise<void> {
    await this.navigateToList();
  }

  private async navigateToList(): Promise<void> {
    // Navigate back to list-view
    const currentUrl = this.router.url;
    const listPath = currentUrl.replace(/\/list-view\/(details|view)\/[^/]+.*$/, '/list-view');
    await this.router.navigateByUrl(listPath);
  }

  // === HasUnsavedChanges interface implementation ===

  hasUnsavedChanges(): boolean {
    return this.customerForm?.dirty ?? false;
  }

  async saveChanges(): Promise<boolean> {
    try {
      await this.onSave();
      return true;
    } catch {
      return false;
    }
  }
}
