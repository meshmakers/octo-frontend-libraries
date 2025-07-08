import { Component, ElementRef, NgZone, ViewChild } from "@angular/core";
import { FileUploadService } from '@meshmakers/shared-ui';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable, Subscription } from "rxjs";
import { CollectionViewer } from '@angular/cdk/collections';
import { AssetRepoGraphQlDataSource } from '@meshmakers/octo-services';
import { NfcReaderService } from "@meshmakers/shared-services";

class TestAssetRepoGraphQlDataSource extends AssetRepoGraphQlDataSource<any, any, any> {
  private dataColumns: any[] = [];

  constructor(messageService: any, query: any, defaultSort: any, dataColumns: any = null) {
    super(messageService, query, defaultSort);
    this.dataColumns = dataColumns;
  }

  override connect(_: CollectionViewer): Observable<any[]> {
    return new Observable<any[]>((subscriber) => {
      subscriber.next(this.dataColumns);
    });
  }
}

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  standalone: false,
  styleUrls: ["./app.component.scss"]
})
export class AppComponent {
  title = 'test-app';

  mmOctoTableDataSource: AssetRepoGraphQlDataSource<any, any, any> = new TestAssetRepoGraphQlDataSource(null, null, null, [
    { id: 1, name: 'test1' },
    { id: 2, name: 'test2' },
    { id: 3, name: 'test3' },
    { id: 4, name: 'test4' },
    { id: 5, name: 'test5' },
    { id: 6, name: 'test6' },
    { id: 7, name: 'test7' },
    { id: 8, name: 'test8' },
    { id: 9, name: 'test9' },
    { id: 10, name: 'test10' }
  ]);

  mmOctoTableAdvancedDataSource: AssetRepoGraphQlDataSource<any, any, any> = new TestAssetRepoGraphQlDataSource(null, null, null, [
    { ckTypeId: 'test1', baseType: { ckTypeId: 'test2' }, isAbstract: true, isFinal: false }
  ]);

  mmOctoTableVirtualDataSource: AssetRepoGraphQlDataSource<any, any, any> = new TestAssetRepoGraphQlDataSource(null, null, null, [
    {
      id: 1,
      companyName: 'Acme Corp',
      customerFirstName: null,
      customerLastName: null,
      status: 'ACTIVE'
    },
    {
      id: 2,
      companyName: null,
      customerFirstName: 'John',
      customerLastName: 'Doe',
      status: 'PENDING'
    },
    {
      id: 3,
      companyName: 'Tech Solutions',
      customerFirstName: null,
      customerLastName: null,
      status: 'INACTIVE'
    }
  ]);

  private convertSerialToEmployeeNumber(serial: string): string {
    if (!serial) return '';

    // Normalize serial string: remove colons if present
    const cleanHex = serial.replace(/:/g, '');

    // Split into byte pairs
    const bytes: string[] = cleanHex.match(/.{1,2}/g) ?? [];

    // Reverse byte order (little-endian)
    const reversedHex = bytes.reverse().join('');

    // Convert to BigInt (in case it's large)
    const decimalValue = BigInt('0x' + reversedHex);

    return decimalValue.toString();
  }


  constructor(private fileUploadService: FileUploadService, private readonly httpClient: HttpClient, private zone: NgZone, private nfcReaderService: NfcReaderService){}




  nfcMessages: string[] = [];  // Holds the scanned NFC tag messages
  nfcSerialNumber: string = '';
  nfcStatus: string = '';
  employeeNumber: string = '';
  private statusSubscription?: Subscription;


  ngOnInit() {
    this.statusSubscription = this.nfcReaderService.nfcStatus$.subscribe(status => {
      this.nfcStatus = status;
    });
  }

  ngOnDestroy() {
    this.statusSubscription?.unsubscribe();
    this.stopCamera();
  }

   onNfc(): void {
     this.nfcReaderService.startScan(
      (serial, employeeNumber, messages) => {
        this.nfcSerialNumber = serial;
        this.employeeNumber = employeeNumber;
        this.nfcMessages = messages;
      },
      (error) => {
      }
    );
    }

    stopNfc(): void {
     this.nfcReaderService.stopScan();
    }


  // async startNfcScan(): Promise<void> {
  //   // --- START: TEMPORARY TEST CODE ---
  //   // If you uncomment this, it will bypass actual NFC scan and directly
  //   // populate data, allowing you to test if the display works.
  //   //
  //   // console.log('Simulating NFC data for display test...');
  //   // this.nfcStatus = 'Simulated NDEF message read.';
  //   // this.nfcMessages = [
  //   //   'Type: text, MIME: n/a, Text: Hello NFC Test!',
  //   //   'Type: url, MIME: n/a, Text: https://angular.dev'
  //   // ];
  //   // You can comment out the rest of the original code in this method if you just want to test display
  //   // return;
  //
  //   // --- END: TEMPORARY TEST CODE ---
  //   if ('NDEFReader' in window) {
  //     const ndef = new NDEFReader();
  //
  //     try {
  //       await ndef.scan();
  //       console.log('NFC scan started.');
  //       this.nfcStatus = 'NFC scan started. Waiting for a tag...';
  //
  //       ndef.onreading = (event: NDEFReadingEvent) => {
  //         this.zone.run(() => {
  //           console.log('NFC tag read:', event);
  //           this.nfcStatus = 'NDEF message read.';
  //           const message = event.message;
  //           this.nfcSerialNumber = event.serialNumber ?? 'Unknown Serial';
  //           this.employeeNumber = this.convertSerialToEmployeeNumber(this.nfcSerialNumber);
  //
  //           // Clear previous scans or comment out if you want to accumulate
  //           this.nfcMessages = [];
  //
  //           for (const record of message.records) {
  //             const text = new TextDecoder().decode(record.data);
  //             const displayText = `Type: ${record.recordType}, MIME: ${record.mediaType ?? 'n/a'}, Text: ${text}`;
  //             console.log(displayText);
  //
  //             // Add the scanned message to the array
  //             this.nfcMessages.push(displayText);
  //           }
  //         });
  //       }
  //
  //       ndef.onreadingerror = (event) => {
  //         console.error('NFC read error:', event);
  //         this.nfcStatus = 'Error reading NFC tag.';
  //       };
  //     } catch (error) {
  //       console.error('Error starting NFC scan:', error);
  //       this.nfcStatus = 'Error starting NFC scan.';
  //       alert('Error starting NFC scan. Make sure your device supports it and the page is served over HTTPS.');
  //     }
  //   } else {
  //     console.warn('Web NFC is not supported on this device.');
  //     this.nfcStatus = 'Web NFC is not supported in this browser.';
  //     alert('Web NFC is not supported in this browser.');
  //   }
  // }

  @ViewChild('video', { static: false }) videoRef!: ElementRef<HTMLVideoElement>;
  result: string = 'Waiting for QR code...';
  private stream: MediaStream | null = null;
  private stop = false;

  async ngAfterViewInit() {
    if (!('BarcodeDetector' in window)) {
      this.result = 'BarcodeDetector not supported.';
      return;
    }

    const BarcodeDetectorClass = (window as any).BarcodeDetector;
    const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      this.videoRef.nativeElement.srcObject = this.stream;

      const scan = async () => {
        if (this.stop) return;
        try {
          const barcodes = await detector.detect(this.videoRef.nativeElement);
          if (barcodes.length > 0) {
            this.result = 'QR Code: ' + barcodes[0].rawValue;
            this.stopCamera();
            return;
          }
        } catch (err) {
          console.error('Scan error:', err);
        }
        requestAnimationFrame(scan);
      };

      scan();
    } catch (err) {
      console.error('Camera error:', err);
      this.result = 'Error accessing camera.';
    }
  }

  stopCamera() {
    this.stop = true;
    this.stream?.getTracks().forEach(track => track.stop());
  }



async onFileUpload(): Promise<void> {
    const r = await this.fileUploadService.showUploadDialog(
      'Upload model',
      'Please upload a model file',
      'application/zip,application/json,application/x-yaml'
    );
    alert(r?.name ?? 'no file selected');

    if (r) {
      const formData: FormData = new FormData();
      formData.append('file', r);
      const params = new HttpParams().set('tenantId', 'demo');

      try {
        await firstValueFrom(this.httpClient.post('/fileUpload/upload', formData, { params }));
        alert('upload done');
      } catch (e: unknown) {
        if (e instanceof HttpErrorResponse) {
          alert('upload failed: ' + e.error);
        } else {
          alert('upload failed');
        }
      }
    }
  }
}
