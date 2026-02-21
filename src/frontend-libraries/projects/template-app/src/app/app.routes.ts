import {Routes} from '@angular/router';
import {authorizeChildGuard} from '@meshmakers/shared-auth';
import {TenantComponent} from './tenant.component';


export const routes: Routes = [
  {path: "", redirectTo: "/octosystem", pathMatch: "full"},
  {
    path: ":tenantId",
    component: TenantComponent,
    canActivateChild: [authorizeChildGuard],
    loadChildren: () =>
      import('./tenants/tenant.routes').then(m => m.routes)
  }
];
