import { BrandingData, BrandingUpdate } from './branding.models';
import { ThemePalette } from './theme.models';

const palette: ThemePalette = {
  primaryColor: '#1',
  secondaryColor: '#2',
  tertiaryColor: '#3',
  neutralColor: '#4',
  backgroundColor: '#5',
  headerGradient: { startColor: '#a', endColor: '#b' },
  footerGradient: { startColor: '#c', endColor: '#d' },
};

describe('branding.models', () => {
  it('BrandingData includes rtId, app text, logo URLs, light/dark themes', () => {
    const d: BrandingData = {
      rtId: 'abc',
      appName: 'App',
      appTitle: 'Tab Title',
      headerLogoUrl: null,
      footerLogoUrl: null,
      faviconUrl: null,
      lightTheme: palette,
      darkTheme: null,
    };
    expect(d.lightTheme.primaryColor).toBe('#1');
    expect(d.darkTheme).toBeNull();
  });

  it('BrandingUpdate file slots accept tri-state File | null | undefined', () => {
    const noChange: BrandingUpdate = {
      appName: 'A',
      appTitle: 'B',
      headerLogoFile: undefined,
      footerLogoFile: null,
      faviconFile: undefined,
      lightTheme: palette,
      darkTheme: null,
    };
    expect(noChange.headerLogoFile).toBeUndefined();
    expect(noChange.footerLogoFile).toBeNull();
  });
});
