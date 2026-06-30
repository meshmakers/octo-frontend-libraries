/*
 * Public API Surface of @meshmakers/octo-ui/tree-navigation-settings
 *
 * Admin-only editor for the per-tenant System.UI/TreeNavigationConfiguration.
 * Lives in its own secondary entry point so host applications that only need
 * the runtime browser / data-mappings trees (primary `@meshmakers/octo-ui`
 * entry) do not pay for the reactive-form / Kendo modules this editor pulls in.
 */
export * from './tree-navigation-settings.component';
export * from './tree-navigation-settings.messages';
export * from './tree-navigation-settings.routes';
