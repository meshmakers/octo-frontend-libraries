import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IaMultipleEntitySelectInputComponent } from './mm-multiple-entity-select-input.component';

describe('IaMultipleEntitySelectInputComponent', () => {
  let component: IaMultipleEntitySelectInputComponent;
  let fixture: ComponentFixture<IaMultipleEntitySelectInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ IaMultipleEntitySelectInputComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IaMultipleEntitySelectInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
