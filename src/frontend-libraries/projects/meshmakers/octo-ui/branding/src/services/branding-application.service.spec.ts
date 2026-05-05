import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  NEUTRAL_BRANDING_DEFAULTS,
  NEUTRAL_FALLBACK_ASSETS,
  OCTO_BRANDING_DEFAULTS,
  OCTO_BRANDING_FALLBACK_ASSETS,
} from '../branding.tokens';
import { BrandingData } from '../models/branding.models';
import { BrandingApplicationService } from './branding-application.service';
import { BrandingDataSource } from './branding-data-source.service';
import { ThemeService } from './theme.service';

describe('BrandingApplicationService – palette generation', () => {
  let service: BrandingApplicationService;

  const neutralBranding: BrandingData = { ...NEUTRAL_BRANDING_DEFAULTS };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BrandingApplicationService,
        {
          provide: ThemeService,
          useValue: {
            isDark: signal(false),
            setDark: jasmine.createSpy('setDark'),
          },
        },
        {
          provide: BrandingDataSource,
          useValue: { branding: signal(neutralBranding) },
        },
        { provide: OCTO_BRANDING_DEFAULTS, useValue: NEUTRAL_BRANDING_DEFAULTS },
        {
          provide: OCTO_BRANDING_FALLBACK_ASSETS,
          useValue: NEUTRAL_FALLBACK_ASSETS,
        },
      ],
    });

    service = TestBed.inject(BrandingApplicationService);
  });

  it('should generate a palette with correct anchor values for #3366ff', () => {
    const palette = service.generatePalette('#3366ff');

    expect(palette[0]).toBe('#000000');
    expect(palette[100]).toBe('#ffffff');
    expect(palette[40]).toBe('#3366ff');
  });

  it('should generate lighter shades above 40 and darker shades below 40 for #3366ff', () => {
    const palette = service.generatePalette('#3366ff');

    // Lighter shades (higher index) — each should be distinct from base
    expect(palette[50]).toBeDefined();
    expect(palette[80]).toBeDefined();
    expect(palette[50]).not.toBe('#3366ff');
    expect(palette[80]).not.toBe('#3366ff');

    // Darker shades (lower index) — each should be distinct from base
    expect(palette[10]).toBeDefined();
    expect(palette[25]).toBeDefined();
    expect(palette[10]).not.toBe('#3366ff');
    expect(palette[25]).not.toBe('#3366ff');
  });

  it('should be deterministic — two calls with same input return identical palettes', () => {
    const palette1 = service.generatePalette('#3366ff');
    const palette2 = service.generatePalette('#3366ff');

    expect(JSON.stringify(palette1)).toBe(JSON.stringify(palette2));
  });

  it('should not throw for black (#000000) and return a valid palette object', () => {
    let palette: ReturnType<typeof service.generatePalette> | undefined;

    expect(() => {
      palette = service.generatePalette('#000000');
    }).not.toThrow();

    expect(palette).toBeDefined();
    expect(palette![0]).toBe('#000000');
    expect(palette![100]).toBe('#ffffff');
    expect(palette![40]).toBe('#000000');
  });
});
