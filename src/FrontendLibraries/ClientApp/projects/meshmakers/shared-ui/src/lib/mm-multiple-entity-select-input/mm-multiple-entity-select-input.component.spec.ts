import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {FocusMonitor} from '@angular/cdk/a11y';
import {of} from 'rxjs';

import {MmMultipleEntitySelectInputComponent} from './mm-multiple-entity-select-input.component';

describe('MmMultipleEntitySelectInputComponent', () => {
  let component: MmMultipleEntitySelectInputComponent;
  let fixture: ComponentFixture<MmMultipleEntitySelectInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MmMultipleEntitySelectInputComponent],
      providers: [
        {provide: FocusMonitor, useValue: {monitor: () => of(null), stopMonitoring: () => {}}}
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .overrideComponent(MmMultipleEntitySelectInputComponent, {set: {template: ''}})
    .compileComponents();

    fixture = TestBed.createComponent(MmMultipleEntitySelectInputComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
