import { Component, inject } from '@angular/core';
import { EntitySelectDataSource } from '@meshmakers/shared-services';
import { GetSdkCustomersDtoGQL, OctoSdkDemoCustomerDto } from '../graphQL/get-sdk-customers';
import { CustomerEntitySelectDataSource } from '../services/customer-entity-select-data-source';

@Component({
  selector: 'app-entity-select-demo',
  standalone: false,
  templateUrl: './entity-select-demo.component.html',
  styleUrls: ['./entity-select-demo.component.scss']
})
export class EntitySelectDemoComponent {
  private getSdkCustomersDtoGQL = inject(GetSdkCustomersDtoGQL);

  customerDataSource: EntitySelectDataSource<OctoSdkDemoCustomerDto>;
  selectedCustomer: OctoSdkDemoCustomerDto | null = null;

  constructor() {
    this.customerDataSource = new CustomerEntitySelectDataSource(this.getSdkCustomersDtoGQL);
  }

  onCustomerSelected(customer: OctoSdkDemoCustomerDto | null): void {
    this.selectedCustomer = customer?.contact ? customer : null;
  }

  clearSelection(): void {
    this.selectedCustomer = null;
  }
}
