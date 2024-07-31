import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {MmMessageDetailsComponent} from './mm-message-details.component';

describe('MessageDetailsComponent', () => {
  let component: MmMessageDetailsComponent;
  let fixture: ComponentFixture<MmMessageDetailsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [MmMessageDetailsComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MmMessageDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
