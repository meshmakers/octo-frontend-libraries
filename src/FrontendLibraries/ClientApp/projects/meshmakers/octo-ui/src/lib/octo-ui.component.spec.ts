import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OctoUiComponent } from './octo-ui.component';

describe('OctoUiComponent', () => {
  let component: OctoUiComponent;
  let fixture: ComponentFixture<OctoUiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OctoUiComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OctoUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
