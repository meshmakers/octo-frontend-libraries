import { Routes } from '@angular/router';
import { UnsavedChangesGuard } from '@meshmakers/shared-ui';
import {
  SymbolLibraryListComponent,
  SymbolLibraryDetailComponent,
  SymbolEditorPageComponent
} from '@meshmakers/octo-process-diagrams';
import { category } from '../../custom-svg-icons';

export const routes: Routes = [
  {
    path: '',
    component: SymbolLibraryListComponent,
    data: {
      breadcrumb: [
        { label: 'Symbol Libraries', svgIcon: category, url: 'symbol-library' }
      ]
    }
  },
  {
    path: ':libraryId',
    component: SymbolLibraryDetailComponent,
    data: {
      breadcrumb: [
        { label: 'Symbol Libraries', svgIcon: category, url: 'symbol-library' },
        { label: '{{libraryName}}', url: 'symbol-library/:libraryId' }
      ]
    }
  },
  {
    path: ':libraryId/:symbolId/edit',
    component: SymbolEditorPageComponent,
    canDeactivate: [UnsavedChangesGuard],
    data: {
      breadcrumb: [
        { label: 'Symbol Libraries', svgIcon: category, url: 'symbol-library' },
        { label: '{{libraryName}}', url: 'symbol-library/:libraryId' },
        { label: '{{symbolName}}', url: 'symbol-library/:libraryId/:symbolId/edit' }
      ]
    }
  }
];
