import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ErrorMessage } from '@meshmakers/shared-services';

@Component({
  standalone: false,
  selector: 'mm-message-details',
  templateUrl: './mm-message-details.component.html',
  styleUrls: ['./mm-message-details.component.css']
})
export class MmMessageDetailsComponent implements OnInit {
  errorMessage: ErrorMessage;

  constructor(
    public dialogRef: MatDialogRef<MmMessageDetailsComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.errorMessage = data.errorMessage;
  }

  ngOnInit(): void {}
}
