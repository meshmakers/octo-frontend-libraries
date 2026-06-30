import { Routes } from '@angular/router';

/**
 * Routes for the tree navigation settings UI. Mount under any path, e.g.:
 *
 * ```ts
 * { path: 'tree-navigation', canActivate: [adminGuard], children: TREE_NAVIGATION_SETTINGS_ROUTES }
 * ```
 *
 * The component is lazy-loaded on first navigation (`loadComponent`).
 */
export const TREE_NAVIGATION_SETTINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./tree-navigation-settings.component').then(
        (m) => m.TreeNavigationSettingsComponent,
      ),
  },
];
