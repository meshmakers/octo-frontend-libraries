import type { Provider } from '@angular/core';
import { Route, Routes } from '@angular/router';
import type { SVGIcon } from '@progress/kendo-svg-icons';
import { EntityDetailComponent } from './entity-detail.component';
import { RuntimeBrowserPageComponent } from './runtime-browser-page.component';

/** Options for creating runtime browser routes. */
export interface RuntimeBrowserRouteOptions {
  /** Base path for breadcrumb URLs (e.g. 'repository/browser', 'administration/plant-management'). */
  basePath: string;
  /** Breadcrumb label for the main browser view. Default: 'Runtime Browser'. */
  breadcrumbLabel?: string;
  /** Breadcrumb label for the entity detail view. Default: 'Entity Details'. */
  entityBreadcrumbLabel?: string;
  /** Optional SVG icon for breadcrumbs. */
  svgIcon?: SVGIcon;
  /** Optional custom page component for the main view (overrides RuntimeBrowserPageComponent). */
  pageComponent?: unknown;
  /** Optional route-level providers (e.g. for RUNTIME_BROWSER_MESSAGES). */
  providers?: Provider[];
}

/**
 * Creates routes for the runtime browser feature (main view + entity detail).
 * Use these as children of a parent route that has a router-outlet.
 *
 * @example
 * // In repository.routes.ts
 * import { storage } from '@meshmakers/octo-ui';
 * {
 *   path: 'browser',
 *   component: RuntimeBrowserOutletComponent,
 *   children: createRuntimeBrowserRoutes({
 *     basePath: 'repository/browser',
 *     breadcrumbLabel: 'Runtime Browser',
 *     entityBreadcrumbLabel: 'Entity Details',
 *     svgIcon: storage,
 *   }),
 *   data: { breadcrumb: [{ label: 'Repository', url: 'repository' }] },
 * }
 */
export function createRuntimeBrowserRoutes(
  options: RuntimeBrowserRouteOptions,
): Routes {
  const {
    basePath,
    breadcrumbLabel = 'Runtime Browser',
    entityBreadcrumbLabel = 'Entity Details',
    svgIcon,
    pageComponent,
    providers = [],
  } = options;

  const mainRoute: Route = {
    path: '',
    component: (pageComponent as never) ?? RuntimeBrowserPageComponent,
    data: {
      breadcrumb: [
        {
          label: breadcrumbLabel,
          ...(svgIcon && { svgIcon }),
          url: basePath,
        },
      ],
    },
    ...(providers.length > 0 && { providers }),
  };

  const entityRoute: Route = {
    path: 'entity/:id',
    component: EntityDetailComponent,
    data: {
      breadcrumb: [
        {
          label: breadcrumbLabel,
          ...(svgIcon && { svgIcon }),
          url: basePath,
        },
        {
          label: entityBreadcrumbLabel,
          url: `${basePath}/entity/:id`,
        },
      ],
    },
  };

  return [mainRoute, entityRoute];
}
