import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MmBreadcrumbComponent } from './mm-breadcrumb.component';

describe('MatBreadcrumbComponent', () => {
  let component: MmBreadcrumbComponent;
  let fixture: ComponentFixture<MmBreadcrumbComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MmBreadcrumbComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MmBreadcrumbComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
