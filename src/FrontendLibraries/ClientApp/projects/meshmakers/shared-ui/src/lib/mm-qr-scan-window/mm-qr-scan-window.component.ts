import { Component, ElementRef, ViewChild, OnDestroy } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { QrCodeScannerService } from '@meshmakers/shared-services';

@Component({
  selector: 'mm-qr-code-scanner',
  templateUrl: './mm-qr-scan-window.component.html',
  styleUrl: './mm-qr-scan-window.component.css'
})
export class MmQrCodeScannerComponent implements OnDestroy {
  @ViewChild('video', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;

  scanning = false;
  constructor(
    private dialogRef: MatDialogRef<MmQrCodeScannerComponent>,
    private scannerService: QrCodeScannerService
  ) {}

  static open(dialog: MatDialog): Promise<string | null> {
    const ref = dialog.open(MmQrCodeScannerComponent, {
      width: '100%',
      height: '100%',
      panelClass: 'full-screen-dialog',
      disableClose: true
    });

    return ref.afterClosed().toPromise();
  }

  async ngOnInit() {
    const supported = await this.scannerService.isSupported();
    if (!supported) {
      alert("QR scanning is not supported in this browser.");
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
