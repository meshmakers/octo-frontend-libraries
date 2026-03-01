import { Component, inject, OnInit } from '@angular/core';
import { AssetRepoGraphQlDataSource } from "@meshmakers/octo-services";
import { MessageService } from '@meshmakers/shared-services';
import { GetSdkCustomersDtoGQL, OctoSdkDemoCustomerDto } from '../graphQL/get-sdk-customers';
import { CustomerGraphQlDataSource } from '../services/customer-graphql-data-source';

@Component({
  selector: 'app-table-demo',
  standalone: false,
  templateUrl: './table-demo.component.html',
  styleUrls: ['./table-demo.component.scss']
})
export class TableDemoComponent implements OnInit {
  private messageService = inject(MessageService);
  private getSdkCustomersDtoGQL = inject(GetSdkCustomersDtoGQL);

  selectedRow: OctoSdkDemoCustomerDto | null = null;
  lastAction: string = '';

  customerDataSource: AssetRepoGraphQlDataSource<OctoSdkDemoCustomerDto, any, any>;

  constructor() {
    this.customerDataSource = new CustomerGraphQlDataSource(this.messageService, this.getSdkCustomersDtoGQL);
  }

  ngOnInit(): void {
    this.customerDataSource.loadData(0, 10);
  }

  onRowClicked(row: any): void {
    this.selectedRow = row;
  }

  onActionColumnClick(event: any): void {
    const entry = event.entry;
    const name = `${entry.contact?.firstName ?? ''} ${entry.contact?.lastName ?? ''}`.trim();
    this.lastAction = `${event.action} on "${name}"`;
  }
}
