import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { CockpitAdapterStatesDtoGQL } from '../../graphQL/cockpitAdapterStates';
import { CockpitCkModelStatesDtoGQL } from '../../graphQL/cockpitCkModelStates';
import { CockpitAdapterStatesService, COCKPIT_ADAPTER_LIMIT } from './cockpit-adapter-states.service';
import { CockpitCkModelStatesService, RESOLVE_FAILED_NAMES_FETCHED } from './cockpit-ck-model-states.service';

describe('cockpit data services', () => {
  const adapters = { fetch: vi.fn() };
  const models = { fetch: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    adapters.fetch.mockReturnValue(of({ data: { runtime: { systemCommunicationAdapter: { totalCount: 3, items: [{ rtId: '1' }, null] } } } }));
    models.fetch.mockReturnValue(of({ data: { constructionKit: {
      all: { totalCount: 7 }, available: { totalCount: 5 }, importing: { totalCount: 0 },
      resolveFailed: { totalCount: 2, items: [{ id: { fullName: 'A-1.0.0' } }, null] }
    } } }));
    TestBed.configureTestingModule({
      providers: [{ provide: CockpitAdapterStatesDtoGQL, useValue: adapters }, { provide: CockpitCkModelStatesDtoGQL, useValue: models }]
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
});
