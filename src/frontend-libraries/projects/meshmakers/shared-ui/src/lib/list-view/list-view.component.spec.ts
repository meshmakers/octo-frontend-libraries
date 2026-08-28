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

  describe('autoPageSize (fit-to-height paging)', () => {
    interface AutoApi {
      recomputeAutoPageSize: () => void;
      effectivePageSize: () => number;
    }
    const api = () => component as unknown as AutoApi;
    let applyPageSizeSpy: jasmine.Spy;
    let contentStub: { clientHeight: number; querySelectorAll: () => { getBoundingClientRect: () => { height: number } }[] } | null;

    function setContent(clientHeight: number, rowHeights: number[]): void {
      contentStub = {
        clientHeight,
        querySelectorAll: () => rowHeights.map(height => ({ getBoundingClientRect: () => ({ height }) }))
      };
    }

    beforeEach(() => {
      component.autoPageSize = true;
      contentStub = null;
      applyPageSizeSpy = jasmine.createSpy('applyPageSize');
      (component as unknown as { dataBindingDirective: unknown }).dataBindingDirective = { applyPageSize: applyPageSizeSpy };
      const host = (component as unknown as { hostElement: { nativeElement: HTMLElement } }).hostElement.nativeElement;
      spyOn(host, 'querySelector').and.callFake(() => contentStub as unknown as Element);
    });

    it('derives the page size from the TALLEST rendered row, not the first', () => {
      // First row is short (30px) but a later row is tall (100px). Fit must key
      // off the tallest so a full page never overflows: 600 / 100 = 6.
      setContent(600, [30, 30, 100]);
      api().recomputeAutoPageSize();
      expect(applyPageSizeSpy).toHaveBeenCalledOnceWith(6);
      expect(api().effectivePageSize()).toBe(6);
    });

    it('ignores ±1 jitter after the first measurement (no extra fetch on page change)', () => {
      setContent(400, [60]);           // first measurement -> floor(400/60) = 6
      api().recomputeAutoPageSize();
      expect(applyPageSizeSpy).toHaveBeenCalledOnceWith(6);
      applyPageSizeSpy.calls.reset();

      // A page whose tallest row is slightly shorter would fit 7 (400/57 = 7.01).
      // That ±1 change must be suppressed — otherwise it refetches with a
      // realigned skip and overlaps the page the user just opened.
      setContent(400, [57]);
      api().recomputeAutoPageSize();
      expect(applyPageSizeSpy).not.toHaveBeenCalled();
      expect(api().effectivePageSize()).toBe(6);
    });

    it('still applies a genuine resize that exceeds the hysteresis band', () => {
      setContent(400, [60]);           // -> 6
      api().recomputeAutoPageSize();
      applyPageSizeSpy.calls.reset();

      setContent(800, [60]);           // viewport doubled -> floor(800/60) = 13
      api().recomputeAutoPageSize();
      expect(applyPageSizeSpy).toHaveBeenCalledOnceWith(13);
      expect(api().effectivePageSize()).toBe(13);
    });
  });

  describe('toolbar actions (AB#4897)', () => {
    interface ToolbarApi {
      getToolbarItemDisabled: (item: unknown) => boolean;
      onRowSelect: (event: unknown) => void;
    }
    const api = () => component as unknown as ToolbarApi;
    const el = () => fixture.nativeElement as HTMLElement;

    it('renders a split button for an item with children AND onClick', () => {
      component.leftToolbarActions = [{
        id: 'new', type: 'link', text: 'New',
        onClick: () => Promise.resolve(),
        children: [{ id: 'variant', type: 'link', text: 'Variant' }],
      }];
      fixture.detectChanges();
      expect(el().querySelector('kendo-splitbutton')).toBeTruthy();
      expect(el().querySelector('kendo-dropdownbutton')).toBeFalsy();
    });

    it('renders a dropdown button for an item with children but no onClick', () => {
      component.leftToolbarActions = [{
        id: 'group', type: 'link', text: 'Group',
        children: [{ id: 'child', type: 'link', text: 'Child' }],
      }];
      fixture.detectChanges();
      expect(el().querySelector('kendo-dropdownbutton')).toBeTruthy();
      expect(el().querySelector('kendo-splitbutton')).toBeFalsy();
    });

    it('applies the fillMode and the tooltip fallback to plain toolbar buttons', () => {
      component.leftToolbarActions = [{
        id: 'more', type: 'link', text: '', tooltip: 'More actions',
        fillMode: 'flat',
        onClick: () => Promise.resolve(),
      }];
      fixture.detectChanges();
      const button = el().querySelector('kendo-grid-toolbar button[kendoButton]') as HTMLButtonElement;
      expect(button.classList).toContain('k-button-flat');
      expect(button.title).toBe('More actions');
    });

    it('passes the current selection (always an array) to a toolbar isDisabled callback', () => {
      const seen: unknown[] = [];
      const item = {
        id: 'sel', type: 'link', text: 'Selection',
        isDisabled: (data?: unknown) => {
          seen.push(data);
          return !Array.isArray(data) || data.length === 0;
        },
      };

      expect(api().getToolbarItemDisabled(item)).toBeTrue();
      expect(seen[0]).toEqual([]);

      const row = { id: 1 };
      api().onRowSelect({ selectedRows: [{ dataItem: row }], deselectedRows: [] });
      expect(api().getToolbarItemDisabled(item)).toBeFalse();
      expect(seen[1]).toEqual([row]);
    });
  });

  describe('card mode (AB#4930)', () => {
    interface CardApi {
      containerWidth: { set: (value: number | null) => void };
      isCardMode: boolean;
      cardTitleColumn: { field: string } | null;
      cardBodyColumns: { field: string }[];
      hasCardValue: (element: unknown, column: unknown) => boolean;
      showCheckboxColumn: () => boolean;
    }
    const api = () => component as unknown as CardApi;

    it('stays off by default at every width', () => {
      api().containerWidth.set(320);
      expect(api().isCardMode).toBeFalse();
    });

    it('activates below cardModeBelow and deactivates above it', () => {
      component.cardModeBelow = 600;
      api().containerWidth.set(599);
      expect(api().isCardMode).toBeTrue();
      api().containerWidth.set(600);
      expect(api().isCardMode).toBeFalse();
    });

    it('sets the mm-list-view-cards host class while active', () => {
      component.cardModeBelow = 600;
      api().containerWidth.set(400);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).classList).toContain('mm-list-view-cards');
    });

    it('uses the first column as card title and the rest as body lines', () => {
      component.columns = [
        { field: 'name', dataType: 'text' },
        { field: 'date', dataType: 'iso8601' },
        { field: 'amount', dataType: 'numeric' },
      ];
      expect(api().cardTitleColumn?.field).toBe('name');
      expect(api().cardBodyColumns.map((c) => c.field)).toEqual(['date', 'amount']);
    });

    it('skips empty values but keeps zero and false in the card body', () => {
      const column = { field: 'value', dataType: 'text' };
      expect(api().hasCardValue({ value: '' }, column)).toBeFalse();
      expect(api().hasCardValue({ value: null }, column)).toBeFalse();
      expect(api().hasCardValue({}, column)).toBeFalse();
      expect(api().hasCardValue({ value: 0 }, column)).toBeTrue();
      expect(api().hasCardValue({ value: false }, column)).toBeTrue();
      expect(api().hasCardValue({ value: 'x' }, column)).toBeTrue();
    });

    it('keeps the checkbox column in card mode even below hideCheckboxesBelow', () => {
      component.selectable = { enabled: true, mode: 'multiple', checkboxOnly: true };
      component.cardModeBelow = 600;
      api().containerWidth.set(400); // below the default hideCheckboxesBelow of 600
      expect(api().showCheckboxColumn()).toBeTrue();
      component.cardModeBelow = null;
      expect(api().showCheckboxColumn()).toBeFalse();
    });
  });

  describe('toolbar isDisabled selection wiring (AB#4897, retained)', () => {
    interface ToolbarApi {
      getToolbarItemDisabled: (item: unknown) => boolean;
      onRowSelect: (event: unknown) => void;
    }
    const api = () => component as unknown as ToolbarApi;

    it('re-evaluates after deselection', () => {
      const seen: unknown[] = [];
      const item = {
        id: 'sel', type: 'link', text: 'Selection',
        isDisabled: (data?: unknown) => {
          seen.push(data);
          return !Array.isArray(data) || data.length === 0;
        },
      };

      expect(api().getToolbarItemDisabled(item)).toBeTrue();
      expect(seen[0]).toEqual([]);

      const row = { id: 1 };
      api().onRowSelect({ selectedRows: [{ dataItem: row }], deselectedRows: [] });
      expect(api().getToolbarItemDisabled(item)).toBeFalse();
      expect(seen[1]).toEqual([row]);

      api().onRowSelect({ selectedRows: [], deselectedRows: [{ dataItem: row }] });
      expect(api().getToolbarItemDisabled(item)).toBeTrue();
      expect(seen[2]).toEqual([]);
    });
  });
});
