import { InjectionToken } from '@angular/core';
import { BrandingData } from './models/branding.models';
import { ThemePalette } from './models/theme.models';

/**
 * Bundled fallback URLs used when the tenant did not upload a logo / favicon.
 * Any field omitted means the corresponding component renders nothing (text-only
 * header, no <link rel="icon">, etc.) instead of breaking with a 404.
 */
export interface OctoBrandingFallbackAssets {
  headerLogo?: string;
  footerLogo?: string;
  favicon?: string;
}

export const OCTO_BRANDING_DEFAULTS = new InjectionToken<BrandingData>(
  'OCTO_BRANDING_DEFAULTS',
);

export const OCTO_BRANDING_FALLBACK_ASSETS = new InjectionToken<OctoBrandingFallbackAssets>(
  'OCTO_BRANDING_FALLBACK_ASSETS',
);

// Library defaults carry the Meshmakers brand mint (#65ceaf) as primary so
// an app that opts into `provideOctoBranding` but never persists a
// `SystemUIBranding` record renders with the publisher's identity rather
// than vanilla Kendo. Mint is also non-aggressive in mixed contexts (no
// alarm/error semantics like Kendo's tomato default), so tenant overrides
// almost always read as an intentional rebrand rather than a workaround.
// Apps override per-tenant via Settings page; the override completely
// replaces these baselines.
const NEUTRAL_LIGHT_THEME: ThemePalette = {
  primaryColor: '#65ceaf',
  secondaryColor: '#5ac4be',
  tertiaryColor: '#0b5c92',
  neutralColor: '#6c757d',
  backgroundColor: '#ffffff',
  headerGradient: { startColor: '#ffffff', endColor: '#f8f9fa' },
  footerGradient: { startColor: '#65ceaf', endColor: '#5ac4be' },
};

const NEUTRAL_DARK_THEME: ThemePalette = {
  primaryColor: '#65ceaf',
  secondaryColor: '#5ac4be',
  tertiaryColor: '#4a8eef',
  neutralColor: '#94a3b8',
  backgroundColor: '#1a1d20',
  headerGradient: { startColor: '#1a1d20', endColor: '#2b2f33' },
  footerGradient: { startColor: '#65ceaf', endColor: '#5ac4be' },
};

/**
 * Library-shipped neutral fallback. Apps that don't supply their own defaults
 * see a working but visually-neutral baseline ("configure me"), not a crash.
 */
export const NEUTRAL_BRANDING_DEFAULTS: BrandingData = {
  rtId: null,
  appName: 'App',
  appTitle: 'App',
  headerLogoUrl: null,
  footerLogoUrl: null,
  faviconUrl: null,
  lightTheme: NEUTRAL_LIGHT_THEME,
  darkTheme: NEUTRAL_DARK_THEME,
};

export const NEUTRAL_FALLBACK_ASSETS: OctoBrandingFallbackAssets = {};
