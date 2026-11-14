import { Injectable, inject } from '@angular/core';
import { DialogRef, DialogService } from '@progress/kendo-angular-dialog';
import { Observable } from 'rxjs';
import { OperationProgressWindowComponent } from './operation-progress-window.component';
import { OperationProgressView } from './operation-progress.model';
import { OperationProgressMessages } from './operation-progress.messages';

/** What {@link OperationProgressWindowService.open} shows and which actions it offers. */
export interface OperationProgressWindowConfig {
  /** Window title ("Tenant backup · octosystem"). */
  title: string;
  /** The live state; the window renders every emission. The host stops following when the window closes. */
  view: Observable<OperationProgressView>;
  /** Download of a succeeded operation (button shown when the view says `canDownload`). */
  onDownload?: () => void | Promise<void>;
  /** "Start again" of a failed or lost operation (button shown when the view says `canStartNew`). */
  onStartNew?: () => void;
  /** Link to My operations (shown when set). */
  onOpenOperations?: () => void;
  messages?: Partial<OperationProgressMessages>;
  width?: number;
}

/**
 * Opens the progress window of a long-running operation (AB#8448, F3.6): state, progress and outcome of one
 * operation, without a cancel button. Unlike {@link ProgressWindowService} the window can be closed at any time —
 * the operation keeps running on the server and is found again in My operations — and it stays open after the
 * operation finished, so the user can download the result or read the error.
 *
 * Follow the operation as long as the window is open: `dialogRef.result` emits when it closes.
 */
@Injectable({ providedIn: 'root' })
export class OperationProgressWindowService {
  private readonly dialogService = inject(DialogService);

  /** App-wide text overrides (i18n), merged under {@link OperationProgressWindowConfig.messages}. */
  public defaultMessages: Partial<OperationProgressMessages> | undefined;

  open(config: OperationProgressWindowConfig): DialogRef {
    const dialogRef = this.dialogService.open({
      title: config.title,
      content: OperationProgressWindowComponent,
      width: config.width ?? 520,
      maxWidth: '95vw'
    });
    const component = dialogRef.content.instance as OperationProgressWindowComponent;
    component.viewChanges = config.view;
    component.messages = { ...(this.defaultMessages ?? {}), ...(config.messages ?? {}) };
    component.onDownload = config.onDownload;
    component.onStartNew = config.onStartNew;
    component.onOpenOperations = config.onOpenOperations;
    return dialogRef;
  }
}
