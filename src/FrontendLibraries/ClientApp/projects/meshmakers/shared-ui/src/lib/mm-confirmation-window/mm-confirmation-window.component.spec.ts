import {waitForAsync, ComponentFixture, TestBed} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';

import {MmConfirmationWindowComponent} from './mm-confirmation-window.component';

describe('ConfirmationWindowComponent', () => {
  let component: MmConfirmationWindowComponent;
  let fixture: ComponentFixture<MmConfirmationWindowComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [MmConfirmationWindowComponent],
      providers: [
        {provide: MatDialogRef, useValue: jasmine.createSpyObj('MatDialogRef', ['close'])},
        {provide: MAT_DIALOG_DATA, useValue: {title: 'Test', message: 'Test message'}}
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MmConfirmationWindowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
