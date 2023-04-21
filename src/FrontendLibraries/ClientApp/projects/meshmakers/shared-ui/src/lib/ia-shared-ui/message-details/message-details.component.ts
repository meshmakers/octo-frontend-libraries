import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {ErrorMessage} from "@meshmakers/shared-services";

@Component({
  selector: 'app-message-details',
  templateUrl: './message-details.component.html',
  styleUrls: ['./message-details.component.css']
})
export class MessageDetailsComponent implements OnInit {

  errorMessage: ErrorMessage;


  constructor(public dialogRef: MatDialogRef<MessageDetailsComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
    this.errorMessage = data.errorMessage;
  }

  ngOnInit() {
  }

}
