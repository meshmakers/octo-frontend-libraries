import { Component, ViewChild, ElementRef } from '@angular/core';

@Component({
  selector: 'app-file-upload-demo',
  standalone: false,
  templateUrl: './file-upload-demo.component.html',
  styleUrls: ['./file-upload-demo.component.scss']
})
export class FileUploadDemoComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  selectedFile: File | null = null;
  acceptTypes = 'application/zip,application/json,application/x-yaml,.zip,.json,.yaml,.yml';

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  openFileDialog(): void {
    this.fileInput.nativeElement.click();
  }

  clearFile(): void {
    this.selectedFile = null;
    this.fileInput.nativeElement.value = '';
  }

  simulateUpload(): void {
    if (!this.selectedFile) return;
    alert(`Upload simulated for: ${this.selectedFile.name} (${this.formatSize(this.selectedFile.size)})`);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
