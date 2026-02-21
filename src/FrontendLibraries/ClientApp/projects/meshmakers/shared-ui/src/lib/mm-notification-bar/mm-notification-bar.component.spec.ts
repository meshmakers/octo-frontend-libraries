import {waitForAsync, ComponentFixture, TestBed} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {MatSnackBar} from '@angular/material/snack-bar';
import {provideRouter} from '@angular/router';

import {MmNotificationBarComponent} from './mm-notification-bar.component';
import {MessageService} from '@meshmakers/shared-services';

describe('MmNotificationBarComponent', () => {
  let component: MmNotificationBarComponent;
  let fixture: ComponentFixture<MmNotificationBarComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [MmNotificationBarComponent],
      providers: [
        MessageService,
        {provide: MatSnackBar, useValue: jasmine.createSpyObj('MatSnackBar', ['openFromComponent'])},
        provideRouter([])
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MmNotificationBarComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
