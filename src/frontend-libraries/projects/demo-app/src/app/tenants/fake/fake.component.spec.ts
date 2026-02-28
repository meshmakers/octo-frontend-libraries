import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute, Event as RouterEvent } from '@angular/router';
import { Subject } from 'rxjs';

import { FakeComponent } from './fake.component';
import { BreadCrumbService } from '@meshmakers/shared-services';

describe('FakeComponent', () => {
  let component: FakeComponent;
  let fixture: ComponentFixture<FakeComponent>;
  let mockBreadCrumbService: jasmine.SpyObj<BreadCrumbService>;
  let mockRouter: { events: Subject<RouterEvent>; navigate: jasmine.Spy };

  beforeEach(async () => {
    mockBreadCrumbService = jasmine.createSpyObj('BreadCrumbService', ['updateBreadcrumbLabels']);
    mockBreadCrumbService.updateBreadcrumbLabels.and.returnValue(Promise.resolve());

    mockRouter = {
      events: new Subject<RouterEvent>(),
      navigate: jasmine.createSpy('navigate')
    };

    const mockActivatedRoute = {
      root: {
        snapshot: { data: {}, params: {}, url: [] },
        children: []
      }
    };

    await TestBed.configureTestingModule({
      imports: [FakeComponent],
      providers: [
        { provide: BreadCrumbService, useValue: mockBreadCrumbService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FakeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
