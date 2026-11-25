import { Component, WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService, WindowService } from '@progress/kendo-angular-dialog';
import { TimeRangePickerLabels, WindowStateService } from '@meshmakers/shared-ui';
import { BreadCrumbService } from '@meshmakers/shared-services';
import { MeshBoardViewComponent } from './meshboard-view.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { EditModeStateService } from '../../services/edit-mode-state.service';
import { WidgetFactoryService } from '../../services/widget-factory.service';
import { WidgetRegistryService } from '../../services/widget-registry.service';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { AnyWidgetConfig, MeshBoardConfig } from '../../models/meshboard.models';
import { MESHBOARD_LANGUAGE } from '../../utils/meshboard-language';
import { MESHBOARD_MESSAGES, MeshBoardMessages } from '../../utils/meshboard-messages';

@Component({
  standalone: true,
  imports: [MeshBoardViewComponent],
  template: '<mm-meshboard-view></mm-meshboard-view>'
})
class HostComponent {}

/**
 * Board name, description, widget titles, widget explanations and period labels in the host language:
 * picked per language, switched live without reloading the board, falling back to the single text.
 */
describe('MeshBoardViewComponent - author texts in the host language', () => {
  const GERMAN_PICKER: TimeRangePickerLabels = { rangeType: 'Zeitraum' };
  const ENGLISH_PICKER: TimeRangePickerLabels = { rangeType: 'Period' };

  interface Rendered {
    fixture: ComponentFixture<HostComponent>;
    el: HTMLElement;
    config: WritableSignal<MeshBoardConfig>;
    language: WritableSignal<string | null>;
    messages: WritableSignal<MeshBoardMessages>;
    loads: () => number;
    breadcrumb: ReturnType<typeof vi.fn>;
    updateWidget: ReturnType<typeof vi.fn>;
  }

  function widget(extra: Partial<AnyWidgetConfig> = {}): AnyWidgetConfig {
    return {
      id: 'w1', type: 'kpi', title: 'Energy quantities', col: 1, row: 1, colSpan: 1, rowSpan: 1,
      valueAttribute: '', queryMode: 'simpleCount', dataSource: { type: 'static' }, ...extra
    } as AnyWidgetConfig;
  }

  function board(widgets: AnyWidgetConfig[], extra: Partial<MeshBoardConfig> = {}): MeshBoardConfig {
    return { id: 'b1', name: 'Energy quantity statistics', columns: 4, rowHeight: 200, gap: 16, widgets, autoRefreshSeconds: 0, ...extra };
  }

  async function render(options: {
    config: MeshBoardConfig;
    language?: string | null;
    withLanguage?: boolean;
    messages?: MeshBoardMessages;
    routeLabels?: TimeRangePickerLabels;
    timeFilter?: boolean;
  }): Promise<Rendered> {
    const config = signal(options.config);
    const language = signal<string | null>(options.language ?? null);
    const messages = signal<MeshBoardMessages>(options.messages ?? {});
    const timeFilter = options.timeFilter ? { enabled: true, selection: { type: 'year' as const, year: 2026 } } : undefined;
    const load = vi.fn().mockResolvedValue([]);
    const breadcrumb = vi.fn();
    const updateWidget = vi.fn();
    const stateService = {
      meshBoardConfig: config,
      isLoading: signal(false),
      isModelAvailable: signal(true),
      hiddenForViewer: signal(new Set<string>()),
      widgetContentHeights: signal(new Map<string, number>()),
      persistedMeshBoardId: signal<string | null>(null),
      variableResolutionErrors: signal([]),
      failedEntitySelectorScopeIds: signal<string[]>([]),
      needsPickEntitySelectorIds: signal<string[]>([]),
      pickerScopes: signal({}),
      timeZoneMode: signal('local'),
      isTimeFilterEnabled: () => !!timeFilter,
      getTimeFilterConfig: () => timeFilter,
      setTimeFilterVariables: vi.fn(),
      resolveCurrentTimeRange: () => null,
      getEntitySelectors: () => [],
      getConfig: () => config(),
      resolveShiftedPeriod: () => null,
      viewerTimeSelection: signal(null),
      setViewerTimeSelection: vi.fn(),
      updateTimeFilterSelection: vi.fn(),
      triggerRefresh: vi.fn(),
      updateWidget,
      switchToMeshBoardByWellKnownName: load,
      loadInitialMeshBoard: load
    };
    const route = {
      snapshot: {
        data: { meshBoardWellKnownName: 'board', meshBoardReadonly: true, ...(options.routeLabels ? { timeRangeLabels: options.routeLabels } : {}) },
        paramMap: convertToParamMap({}),
        queryParamMap: convertToParamMap({})
      },
      parent: null,
      root: { firstChild: null }
    };
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: ActivatedRoute, useValue: route },
        { provide: MeshBoardStateService, useValue: stateService },
        { provide: MeshBoardVariableService, useValue: {} },
        { provide: EditModeStateService, useValue: { isEditMode: signal(false), isSaving: signal(false), reset: vi.fn(), hasUnsavedChanges: () => false, enterEditMode: vi.fn() } },
        { provide: WidgetFactoryService, useValue: {} },
        { provide: WidgetRegistryService, useValue: { getWidgetComponent: () => null } },
        { provide: MeshBoardDataService, useValue: {} },
        { provide: MeshBoardGridService, useValue: {} },
        { provide: DialogService, useValue: {} },
        { provide: WindowService, useValue: {} },
        { provide: WindowStateService, useValue: {} },
        { provide: BreadCrumbService, useValue: { updateBreadcrumbLabels: breadcrumb } },
        { provide: MESHBOARD_MESSAGES, useValue: messages },
        ...(options.withLanguage === false ? [] : [{ provide: MESHBOARD_LANGUAGE, useValue: language }])
      ]
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, config, language, messages, loads: () => load.mock.calls.length, breadcrumb, updateWidget };
  }

  function rerender(r: Rendered): void {
    r.fixture.detectChanges();
  }

  const header = (el: HTMLElement) => el.querySelector('.widget-header .widget-title')?.textContent?.trim();
  const boardName = (el: HTMLElement) => el.querySelector('.meshboard-title')?.textContent?.trim();
  const boardDescription = (el: HTMLElement) => el.querySelector('.meshboard-description')?.textContent?.trim();
  const infoIcon = (el: HTMLElement) => el.querySelector<HTMLElement>('.widget-header .widget-info');

  afterEach(() => TestBed.resetTestingModule());

  describe('widget title per language', () => {
    const titles = { 'de-AT': 'Energiemengen', 'en-GB': 'Energy quantities' };

    it('reads the title of the host language and follows a language change without reloading the board', async () => {
      const r = await render({ config: board([widget({ titles })]), language: 'de-AT' });
      expect(header(r.el)).toBe('Energiemengen');
      const loadsBefore = r.loads();

      r.language.set('en-GB');
      rerender(r);

      expect(header(r.el)).toBe('Energy quantities');
      expect(r.loads()).toBe(loadsBefore);
    });

    it('never picks a sibling culture: de-DE shows the single title, not the de-AT entry', async () => {
      const r = await render({ config: board([widget({ title: 'Energy quantities', titles: { 'de-AT': 'Energiemengen' } })]), language: 'de-DE' });

      expect(header(r.el)).toBe('Energy quantities');
    });
  });

  describe('board name and description per language', () => {
    const names = { 'de-AT': 'Energiemengen-Statistik', 'en-GB': 'Energy quantity statistics' };
    const descriptions = { 'de-AT': 'Monatswerte', 'en-GB': 'Monthly values' };

    it('shows name and description of the host language in the header and follows a language change', async () => {
      const r = await render({ config: board([], { names, description: 'Monthly values', descriptions }), language: 'de-AT' });
      expect(boardName(r.el)).toBe('Energiemengen-Statistik');
      expect(boardDescription(r.el)).toBe('Monatswerte');

      r.language.set('en-GB');
      rerender(r);

      expect(boardName(r.el)).toBe('Energy quantity statistics');
      expect(boardDescription(r.el)).toBe('Monthly values');
    });

    it('puts the board name of the host language into the breadcrumb and updates it on a language change', async () => {
      const r = await render({ config: board([], { names }), language: 'de-AT' });
      expect(r.breadcrumb).toHaveBeenLastCalledWith({ name: 'Energiemengen-Statistik' });

      r.language.set('en-GB');
      rerender(r);
      await r.fixture.whenStable();

      expect(r.breadcrumb).toHaveBeenLastCalledWith({ name: 'Energy quantity statistics' });
    });
  });

  describe('period labels', () => {
    const pickerText = (el: HTMLElement) => el.querySelector('mm-time-range-picker')?.textContent ?? '';

    it('shows the picker labels of the host messages and relabels on a language change', async () => {
      const r = await render({ config: board([]), messages: { timeRangeLabels: GERMAN_PICKER }, timeFilter: true });
      expect(pickerText(r.el)).toContain('Zeitraum');

      r.messages.set({ timeRangeLabels: ENGLISH_PICKER });
      rerender(r);

      expect(pickerText(r.el)).toContain('Period');
      expect(pickerText(r.el)).not.toContain('Zeitraum');
    });

    it('route data labels win over the host messages', async () => {
      const r = await render({ config: board([]), messages: { timeRangeLabels: GERMAN_PICKER }, routeLabels: ENGLISH_PICKER, timeFilter: true });

      expect(pickerText(r.el)).toContain('Period');
      expect(pickerText(r.el)).not.toContain('Zeitraum');
    });
  });

  describe('fallback', () => {
    it('without a language source shows the single title, name and description, as before', async () => {
      const r = await render({
        config: board([widget({ titles: { 'de-AT': 'Energiemengen' } })], { names: { 'de-AT': 'Statistik' }, description: 'Monthly values', descriptions: { 'de-AT': 'Monatswerte' } }),
        withLanguage: false
      });

      expect(header(r.el)).toBe('Energy quantities');
      expect(boardName(r.el)).toBe('Energy quantity statistics');
      expect(boardDescription(r.el)).toBe('Monthly values');
    });

    it('with no entry for the current language shows the single texts', async () => {
      const r = await render({ config: board([widget({ titles: { 'de-AT': 'Energiemengen' } })], { names: { 'de-AT': 'Statistik' } }), language: 'fr-FR' });

      expect(header(r.el)).toBe('Energy quantities');
      expect(boardName(r.el)).toBe('Energy quantity statistics');
    });

    it('ignores an empty or non-string entry, logs one warning naming the widget and never shows an empty header', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const r = await render({ config: board([widget({ titles: { 'de-AT': '', 'en-GB': 42 as unknown as string } })]), language: 'de-AT' });
      rerender(r);
      expect(header(r.el)).toBe('Energy quantities');

      r.language.set('en-GB');
      rerender(r);

      expect(header(r.el)).toBe('Energy quantities');
      const titleWarnings = warn.mock.calls.filter(call => String(call[0]).includes('titles'));
      expect(titleWarnings.length).toBe(1);
      expect(String(titleWarnings[0][0])).toContain('widget "Energy quantities" (w1)');
    });

    it('ignores an empty board name entry with one warning naming the board', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const r = await render({ config: board([], { names: { 'de-AT': '' } }), language: 'de-AT' });
      rerender(r);

      expect(boardName(r.el)).toBe('Energy quantity statistics');
      const nameWarnings = warn.mock.calls.filter(call => String(call[0]).includes('names'));
      expect(nameWarnings.length).toBe(1);
      expect(String(nameWarnings[0][0])).toContain('MeshBoard "Energy quantity statistics"');
    });
  });

  describe('widget explanation (info icon)', () => {
    const descriptions = { 'de-AT': 'Summe aller Zählpunkte im Monat', 'en-GB': 'Sum of all metering points per month' };

    it('shows an info icon whose tooltip is the explanation in the host language, and follows a language change', async () => {
      const r = await render({ config: board([widget({ description: 'Sum of all metering points per month', descriptions })]), language: 'de-AT' });
      const icon = infoIcon(r.el);
      expect(icon).not.toBeNull();
      expect(icon?.getAttribute('title')).toBe('Summe aller Zählpunkte im Monat');
      expect(icon?.getAttribute('aria-label')).toBe('Summe aller Zählpunkte im Monat');

      r.language.set('en-GB');
      rerender(r);

      expect(infoIcon(r.el)?.getAttribute('title')).toBe('Sum of all metering points per month');
    });

    it('shows the info icon for an explanation given only per language', async () => {
      const r = await render({ config: board([widget({ descriptions })]), language: 'en-GB' });

      expect(infoIcon(r.el)?.getAttribute('title')).toBe('Sum of all metering points per month');
    });

    it('shows no info icon when the widget has no explanation', async () => {
      const r = await render({ config: board([widget()]), language: 'de-AT' });

      expect(header(r.el)).toBe('Energy quantities');
      expect(infoIcon(r.el)).toBeNull();
    });

    it('shows no info icon when the explanation has no text for the language and no single text', async () => {
      const r = await render({ config: board([widget({ descriptions: { 'de-AT': 'Nur Deutsch' } })]), language: 'en-GB' });

      expect(infoIcon(r.el)).toBeNull();
    });
  });

  describe('info icon position and size', () => {
    it('sits directly after the title, in the title line, so a long title truncates before it', async () => {
      const r = await render({ config: board([widget({ description: 'Sum of all metering points per month' })]), language: 'en-GB' });
      const icon = infoIcon(r.el);

      expect(icon?.previousElementSibling?.classList.contains('widget-title')).toBe(true);
      expect(icon?.parentElement?.classList.contains('widget-title-row')).toBe(true);
      expect(icon?.closest('.widget-title-block')).not.toBeNull();
    });

    it('uses the medium svg icon size (16px)', async () => {
      const r = await render({ config: board([widget({ description: 'Sum of all metering points per month' })]), language: 'en-GB' });

      expect(infoIcon(r.el)?.querySelector('.k-svg-icon')?.classList.contains('k-icon-md')).toBe(true);
    });
  });

  describe('Studio keeps authored texts', () => {
    it('editing the single title in the edit widget dialog keeps the per-language titles and the explanation', async () => {
      const original = widget({ titles: { 'de-AT': 'Energiemengen' }, description: 'Info', descriptions: { 'de-AT': 'Info DE' } });
      const r = await render({ config: board([original]), language: 'de-AT' });
      const view = r.fixture.debugElement.children[0].componentInstance as MeshBoardViewComponent;

      view.onEditWidgetSave({ id: 'w1', title: 'Energy totals', col: 1, row: 1, colSpan: 1, rowSpan: 1 });

      const update = r.updateWidget.mock.calls[0][1] as (w: AnyWidgetConfig) => AnyWidgetConfig;
      const saved = update(original);
      expect(saved.title).toBe('Energy totals');
      expect(saved.titles).toEqual({ 'de-AT': 'Energiemengen' });
      expect(saved.description).toBe('Info');
      expect(saved.descriptions).toEqual({ 'de-AT': 'Info DE' });
    });
  });
});
