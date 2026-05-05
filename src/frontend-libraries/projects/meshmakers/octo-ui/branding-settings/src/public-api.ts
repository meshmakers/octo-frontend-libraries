/*
 * Public API Surface of @meshmakers/octo-ui/branding-settings
 *
 * Heavy admin-only branding editor. Lives in its own secondary entry point so
 * host applications that only need the lightweight branding pieces (header
 * logo, theme switcher, services) — exposed by the primary `@meshmakers/octo-ui`
 * entry — do not pay for the form/Kendo modules pulled in by the editor itself.
 */
export * from './settings-page.component';
export * from './branding-settings.messages';
export * from './branding-settings.routes';
