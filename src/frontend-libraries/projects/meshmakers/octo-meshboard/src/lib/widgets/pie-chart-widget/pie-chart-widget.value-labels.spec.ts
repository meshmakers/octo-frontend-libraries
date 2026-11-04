import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PieChartWidgetComponent } from './pie-chart-widget.component';
import { QueryExecutorService } from '../../services/query-executor.service';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { MESHBOARD_LABEL_RESOLVER, MeshBoardLabelResolver } from '../../utils/meshboard-labels';
import { PieChartWidgetConfig } from '../../models/meshboard.models';

/**
 * Pie chart `categoryLabels` (AB#7235): the OBIS-code fixture of the energy boards. Precedence:
 * widget config entry, then the host label resolver (AB#5622), then today's text.
 */
describe('PieChartWidgetComponent categoryLabels (AB#7235)', () => {
  const FEED_IN = '1-1:2.9.0 G.03';
  const SURPLUS = '1-1:2.9.0 P.01T';

  function row(category: string, value: number) {
    return {
      __typename: 'StreamDataQueryRow',
      cells: [{ attributePath: 'obisCode', value: category }, { attributePath: 'energy_sum', value }]
    };
  }

  const rows = [row(FEED_IN, 10), row(SURPLUS, 4), row('NOT_PAID', 1)];

  function config(overrides: Partial<PieChartWidgetConfig> = {}): PieChartWidgetConfig {
    return {
      id: 'w1', type: 'pieChart', title: 'Energy', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: { type: 'persistentQuery', queryRtId: 'q1', queryFamily: 'streamData', entitySelectorId: 'mp' },
      chartType: 'pie', categoryField: 'obisCode', valueField: 'energy_sum', showLabels: true,
      ...overrides
    };
  }

  function setup(cfg: PieChartWidgetConfig, resolver?: MeshBoardLabelResolver) {
    const execute = vi.fn().mockName('QueryExecutorService.execute').mockReturnValue(of({
      family: 'streamData', queryRtId: 'q1', associatedCkTypeId: null,
      columns: [{ attributePath: 'obisCode' }, { attributePath: 'energy_sum' }], rows, totalCount: rows.length, hasNextPage: false, endCursor: null
    }));
    TestBed.configureTestingModule({
      providers: [
        { provide: QueryExecutorService, useValue: { execute } },
        { provide: MeshBoardDataService, useValue: {} },
        {
          provide: MeshBoardStateService,
          useValue: {
            resolveStreamDataScope: vi.fn().mockReturnValue({ kind: 'scoped', rtIds: ['rt-1'] }),
            resolveStreamDataTimeArgs: vi.fn().mockReturnValue(undefined),
            resolveStreamDataRtIds: vi.fn().mockReturnValue(['rt-1']),
            getVariables: vi.fn().mockReturnValue([])
          }
        },
        { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn().mockReturnValue(undefined) } },
        ...(resolver ? [{ provide: MESHBOARD_LABEL_RESOLVER, useValue: resolver }] : [])
      ]
    });
    const cmp = TestBed.createComponent(PieChartWidgetComponent).componentInstance;
    cmp.config = cfg;
    return { cmp, execute, load: () => (cmp as unknown as { loadData(): Promise<void> }).loadData() };
  }

  it('shows the configured name in slice, legend and tooltip data and keeps the values', async () => {
    const { cmp, load } = setup(config({ categoryLabels: { [FEED_IN]: 'Feed-in' } }));

    await load();

    expect(cmp.chartData().map(item => ({ category: item.category, value: item.value }))).toEqual([
      { category: 'Feed-in', value: 10 },
      { category: SURPLUS, value: 4 },
      { category: 'Not paid', value: 1 }
    ]);
    (cmp as unknown as { updateLabelSettings(): void }).updateLabelSettings();
    expect(cmp.labelSettings().content({ category: 'Feed-in', value: 10 })).toBe('Feed-in: 10');
  });

  it('shows today\'s texts without the key, with an empty map and for a value without an entry', async () => {
    for (const categoryLabels of [undefined, {}, { other: 'X' }] as (Record<string, string> | undefined)[]) {
      TestBed.resetTestingModule();
      const { cmp, load } = setup(config({ categoryLabels }));

      await load();

      expect(cmp.chartData().map(item => item.category)).toEqual([FEED_IN, SURPLUS, 'Not paid']);
    }
  });

  it('matches the exact raw value only', async () => {
    const { cmp, load } = setup(config({ categoryLabels: { '1-1:2.9.0 g.03': 'wrong case', [` ${FEED_IN}`]: 'leading blank' } }));

    await load();

    expect(cmp.chartData()[0].category).toBe(FEED_IN);
  });

  it('config entry wins over the host resolver, the resolver wins over today\'s text', async () => {
    const resolver: MeshBoardLabelResolver = r => `Host ${r.value}`;
    const { cmp, load } = setup(config({ categoryLabels: { [FEED_IN]: 'Feed-in' } }), resolver);

    await load();

    expect(cmp.chartData().map(item => item.category)).toEqual(['Feed-in', `Host ${SURPLUS}`, 'Host NOT_PAID']);
  });

  it('a resolver that has no text falls through to today\'s text for a value without an entry', async () => {
    const { cmp, load } = setup(config({ categoryLabels: { [FEED_IN]: 'Feed-in' } }), () => null);

    await load();

    expect(cmp.chartData().map(item => item.category)).toEqual(['Feed-in', SURPLUS, 'Not paid']);
  });

  it('sends the same query with and without names (display only)', async () => {
    const plain = setup(config());
    await plain.load();
    const plainCall = plain.execute.mock.calls[0];
    TestBed.resetTestingModule();

    const named = setup(config({ categoryLabels: { [FEED_IN]: 'Feed-in' } }));
    await named.load();

    expect(named.execute.mock.calls[0]).toEqual(plainCall);
  });

  it('colours by the raw value, never by the configured name', async () => {
    const { cmp } = setup(config({
      categoryLabels: { [FEED_IN]: 'Feed-in', [SURPLUS]: 'Paid' },
      categoryColors: { [FEED_IN]: '#00ff00', Paid: '#ff0000' }
    }));

    expect(cmp.toItem(FEED_IN, 1, 0).color).toBe('#00ff00');
    expect(cmp.toItem(FEED_IN, 1, 0).category).toBe('Feed-in');
    // A name equal to a categoryColors key must not pull that colour onto a different raw value.
    expect(cmp.toItem(SURPLUS, 1, 1).category).toBe('Paid');
    expect(cmp.toItem(SURPLUS, 1, 1).color).not.toBe('#ff0000');
  });

  it('keeps the colour lookup by the host label of a category as before', () => {
    const { cmp } = setup(
      config({ categoryLabels: { PAID: 'Beglichen' }, categoryColors: { Bezahlt: '#00ff00' } }),
      r => (r.value === 'PAID' ? 'Bezahlt' : null)
    );

    expect(cmp.toItem('PAID', 1, 0).category).toBe('Beglichen');
    expect(cmp.toItem('PAID', 1, 0).color).toBe('#00ff00');
  });

  it('does not throw for raw values named like inherited members', () => {
    const { cmp } = setup(config({ categoryLabels: { PAID: 'Beglichen' } }));

    expect(cmp.toItem('constructor', 1, 0).category).toBe('constructor');
    expect(cmp.toItem('toString', 1, 0).category).toBe('toString');
  });

  it('two categories given the same name stay two slices', async () => {
    const { cmp, load } = setup(config({ categoryLabels: { [FEED_IN]: 'Same', [SURPLUS]: 'Same' } }));

    await load();

    expect(cmp.chartData().map(item => [item.category, item.value])).toEqual([['Same', 10], ['Same', 4], ['Not paid', 1]]);
  });
});
