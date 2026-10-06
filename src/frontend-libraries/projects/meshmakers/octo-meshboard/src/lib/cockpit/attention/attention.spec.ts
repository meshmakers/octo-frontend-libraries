import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { last } from 'rxjs/operators';
import { AttentionFinding, AttentionProvider, COCKPIT_ATTENTION_PROVIDERS, nameList, plural, sortAttentionFindings } from './attention.models';
import { CockpitAttentionService, selectProviders } from './attention.service';

const finding = (id: string, severity: AttentionFinding['severity']): AttentionFinding => ({ id, severity, title: id, text: '', links: [] });

function provider(id: string, visible: boolean, findings: Observable<AttentionFinding[]>): AttentionProvider & { load: ReturnType<typeof vi.fn> } {
  return { id, label: id, description: `${id} check`, isVisible: vi.fn().mockResolvedValue(visible), load: vi.fn().mockReturnValue(findings) };
}

describe('attention helpers', () => {
  it('sorts errors first and keeps the provider order within a severity', () => {
    const sorted = sortAttentionFindings([finding('i', 'info'), finding('w1', 'warning'), finding('e', 'error'), finding('w2', 'warning')]);
    expect(sorted.map(f => f.id)).toEqual(['e', 'w1', 'w2', 'i']);
  });

  it('lists names with a cap', () => {
    expect(nameList([])).toBe('');
    expect(nameList(['a'])).toBe('a');
    expect(nameList(['a', 'b'])).toBe('a and b');
    expect(nameList(['a', 'b', 'c'])).toBe('a, b and c');
    expect(nameList(['a', 'b', 'c', 'd', 'e'])).toBe('a, b, c and 2 more');
    expect(nameList(['a', 'b'], 3, 5)).toBe('a, b and 3 more');
  });

  it('pluralises', () => {
    expect(plural(1, 'pool')).toBe('1 pool');
    expect(plural(3, 'pool')).toBe('3 pools');
  });

  it('selects all providers for an empty list and ignores unknown ids', () => {
    const a = provider('a', true, of([]));
    const b = provider('b', true, of([]));
    expect(selectProviders([a, b], undefined)).toEqual([a, b]);
    expect(selectProviders([a, b], [])).toEqual([a, b]);
    expect(selectProviders([a, b], ['b', 'gone'])).toEqual([b]);
  });
});

describe('CockpitAttentionService', () => {
  const context = { tenantId: 'meshmakers' };

  function setup(providers: AttentionProvider[]): CockpitAttentionService {
    TestBed.configureTestingModule({
      providers: providers.map(p => ({ provide: COCKPIT_ATTENTION_PROVIDERS, useValue: p, multi: true }))
    });
    return TestBed.inject(CockpitAttentionService);
  }

  it('has nothing to check without providers', async () => {
    expect(await firstValueFrom(setup([]).state(context))).toEqual({ findings: [], loading: false, visibleProviders: 0 });
  });

  it('lists the registered providers for the config dialog', () => {
    expect(setup([provider('a', true, of([]))]).availableProviders()).toEqual([{ id: 'a', label: 'a', description: 'a check' }]);
  });

  it('never loads a provider the viewer may not see', async () => {
    const hidden = provider('hidden', false, of([finding('x', 'error')]));
    const shown = provider('shown', true, of([finding('y', 'warning')]));
    const state = await firstValueFrom(setup([hidden, shown]).state(context).pipe(last()));

    expect(hidden.load).not.toHaveBeenCalled();
    expect(shown.load).toHaveBeenCalledWith(context);
    expect(state).toEqual({ findings: [finding('y', 'warning')], loading: false, visibleProviders: 1 });
  });

  it('reports zero visible providers when the viewer may see none', async () => {
    const state = await firstValueFrom(setup([provider('a', false, of([]))]).state(context).pipe(last()));
    expect(state.visibleProviders).toBe(0);
  });

  it('runs only the configured providers', async () => {
    const a = provider('a', true, of([finding('a', 'error')]));
    const b = provider('b', true, of([finding('b', 'error')]));
    const findings = await firstValueFrom(setup([a, b]).findings(context, ['b']).pipe(last()));
    expect(findings.map(f => f.id)).toEqual(['b']);
    expect(a.isVisible).not.toHaveBeenCalled();
  });

  it('starts loading and drops a failing provider, sorted by severity', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = setup([
      provider('failing', true, throwError(() => new Error('boom'))),
      provider('info', true, of([finding('i', 'info')])),
      provider('error', true, of([finding('e', 'error')]))
    ]);
    const first = await firstValueFrom(service.state(context));
    expect(first.loading).toBe(true);
    const state = await firstValueFrom(service.state(context).pipe(last()));
    expect(state.findings.map(f => f.id)).toEqual(['e', 'i']);
    expect(state.loading).toBe(false);
  });

  it('treats a rejected visibility check as a failed provider without loading it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken: AttentionProvider = { id: 'broken', label: '', description: '', isVisible: () => Promise.reject(new Error('no')), load: vi.fn() };
    const state = await firstValueFrom(setup([broken]).state(context).pipe(last()));
    expect(state.findings).toEqual([]);
    expect(broken.load).not.toHaveBeenCalled();
  });
});
