import {Routes} from '@angular/router';
import {
  add,
  category,
  dashboard, event_list, insert_link,
  settings,
  storage,
  tenancy
} from '../custom-svg-icons';
import { UnsavedChangesGuard } from '@meshmakers/shared-ui';

export const routes: Routes = [
  {
    path: "",
    pathMatch: "full",
    redirectTo: "cockpit",
    data: {}
  },
  {
    path: "cockpit",
    loadComponent: () =>
      import('@meshmakers/octo-meshboard').then(m => m.MeshBoardViewComponent),
    canDeactivate: [UnsavedChangesGuard],
    data: {
      // Load MeshBoard with rtWellKnownName "cockpit"
      meshBoardWellKnownName: 'cockpit',
      breadcrumb: [
        {
          label: "Cockpit",
          svgIcon: dashboard,
          url: "cockpit"
        }
      ]
    }
  },
  {
    path: "tenants",
    loadComponent: () =>
      import('./tenants/tenants.component').then(m => m.TenantsComponent),
    data: {
      roles: ["TenantManagement"],
      breadcrumb: [
        {
          label: "Tenants",
          svgIcon: tenancy,
          url: "tenants"
        }
      ],
      navigationMenu: [
        {
          id: '1', text: 'Tenants', type: 'section', children: [
            {id: '2', text: 'New', type: 'link', link: "tenants/new", svgIcon: add},
            {id: '3', type: 'separator'},
            {id: '4', text: 'Attach', type: 'link', link: "tenants/attach", svgIcon: insert_link},
          ]
        },
      ]
    }
  },
  {
    path: "tenants/attach",
    loadComponent: () =>
      import('./fake/fake.component').then(m => m.FakeComponent),
    data: {
      roles: ["TenantManagement"],
      breadcrumb: [
        {
          label: "Tenants",
          svgIcon: tenancy,
          url: "tenants"
        },
        {
          label: "Attach",
          url: "tenants/attach"
        }
      ]
    }
  },
  {
    path: "tenants/new",
    loadComponent: () =>
      import('./fake/fake.component').then(m => m.FakeComponent),
    data: {
      roles: ["TenantManagement"],
      breadcrumb: [
        {
          label: "Tenants",
          svgIcon: tenancy,
          url: "tenants"
        },
        {
          label: "New",
          url: "tenants/new"
        }
      ]
    }
  },
  {
    path: "list-view",
    loadComponent: () =>
      import('./list-view-demo/list-view-demo.component').then(m => m.ListViewDemoComponent),
    data: {
      breadcrumb: [
        {
          label: "List View",
          svgIcon: event_list,
          url: "list-view"
        }
      ]
    }
  },
  {
    path: "list-view/details/:id",
    loadComponent: () =>
      import('./list-view-demo/details/details.component').then(m => m.ListViewDetailsComponent),
    canDeactivate: [UnsavedChangesGuard],
    data: {
      breadcrumb: [
        {
          label: "List View",
          svgIcon: event_list,
          url: "list-view"
        },
        {
          label: "Details",
          url: "list-view/details"
        }
      ]
    }
  },
  {
    path: "list-view/view/:id",
    loadComponent: () =>
      import('./list-view-demo/details/details.component').then(m => m.ListViewDetailsComponent),
    data: {
      isViewMode: true,
      breadcrumb: [
        {
          label: "List View",
          svgIcon: event_list,
          url: "list-view"
        },
        {
          label: "View",
          url: "list-view/view"
        }
      ]
    }
  },
  {
    path: "meshboard",
    loadComponent: () =>
      import('@meshmakers/octo-meshboard').then(m => m.MeshBoardViewComponent),
    canDeactivate: [UnsavedChangesGuard],
    data: {
      breadcrumb: [
        {
          label: "MeshBoard",
          svgIcon: dashboard,
          url: "meshboard"
        }
      ]
    }
  },
  {
    path: "meshboard/:rtId",
    loadComponent: () =>
      import('@meshmakers/octo-meshboard').then(m => m.MeshBoardViewComponent),
    canDeactivate: [UnsavedChangesGuard],
    data: {
      breadcrumb: [
        {
          label: "MeshBoard",
          svgIcon: dashboard,
          url: "meshboard"
        }
      ]
    }
  },
  {
    path: "process-designer",
    loadChildren: () =>
      import('./process-designer/process-designer.routes').then(m => m.routes),
    data: {
      breadcrumb: [
        {
          label: "Process Diagrams",
          svgIcon: settings,
          url: "process-designer"
        }
      ]
    }
  },
  {
    path: "symbol-library",
    loadChildren: () =>
      import('./symbol-library/symbol-library.routes').then(m => m.routes),
    data: {
      breadcrumb: [
        {
          label: "Symbol Libraries",
          svgIcon: category,
          url: "symbol-library"
        }
      ]
    }
  },
  {
    path: "data-mappings",
    loadComponent: () =>
      import('@meshmakers/octo-ui').then(m => m.DataMappingOverviewComponent),
    data: {
      breadcrumb: [
        {
          label: "Data Mappings",
          svgIcon: insert_link,
          url: "data-mappings"
        }
      ]
    }
  },
  {
    path: "demos",
    loadChildren: () =>
      import('./demos/demos.routes').then(m => m.routes),
    data: {
      breadcrumb: [
        {
          label: "Demos",
          svgIcon: storage,
          url: "demos"
        }
      ]
    }
  }
];
