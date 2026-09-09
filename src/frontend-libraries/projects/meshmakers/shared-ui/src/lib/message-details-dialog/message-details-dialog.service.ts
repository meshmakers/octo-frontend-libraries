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
    // from WindowSettings.messages at open time. The same labels in the inner
    // <kendo-window-messages> directive cannot reach the titlebar (the
    // directive sits inside the projected content, but Kendo Window's
    // ContentChild query runs at the <kendo-window> level), so the tooltips
    // would stay on Kendo defaults. Forward the title slots explicitly.
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
