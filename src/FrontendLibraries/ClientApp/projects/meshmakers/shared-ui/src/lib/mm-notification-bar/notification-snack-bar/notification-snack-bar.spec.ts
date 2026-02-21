import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {MAT_SNACK_BAR_DATA, MatSnackBarRef} from '@angular/material/snack-bar';
import {MatDialog} from '@angular/material/dialog';

import {NotificationSnackBar} from './notification-snack-bar';

describe('NotificationSnackBar', () => {
  let component: NotificationSnackBar;
  let fixture: ComponentFixture<NotificationSnackBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationSnackBar],
      providers: [
        {provide: MAT_SNACK_BAR_DATA, useValue: {message: 'test', isError: false}},
        {provide: MatSnackBarRef, useValue: jasmine.createSpyObj('MatSnackBarRef', ['dismiss', 'dismissWithAction'])},
        {provide: MatDialog, useValue: jasmine.createSpyObj('MatDialog', ['open'])}
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .overrideComponent(NotificationSnackBar, {set: {template: '', imports: []}})
    .compileComponents();

    fixture = TestBed.createComponent(NotificationSnackBar);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
