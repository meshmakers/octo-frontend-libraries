import { ModuleWithProviders, NgModule } from '@angular/core';
import { MessageService } from './services/message.service';
import { NfcReaderService } from "./services/nfcReader.service";
import { QrCodeScannerService } from "./services/qrCodeScanner.service";
import { MacoSchemeDecoderService } from "./services/macoSchemeDecoder.service";
import { MmHttpErrorInterceptor } from "./shared/mm-http-error-interceptor.service";

@NgModule({
  declarations: [],
  imports: [],
  exports: []
})
export class SharedServicesModule {
  static forRoot(): ModuleWithProviders<SharedServicesModule> {
    return {
      ngModule: SharedServicesModule,
      providers: [MessageService, NfcReaderService, QrCodeScannerService, MacoSchemeDecoderService, MmHttpErrorInterceptor],
    };
  }
}
