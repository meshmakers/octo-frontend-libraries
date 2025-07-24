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

  async scan(video: HTMLVideoElement): Promise<string> {
    const BarcodeDetectorClass = (window as any).BarcodeDetector;
    const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      video.srcObject = this.stream;

      // Ensure video is playing before scanning
      await video.play();

      return new Promise((resolve, reject) => {
        const detectLoop = async () => {
          try {
            const barcodes = await detector.detect(video);
            if (barcodes.length > 0) {
              this.stop();
              resolve(barcodes[0].rawValue);
              return;
            }
          } catch (err) {
            this.stop();
            reject(err);
            return;
          }

          requestAnimationFrame(detectLoop);
        };

        detectLoop();
      });
    } catch (err) {
      console.error("Camera access or scan error", err);
      this.stop();
      throw err;
    }
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
}
