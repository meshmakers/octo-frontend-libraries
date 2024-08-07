import { Injectable } from '@angular/core';
import { firstValueFrom } from "rxjs";
import {
  FileUploadData,
  FileUploadResult
} from "../models/confirmation";
import { MatDialog } from "@angular/material/dialog";
import { MmFileUploadComponent } from "../mm-file-upload/mm-file-upload.component";

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {

  constructor(private readonly dialog: MatDialog) { }


  async showUploadDialog(title: string, message: string, mimeTypes: string): Promise<File | null> {
    const dialogRef = this.dialog.open<MmFileUploadComponent, FileUploadData, FileUploadResult>(
      MmFileUploadComponent,
      {
        width: '50vw',
        maxWidth: '50vw',
        data: {
          title,
          message,
          mimeTypes
        } as FileUploadData
      }
    );

    const r = await firstValueFrom(dialogRef.afterClosed());
    const success =  r?.success ?? false;
    if (success){
      return r?.selectedFile ?? null;
    }
    return null;
  }
}
