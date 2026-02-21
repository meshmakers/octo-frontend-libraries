import {waitForAsync, ComponentFixture, TestBed} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Clipboard} from '@angular/cdk/clipboard';

import {MmMessageDetailsComponent} from './mm-message-details.component';

describe('MessageDetailsComponent', () => {
  let component: MmMessageDetailsComponent;
  let fixture: ComponentFixture<MmMessageDetailsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [MmMessageDetailsComponent],
      providers: [
        {provide: MatDialogRef, useValue: jasmine.createSpyObj('MatDialogRef', ['close'])},
        {provide: MAT_DIALOG_DATA, useValue: {message: 'test'}},
        {provide: MatSnackBar, useValue: jasmine.createSpyObj('MatSnackBar', ['open'])},
        {provide: Clipboard, useValue: jasmine.createSpyObj('Clipboard', ['copy'])}
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MmMessageDetailsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
