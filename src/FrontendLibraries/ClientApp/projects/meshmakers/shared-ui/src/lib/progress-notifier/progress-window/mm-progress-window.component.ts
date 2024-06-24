import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ProgressValue } from '../shared/progressValue';

export interface ProgressWindowData {
  title: string;
  isDeterminate: boolean;
  progress: Observable<ProgressValue>;
  isCancelOperationAvailable: boolean;
  cancelOperation: () => void;
}

export type ProgressWindowResult = object

@Component({
  selector: 'mm-progress-window',
  templateUrl: './mm-progress-window.component.html',
  styleUrls: ['./mm-progress-window.component.css']
})
export class MmProgressWindowComponent implements OnInit {
  public statusText: string | null;
  public progressValue: number;

  constructor(@Inject(MAT_DIALOG_DATA) public data: ProgressWindowData) {
    this.statusText = null;
    this.progressValue = 0;

    data.progress.subscribe((value) => {
      this.statusText = value.statusText;
      this.progressValue = value.progressValue;
    });
  }

  ngOnInit(): void {}

  onCancelClick(): void {
    this.data.cancelOperation();
  }
}
