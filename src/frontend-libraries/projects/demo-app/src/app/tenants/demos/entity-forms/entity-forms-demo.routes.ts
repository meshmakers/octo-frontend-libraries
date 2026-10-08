import { Routes } from '@angular/router';
import { entityFormRoutes } from '@meshmakers/octo-ui/entity-forms';
import { EntityFormsDemoComponent } from './entity-forms-demo.component';

export const routes: Routes = [
  {
    path: '',
    component: EntityFormsDemoComponent,
    children: entityFormRoutes({
      formKey: 'sftp-configuration',
      breadcrumbUrl: 'demos/entity-forms',
    }),
  },
];
