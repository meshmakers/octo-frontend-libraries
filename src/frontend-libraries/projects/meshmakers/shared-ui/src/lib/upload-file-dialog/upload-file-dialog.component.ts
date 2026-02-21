import { Component, ElementRef, Input, signal, ViewChild, inject } from '@angular/core';
import {NotificationService} from '@progress/kendo-angular-notification';
import {ButtonComponent} from '@progress/kendo-angular-buttons';
import {
  DialogActionsComponent,
  DialogContentBase,
  DialogRef,
} from '@progress/kendo-angular-dialog';
import {NgIf} from '@angular/common';
import {SVGIconComponent} from '@progress/kendo-angular-icons';
import {deleteIcon, upload} from '../svg-icons';
import {FileUploadResult} from '../models/confirmation';

@Component({
  selector: 'mm-upload-file-dialog',
  imports: [
    ButtonComponent,
    DialogActionsComponent,
    NgIf,
    SVGIconComponent
  ],
  templateUrl: './upload-file-dialog.component.html',
  styleUrl: './upload-file-dialog.component.css'
})
export class UploadFileDialogComponent extends DialogContentBase {
  private readonly dialogRef: DialogRef;
  private readonly notificationService = inject(NotificationService);

  @Input() message = '';
  @Input() mimeTypes: string | null = null;
  @Input() fileExtensions: string | null = null;

  protected fileName = signal('');
  protected fileSize = signal(0);
  protected uploadProgress = signal(0);
  @ViewChild('fileInput') protected fileInput: ElementRef | undefined;
  protected selectedFile: File | null = null;
  protected uploadSuccess: boolean;
  protected uploadError: boolean;

  constructor() {
    const dialogRef = inject(DialogRef);

    super(dialogRef);
    this.dialogRef = dialogRef;

    this.uploadError = false;
    this.uploadSuccess = false;
  }


  // Handler for file input change
  onFileChange(event: any): void {
    const file = event.target.files[0] as File | null;
    this.uploadFile(file);
  }

  // Handler for the file drop
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
    const allowedMimeTypes = this.mimeTypes?.split(',').map((mimeType) => mimeType.trim()) ?? [];
    const allowedFileExtensions = this.fileExtensions?.split(',').map((mimeType) => mimeType.trim()) ?? [];
    if (!file) {
      return;
    }
    console.debug("type: " + file.type);
    console.debug("name: " + file.name);
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    console.debug("extension: " + extension);

    if ((allowedFileExtensions.includes(extension) || allowedMimeTypes.includes(file.type)) ||
      allowedFileExtensions.length > 0 && allowedMimeTypes.length > 0) {
      this.selectedFile = file;
      this.fileSize.set(Math.round(file.size / 1024)); // Set file size in KB

      this.uploadSuccess = true;
      this.uploadError = false;
      this.fileName.set(file.name); // Set image name
    } else {
      this.uploadSuccess = false;
      this.uploadError = true;

      this.notificationService.show({
        content: 'File type not supported!',
        hideAfter: 600,
        position: {horizontal: "right", vertical: "top"},
        animation: {type: "fade", duration: 400},
        type: {style: "error", icon: true},
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
    if (this.selectedFile) {
      this.dialogRef.close(new FileUploadResult(this.selectedFile));
    }
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  protected readonly upload = upload;
  protected readonly deleteIcon = deleteIcon;
}
