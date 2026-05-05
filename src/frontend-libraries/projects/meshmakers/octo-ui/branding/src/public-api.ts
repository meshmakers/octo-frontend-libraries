// Public API of the branding feature folder. Re-exported by
// octo-ui/src/public-api.ts to expose under @meshmakers/octo-ui.
//
// Note: the heavy admin-only `SettingsPageComponent` (a.k.a.
// `mm-branding-settings`) and `BRANDING_ROUTES` live in the dedicated
// secondary entry point `@meshmakers/octo-ui/branding-settings` so apps that
// only need the lightweight branding pieces (logo, theme switcher, services)
// don't pull in form/Kendo modules they don't use.

// Configuration & tokens
export * from './branding.config';
export * from './branding.tokens';

// Models (via barrel)
export * from './branding.model';

// Components
//
// Note: there is no `<mm-brand-logo>` component. Hosts render the logo inline
// with `<img [src]="branding.branding().headerLogoUrl ?? '/your-fallback.svg'">`
// after injecting `BrandingDataSource`. See `BRANDING_USAGE.md` for the
// recommended snippet.
export * from './components/mm-theme-switcher/theme-switcher.component';
export * from './components/mm-theme-switcher/theme-switcher.messages';

// Services
export * from './services/branding-data-source.service';
export * from './services/theme.service';
export * from './services/branding-application.service';
export * from './services/app-title.service';

// Test utilities
export * from './testing/branding-stub';
