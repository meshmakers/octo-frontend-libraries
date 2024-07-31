import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {MmConfirmationWindowComponent} from './mm-confirmation-window.component';

describe('ConfirmationWindowComponent', () => {
  let component: MmConfirmationWindowComponent;
  let fixture: ComponentFixture<MmConfirmationWindowComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [MmConfirmationWindowComponent]
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
