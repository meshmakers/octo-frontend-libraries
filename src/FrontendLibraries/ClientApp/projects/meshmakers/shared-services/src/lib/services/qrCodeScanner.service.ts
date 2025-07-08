import { Injectable } from "@angular/core";


@Injectable()
export class QrCodeScannerService {
  private stream: MediaStream | null = null;

  async isSupported(): Promise<boolean> {
    const BarcodeDetectorClass = (window as any).BarcodeDetector;
    return !!BarcodeDetectorClass &&
      await BarcodeDetectorClass.getSupportedFormats().then(
        (formats: string[]) => formats.includes("qr_code")
      );
  }

  async startScan(videoElement: HTMLVideoElement): Promise<string> {
    const BarcodeDetectorClass = (window as any).BarcodeDetector;
    const detector = new BarcodeDetectorClass({ formats: ["qr_code"] });

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });

    videoElement.srcObject = this.stream;

    return new Promise((resolve, reject) => {
      const scan = async () => {
        try {
          const barcodes = await detector.detect(videoElement);
          if (barcodes.length > 0) {
            this.stopScan();
            resolve(barcodes[0].rawValue);
            return;
          }
        } catch (err) {
          console.error("Detection error", err);
          this.stopScan();
          reject(err);
          return;
        }
        requestAnimationFrame(scan);
      };
      scan();
    });
  }

  stopScan(): void {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
  }
}
