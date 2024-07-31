import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {MmProgressWindowComponent} from './mm-progress-window.component';

describe('ProgressWindowComponent', () => {
  let component: MmProgressWindowComponent;
  let fixture: ComponentFixture<MmProgressWindowComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [MmProgressWindowComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MmProgressWindowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
