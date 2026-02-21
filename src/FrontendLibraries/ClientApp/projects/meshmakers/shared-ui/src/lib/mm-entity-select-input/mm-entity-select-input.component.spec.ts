import {waitForAsync, ComponentFixture, TestBed} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {FocusMonitor} from '@angular/cdk/a11y';
import {of} from 'rxjs';

import {MmEntitySelectInputComponent} from './mm-entity-select-input.component';

describe('MmEntitySelectInputComponent', () => {
  let component: MmEntitySelectInputComponent;
  let fixture: ComponentFixture<MmEntitySelectInputComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [MmEntitySelectInputComponent],
      providers: [
        {provide: FocusMonitor, useValue: {monitor: () => of(null), stopMonitoring: () => {}}}
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .overrideComponent(MmEntitySelectInputComponent, {set: {template: ''}})
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MmEntitySelectInputComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
