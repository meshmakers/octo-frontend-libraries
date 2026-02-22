import { Component, inject, OnDestroy, AfterViewInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Observable, Subscription } from 'rxjs';
import { ProgressValue } from './progress-value';

export interface ProgressWindowData {
  isDeterminate: boolean;
  progress: Observable<ProgressValue>;
  isCancelOperationAvailable: boolean;
  cancelOperation: () => void;
}

@Component({
  selector: 'mm-progress-window',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatProgressBarModule],
  template: `
    <mat-dialog-content>
      <div class="progress-section">
        @if (isDeterminate) {
          <mat-progress-bar mode="determinate" [value]="progressPercent"></mat-progress-bar>
        } @else {
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        }
        @if (statusText) {
          <p class="status-text">{{ statusText }}</p>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (isCancelOperationAvailable) {
        <button mat-stroked-button (click)="onCancelClick()">Cancel</button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    .progress-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 350px;
    }
    .status-text {
      margin: 0;
      font-size: 14px;
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `]
})
export class ProgressWindowComponent implements AfterViewInit, OnDestroy {
  private readonly dialogRef = inject<MatDialogRef<ProgressWindowComponent>>(MatDialogRef);
  private readonly data = inject<ProgressWindowData>(MAT_DIALOG_DATA);
  private progressSubscription?: Subscription;

  isDeterminate: boolean;
  isCancelOperationAvailable: boolean;
  statusText: string | null = null;
  progressPercent = 0;

  constructor() {
    this.isDeterminate = this.data.isDeterminate;
    this.isCancelOperationAvailable = this.data.isCancelOperationAvailable;
  }

  ngAfterViewInit(): void {
    if (this.data.progress) {
      this.progressSubscription = this.data.progress.subscribe((value: ProgressValue) => {
        this.statusText = value.statusText;
        this.progressPercent = value.progressValue;
      });
    }
  }

  ngOnDestroy(): void {
    this.progressSubscription?.unsubscribe();
  }

  onCancelClick(): void {
    if (this.data.cancelOperation) {
      this.data.cancelOperation();
    }
    this.dialogRef.close();
  }
}
