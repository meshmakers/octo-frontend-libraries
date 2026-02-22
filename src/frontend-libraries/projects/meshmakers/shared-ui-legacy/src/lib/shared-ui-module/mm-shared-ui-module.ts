/**
 * Backward-compatible MmSharedUiModule for legacy apps that use
 * importProvidersFrom(MmSharedUiModule.forRoot()).
 *
 * Provides a Material-based ConfirmationService as a drop-in replacement
 * for the Kendo-based version from @meshmakers/shared-ui.
 */
import { ModuleWithProviders, NgModule } from '@angular/core';
import { ConfirmationService } from '../confirmation/confirmation.service';

@NgModule({
  declarations: [],
  imports: [],
  exports: []
})
export class MmSharedUiModule {
  static forRoot(): ModuleWithProviders<MmSharedUiModule> {
    return {
      ngModule: MmSharedUiModule,
      providers: [
        ConfirmationService,
      ]
    };
  }
}
