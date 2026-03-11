/*
 * Public API Surface of shared-ui
 */

import {EnvironmentProviders, makeEnvironmentProviders} from '@angular/core';
import {FileUploadService} from './lib/services/file-upload.service';
import {ConfirmationService} from './lib/services/confirmation.service';
import {InputService} from './lib/services/input.service';
import {ProgressWindowService} from './lib/progress-window/progress-window.service';
import {NotificationDisplayService} from './lib/services/notification-display.service';
import {MessageDetailsDialogService} from './lib/message-details-dialog/message-details-dialog.service';
import {MessageListenerService} from './lib/services/message-listener.service';
import { provideMmSharedServices } from "@meshmakers/shared-services";

export * from './lib/list-view/list-view.component';
export * from './lib/upload-file-dialog/upload-file-dialog.component';
export * from './lib/input-dialog/input-dialog.component';
export * from './lib/tree/tree.component';
export * from './lib/base-form/base-form.component';
export * from './lib/base-tree-detail/base-tree-detail.component';
export * from './lib/progress-window/progress-window.component';
export * from './lib/progress-window/progress-window.service';
export * from './lib/data-sources/data-source-typed';
export * from './lib/data-sources/data-source-base';
export * from './lib/data-sources/hierarchy-data-source';
export * from './lib/data-sources/hierarchy-data-source-base';
export * from './lib/directives/mm-list-view-data-binding.directive';
export * from './lib/pipes/pascal-case.pipe';
export * from './lib/pipes/bytes-to-size.pipe';
export * from './lib/models/fetchResult';
export * from './lib/models/progressValue';
export * from './lib/models/node-dropped-event';
export * from './lib/models/importStrategyDto';
export * from './lib/models/confirmation';
export * from './lib/services/file-upload.service';
export * from './lib/services/confirmation.service';
export * from './lib/services/input.service';
export * from './lib/services/notification-display.service';
export * from './lib/services/message-listener.service';
export * from './lib/message-details-dialog/message-details-dialog.component';
export * from './lib/message-details-dialog/message-details-dialog.service';
export * from './lib/entity-select-input/entity-select-input.component';
export * from './lib/entity-select-dialog/entity-select-dialog.component';
export * from './lib/entity-select-dialog/entity-select-dialog.service';
export * from './lib/entity-select-dialog/entity-select-dialog-data-source';
export * from './lib/list-view/list-view.model';
export * from './lib/guards/unsaved-changes.interface';
export * from './lib/guards/unsaved-changes.guard';
export * from './lib/guards/unsaved-changes.directive';
export * from './lib/save-as-dialog';
export * from './lib/time-range-picker';
export * from './lib/cron-builder';
export * from './lib/copyable-text/copyable-text.component';
export * from './lib/import-strategy-dialog/import-strategy-dialog.component';
export * from './lib/import-strategy-dialog/import-strategy-dialog.service';

import { EntitySelectDialogService } from './lib/entity-select-dialog/entity-select-dialog.service';
import { SaveAsDialogService } from './lib/save-as-dialog';
import { ImportStrategyDialogService } from './lib/import-strategy-dialog/import-strategy-dialog.service';

export function provideMmSharedUi(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideMmSharedServices(),
    FileUploadService,
    ConfirmationService,
    InputService,
    ProgressWindowService,
    NotificationDisplayService,
    MessageListenerService,
    MessageDetailsDialogService,
    EntitySelectDialogService,
    SaveAsDialogService,
    ImportStrategyDialogService,
  ]);
}


