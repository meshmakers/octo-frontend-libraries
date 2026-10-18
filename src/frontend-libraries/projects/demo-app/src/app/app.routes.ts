import {Routes} from '@angular/router';
import {authorizeChildGuard, TENANT_MISMATCH_PATH, TenantMismatchComponent} from '@meshmakers/shared-auth';
import {TenantComponent} from './tenant.component';


export const routes: Routes = [
  {path: '', redirectTo: '/octosystem', pathMatch: 'full'},
  // AB#6731: shown by authorizeGuard when the token belongs to another tenant than the route
  {path: `:tenantId/${TENANT_MISMATCH_PATH}`, component: TenantMismatchComponent},
  {
    path: ':tenantId',
    component: TenantComponent,
    canActivateChild: [authorizeChildGuard],
    loadChildren: () =>
      import('./tenants/tenant.routes').then(m => m.routes)
  }
];
