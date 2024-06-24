import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {MmEntitySelectInputComponent} from './mm-entity-select-input.component';

describe('IaEntitySelectInputComponent', () => {
  let component: MmEntitySelectInputComponent;
  let fixture: ComponentFixture<MmEntitySelectInputComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [MmEntitySelectInputComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MmEntitySelectInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
