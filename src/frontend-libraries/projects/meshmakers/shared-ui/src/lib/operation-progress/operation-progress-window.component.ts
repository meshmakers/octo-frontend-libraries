import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ButtonComponent } from '@progress/kendo-angular-buttons';
import { DialogActionsComponent, DialogContentBase, DialogRef } from '@progress/kendo-angular-dialog';
import { Observable } from 'rxjs';
import { MmDialogActionsDirective } from '../dialog-actions/dialog-actions.directive';
import { OperationProgressComponent } from './operation-progress.component';
import { OperationProgressView } from './operation-progress.model';
import { DEFAULT_OPERATION_PROGRESS_MESSAGES, OperationProgressMessages } from './operation-progress.messages';

/**
 * Dialog content of the operation progress window (AB#8448): `mm-operation-progress` plus the window actions
 * (Download, Start again, Close). Opened through {@link OperationProgressWindowService}; closing the window never
 * cancels the operation, it only stops following it.
 */
@Component({
  selector: 'mm-operation-progress-window',
  imports: [OperationProgressComponent, DialogActionsComponent, MmDialogActionsDirective, ButtonComponent],
  template: `
    @if (view(); as current) {
      <div class="mm-operation-progress-window__body">
        <mm-operation-progress [view]="current" [messages]="messages" [showActions]="false"
                               [showOperationsLink]="!!onOpenOperations"
                               (openOperations)="openOperations()" />
      </div>
    }
    <kendo-dialog-actions>
      <button kendoButton type="button" data-close (click)="close()">{{ text.close }}</button>
      @if (view(); as current) {
        @if (current.canStartNew && onStartNew && (current.status === 'failed' || current.status === 'outcomeUnknown')) {
          <button kendoButton type="button" [themeColor]="current.status === 'outcomeUnknown' ? 'primary' : 'base'"
                  data-start-new (click)="startNew()">{{ text.startNew }}</button>
        }
        @if (current.status === 'succeeded' && current.canDownload && onDownload) {
          <button kendoButton type="button" themeColor="primary" data-download (click)="download()">{{ text.download }}</button>
        }
      }
    </kendo-dialog-actions>
  `,
  styles: [`
    .mm-operation-progress-window__body {
      padding: var(--theme-space-4, 16px);
      box-sizing: border-box;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OperationProgressWindowComponent extends DialogContentBase implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ref: DialogRef;

  /** Set by the service before the first change detection. */
  public viewChanges!: Observable<OperationProgressView>;
  public messages: Partial<OperationProgressMessages> | undefined;
  public onDownload?: () => void | Promise<void>;
  public onStartNew?: () => void;
  public onOpenOperations?: () => void;

  protected readonly view = signal<OperationProgressView | null>(null);

  constructor() {
    const dialogRef = inject(DialogRef);
    super(dialogRef);
    this.ref = dialogRef;
  }

  protected get text(): OperationProgressMessages {
    return { ...DEFAULT_OPERATION_PROGRESS_MESSAGES, ...(this.messages ?? {}) };
  }

  ngOnInit(): void {
    const subscription = this.viewChanges.subscribe(view => this.view.set(view));
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  protected close(): void {
    this.ref.close();
  }

  protected download(): void {
    void this.onDownload?.();
  }

  /** Closes the window and lets the host start the operation again (the host opens a new window). */
  protected startNew(): void {
    this.ref.close();
    this.onStartNew?.();
  }

  /** Closes the window and lets the host navigate to My operations. */
  protected openOperations(): void {
    this.ref.close();
    this.onOpenOperations?.();
  }
}
