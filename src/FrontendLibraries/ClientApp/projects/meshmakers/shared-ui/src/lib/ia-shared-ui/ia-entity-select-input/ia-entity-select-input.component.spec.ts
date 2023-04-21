import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {IaEntitySelectInput} from './ia-entity-select-input.component';

describe('IaEntitySelectInputComponent', () => {
  let component: IaEntitySelectInput;
  let fixture: ComponentFixture<IaEntitySelectInput>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [IaEntitySelectInput]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(IaEntitySelectInput);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
