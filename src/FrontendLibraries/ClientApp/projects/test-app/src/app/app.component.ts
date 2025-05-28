import { Component } from '@angular/core';
import { FileUploadService } from '@meshmakers/shared-ui';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { CollectionViewer } from '@angular/cdk/collections';
import { AssetRepoGraphQlDataSource } from '@meshmakers/octo-services';

class TestAssetRepoGraphQlDataSource extends AssetRepoGraphQlDataSource<any, any, any> {
  private dataColumns: any[] = [];

  constructor(messageService: any, query: any, defaultSort: any, dataColumns: any = null) {
    super(messageService, query, defaultSort);
    this.dataColumns = dataColumns;
  }

  override connect(_: CollectionViewer): Observable<any[]> {
    // return dummy data
    return new Observable<any[]>((subscriber) => {
      subscriber.next(this.dataColumns);
    });
  }
}

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'test-app';
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
  ]);

  // based on this    columnNames: ['ckTypeId', 'baseType', 'isAbstract', 'isFinal'],
  //             accessPaths: {'baseType': 'baseType.ckTypeId'}
  mmOctoTableAdvancedDataSource: AssetRepoGraphQlDataSource<any, any, any> = new TestAssetRepoGraphQlDataSource(null, null, null, [
    { ckTypeId: 'test1', baseType: { ckTypeId: 'test2' }, isAbstract: true, isFinal: false }
  ]);

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
      companyName: 'Tech Solutions',
      customerFirstName: null,
      customerLastName: null,
      status: 'INACTIVE'
    }
  ]);

  constructor(private fileUploadService: FileUploadService, private readonly httpClient: HttpClient) {}

  async onFileUpload(): Promise<void> {
    const r = await this.fileUploadService.showUploadDialog(
      'Upload model',
      'Please upload a model file',
      'application/zip,application/json,application/x-yaml'
    );
    alert(r?.name ?? 'no file selected');

    if (r) {
      const formData: FormData = new FormData();
      formData.append('file', r);

      const params = new HttpParams().set('tenantId', 'demo');

      try {
        await firstValueFrom(this.httpClient.post('/fileUpload/upload', formData, { params: params }));
        alert('upload done');
      } catch (e: unknown) {
        if (e instanceof HttpErrorResponse) {
          alert('upload failed: ' + e.error);
        } else {
          alert('upload failed');
        }
      }
    }
  }
}
