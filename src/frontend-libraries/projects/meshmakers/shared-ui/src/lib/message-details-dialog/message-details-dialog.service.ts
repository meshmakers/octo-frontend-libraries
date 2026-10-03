import { Injectable, inject } from '@angular/core';
import { WindowService, WindowRef } from '@progress/kendo-angular-dialog';
import { MessageDetailsDialogComponent, MessageDetailsDialogData } from './message-details-dialog.component';
import { WindowStateService } from '../services/window-state.service';
import { MessageDetailsDialogMessages } from './message-details-dialog.messages';

@Injectable()
export class MessageDetailsDialogService {
  private readonly windowService = inject(WindowService);
  private readonly windowStateService = inject(WindowStateService);

  public defaultMessages: Partial<MessageDetailsDialogMessages> | undefined;

  showDetailsDialog(data: MessageDetailsDialogData): WindowRef {
    const size = this.windowStateService.resolveWindowSize('message-details', { width: 900, height: 600 });

    const effectiveMessages = data.messages ?? this.defaultMessages;

    // Kendo's Window titlebar reads close/minimize/maximize/restore tooltips
    // from WindowSettings.messages at open time - the only way in. The content
    // component cannot carry them: WindowService builds it in the container's
    // injector, outside the window, so a <kendo-window-messages> there finds no
    // LocalizationService (NG0201) and could not reach the titlebar anyway.
    const windowMessages = effectiveMessages
      ? {
        closeTitle: effectiveMessages.closeTitle,
        minimizeTitle: effectiveMessages.minimizeTitle,
        maximizeTitle: effectiveMessages.maximizeTitle,
        restoreTitle: effectiveMessages.restoreTitle,
      }
      : undefined;

    const windowRef = this.windowService.open({
      content: MessageDetailsDialogComponent,
      title: data.title,
      width: size.width,
      height: size.height,
      minWidth: 500,
      minHeight: 400,
      resizable: true,
      messages: windowMessages,
    });

    this.windowStateService.applyModalBehavior('message-details', windowRef);

    const contentRef = windowRef.content as { instance?: MessageDetailsDialogComponent } | undefined;
    if (contentRef?.instance) {
      contentRef.instance.data = effectiveMessages
        ? { ...data, messages: effectiveMessages }
        : data;
    }

    return windowRef;
  }
}
