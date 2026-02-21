import { Component, inject } from '@angular/core';
import { FileUploadService } from '@meshmakers/shared-ui-legacy';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-file-upload-demo',
  standalone: false,
  templateUrl: './file-upload-demo.component.html',
  styleUrls: ['./file-upload-demo.component.scss']
})
export class FileUploadDemoComponent {
  private fileUploadService = inject(FileUploadService);
  private readonly httpClient = inject(HttpClient);

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