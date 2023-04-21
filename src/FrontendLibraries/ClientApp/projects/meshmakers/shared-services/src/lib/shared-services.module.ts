import {ModuleWithProviders, NgModule} from '@angular/core';
import {MessageService} from "./services/message.service";


@NgModule({
  declarations: [],
  imports: [],
  exports: []
})
export class SharedServicesModule {
  static forRoot(): ModuleWithProviders<SharedServicesModule> {
    return {
      ngModule: SharedServicesModule,
      providers: [
        MessageService
      ]
    }
  }
}
