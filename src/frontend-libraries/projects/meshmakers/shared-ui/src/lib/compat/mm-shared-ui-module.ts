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
import { ConfirmationService } from '../services/confirmation.service';
import { FileUploadService } from '../services/file-upload.service';
import { ProgressWindowService } from '../progress-window/progress-window.service';
import { NotificationDisplayService } from '../services/notification-display.service';
import { MessageListenerService } from '../services/message-listener.service';
import { InputService } from '../services/input.service';

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
