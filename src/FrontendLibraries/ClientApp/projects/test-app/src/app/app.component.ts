import { Component } from "@angular/core";
import { FileUploadService } from "@meshmakers/shared-ui";
import { HttpClient, HttpErrorResponse, HttpParams } from "@angular/common/http";
import { firstValueFrom } from "rxjs";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"]
})
export class AppComponent {
  title = "test-app";

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
