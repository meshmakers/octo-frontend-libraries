import { Component } from "@angular/core";
import { FileUploadService } from "@meshmakers/shared-ui";
import { HttpClient, HttpErrorResponse, HttpParams } from "@angular/common/http";
import { firstValueFrom, Observable } from "rxjs";
import { NewGraphQlDataSource } from "@meshmakers/octo-ui";
import { CollectionViewer } from "@angular/cdk/collections";


class TestNewGraphQlDataSource extends NewGraphQlDataSource<any, any, any> {
  private dataColumns: any[] = [];

  constructor(messageService: any, query: any, defaultSort: any, dataColumns: any = null) {
    super(messageService, query, defaultSort
    );
    this.dataColumns = dataColumns;
  }

  override connect(collectionViewer: CollectionViewer): Observable<any[]> {

    // return dummy data
    return  new Observable<any[]>(subscriber => {
      subscriber.next(this.dataColumns);
    });
  }


}


@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"]
})
export class AppComponent {
  title = "test-app";
  mmOctoTableDataSource: NewGraphQlDataSource<any, any, any> = new TestNewGraphQlDataSource(null, null, null,[{id: 1, name: 'test1'}, {id: 2, name: 'test2'}]);

  // based on this    columnNames: ['ckTypeId', 'baseType', 'isAbstract', 'isFinal'],
  //             accessPaths: {'baseType': 'baseType.ckTypeId'}
  mmOctoTableAdvancedDataSource: NewGraphQlDataSource<any, any, any> = new TestNewGraphQlDataSource(null, null, null, [{ckTypeId: 'test1', baseType: {ckTypeId: 'test2'}, isAbstract: true, isFinal: false}]);

  constructor(private fileUploadService: FileUploadService, private readonly httpClient: HttpClient) {
  }

  async onFileUpload(): Promise<void> {

    const r = await this.fileUploadService.showUploadDialog("Upload model", "Please upload a model file", "application/zip,application/json,application/x-yaml");
    alert(r?.name ?? "no file selected");

    if (r) {
      const formData: FormData = new FormData();
      formData.append("file", r);

      const params = new HttpParams().set("tenantId", "demo");

      try {
        await firstValueFrom(this.httpClient.post("/fileUpload/upload", formData, { params: params }));
        alert("upload done");
      } catch (e: unknown) {
        if (e instanceof HttpErrorResponse) {
          alert("upload failed: " + e.error);
        } else {
          alert("upload failed");
        }
      }

    }

  }
}
