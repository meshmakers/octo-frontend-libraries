import { Component, ElementRef, Inject, signal, ViewChild } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { FileUploadData, FileUploadResult } from "../models/confirmation";
import { MatSnackBar } from "@angular/material/snack-bar";

@Component({
  selector: 'mm-mm-file-upload',
  templateUrl: './mm-file-upload.component.html',
  styleUrl: './mm-file-upload.component.css'
})
export class MmFileUploadComponent  {
  protected fileName = signal('');
  protected fileSize = signal(0);
  protected uploadProgress = signal(0);
  @ViewChild('fileInput') protected fileInput: ElementRef | undefined;
  protected selectedFile: File | null = null;
  protected uploadSuccess: boolean;
  protected uploadError: boolean;


  constructor(
    private readonly dialogRef: MatDialogRef<MmFileUploadComponent>,
    @Inject(MAT_DIALOG_DATA) protected data: FileUploadData,
    private snackBar: MatSnackBar
  ) {
    this.uploadError = false;
    this.uploadSuccess = false;
  }

  // Handler for file input change
  onFileChange(event: any): void {
    const file = event.target.files[0] as File | null;
    this.uploadFile(file);
  }

  // Handler for file drop
  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files[0] as File | null;
    this.uploadFile(file);
  }

  // Prevent default dragover behavior
  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  // Method to handle file upload
  uploadFile(file: File | null): void {
    const allowedMimeTypes = this.data.mimeTypes.split(',').map((mimeType) => mimeType.trim());
    if (!file) {
      return;
    }
    console.log(file.type);
    if (allowedMimeTypes.length > 0 && allowedMimeTypes.includes(file.type)) {
      this.selectedFile = file;
      this.fileSize.set(Math.round(file.size / 1024)); // Set file size in KB

      this.uploadSuccess = true;
      this.uploadError = false;
      this.fileName.set(file.name); // Set image name
    } else {
      this.uploadSuccess = false;
      this.uploadError = true;
      this.snackBar.open('File type not supported!', 'Close', {
        duration: 3000,
        panelClass: 'error',
      });
    }
  }

  // Method to remove a file
  removeFile(): void {
    this.selectedFile = null;
    this.fileName.set('');
    this.fileSize.set(0);
    this.uploadSuccess = false;
    this.uploadError = false;
    this.uploadProgress.set(0);
  }

  onOk(): void {
    this.dialogRef.close(({
      success: true,
      selectedFile: this.selectedFile
    } as FileUploadResult));
  }

  onCancel(): void {
    this.dialogRef.close(({
      success: false,
      selectedFile: null
    } as FileUploadResult));
  }
}
