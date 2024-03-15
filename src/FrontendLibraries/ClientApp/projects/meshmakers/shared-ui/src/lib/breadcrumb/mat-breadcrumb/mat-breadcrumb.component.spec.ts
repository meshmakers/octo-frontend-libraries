import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatBreadcrumbComponent } from './mat-breadcrumb.component';

describe('MatBreadcrumbComponent', () => {
  let component: MatBreadcrumbComponent;
  let fixture: ComponentFixture<MatBreadcrumbComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatBreadcrumbComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MatBreadcrumbComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
