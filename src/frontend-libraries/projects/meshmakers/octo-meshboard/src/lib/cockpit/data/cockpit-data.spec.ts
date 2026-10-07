import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { CockpitAdapterStatesDtoGQL } from '../../graphQL/cockpitAdapterStates';
import { CockpitCkModelStatesDtoGQL } from '../../graphQL/cockpitCkModelStates';
import { CockpitDataFlowExecutionsDtoGQL } from '../../graphQL/cockpitDataFlowExecutions';
import { COCKPIT_DATA_FLOW_LIMIT, CockpitDataFlowExecutionsService, countFlowExecutions } from './cockpit-data-flow-executions.service';
import { CockpitAdapterStatesService, COCKPIT_ADAPTER_LIMIT } from './cockpit-adapter-states.service';
import { CockpitCkModelStatesService, RESOLVE_FAILED_NAMES_FETCHED } from './cockpit-ck-model-states.service';

describe('cockpit data services', () => {
  const adapters = { fetch: vi.fn() };
  const models = { fetch: vi.fn() };
  const dataFlows = { fetch: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    adapters.fetch.mockReturnValue(of({ data: { runtime: { systemCommunicationAdapter: { totalCount: 3, items: [{ rtId: '1' }, null] } } } }));
    models.fetch.mockReturnValue(of({ data: { constructionKit: {
      all: { totalCount: 7 }, available: { totalCount: 5 }, importing: { totalCount: 0 },
      resolveFailed: { totalCount: 2, items: [{ id: { fullName: 'A-1.0.0' } }, null] }
    } } }));
    dataFlows.fetch.mockReturnValue(of({ data: { runtime: { systemCommunicationDataFlow: { totalCount: 4, items: [{ rtId: 'f1', children: { items: [] } }, null] } } } }));
    TestBed.configureTestingModule({
      providers: [
        { provide: CockpitAdapterStatesDtoGQL, useValue: adapters },
        { provide: CockpitCkModelStatesDtoGQL, useValue: models },
        { provide: CockpitDataFlowExecutionsDtoGQL, useValue: dataFlows }
      ]
    });
  });

  it('shares one adapter request per tenant for a few seconds', async () => {
    const service = TestBed.inject(CockpitAdapterStatesService);
    const first = await firstValueFrom(service.states('t1', 1000));
    await firstValueFrom(service.states('t1', 5000));
    await firstValueFrom(service.states('t2', 5000));
    expect(first).toEqual({ states: [{ rtId: '1' }], totalCount: 3 });
    expect(adapters.fetch).toHaveBeenCalledTimes(2);
    expect(adapters.fetch.mock.calls[0][0].variables).toEqual({ first: COCKPIT_ADAPTER_LIMIT });
    await firstValueFrom(service.states('t1', 20_000));
    expect(adapters.fetch).toHaveBeenCalledTimes(3);
  });

  it('reads the CK model counts per state with the ResolveFailed names', async () => {
    const counts = await firstValueFrom(TestBed.inject(CockpitCkModelStatesService).counts('t1'));
    expect(counts).toEqual({ total: 7, available: 5, importing: 0, resolveFailed: 2, resolveFailedNames: ['A-1.0.0'] });
    expect(models.fetch.mock.calls[0][0].variables).toEqual({ first: RESOLVE_FAILED_NAMES_FETCHED });
  });

  it('shares one data flow request per tenant for a few seconds (KPI + attention list, AB#5622)', async () => {
    const service = TestBed.inject(CockpitDataFlowExecutionsService);
    const first = await firstValueFrom(service.executions('t1', 1000));
    await firstValueFrom(service.executions('t1', 5000));
    await firstValueFrom(service.executions('t2', 5000));
    expect(first).toEqual({ flows: [{ rtId: 'f1', children: { items: [] } }], totalCount: 4 });
    expect(dataFlows.fetch).toHaveBeenCalledTimes(2);
    expect(dataFlows.fetch.mock.calls[0][0]).toMatchObject({ variables: { first: COCKPIT_DATA_FLOW_LIMIT }, fetchPolicy: 'network-only' });
    await firstValueFrom(service.executions('t1', 20_000));
    expect(dataFlows.fetch).toHaveBeenCalledTimes(3);
  });

  it('does not keep a failed data flow request', async () => {
    const service = TestBed.inject(CockpitDataFlowExecutionsService);
    dataFlows.fetch.mockReturnValueOnce(throwError(() => new Error('boom')));
    await expect(firstValueFrom(service.executions('t1', 1000))).rejects.toThrow('boom');
    expect(await firstValueFrom(service.executions('t1', 2000))).toMatchObject({ totalCount: 4 });
    expect(dataFlows.fetch).toHaveBeenCalledTimes(2);
  });

  it('a late failure of an expired request keeps the newer shared request', async () => {
    const service = TestBed.inject(CockpitDataFlowExecutionsService);
    const slow = new Subject<never>();
    dataFlows.fetch.mockReturnValueOnce(slow);
    const failed = firstValueFrom(service.executions('t1', 1000));
    await firstValueFrom(service.executions('t1', 20_000));
    slow.error(new Error('late'));
    await expect(failed).rejects.toThrow('late');
    await firstValueFrom(service.executions('t1', 21_000));
    expect(dataFlows.fetch).toHaveBeenCalledTimes(2);
  });

  it('sums the 24 h executions over the flows', () => {
    const pipeline = (ok: number, failed: number) => ({
      __typename: 'SystemCommunicationPipeline',
      statisticsForPipeline: { items: [{ lastHourSuccessCount: 0, lastHourFailureCount: 0, last24HoursSuccessCount: ok, last24HoursFailureCount: failed, hourlyBuckets: [] }] },
      executedPipeline: { items: [] }
    });
    expect(countFlowExecutions([{ children: { items: [pipeline(5, 1), pipeline(2, 3)] } }, { children: { items: [] } }, { children: null }]))
      .toEqual({ succeeded: 7, failed: 4 });
  });
});
