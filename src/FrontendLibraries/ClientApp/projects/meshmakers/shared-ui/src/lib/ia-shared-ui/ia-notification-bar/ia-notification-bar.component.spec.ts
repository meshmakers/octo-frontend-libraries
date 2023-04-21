import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {IaNotificationBarComponent} from './ia-notification-bar.component';

describe('IaNotificationBarComponent', () => {
  let component: IaNotificationBarComponent;
  let fixture: ComponentFixture<IaNotificationBarComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [IaNotificationBarComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(IaNotificationBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
