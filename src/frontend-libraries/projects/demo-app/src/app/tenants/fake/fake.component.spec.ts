import type { Mock, MockedObject } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute, Event as RouterEvent } from '@angular/router';
import { Subject } from 'rxjs';

import { FakeComponent } from './fake.component';
import { BreadCrumbService } from '@meshmakers/shared-services';

describe('FakeComponent', () => {
    let component: FakeComponent;
    let fixture: ComponentFixture<FakeComponent>;
    let mockBreadCrumbService: MockedObject<BreadCrumbService>;
    let mockRouter: {
        events: Subject<RouterEvent>;
        navigate: Mock;
    };

    beforeEach(async () => {
        mockBreadCrumbService = {
            updateBreadcrumbLabels: vi.fn().mockName("BreadCrumbService.updateBreadcrumbLabels")
        } as unknown as MockedObject<BreadCrumbService>;
        mockBreadCrumbService.updateBreadcrumbLabels.mockResolvedValue(undefined);

        mockRouter = {
            events: new Subject<RouterEvent>(),
            navigate: vi.fn().mockName('navigate')
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
