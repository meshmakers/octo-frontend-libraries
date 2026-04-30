import { ThemePalette } from './theme.models';

/** Domain-level branding shape consumed by the UI. */
export interface BrandingData {
  rtId: string | null;
  appName: string;
  appTitle: string;
  headerLogoUrl: string | null;
  footerLogoUrl: string | null;
  faviconUrl: string | null;
  lightTheme: ThemePalette;
  /** When null, the tenant has disabled dark mode — switcher locks to light. */
  darkTheme: ThemePalette | null;
}

/**
 * Update descriptor for `BrandingDataSource.save`. File slots are tri-state:
 * `File` replaces, `null` clears, `undefined` leaves the existing blob untouched.
 */
export interface BrandingUpdate {
  appName: string;
  appTitle: string;
  headerLogoFile: File | null | undefined;
  footerLogoFile: File | null | undefined;
  faviconFile: File | null | undefined;
  lightTheme: ThemePalette;
  darkTheme: ThemePalette | null;
}
