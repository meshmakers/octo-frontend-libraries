/**
 * Strings used by `SettingsPageComponent`. This is a **required** input on the
 * component — there are too many keys to provide reasonable English defaults
 * that would degrade gracefully. Host applications construct an instance from
 * their own translation system (e.g. ngx-translate `instant()`) and pass it
 * via `[messages]`.
 *
 * Suggested .resx key prefix: `Branding_Settings_*` (or `Settings_*` to match
 * the existing maco-app keys).
 */
export interface BrandingSettingsMessages {
  // Section headers
  sectionGeneral: string;
  sectionLogos: string;
  sectionLightTheme: string;
  sectionDarkTheme: string;
  enableDarkTheme: string;

  // General
  appName: string;
  appTitle: string;

  // Logos
  logoHeader: string;
  logoFooter: string;
  logoFavicon: string;
  logoRemove: string;
  uploadLogo: string;
  uploadFavicon: string;

  // Colors
  colorPrimary: string;
  colorSecondary: string;
  colorTertiary: string;
  colorNeutral: string;
  colorBackground: string;
  gradientHeader: string;
  gradientFooter: string;
  gradientStart: string;
  gradientEnd: string;

  // Form / actions
  required: string;
  save: string;
  resetDefaults: string;

  // Feedback
  saveSuccess: string;
  saveError: string;
  resetSuccess: string;
  loadError: string;
}
