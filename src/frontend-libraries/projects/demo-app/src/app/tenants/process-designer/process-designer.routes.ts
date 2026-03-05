import { Routes } from '@angular/router';
import { UnsavedChangesGuard } from '@meshmakers/shared-ui';
import { ProcessDiagramListComponent } from '@meshmakers/octo-process-diagrams';
import { settings } from '../../custom-svg-icons';

export const routes: Routes = [
  {
    path: '',
    component: ProcessDiagramListComponent,
    data: {
      breadcrumb: [
        { label: 'Process Diagrams', svgIcon: settings, url: 'process-designer' }
      ]
    }
  },
  {
    path: ':diagramRtId',
    loadComponent: () =>
      import('./process-designer-page.component').then(m => m.ProcessDesignerPageComponent),
    canDeactivate: [UnsavedChangesGuard],
    data: {
      breadcrumb: [
        { label: 'Process Diagrams', svgIcon: settings, url: 'process-designer' },
        { label: '{{diagramName}}', url: 'process-designer/:diagramRtId' }
      ]
    }
  }
];
