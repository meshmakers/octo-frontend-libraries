import { Component, inject, OnDestroy, AfterViewInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '@progress/kendo-angular-buttons';
import {
  DialogActionsComponent,
  DialogContentBase,
  DialogRef,
} from '@progress/kendo-angular-dialog';
import { ProgressBarComponent } from '@progress/kendo-angular-progressbar';
import { Observable, Subscription } from 'rxjs';
import { ProgressValue } from '../models/progressValue';

export interface ProgressWindowData {
  title: string;
  isDeterminate: boolean;
  progress: Observable<ProgressValue>;
  isCancelOperationAvailable: boolean;
  cancelOperation: () => void;
}

export type ProgressWindowResult = object;

@Component({
  selector: 'mm-progress-window',
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
    DialogActionsComponent,
    ProgressBarComponent,
  ],
  templateUrl: './progress-window.component.html',
  styleUrl: './progress-window.component.scss'
})
export class ProgressWindowComponent extends DialogContentBase implements OnDestroy, AfterViewInit {
  private readonly dialogRef: DialogRef;
  private progressSubscription?: Subscription;

  @Input() isDeterminate = true;
  @Input() progress!: Observable<ProgressValue>;
  @Input() isCancelOperationAvailable = false;
  @Input() cancelOperation?: () => void;

  public statusText: string | null = null;
  public progressValue = 0;

  constructor() {
    const dialogRef = inject(DialogRef);
    super(dialogRef);
    this.dialogRef = dialogRef;
  }

  override ngAfterViewInit(): void {
    // Subscribe to progress updates after view is initialized
    if (this.progress) {
      this.progressSubscription = this.progress.subscribe((value: ProgressValue) => {
        this.statusText = value.statusText;
        this.progressValue = value.progressValue;
      });
    }
  }

  ngOnDestroy(): void {
    // Clean up subscription
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
    }
  }

  onCancelClick(): void {
    if (this.cancelOperation) {
      this.cancelOperation();
    }
    this.dialogRef.close();
  }
}