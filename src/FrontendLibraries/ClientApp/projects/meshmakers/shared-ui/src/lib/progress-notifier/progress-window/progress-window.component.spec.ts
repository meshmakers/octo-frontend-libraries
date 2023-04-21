import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {ProgressWindowComponent} from './progress-window.component';

describe('ProgressWindowComponent', () => {
  let component: ProgressWindowComponent;
  let fixture: ComponentFixture<ProgressWindowComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ProgressWindowComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ProgressWindowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
