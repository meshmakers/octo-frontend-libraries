import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {provideRouter} from '@angular/router';
import {BreadcrumbService} from '@meshmakers/shared-services';
import {Subject} from 'rxjs';

import {MmBreadcrumbComponent} from './mm-breadcrumb.component';

describe('MatBreadcrumbComponent', () => {
  let component: MmBreadcrumbComponent;
  let fixture: ComponentFixture<MmBreadcrumbComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MmBreadcrumbComponent],
      providers: [
        provideRouter([]),
        {provide: BreadcrumbService, useValue: {
          breadcrumbLabels: new Subject(),
          newBreadcrumb: new Subject()
        }}
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MmBreadcrumbComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
