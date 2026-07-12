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

  describe('responsive columns (hideBelow / minWidth)', () => {
    interface ResponsiveApi {
      containerWidth: { set: (value: number | null) => void };
      isColumnHidden: (col: unknown) => boolean;
      getEffectiveWidth: (col: unknown) => number | undefined;
    }
    const api = () => component as unknown as ResponsiveApi;

    it('keeps all columns visible before the first width measurement', () => {
      const column = { field: 'version', hideBelow: 1280 };
      expect(api().isColumnHidden(column)).toBeFalse();
    });

    it('hides a column below its hideBelow breakpoint and shows it above', () => {
      const column = { field: 'version', hideBelow: 1280 };
      api().containerWidth.set(1000);
      expect(api().isColumnHidden(column)).toBeTrue();
      api().containerWidth.set(1400);
      expect(api().isColumnHidden(column)).toBeFalse();
    });

    it('never hides columns without hideBelow', () => {
      const column = { field: 'name' };
      api().containerWidth.set(100);
      expect(api().isColumnHidden(column)).toBeFalse();
    });

    it('keeps fixed-width columns at their configured width', () => {
      component.columns = [{ field: 'type', width: 80, minWidth: 200 }];
      api().containerWidth.set(500);
      expect(api().getEffectiveWidth(component.columns[0])).toBe(80);
    });

    it('leaves auto columns auto while there is enough room', () => {
      component.columns = [
        { field: 'name', minWidth: 200 },
        { field: 'type', width: 80 }
      ];
      component.selectable = { enabled: false };
      api().containerWidth.set(1200);
      expect(api().getEffectiveWidth(component.columns[0])).toBeUndefined();
    });

    it('pins auto columns to minWidth when fixed columns squeeze them below it', () => {
      component.columns = [
        { field: 'name', minWidth: 200 },
        { field: 'type', width: 900 }
      ];
      component.selectable = { enabled: false };
      api().containerWidth.set(1000);
      expect(api().getEffectiveWidth(component.columns[0])).toBe(200);
    });

    it('ignores hidden columns when computing the remaining space', () => {
      component.columns = [
        { field: 'name', minWidth: 200 },
        { field: 'message', width: 900, hideBelow: 1600 }
      ];
      component.selectable = { enabled: false };
      // At 1000px the 900px column is hidden, so the auto column has plenty of room.
      api().containerWidth.set(1000);
      expect(api().getEffectiveWidth(component.columns[0])).toBeUndefined();
    });

    it('returns undefined for auto columns without minWidth', () => {
      component.columns = [{ field: 'name' }];
      api().containerWidth.set(100);
      expect(api().getEffectiveWidth(component.columns[0])).toBeUndefined();
    });
  });

  describe('checkbox column hiding (hideCheckboxesBelow)', () => {
    interface CheckboxApi {
      containerWidth: { set: (value: number | null) => void };
      showCheckboxColumn: () => boolean;
    }
    const api = () => component as unknown as CheckboxApi;

    beforeEach(() => {
      component.selectable = { mode: 'multiple', enabled: true };
      component.showRowCheckBoxes = true;
    });

    it('shows checkboxes before the first width measurement', () => {
      expect(api().showCheckboxColumn()).toBeTrue();
    });

    it('hides checkboxes below the default 600px breakpoint and shows them above', () => {
      api().containerWidth.set(400);
      expect(api().showCheckboxColumn()).toBeFalse();
      api().containerWidth.set(800);
      expect(api().showCheckboxColumn()).toBeTrue();
    });

    it('always shows checkboxes when hideCheckboxesBelow is null', () => {
      component.hideCheckboxesBelow = null;
      api().containerWidth.set(400);
      expect(api().showCheckboxColumn()).toBeTrue();
    });

    it('never shows checkboxes when selection is disabled', () => {
      component.selectable = { enabled: false };
      api().containerWidth.set(800);
      expect(api().showCheckboxColumn()).toBeFalse();
    });
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
