import { Component, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ProgressValue } from '../models/progressValue';

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
  standalone: false,
  templateUrl: './mm-progress-window.component.html',
  styleUrls: ['./mm-progress-window.component.css']
})
export class MmProgressWindowComponent implements OnInit {
  data = inject<ProgressWindowData>(MAT_DIALOG_DATA);

  public statusText: string | null;
  public progressValue: number;

  constructor() {
    const data = this.data;

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
