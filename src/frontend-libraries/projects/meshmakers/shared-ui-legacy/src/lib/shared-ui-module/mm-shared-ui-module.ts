/**
 * Backward-compatible MmSharedUiModule for legacy apps that use
 * importProvidersFrom(MmSharedUiModule.forRoot()).
 *
 * New code should use provideMmSharedUi() directly.
 *
 * Note: This module only provides services via forRoot(). Legacy Material-based
 * components (mm-notification-bar, mm-breadcrumb, mm-entity-select) must be
 * provided locally by each consumer app as standalone components.
 */
import { ModuleWithProviders, NgModule } from '@angular/core';
import {
  ConfirmationService,
  FileUploadService,
  ProgressWindowService,
  NotificationDisplayService,
  MessageListenerService,
  InputService,
} from '@meshmakers/shared-ui';

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
        FileUploadService,
        ConfirmationService,
        InputService,
        ProgressWindowService,
        NotificationDisplayService,
        MessageListenerService,
      ]
    };
  }
}
