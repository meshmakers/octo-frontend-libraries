import { Routes } from '@angular/router';

/**
 * Routes for the branding/settings UI. Mount under any path:
 *
 * ```ts
 * { path: 'settings', canActivate: [adminGuard], children: BRANDING_ROUTES }
 * ```
 *
 * The `SettingsPageComponent` is lazy-loaded on first navigation regardless of
 * how the host wires this — `loadComponent` returns a dynamic import.
 */
export const BRANDING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./settings-page.component').then(
        (m) => m.SettingsPageComponent,
      ),
  },
];
