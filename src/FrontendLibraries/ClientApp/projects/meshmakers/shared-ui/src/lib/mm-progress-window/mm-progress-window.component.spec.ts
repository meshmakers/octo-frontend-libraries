import {waitForAsync, ComponentFixture, TestBed} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {of} from 'rxjs';

import {MmProgressWindowComponent} from './mm-progress-window.component';

describe('ProgressWindowComponent', () => {
  let component: MmProgressWindowComponent;
  let fixture: ComponentFixture<MmProgressWindowComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [MmProgressWindowComponent],
      providers: [
        {provide: MAT_DIALOG_DATA, useValue: {
          title: 'Test',
          isDeterminate: false,
          progress: of({statusText: 'Loading...', progressValue: 0}),
          isCancelOperationAvailable: false,
          cancelOperation: () => {}
        }}
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MmProgressWindowComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
