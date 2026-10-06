import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { last, toArray } from 'rxjs/operators';
import { CkModelService, TENANT_ID_PROVIDER } from '@meshmakers/octo-services';
import { CockpitDataFlowExecutionsDtoGQL } from '../../graphQL/cockpitDataFlowExecutions';
import { HOUR_MS } from '../../utils/pipeline-executions';
import { COCKPIT_ROLES, COCKPIT_VIEWER_ACCESS } from '../cockpit-host';
import { CockpitAdapterState, CockpitAdapterStatesService } from '../data/cockpit-adapter-states.service';
import { CockpitCkModelStatesService } from '../data/cockpit-ck-model-states.service';
import { adapterKpi, ckModelKpi, CockpitDataFlowRow, executionKpi, formatCount, sparklineGeometry } from './cockpit-kpi';
import { CockpitKpiService } from './cockpit-kpi.service';

function adapter(overrides: Partial<Record<keyof CockpitAdapterState, unknown>>): CockpitAdapterState {
  return {
    rtId: 'a'.repeat(24), name: 'mesh-adapter', communicationState: 'ONLINE', communicationStateTimestamp: null,
    deploymentState: 'DEPLOYED', configurationState: 'CONFIGURED', lifecycleState: 'RUNNING', ...overrides
  } as CockpitAdapterState;
}

const all = (states: CockpitAdapterState[], totalCount = states.length) => ({ states, totalCount });

function pipeline(stats: Record<string, unknown> | null, latest: { startedAt: Date; status: string } | null = null) {
  return {
    __typename: 'SystemCommunicationPipeline',
    statisticsForPipeline: { items: stats ? [{ lastHourSuccessCount: 0, lastHourFailureCount: 0, last24HoursSuccessCount: 0, last24HoursFailureCount: 0, hourlyBuckets: [], ...stats }] : [] },
    executedPipeline: { items: latest ? [latest] : [] }
  };
}

const flow = (...children: unknown[]): CockpitDataFlowRow => ({ children: { items: children } });

describe('cockpit KPI mapping', () => {
  it('formats counts with grouping', () => {
    expect(formatCount(1284)).toBe('1,284');
  });

  it('counts online of the adapters expected to run and names a single one', () => {
    expect(adapterKpi(all([adapter({})]))).toMatchObject({ value: '1 / 1', status: 'success', statusLabel: 'All online', detail: 'mesh-adapter', link: { kind: 'adapters' } });
  });

  it('counts edge / local adapters online without a Helm deployment', () => {
    const kpi = adapterKpi(all([adapter({ rtId: '1' }), adapter({ rtId: '2', deploymentState: 'DISABLED' }), adapter({ rtId: '3', deploymentState: 'UNDEPLOYED' })]));
    expect(kpi).toMatchObject({ value: '3 / 3', status: 'success', detail: '2 edge / local' });
  });

  it('warns about offline adapters, but not hibernated or undeployed ones', () => {
    const kpi = adapterKpi(all([
      adapter({ rtId: '1' }),
      adapter({ rtId: '2', communicationState: 'OFFLINE' }),
      adapter({ rtId: '3', communicationState: 'OFFLINE', lifecycleState: 'HIBERNATED' }),
      adapter({ rtId: '4', deploymentState: 'UNDEPLOYED', communicationState: 'OFFLINE' }),
      adapter({ rtId: '5', deploymentState: 'DISABLED', communicationState: 'OFFLINE' })
    ]));
    expect(kpi).toMatchObject({ value: '1 / 4', status: 'warning', statusLabel: '2 offline', detail: '1 hibernated · 1 not deployed' });
  });

  it('is neutral without adapters expected to run and says "≥" for capped reads', () => {
    expect(adapterKpi(all([]))).toMatchObject({ value: '0 / 0', status: 'neutral', statusLabel: 'No adapters' });
    const kpi = adapterKpi(all([adapter({})], 620));
    expect(kpi.value).toBe('1 / ≥ 1');
    expect(kpi.detail).toContain('based on the first 1 of 620 adapters');
  });

  it('sums executions over data flows like the Data Flows list, with failed count and sparkline', () => {
    const hourStart = Math.floor(Date.now() / HOUR_MS) * HOUR_MS - 2 * HOUR_MS;
    const kpi = executionKpi([
      flow(pipeline({ last24HoursSuccessCount: 1000, last24HoursFailureCount: 3, hourlyBuckets: [{ hourStartAt: new Date(hourStart), successCount: 10, failureCount: 1 }] })),
      flow(pipeline({ last24HoursSuccessCount: 281, lastHourSuccessCount: 4, hourlyBuckets: [{ hourStartAt: new Date(hourStart), successCount: 5, failureCount: 0 }] })),
      flow()
    ]);
    expect(kpi).toMatchObject({ value: '1,284', status: 'error', statusLabel: '3 failed', detail: '1,281 succeeded', link: { kind: 'dataFlows' } });
    expect(kpi.sparkline).toHaveLength(24);
    expect(kpi.sparkline![21]).toBe(16);
    expect(kpi.sparkline![23]).toBe(4);
    expect(kpi.sparklineLabel).toContain('peak 16');
    expect(kpi.sparklineLabel).toContain('3 failed');
  });

  it('is idle without executions and says "≥" when the flows were capped', () => {
    expect(executionKpi([flow(pipeline({}))])).toMatchObject({ value: '0', status: 'neutral', statusLabel: 'Idle', sparkline: undefined });
    const capped = executionKpi([flow(pipeline({ last24HoursSuccessCount: 5, last24HoursFailureCount: 1 }))], 800);
    expect(capped).toMatchObject({ value: '≥ 6', statusLabel: '≥ 1 failed' });
  });

  it('maps CK model counts: ResolveFailed is an error, importing a warning', () => {
    expect(ckModelKpi({ total: 12, available: 12, importing: 0, resolveFailed: 0, resolveFailedNames: [] }))
      .toMatchObject({ value: '12 / 12', status: 'success', statusLabel: 'All available', link: { kind: 'ckModels' }, detail: undefined });
    expect(ckModelKpi({ total: 12, available: 9, importing: 0, resolveFailed: 3, resolveFailedNames: ['A-1.0.0', 'B-1.0.0', 'C-1.0.0'] }))
      .toMatchObject({ value: '9 / 12', status: 'error', statusLabel: '3 ResolveFailed', detail: 'A-1.0.0, B-1.0.0 and 1 more' });
    expect(ckModelKpi({ total: 5, available: 4, importing: 1, resolveFailed: 0, resolveFailedNames: [] }))
      .toMatchObject({ status: 'warning', statusLabel: 'Importing', detail: '1 importing' });
    expect(ckModelKpi({ total: 0, available: 0, importing: 0, resolveFailed: 0, resolveFailedNames: [] })).toMatchObject({ status: 'neutral' });
  });

  it('scales sparkline points into the box', () => {
    const geometry = sparklineGeometry([0, 5, 10], 120, 36, 3)!;
    expect(geometry.line).toBe('M0 33 L60 18 L120 3');
    expect(geometry.area).toBe('M0 33 L60 18 L120 3 L120 36 L0 36 Z');
    expect(sparklineGeometry([1])).toBeNull();
  });
});

describe('CockpitKpiService', () => {
  const isInRole = vi.fn();
  const isModelAvailable = vi.fn();
  const adapterStates = { states: vi.fn() };
  const ckModelStates = { counts: vi.fn() };
  const dataFlows = { fetch: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    isInRole.mockReturnValue(true);
    isModelAvailable.mockResolvedValue(true);
    adapterStates.states.mockReturnValue(of(all([adapter({})])));
    ckModelStates.counts.mockReturnValue(of({ total: 2, available: 2, importing: 0, resolveFailed: 0, resolveFailedNames: [] }));
    dataFlows.fetch.mockReturnValue(of({ data: { runtime: { systemCommunicationDataFlow: { totalCount: 1, items: [flow(pipeline({ last24HoursSuccessCount: 2 })), null] } } } }));
    TestBed.configureTestingModule({
      providers: [
        { provide: TENANT_ID_PROVIDER, useValue: () => Promise.resolve('t1') },
        { provide: COCKPIT_VIEWER_ACCESS, useValue: { isInRole } },
        { provide: CkModelService, useValue: { isModelAvailable } },
        { provide: CockpitAdapterStatesService, useValue: adapterStates },
        { provide: CockpitCkModelStatesService, useValue: ckModelStates },
        { provide: CockpitDataFlowExecutionsDtoGQL, useValue: dataFlows }
      ]
    });
  });

  const run = (kind: 'adapterStatus' | 'ckModelState' | 'pipelineExecutions') => firstValueFrom(TestBed.inject(CockpitKpiService).kpi(kind).pipe(toArray()));

  it('starts loading, then shows the figure for the current tenant', async () => {
    const results = await run('adapterStatus');
    expect(results[0]).toEqual({ state: 'loading' });
    expect(results[1]).toMatchObject({ state: 'ready', kpi: { id: 'adapters-online' } });
    expect(adapterStates.states).toHaveBeenCalledWith('t1');
  });

  it('counts executions and CK models', async () => {
    expect((await run('pipelineExecutions'))[1]).toMatchObject({ state: 'ready', kpi: { value: '2' } });
    expect((await run('ckModelState'))[1]).toMatchObject({ state: 'ready', kpi: { value: '2 / 2' } });
  });

  it('tells viewers without the role why and runs no query', async () => {
    isInRole.mockImplementation((role: string) => role === COCKPIT_ROLES.AdminPanelManagement);
    const result = await firstValueFrom(TestBed.inject(CockpitKpiService).kpi('adapterStatus').pipe(last()));
    expect(result).toEqual({ state: 'unavailable', reason: expect.stringContaining('CommunicationManagement') });
    expect(adapterStates.states).not.toHaveBeenCalled();
    expect((await run('ckModelState'))[1].state).toBe('ready');
  });

  it('is unavailable without the System.Communication model', async () => {
    isModelAvailable.mockResolvedValue(false);
    expect((await run('pipelineExecutions'))[1].state).toBe('unavailable');
    expect(dataFlows.fetch).not.toHaveBeenCalled();
  });

  it('reports a failing query as error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    dataFlows.fetch.mockReturnValue(throwError(() => new Error('boom')));
    expect((await run('pipelineExecutions'))[1]).toEqual({ state: 'error', message: 'boom' });
  });
});
