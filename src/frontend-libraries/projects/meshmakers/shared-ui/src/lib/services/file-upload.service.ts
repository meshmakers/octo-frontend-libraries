import { Injectable, inject } from '@angular/core';
import {DialogRef, DialogService} from '@progress/kendo-angular-dialog';
import {UploadFileDialogComponent} from '../upload-file-dialog/upload-file-dialog.component';
import {FileUploadResult} from '../models/confirmation';

@Injectable()
export class FileUploadService {
  private readonly dialogService = inject(DialogService);

  public async showUploadDialog(title: string, message: string, mimeTypes: string | null = null, fileExtensions: string | null = null): Promise<File | null> {

    const dialogRef: DialogRef = this.dialogService.open({
      title,
      content: UploadFileDialogComponent
    });

    const component = dialogRef.content.instance as UploadFileDialogComponent;
    component.message = message;
    component.mimeTypes = mimeTypes;
    component.fileExtensions = fileExtensions;

    return new Promise<File | null>((resolve) => {
      dialogRef.result.subscribe((result) => {
        if (result instanceof FileUploadResult) {
          resolve(result.selectedFile as File);
        } else {
          resolve(null);
        }
      });
    });
  }
}
