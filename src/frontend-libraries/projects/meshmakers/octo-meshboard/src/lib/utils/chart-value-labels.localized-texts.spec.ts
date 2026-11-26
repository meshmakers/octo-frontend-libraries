import { TestBed } from '@angular/core/testing';
import { WindowService } from '@progress/kendo-angular-dialog';
import {
  normalizeChartValueLabels, resolveChartValueLabels, toValueLabelRows, withPerLanguageValueLabels
} from './chart-value-labels';
import { WidgetRegistryService, WidgetConfigResult } from '../services/widget-registry.service';
import { registerDefaultWidgets } from '../registrations/default-widget-registrations';
import { AnyWidgetConfig, BarChartWidgetConfig, LineChartWidgetConfig, PieChartWidgetConfig } from '../models/meshboard.models';

/**
 * Chart category and series names given per language. AC 1: a per-language name resolves for the
 * viewer language; AC 2: single names and boards without per-language names behave as before, and
 * a config dialog (which edits single names only) never drops the per-language ones.
 */
describe('Chart value labels per language', () => {
  const FEED_IN = '1-1:2.9.0 G.03';
  const PER_LANGUAGE = { 'de-AT': 'Einspeisung', 'en-GB': 'Feed-in' };

  it('AC 1: resolves a per-language name with the resolver and keeps single names as they are', () => {
    const resolve = (_raw: string, texts: unknown) => (texts as Record<string, string>)['de-AT'] ?? '';
    expect(resolveChartValueLabels({ [FEED_IN]: PER_LANGUAGE, B: 'Bezug' }, resolve)).toEqual({ [FEED_IN]: 'Einspeisung', B: 'Bezug' });
  });

  it('AC 2: a per-language name without a match is left out, so the raw value shows', () => {
    expect(resolveChartValueLabels({ [FEED_IN]: { 'fr-FR': 'Injection' } }, () => '')).toEqual({});
  });

  it('AC 2: normalising keeps per-language names next to trimmed single names and drops empty ones', () => {
    expect(normalizeChartValueLabels({ [FEED_IN]: PER_LANGUAGE, B: '  Bezug ', C: '', D: {} }))
      .toEqual({ [FEED_IN]: PER_LANGUAGE, B: 'Bezug' });
  });

  it('AC 2: the dialog editor lists only single names; saving adds the per-language names back', () => {
    const configured = { [FEED_IN]: PER_LANGUAGE, B: 'Bezug' };
    expect(toValueLabelRows(configured).map(row => [row.value, row.label])).toEqual([['B', 'Bezug']]);
    expect(withPerLanguageValueLabels({ B: 'Grid' }, configured)).toEqual({ B: 'Grid', [FEED_IN]: PER_LANGUAGE });
    expect(withPerLanguageValueLabels({ [FEED_IN]: 'Feed-in (single)' }, configured)).toEqual({ [FEED_IN]: 'Feed-in (single)' });
    expect(withPerLanguageValueLabels(undefined, { B: 'Bezug' })).toBeUndefined();
  });

  describe('chart registrations', () => {
    let registry: WidgetRegistryService;

    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [{ provide: WindowService, useValue: { open: vi.fn() } }] });
      registry = TestBed.inject(WidgetRegistryService);
      registerDefaultWidgets(registry);
    });

    function apply<T extends AnyWidgetConfig>(type: T['type'], extra: Partial<T>, result: Partial<WidgetConfigResult> & Record<string, unknown>): T {
      const widget = { ...registry.createWidget(type, { id: 'w', title: 'Energy', col: 1, row: 1, colSpan: 2, rowSpan: 2 }), ...extra } as T;
      return registry.applyConfigResult(widget, { ckTypeId: '', queryRtId: 'q', queryName: 'Q', ...result } as WidgetConfigResult) as T;
    }

    it('AC 2: a pie, bar and line dialog save keeps the per-language names of the board', () => {
      const pie = apply<PieChartWidgetConfig>('pieChart', { categoryLabels: { [FEED_IN]: PER_LANGUAGE } }, { categoryLabels: { B: 'Bezug' } });
      expect(pie.categoryLabels).toEqual({ B: 'Bezug', [FEED_IN]: PER_LANGUAGE });

      const bar = apply<BarChartWidgetConfig>('barChart', { categoryLabels: { [FEED_IN]: PER_LANGUAGE }, seriesLabels: { S: PER_LANGUAGE } }, {});
      expect([bar.categoryLabels, bar.seriesLabels]).toEqual([{ [FEED_IN]: PER_LANGUAGE }, { S: PER_LANGUAGE }]);

      const line = apply<LineChartWidgetConfig>('lineChart', { seriesLabels: { S: PER_LANGUAGE } }, {});
      expect(line.seriesLabels).toEqual({ S: PER_LANGUAGE });
    });
  });
});
