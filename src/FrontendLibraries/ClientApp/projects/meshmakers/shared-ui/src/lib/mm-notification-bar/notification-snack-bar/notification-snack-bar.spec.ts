import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationSnackBar } from './notification-snack-bar';

describe('NotificationSnackBar', () => {
  let component: NotificationSnackBar;
  let fixture: ComponentFixture<NotificationSnackBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationSnackBar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationSnackBar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
