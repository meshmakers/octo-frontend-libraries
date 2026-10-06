import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { AssetRepoService, CkModelService, CONFIGURATION_SERVICE, TenantFeaturesStatus } from '@meshmakers/octo-services';
import { CockpitUnregisteredPoolsDtoGQL } from '../../../graphQL/cockpitUnregisteredPools';
import { COCKPIT_ROLES, COCKPIT_VIEWER_ACCESS } from '../../cockpit-host';
import { ADAPTER_OFFLINE_GRACE_MS, adaptersInError, adaptersOffline, CockpitAdapterState, CockpitAdapterStatesService } from '../../data/cockpit-adapter-states.service';
import { CockpitCkModelStatesService } from '../../data/cockpit-ck-model-states.service';
import { AdaptersAttentionProvider } from './adapters.provider';
import { CkModelsResolveFailedAttentionProvider } from './ck-models-resolve-failed.provider';
import { enabledButNotInstalled, FeaturesNotInstalledAttentionProvider, isServiceConfigured } from './features-not-installed.provider';
import { UnregisteredPoolsAttentionProvider } from './unregistered-pools.provider';

const context = { tenantId: 'meshmakers' };
const RT = (c: string) => c.repeat(24);
type S = CockpitAdapterState;

function adapter(overrides: Partial<Record<keyof S, unknown>>): S {
  return {
    rtId: RT('a'), name: 'mesh-adapter', communicationState: 'ONLINE', communicationStateTimestamp: null,
    deploymentState: 'DEPLOYED', configurationState: 'CONFIGURED', lifecycleState: 'RUNNING', ...overrides
  } as S;
}

describe('cockpit attention providers', () => {
  const isInRole = vi.fn();
  const isModelAvailable = vi.fn();
  const ckModelStates = { counts: vi.fn() };
  const pools = { fetch: vi.fn() };
  const adapterStates = { states: vi.fn() };
  const assetRepo = { getTenantFeaturesStatus: vi.fn() };
  const configuration = { config: { reportingServices: 'https://reporting/', aiServices: '' } as Record<string, string> };

  beforeEach(() => {
    vi.clearAllMocks();
    isInRole.mockReturnValue(true);
    isModelAvailable.mockResolvedValue(true);
    configuration.config = { reportingServices: 'https://reporting/', aiServices: '' };
    TestBed.configureTestingModule({
      providers: [
        CkModelsResolveFailedAttentionProvider,
        UnregisteredPoolsAttentionProvider,
        AdaptersAttentionProvider,
        FeaturesNotInstalledAttentionProvider,
        { provide: COCKPIT_VIEWER_ACCESS, useValue: { isInRole } },
        { provide: CkModelService, useValue: { isModelAvailable } },
        { provide: CockpitCkModelStatesService, useValue: ckModelStates },
        { provide: CockpitUnregisteredPoolsDtoGQL, useValue: pools },
        { provide: CockpitAdapterStatesService, useValue: adapterStates },
        { provide: AssetRepoService, useValue: assetRepo },
        { provide: CONFIGURATION_SERVICE, useValue: configuration }
      ]
    });
  });

  it('hides every role-gated provider when the host provides no viewer access', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [CkModelsResolveFailedAttentionProvider, { provide: CkModelService, useValue: { isModelAvailable } }, { provide: CockpitCkModelStatesService, useValue: ckModelStates }]
    });
    expect(await TestBed.inject(CkModelsResolveFailedAttentionProvider).isVisible()).toBe(false);
  });

  describe('CK models in ResolveFailed', () => {
    const provider = () => TestBed.inject(CkModelsResolveFailedAttentionProvider);

    it('is visible only to viewers who may open the model libraries', async () => {
      isInRole.mockImplementation((role: string) => role === COCKPIT_ROLES.AdminPanelManagement);
      expect(await provider().isVisible()).toBe(true);
      isInRole.mockReturnValue(false);
      expect(await provider().isVisible()).toBe(false);
    });

    it('builds one error finding from the shared counts', async () => {
      ckModelStates.counts.mockReturnValue(of({ total: 9, available: 4, importing: 0, resolveFailed: 5, resolveFailedNames: ['Demo.Tickets-1.0.0', 'FamilyOs-2.0.0'] }));
      const findings = await firstValueFrom(provider().load(context));
      expect(ckModelStates.counts).toHaveBeenCalledWith('meshmakers');
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ severity: 'error', title: '5 CK models in ResolveFailed', links: [{ target: { kind: 'ckModels' } }] });
      expect(findings[0].text).toContain('Demo.Tickets-1.0.0, FamilyOs-2.0.0 and 3 more');
    });

    it('reports nothing when every model resolves', async () => {
      ckModelStates.counts.mockReturnValue(of({ total: 3, available: 3, importing: 0, resolveFailed: 0, resolveFailedNames: [] }));
      expect(await firstValueFrom(provider().load(context))).toEqual([]);
    });
  });

  describe('pools not registered', () => {
    const provider = () => TestBed.inject(UnregisteredPoolsAttentionProvider);

    it('needs CommunicationManagement and the System.Communication model', async () => {
      expect(await provider().isVisible()).toBe(true);
      expect(isModelAvailable).toHaveBeenCalledWith('System.Communication');
      isModelAvailable.mockResolvedValue(false);
      expect(await provider().isVisible()).toBe(false);
      isModelAvailable.mockResolvedValue(true);
      isInRole.mockReturnValue(false);
      expect(await provider().isVisible()).toBe(false);
    });

    it('links a single unregistered pool directly', async () => {
      pools.fetch.mockReturnValue(of({ data: { runtime: { systemCommunicationPool: { totalCount: 1, items: [{ rtId: RT('p'), name: 'Default Cloud' }] } } } }));
      const [found] = await firstValueFrom(provider().load());
      expect(found).toMatchObject({ severity: 'warning', title: 'Pool "Default Cloud" is not registered' });
      expect(found.links[0].target).toEqual({ kind: 'pool', rtId: RT('p') });
    });

    it('summarises several pools and reports nothing when there are none', async () => {
      pools.fetch.mockReturnValue(of({ data: { runtime: { systemCommunicationPool: { totalCount: 2, items: [{ rtId: RT('p'), name: 'a' }, { rtId: RT('q'), name: 'b' }] } } } }));
      const [found] = await firstValueFrom(provider().load());
      expect(found.title).toBe('2 pools not registered');
      expect(found.links).toEqual([{ label: 'Open pools', target: { kind: 'pools' } }]);

      pools.fetch.mockReturnValue(of({ data: { runtime: { systemCommunicationPool: { totalCount: 0, items: [] } } } }));
      expect(await firstValueFrom(provider().load())).toEqual([]);
    });
  });

  describe('adapters in error / offline', () => {
    const provider = () => TestBed.inject(AdaptersAttentionProvider);
    const now = Date.parse('2026-10-06T10:00:00Z');

    it('finds deployment and configuration errors', () => {
      const states = [adapter({ rtId: RT('a') }), adapter({ rtId: RT('b'), deploymentState: 'ERROR' }), adapter({ rtId: RT('c'), configurationState: 'ERROR' })];
      expect(adaptersInError(states).map(s => s.rtId)).toEqual([RT('b'), RT('c')]);
    });

    it('reports adapters expected to run offline beyond the grace period, not hibernated or undeployed ones', () => {
      const old = new Date(now - ADAPTER_OFFLINE_GRACE_MS - 1000);
      const fresh = new Date(now - 60_000);
      const states = [
        adapter({ rtId: RT('a'), communicationState: 'OFFLINE', communicationStateTimestamp: old }),
        adapter({ rtId: RT('b'), communicationState: 'OFFLINE', communicationStateTimestamp: fresh }),
        adapter({ rtId: RT('c'), communicationState: 'OFFLINE', lifecycleState: 'HIBERNATED' }),
        adapter({ rtId: RT('d'), communicationState: 'OFFLINE', deploymentState: 'UNDEPLOYED' }),
        adapter({ rtId: RT('e'), communicationState: 'UNREGISTERED', communicationStateTimestamp: null }),
        adapter({ rtId: RT('f'), communicationState: 'OFFLINE', deploymentState: 'DISABLED', communicationStateTimestamp: old })
      ];
      expect(adaptersOffline(states, now).map(s => s.rtId)).toEqual([RT('a'), RT('e'), RT('f')]);
    });

    it('builds an error finding linking the adapter, no offline finding for the same adapter', async () => {
      adapterStates.states.mockReturnValue(of({ totalCount: 2, states: [
        adapter({ rtId: RT('b'), name: 'sap-bridge', deploymentState: 'ERROR', communicationState: 'OFFLINE' }),
        adapter({ rtId: RT('a') })
      ] }));
      const findings = await firstValueFrom(provider().load(context));
      expect(adapterStates.states).toHaveBeenCalledWith('meshmakers');
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ id: 'adapters:error', severity: 'error', title: '1 adapter in error' });
      expect(findings[0].links[0].target).toEqual({ kind: 'adapter', rtId: RT('b') });
      expect(findings[0].explain).toMatchObject({ label: 'sap-bridge', rtId: RT('b'), ckTypeId: 'System.Communication/Adapter' });
    });

    it('says "≥" when the adapter read was capped', async () => {
      adapterStates.states.mockReturnValue(of({ totalCount: 900, states: [adapter({ rtId: RT('b'), deploymentState: 'ERROR' })] }));
      const [found] = await firstValueFrom(provider().load(context));
      expect(found.title).toBe('≥ 1 adapter in error');
    });

    it('reports nothing when all adapters are fine', async () => {
      adapterStates.states.mockReturnValue(of({ totalCount: 1, states: [adapter({})] }));
      expect(await firstValueFrom(provider().load(context))).toEqual([]);
    });
  });

  describe('features enabled but not installed', () => {
    const provider = () => TestBed.inject(FeaturesNotInstalledAttentionProvider);
    const status = (overrides: Partial<TenantFeaturesStatus> = {}): TenantFeaturesStatus => ({
      streamData: { instanceEnabled: true, tenantEnabled: true },
      communication: { tenantEnabled: true },
      reporting: { tenantEnabled: false },
      aiServices: { tenantEnabled: false },
      ...overrides
    });

    it('treats an empty or legacy "/" URL as not installed', () => {
      expect(isServiceConfigured('')).toBe(false);
      expect(isServiceConfigured('/')).toBe(false);
      expect(isServiceConfigured(undefined)).toBe(false);
      expect(isServiceConfigured('https://x/')).toBe(true);
    });

    it('lists the capabilities enabled without their service', () => {
      const config = { reportingServices: '', aiServices: '/' };
      expect(enabledButNotInstalled(status({ reporting: { tenantEnabled: true } }), config)).toEqual(['Reporting']);
      expect(enabledButNotInstalled(status({ aiServices: { tenantEnabled: true } }), config)).toEqual(['AI Services']);
      expect(enabledButNotInstalled(status({ streamData: { instanceEnabled: false, tenantEnabled: true } }), config)).toEqual(['Stream Data']);
      expect(enabledButNotInstalled(status({ reporting: { tenantEnabled: true } }), { reportingServices: 'https://r/' })).toEqual([]);
      expect(enabledButNotInstalled(null, config)).toEqual([]);
    });

    it('needs TenantManagement', async () => {
      isInRole.mockImplementation((role: string) => role === COCKPIT_ROLES.TenantManagement);
      expect(await provider().isVisible()).toBe(true);
      isInRole.mockReturnValue(false);
      expect(await provider().isVisible()).toBe(false);
    });

    it('reads the tenant status once and builds an info finding', async () => {
      configuration.config = { reportingServices: '', aiServices: '' };
      assetRepo.getTenantFeaturesStatus.mockResolvedValue(status({ reporting: { tenantEnabled: true } }));
      const findings = await firstValueFrom(provider().load(context));
      expect(assetRepo.getTenantFeaturesStatus).toHaveBeenCalledWith('meshmakers');
      expect(findings).toEqual([expect.objectContaining({ severity: 'info', title: 'Reporting enabled, but not installed', links: [{ label: 'Open tenant settings', target: { kind: 'tenantSettings' } }] })]);
    });

    it('reports nothing when everything enabled is installed', async () => {
      assetRepo.getTenantFeaturesStatus.mockResolvedValue(status({ reporting: { tenantEnabled: true } }));
      expect(await firstValueFrom(provider().load(context))).toEqual([]);
    });
  });
});
