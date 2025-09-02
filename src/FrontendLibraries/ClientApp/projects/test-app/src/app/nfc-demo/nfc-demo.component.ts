import { Component, inject } from '@angular/core';
import { NfcReaderService } from '@meshmakers/shared-services';

@Component({
  selector: 'app-nfc-demo',
  standalone: false,
  templateUrl: './nfc-demo.component.html',
  styleUrls: ['./nfc-demo.component.scss']
})
export class NfcDemoComponent {
  protected nfcReaderService = inject(NfcReaderService);
  
  nfcMessages: string[] = [];  // Holds the scanned NFC tag messages
  nfcSerialNumber: string = '';
  employeeNumber: string = '';

  onNfc(): void {
    this.nfcReaderService.startScan(
      (serial, employeeNumber, messages) => {
        this.nfcSerialNumber = serial;
        this.employeeNumber = employeeNumber;
        this.nfcMessages = messages;
      },
      (error) => {
        console.error('NFC Error:', error);
      }
    );
  }

  stopNfc(): void {
    this.nfcReaderService.stopScan();
  }
}