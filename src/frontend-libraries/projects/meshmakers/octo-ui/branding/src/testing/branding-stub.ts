import { Provider, signal, WritableSignal } from '@angular/core';
import { NEUTRAL_BRANDING_DEFAULTS } from '../branding.tokens';
import { BrandingData, BrandingUpdate } from '../models/branding.models';
import { BrandingDataSource } from '../services/branding-data-source.service';

/**
 * Framework-agnostic stub matching the runtime shape of `BrandingDataSource`.
 * The async methods are plain functions; consumers wrap them in their own
 * spy primitive (`jasmine.createSpy`, `jest.fn`, `vi.fn`) when they need
 * call assertions. Casting `branding` back to `WritableSignal` lets specs
 * drive state changes.
 */
export interface BrandingDataSourceStub {
  branding: WritableSignal<BrandingData>;
  load: () => Promise<void>;
  save: (u: BrandingUpdate) => Promise<BrandingData>;
  resetToDefaults: () => Promise<void>;
}

export function createBrandingStub(
  overrides?: Partial<BrandingData>,
): BrandingDataSourceStub {
  const branding = signal<BrandingData>({
    ...NEUTRAL_BRANDING_DEFAULTS,
    ...(overrides ?? {}),
  });
  return {
    branding,
    load: () => Promise.resolve(),
    save: () => Promise.resolve(branding()),
    resetToDefaults: () => Promise.resolve(),
  };
}

/** Convenience: returns a Provider that injects the stub as BrandingDataSource. */
export function provideBrandingTesting(
  stub: BrandingDataSourceStub = createBrandingStub(),
): Provider {
  return { provide: BrandingDataSource, useValue: stub };
}
