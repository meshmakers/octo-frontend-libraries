/// <reference types="jasmine" />
import { Provider, signal, WritableSignal } from '@angular/core';
import { NEUTRAL_BRANDING_DEFAULTS } from '../branding.tokens';
import { BrandingData, BrandingUpdate } from '../models/branding.models';
import { BrandingDataSource } from '../services/branding-data-source.service';

export interface BrandingDataSourceStub {
  branding: WritableSignal<BrandingData>;
  load: jasmine.Spy<() => Promise<void>>;
  save: jasmine.Spy<(u: BrandingUpdate) => Promise<BrandingData>>;
  resetToDefaults: jasmine.Spy<() => Promise<void>>;
}

/**
 * Build a stub matching the runtime shape of BrandingDataSource. Cast
 * `branding` back to WritableSignal in specs to drive state changes.
 */
export function createBrandingStub(
  overrides?: Partial<BrandingData>,
): BrandingDataSourceStub {
  const branding = signal<BrandingData>({
    ...NEUTRAL_BRANDING_DEFAULTS,
    ...(overrides ?? {}),
  });
  return {
    branding,
    load: jasmine.createSpy('load').and.resolveTo(),
    save: jasmine.createSpy('save').and.callFake(async () => branding()),
    resetToDefaults: jasmine.createSpy('resetToDefaults').and.resolveTo(),
  };
}

/** Convenience: returns a Provider that injects the stub as BrandingDataSource. */
export function provideBrandingTesting(
  stub: BrandingDataSourceStub = createBrandingStub(),
): Provider {
  return { provide: BrandingDataSource, useValue: stub };
}
