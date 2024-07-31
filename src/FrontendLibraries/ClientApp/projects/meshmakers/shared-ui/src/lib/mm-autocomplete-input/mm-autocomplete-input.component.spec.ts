import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {IaAutocompleteInput} from './ia-autocomplete-input.component';

describe('IaAutocompleteInputComponent', () => {
  let component: IaAutocompleteInput;
  let fixture: ComponentFixture<IaAutocompleteInput>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [IaAutocompleteInput]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(IaAutocompleteInput);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
