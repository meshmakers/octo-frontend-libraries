import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class NfcReaderService {
  private ndef: NDEFReader | null = null;
  private abortController: AbortController | null = null;

  // Emits NFC status updates to subscribers
  private nfcStatusSubject = new BehaviorSubject<string>('');
  nfcStatus$ = this.nfcStatusSubject.asObservable();

  constructor() {}

  private convertSerialToEmployeeNumber(serial: string): string {
    if (!serial) return '';

    const cleanHex = serial.replace(/:/g, '');
    const bytes = cleanHex.match(/.{1,2}/g) ?? [];
    const reversedHex = bytes.reverse().join('');
    const decimalValue = BigInt('0x' + reversedHex);

    return decimalValue.toString();
  }

  async startScan(
    onSuccess: (serial: string, employeeNumber: string, messages: string[]) => void,
    onError: (error: string) => void
  ): Promise<void> {
    if (!('NDEFReader' in window)) {
      this.nfcStatusSubject.next('Web NFC is not supported in this browser.');
      onError('Web NFC is not supported in this browser.');
      return;
    }

    this.abortController = new AbortController();
    this.ndef = new NDEFReader();

    try {
      await this.ndef.scan({ signal: this.abortController.signal });

      this.nfcStatusSubject.next('NFC scan started. Waiting for a tag...');
      onSuccess('', '', []); // Optional: Notify scan started

      this.ndef.onreading = (event: NDEFReadingEvent) => {
        console.log('Tag read event fired', event);

        const serial = event.serialNumber ?? 'Unknown Serial';
        const employeeNumber = this.convertSerialToEmployeeNumber(serial);

        const messages: string[] = [];

        if (event.message.records && event.message.records.length > 0) {
          for (const record of event.message.records) {
            if (record.data) {
              const text = new TextDecoder().decode(record.data.buffer);
              messages.push(`Type: ${record.recordType}, MIME: ${record.mediaType ?? 'n/a'}, Text: ${text}`);
            }
          }
        }

        this.nfcStatusSubject.next('NFC tag read successfully.');
        onSuccess(serial, employeeNumber, messages);
      };

      this.ndef.onreadingerror = () => {
        this.nfcStatusSubject.next('Error reading NFC tag.');
        onError('Error reading NFC tag.');
      };
    } catch (err) {
      console.error('Error reading NFC tag: ', err);
      this.nfcStatusSubject.next('Error starting NFC scan.');
      onError('Error starting NFC scan.');
    }
  }

  stopScan(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      this.ndef = null;
      this.nfcStatusSubject.next('NFC scan stopped.');
    }
  }
}
