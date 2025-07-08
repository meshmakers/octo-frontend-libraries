import { Component, ElementRef, NgZone, ViewChild } from "@angular/core";
import { FileUploadService, MmQrCodeScannerComponent } from "@meshmakers/shared-ui";
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable, Subscription } from "rxjs";
import { CollectionViewer } from '@angular/cdk/collections';
import { AssetRepoGraphQlDataSource } from '@meshmakers/octo-services';
import { NfcReaderService } from "@meshmakers/shared-services";
import {QrCodeScannerService} from "@meshmakers/shared-services";
import { MatDialog } from "@angular/material/dialog";

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


  constructor(private fileUploadService: FileUploadService, private readonly httpClient: HttpClient, private zone: NgZone, private nfcReaderService: NfcReaderService, private dialog: MatDialog) { }




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
    //this.stopCamera();
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


  //QR Implementation
  //@ViewChild('video', { static: false }) videoRef!: ElementRef<HTMLVideoElement>;
  output: string = 'Waiting for QR code...';


  async openScanner() {
    const result = await MmQrCodeScannerComponent.open(this.dialog);
    if (result) {
      console.log('Scanned:', result);
      this.output = result;
    }
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
