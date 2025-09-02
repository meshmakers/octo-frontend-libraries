import { Component, inject } from '@angular/core';
import { MacoSchemeDecoderService, ParseResponse, ParseResult } from '@meshmakers/shared-services';
import { MatDialog } from '@angular/material/dialog';
import { MmQrCodeScannerComponent } from '@meshmakers/shared-ui';

@Component({
  selector: 'app-qr-demo',
  standalone: false,
  templateUrl: './qr-demo.component.html',
  styleUrls: ['./qr-demo.component.scss']
})
export class QrDemoComponent {
  private dialog = inject(MatDialog);
  private macoSchemeDecoder = inject(MacoSchemeDecoderService);

  // QR Implementation
  output: string = 'Waiting for QR code...';
  showScanner = false;
  useDialog = true;
  message = '';
  decodedResult: ParseResult | null = null;

  scanQRCode() {
    if (this.useDialog) {
      this.openScannerDialog();
    } else {
      this.showScanner = true;
    }
  }

  async openScannerDialog() {
    const result = await MmQrCodeScannerComponent.open(this.dialog);
    this.handleScanResult(result);
  }

  handleScanResult(result: string | null) {
    if (result) {
      console.log('Scanned:', result);
      this.output = result;
      this.parseMacoUrl(result);
    } else {
      console.log('Scan was cancelled or failed.');
    }
    this.showScanner = false;
  }

  private parseMacoUrl(result: string) {
    const response: ParseResponse = this.macoSchemeDecoder.parseUrl(result);
    if (response.success && response.data) {
      this.decodedResult = response.data;
      this.message = response.message;
    } else {
      this.decodedResult = null;
      this.message = response.message;
    }
  }

  onScanComplete(result: string | null) {
    this.handleScanResult(result);
  }
}