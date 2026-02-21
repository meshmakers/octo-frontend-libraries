import { Component } from '@angular/core';
import { CollectionViewer } from '@angular/cdk/collections';
import { FieldFilterDto, SearchFilterDto, SortDto } from "@meshmakers/octo-services";
import { AssetRepoGraphQlDataSource } from "@meshmakers/octo-ui-legacy";
import { PagedResultDto } from "@meshmakers/shared-services";
import { Observable } from "rxjs";

class TestAssetRepoGraphQlDataSource extends AssetRepoGraphQlDataSource<any, any, any> {
  private dataColumns: any[] = [];
  private delayMs: number = 0;

  constructor(messageService: any, query: any, defaultSort: any, dataColumns: any = null, delayMs: number = 0) {
    super(messageService, query, defaultSort);
    this.dataColumns = dataColumns;
    this.delayMs = delayMs;
  }

  override connect(_: CollectionViewer): Observable<any[]> {
    // return dummy data with artificial loading delay
    return new Observable<any[]>((subscriber) => {
      setTimeout(() => {
        subscriber.next(this.dataColumns);
      }, this.delayMs);
    });
  }

  override loadData(skip = 0, take = 10, searchFilter: SearchFilterDto | null = null,
                   fieldFilter: FieldFilterDto[] | null = null, sort: SortDto[] | null = null): void {
    // Start loading state
    this.onBeginLoad();

    // Simulate async loading with delay
    setTimeout(() => {
      // Create a paged result with dummy data
      const pagedResult: PagedResultDto<any> = {
        list: this.dataColumns.slice(skip, skip + take),
        totalCount: this.dataColumns.length,
        skip: skip,
        take: take,
      };

      // Complete loading state
      this.onCompleteLoad(pagedResult);
    }, this.delayMs);
  }
}

@Component({
  selector: 'app-table-demo',
  standalone: false,
  templateUrl: './table-demo.component.html',
  styleUrls: ['./table-demo.component.scss']
})
export class TableDemoComponent {
  mmOctoTableDataSource: AssetRepoGraphQlDataSource<any, any, any> = new TestAssetRepoGraphQlDataSource(null, null, null, [
    { id: 1, name: 'test1' },
    { id: 2, name: 'test2' },
    { id: 3, name: 'test3' },
    { id: 4, name: 'test4' },
    { id: 5, name: 'test5' },
    { id: 6, name: 'test6' },
    { id: 7, name: 'test7' },
    { id: 8, name: 'test8' },
    { id: 9, name: 'test9' },
    { id: 10, name: 'test10' }
  ], 2000);

  // based on this    columnNames: ['ckTypeId', 'baseType', 'isAbstract', 'isFinal'],
  //             accessPaths: {'baseType': 'baseType.ckTypeId'}
  mmOctoTableAdvancedDataSource: AssetRepoGraphQlDataSource<any, any, any> = new TestAssetRepoGraphQlDataSource(null, null, null, [
    { ckTypeId: 'test1', baseType: { ckTypeId: 'test2' }, isAbstract: true, isFinal: false }
  ], 1500);

  mmOctoTableVirtualDataSource: AssetRepoGraphQlDataSource<any, any, any> = new TestAssetRepoGraphQlDataSource(null, null, null, [
    {
      id: 1,
      companyName: 'Acme Corp',
      customerFirstName: null,
      customerLastName: null,
      status: 'ACTIVE'
    },
    {
      id: 2,
      companyName: null,
      customerFirstName: 'John',
      customerLastName: 'Doe',
      status: 'PENDING'
    },
    {
      id: 3,
      companyName: 'TechCo',
      customerFirstName: null,
      customerLastName: null,
      status: 'INACTIVE'
    },
    {
      id: 4,
      companyName: null,
      customerFirstName: 'Jane',
      customerLastName: 'Smith',
      status: 'ACTIVE'
    }
  ], 1000);
}