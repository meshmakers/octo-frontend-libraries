import { TestBed } from '@angular/core/testing';
import {
  OCTO_BRANDING_DEFAULTS,
  OCTO_BRANDING_FALLBACK_ASSETS,
  NEUTRAL_BRANDING_DEFAULTS,
  NEUTRAL_FALLBACK_ASSETS,
} from './branding.tokens';

describe('branding.tokens', () => {
  it('NEUTRAL_BRANDING_DEFAULTS is a complete BrandingData carrying the Meshmakers brand mint', () => {
    expect(NEUTRAL_BRANDING_DEFAULTS.appName).toBe('App');
    // #65ceaf is the Meshmakers brand mint — apps that opt into
    // provideOctoBranding but never persist a SystemUIBranding entity render
    // with the publisher's identity rather than vanilla Kendo defaults.
    expect(NEUTRAL_BRANDING_DEFAULTS.lightTheme.primaryColor.toLowerCase()).toBe('#65ceaf');
    expect(NEUTRAL_BRANDING_DEFAULTS.darkTheme).not.toBeNull();
  });

  it('NEUTRAL_FALLBACK_ASSETS has no logo/favicon URLs (renders text-only)', () => {
    expect(NEUTRAL_FALLBACK_ASSETS.headerLogo).toBeUndefined();
    expect(NEUTRAL_FALLBACK_ASSETS.favicon).toBeUndefined();
  });

  it('OCTO_BRANDING_DEFAULTS token is providable and resolves to neutral when not overridden', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: OCTO_BRANDING_DEFAULTS, useValue: NEUTRAL_BRANDING_DEFAULTS },
      ],
    });
    const value = TestBed.inject(OCTO_BRANDING_DEFAULTS);
    expect(value.appName).toBe('App');
  });

  it('OCTO_BRANDING_FALLBACK_ASSETS token is providable', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: OCTO_BRANDING_FALLBACK_ASSETS, useValue: NEUTRAL_FALLBACK_ASSETS },
      ],
    });
    const value = TestBed.inject(OCTO_BRANDING_FALLBACK_ASSETS);
    expect(value.headerLogo).toBeUndefined();
  });
});
