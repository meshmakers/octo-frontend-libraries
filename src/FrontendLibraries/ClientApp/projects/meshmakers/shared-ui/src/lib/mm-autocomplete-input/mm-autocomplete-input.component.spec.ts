import {waitForAsync, ComponentFixture, TestBed} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {FocusMonitor} from '@angular/cdk/a11y';
import {of} from 'rxjs';

import {MmAutocompleteInputComponent} from './mm-autocomplete-input.component';

describe('MmAutocompleteInputComponent', () => {
  let component: MmAutocompleteInputComponent;
  let fixture: ComponentFixture<MmAutocompleteInputComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [MmAutocompleteInputComponent],
      providers: [
        {provide: FocusMonitor, useValue: {monitor: () => of(null), stopMonitoring: () => {}}}
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .overrideComponent(MmAutocompleteInputComponent, {set: {template: ''}})
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MmAutocompleteInputComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
