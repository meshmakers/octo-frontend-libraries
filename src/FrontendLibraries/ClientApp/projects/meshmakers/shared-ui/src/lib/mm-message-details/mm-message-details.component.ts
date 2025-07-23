import { Component, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ErrorMessage } from '@meshmakers/shared-services';

@Component({
  selector: 'mm-message-details',
  standalone: false,
  templateUrl: './mm-message-details.component.html',
  styleUrls: ['./mm-message-details.component.css']
})
export class MmMessageDetailsComponent implements OnInit {
  dialogRef = inject<MatDialogRef<MmMessageDetailsComponent>>(MatDialogRef);
  data = inject(MAT_DIALOG_DATA);

  errorMessage: ErrorMessage;

  constructor() {
    const data = this.data;

    this.errorMessage = data.errorMessage;
  }

  ngOnInit(): void {}
}
