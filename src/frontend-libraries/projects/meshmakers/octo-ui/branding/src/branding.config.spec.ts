import { TestBed } from '@angular/core/testing';
import { provideOctoBranding } from './branding.config';
import {
  NEUTRAL_BRANDING_DEFAULTS,
  OCTO_BRANDING_DEFAULTS,
  OCTO_BRANDING_FALLBACK_ASSETS,
} from './branding.tokens';

describe('provideOctoBranding', () => {
  it('uses neutral defaults when no config is passed', () => {
    TestBed.configureTestingModule({ providers: [provideOctoBranding()] });
    expect(TestBed.inject(OCTO_BRANDING_DEFAULTS).appName).toBe('App');
    expect(TestBed.inject(OCTO_BRANDING_FALLBACK_ASSETS).headerLogo).toBeUndefined();
  });

  it('merges partial defaults from caller over neutral defaults', () => {
    TestBed.configureTestingModule({
      providers: [
        provideOctoBranding({
          defaults: { appName: 'TecLink', appTitle: 'TecLink' },
        }),
      ],
    });
    const v = TestBed.inject(OCTO_BRANDING_DEFAULTS);
    expect(v.appName).toBe('TecLink');
    expect(v.appTitle).toBe('TecLink');
    // Untouched keys remain neutral
    expect(v.lightTheme.primaryColor).toBe(
      NEUTRAL_BRANDING_DEFAULTS.lightTheme.primaryColor,
    );
  });

  it('passes fallbackAssets through verbatim', () => {
    TestBed.configureTestingModule({
      providers: [
        provideOctoBranding({
          fallbackAssets: { headerLogo: '/maco-logo.svg', favicon: '/favicon.ico' },
        }),
      ],
    });
    const v = TestBed.inject(OCTO_BRANDING_FALLBACK_ASSETS);
    expect(v.headerLogo).toBe('/maco-logo.svg');
    expect(v.favicon).toBe('/favicon.ico');
  });

  it('darkTheme: null in caller config results in null darkTheme (single-theme tenant)', () => {
    TestBed.configureTestingModule({
      providers: [provideOctoBranding({ defaults: { darkTheme: null } })],
    });
    expect(TestBed.inject(OCTO_BRANDING_DEFAULTS).darkTheme).toBeNull();
  });
});
