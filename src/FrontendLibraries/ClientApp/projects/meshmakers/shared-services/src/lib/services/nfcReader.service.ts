import { Injectable, NgZone } from '@angular/core';

@Injectable()
export class NfcReaderService {
  constructor(private zone: NgZone) {}

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
      onError('Web NFC is not supported in this browser.');
      return;
    }

    const ndef = new NDEFReader();

    try {
      await ndef.scan();
      onSuccess('','',[]); // Optional: Notify scan started
      console.log('NFC scan started. Now waiting for tag...');

      ndef.onreading = (event: NDEFReadingEvent) => {
        console.log('Tag read event fired', event);
        this.zone.run(() => {
          const serial = event.serialNumber ?? 'Unknown Serial';
          const employeeNumber = this.convertSerialToEmployeeNumber(serial);

          const messages: string[] = [];

          if (event.message.records && event.message.records.length > 0) {
            for (const record of event.message.records) {
              if(record.data) {
                const text = new TextDecoder().decode(record.data?.buffer);
                messages.push(`Type: ${record.recordType}, MIME: ${record.mediaType ?? 'n/a'}, Text: ${text}`);
              }
            }
          }

          onSuccess(serial, employeeNumber, messages);
        });
      };

      ndef.onreadingerror = () => {
        this.zone.run(() => onError('Error reading NFC tag.'));
      };
    } catch (err) {
      this.zone.run(() => onError('Error starting NFC scan.'));
    }
  }
}
