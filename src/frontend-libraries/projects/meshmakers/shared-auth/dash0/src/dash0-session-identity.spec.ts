import { TestBed } from '@angular/core/testing';
import { SESSION_IDENTITY_SINK } from '@meshmakers/shared-auth';
import {
  DASH0_TENANT_ATTRIBUTE,
  Dash0IdentityApi,
  createDash0SessionIdentitySink,
  provideDash0SessionIdentity
} from './dash0-session-identity';

describe('Dash0 session identity sink (AB#7327)', () => {
  let api: { identify: ReturnType<typeof vi.fn>; addSignalAttribute: ReturnType<typeof vi.fn>; removeSignalAttribute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { identify: vi.fn(), addSignalAttribute: vi.fn(), removeSignalAttribute: vi.fn() };
  });

  const sink = () => createDash0SessionIdentitySink(api as unknown as Dash0IdentityApi);

  it('uses the backend tenant key', () => {
    expect(DASH0_TENANT_ATTRIBUTE).toBe('octo.tenant.id');
  });

  it('set maps to identify(sub, { name, email }) and the tenant attribute', () => {
    sink().set({ userId: 'u1', name: 'Max', email: 'max@example.com', tenantId: 'bierok' });

    expect(api.identify).toHaveBeenCalledWith('u1', { name: 'Max', email: 'max@example.com' });
    expect(api.addSignalAttribute).toHaveBeenCalledWith('octo.tenant.id', 'bierok');
  });

  it('set leaves out missing name and e-mail and drops a stale tenant attribute', () => {
    sink().set({ userId: 'u1', name: null, email: null, tenantId: null });

    expect(api.identify).toHaveBeenCalledWith('u1', { name: undefined, email: undefined });
    expect(api.addSignalAttribute).not.toHaveBeenCalled();
    expect(api.removeSignalAttribute).toHaveBeenCalledWith('octo.tenant.id');
  });

  it('clear maps to identify() and removing the tenant attribute', () => {
    sink().clear();

    expect(api.identify).toHaveBeenCalledWith();
    expect(api.removeSignalAttribute).toHaveBeenCalledWith('octo.tenant.id');
  });

  it('the real SDK calls are harmless when Dash0 was never initialised', () => {
    const real = createDash0SessionIdentitySink();

    expect(() => {
      real.set({ userId: 'u1', name: 'Max', email: 'max@example.com', tenantId: 't' });
      real.clear();
    }).not.toThrow();
  });

  it('provideDash0SessionIdentity registers the sink under the shared-auth token', () => {
    TestBed.configureTestingModule({ providers: [provideDash0SessionIdentity()] });

    const provided = TestBed.inject(SESSION_IDENTITY_SINK);

    expect(typeof provided.set).toBe('function');
    expect(typeof provided.clear).toBe('function');
  });
});
