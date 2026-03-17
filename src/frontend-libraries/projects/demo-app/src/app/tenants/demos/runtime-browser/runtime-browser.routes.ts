import { Route } from '@angular/router';
import {
  createRuntimeBrowserRoutes,
  RuntimeBrowserOutletComponent,
  storage,
} from '@meshmakers/octo-ui';
import { RuntimeBrowserDemoComponent } from './runtime-browser-demo.component';

export const routes: Route[] = [
  {
    path: '',
    component: RuntimeBrowserOutletComponent,
    children: createRuntimeBrowserRoutes({
      basePath: 'demos/runtime-browser',
      breadcrumbLabel: 'Runtime Browser',
      entityBreadcrumbLabel: 'Entity Details',
      svgIcon: storage,
      pageComponent: RuntimeBrowserDemoComponent,
    }),
  },
];
