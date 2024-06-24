import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {MmNotificationBarComponent} from './mm-notification-bar.component';

describe('IaNotificationBarComponent', () => {
  let component: MmNotificationBarComponent;
  let fixture: ComponentFixture<MmNotificationBarComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [MmNotificationBarComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MmNotificationBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
