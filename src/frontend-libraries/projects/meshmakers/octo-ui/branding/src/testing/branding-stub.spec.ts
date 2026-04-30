import { TestBed } from '@angular/core/testing';
import { BrandingDataSource } from '../services/branding-data-source.service';
import { createBrandingStub, provideBrandingTesting } from './branding-stub';

describe('createBrandingStub / provideBrandingTesting', () => {
  it('returns a stub with branding signal and load/save/reset spies', () => {
    const stub = createBrandingStub();
    expect(stub.branding).toBeDefined();
    expect(typeof stub.branding).toBe('function');
    expect(stub.load).toBeDefined();
    expect(stub.save).toBeDefined();
    expect(stub.resetToDefaults).toBeDefined();
  });

  it('overrides take effect in the stub branding signal', () => {
    const stub = createBrandingStub({ appName: 'Custom' });
    expect(stub.branding().appName).toBe('Custom');
  });

  it('provideBrandingTesting injects the stub as BrandingDataSource', () => {
    const stub = createBrandingStub({ appName: 'X' });
    TestBed.configureTestingModule({
      providers: [provideBrandingTesting(stub)],
    });
    const ds = TestBed.inject(BrandingDataSource);
    expect((ds.branding as () => { appName: string })().appName).toBe('X');
  });
});
