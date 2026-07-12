import '@angular/localize/init';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { CommandSettingsService } from '@meshmakers/shared-services';

import { ListViewComponent } from './list-view.component';

describe('MmTableComponent', () => {
  let component: ListViewComponent;
  let fixture: ComponentFixture<ListViewComponent>;
  let mockRouter: { navigate: jasmine.Spy };
  let mockCommandSettingsService: { navigateRelativeToRoute: Record<string, unknown>; commandItems: unknown[] };

  beforeEach(async () => {
    mockRouter = {
      navigate: jasmine.createSpy('navigate')
    };

    mockCommandSettingsService = {
      navigateRelativeToRoute: {},
      commandItems: []
    };

    await TestBed.configureTestingModule({
      imports: [ListViewComponent],
      providers: [
        provideNoopAnimations(),
        { provide: Router, useValue: mockRouter },
        { provide: CommandSettingsService, useValue: mockCommandSettingsService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('badge columns', () => {
    const badgeColumn = {
      field: 'flag',
      displayName: 'Flag',
      dataType: 'badge' as const,
      badgeMapping: { true: { label: 'Dynamic', color: '#64ceb9' } }
    };

    it('resolves a mapped value to its badge appearance', () => {
      const badge = (component as unknown as {
        getBadgeMapping: (item: Record<string, unknown>, col: unknown) => { label?: string } | null;
      }).getBadgeMapping({ flag: true }, badgeColumn);
      expect(badge?.label).toBe('Dynamic');
    });

    it('resolves an unmapped value to null (template renders the neutral pill, or nothing with badgeHideUnmapped)', () => {
      const badge = (component as unknown as {
        getBadgeMapping: (item: Record<string, unknown>, col: unknown) => unknown;
      }).getBadgeMapping({ flag: false }, badgeColumn);
      expect(badge).toBeNull();
    });
  });
});
