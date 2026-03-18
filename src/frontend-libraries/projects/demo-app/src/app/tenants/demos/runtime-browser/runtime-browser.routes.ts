import { Route } from '@angular/router';
import {
  createRuntimeBrowserRoutes,
  RuntimeBrowserPageComponent,
} from '@meshmakers/octo-ui';
import { RuntimeBrowserDemoComponent } from './runtime-browser-demo.component';

export const routes: Route[] = [
  {
    path: '',
    component: RuntimeBrowserDemoComponent,
    children: createRuntimeBrowserRoutes({
      basePath: 'demos/runtime-browser',
      breadcrumbLabel: 'Runtime Browser',
      entityBreadcrumbLabel: 'Entity Details',
      pageComponent: RuntimeBrowserPageComponent,
    }),
  },
];
