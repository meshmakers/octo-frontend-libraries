import { Routes } from '@angular/router';
import { RuntimeBrowserComponent } from './runtime-browser.component';
import { EntityDetailComponent } from './entity-detail.component';
import { storage } from '../../../custom-svg-icons';

export const routes: Routes = [
  {
    path: '',
    component: RuntimeBrowserComponent,
    data: {
      breadcrumb: [
        {
          label: 'Runtime Browser',
          svgIcon: storage,
          url: 'repository/browser',
        },
      ],
    },
  },
  {
    path: 'entity/:id',
    component: EntityDetailComponent,
    data: {
      breadcrumb: [
        {
          label: 'Runtime Browser',
          svgIcon: storage,
          url: 'repository/browser',
        },
        {
          label: 'Entity Details',
          url: 'repository/browser/entity/:id',
        },
      ],
    },
  },
];
