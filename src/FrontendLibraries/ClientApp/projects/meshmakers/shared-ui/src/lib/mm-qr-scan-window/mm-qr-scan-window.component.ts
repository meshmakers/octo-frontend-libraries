import { Component, ElementRef, ViewChild, OnDestroy, OnInit } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { QrCodeScannerService } from '@meshmakers/shared-services';
import { MatSnackBar } from "@angular/material/snack-bar";
import { firstValueFrom } from "rxjs";

@Component({
  selector: 'mm-qr-code-scanner',
  templateUrl: './mm-qr-scan-window.component.html',
  styleUrl: './mm-qr-scan-window.component.css'
})
export class MmQrCodeScannerComponent implements OnInit, OnDestroy {
  @ViewChild('video', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;

  scanning = false;
  constructor(
    private dialogRef: MatDialogRef<MmQrCodeScannerComponent>,
    private snackBar: MatSnackBar,
    private scannerService: QrCodeScannerService
  ) {}

  private async checkCameraPermission(): Promise<boolean> {
    if (!navigator.permissions || !navigator.mediaDevices) return true;

    try {
      const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return status.state !== 'denied';

    } catch {
      return true; // fallback for Safari or unsupported browsers
    }
  }


  static open(dialog: MatDialog): Promise<string | null> {
    const ref = dialog.open(MmQrCodeScannerComponent, {
      width: '100%',
      height: '100%',
      panelClass: 'full-screen-dialog',
      disableClose: true
    });

    return firstValueFrom(ref.afterClosed());
  }

  async ngOnInit() {

    const hasPermission = await this.checkCameraPermission();

    if (!hasPermission) {
      this.snackBar.open(
        'Camera access is blocked. Please enable it in your browser settings.',
        'OK',
        {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
        }
      );
      this.dialogRef.close(null);
      return;
    }

    const supported = await this.scannerService.isSupported();
    if (!supported) {
      this.snackBar.open(
        'QR scanning is not supported in this browser.',
        'OK',
        {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
        }
        );
      this.dialogRef.close(null);
      return;
    }

    try {
      const result = await this.scannerService.scan(this.videoRef.nativeElement);
      this.dialogRef.close(result); // Return result to parent
      this.scanning = false;
    } catch (err) {
      console.error("QR scan error:", err);
      this.dialogRef.close(null);
      this.scanning = false;
    }
  }

  onCancel() {
    this.scannerService.stop();
    this.dialogRef.close(null);
  }

  ngOnDestroy() {
    this.scannerService.stop();
  }
}
