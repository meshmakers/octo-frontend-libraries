import { Routes } from '@angular/router';
import { storage } from '../../custom-svg-icons';

export const routes: Routes = [
  {
    path: 'demos',
    loadComponent: () =>
      import('../fake/fake.component').then((m) => m.FakeComponent),
    data: {
      breadcrumb: [
        {
          label: 'Demos',
          svgIcon: storage,
          url: 'demos',
        },
      ],
    },
  },
  {
    path: 'tree',
    loadComponent: () =>
      import('./tree/tree-demo.component').then((m) => m.TreeDemoComponent),
    data: {
      breadcrumb: [
        {
          label: 'Tree',
          url: 'demos/tree',
        },
      ],
    },
  },
  {
    path: 'dialogs',
    loadComponent: () =>
      import('./dialogs/dialogs-demo/dialogs-demo.component').then(
        (m) => m.DialogsDemoComponent,
      ),
    data: {
      breadcrumb: [
        {
          label: 'Dialogs',
          url: 'demos/dialogs',
        },
      ],
    },
  },
  {
    path: 'property-grid',
    loadComponent: () =>
      import('./property-grid/property-grid-demo.component').then(
        (m) => m.PropertyGridDemoComponent,
      ),
    data: {
      breadcrumb: [
        {
          label: 'Property Grid',
          url: 'demos/property-grid',
        },
      ],
    },
  },
  {
    path: 'attribute-selector',
    loadComponent: () =>
      import('./attribute-selector/attribute-selector-demo.component').then(
        (m) => m.AttributeSelectorDemoComponent,
      ),
    data: {
      breadcrumb: [
        {
          label: 'Attribute Selector',
          url: 'demos/attribute-selector',
        },
      ],
    },
  },
  {
    path: 'attribute-sort-selector',
    loadComponent: () =>
      import('./attribute-sort-selector/attribute-sort-selector-demo.component').then(
        (m) => m.AttributeSortSelectorDemoComponent,
      ),
    data: {
      breadcrumb: [
        {
          label: 'Attribute Sort Selector',
          url: 'demos/attribute-sort-selector',
        },
      ],
    },
  },
  {
    path: 'message',
    loadComponent: () =>
      import('./message/message-demo.component').then(
        (m) => m.MessageDemoComponent,
      ),
    data: {
      breadcrumb: [
        {
          label: 'Message Demo',
          url: 'demos/message',
        },
      ],
    },
  },
  {
    path: 'entity-select',
    loadComponent: () =>
      import('./entity-select/entity-select-demo.component').then(
        (m) => m.EntitySelectDemoComponent,
      ),
    data: {
      breadcrumb: [
        {
          label: 'Entity Select',
          url: 'demos/entity-select',
        },
      ],
    },
  },
  {
    path: 'ck-type-selector',
    loadComponent: () =>
      import('./ck-type-selector/ck-type-selector-demo.component').then(
        (m) => m.CkTypeSelectorDemoComponent,
      ),
    data: {
      breadcrumb: [
        {
          label: 'CkType Selector',
          url: 'demos/ck-type-selector',
        },
      ],
    },
  },
  {
    path: 'multiselect',
    loadComponent: () =>
      import('./multiselect/multiselect-demo.component').then(
        (m) => m.MultiselectDemoComponent,
      ),
    data: {
      breadcrumb: [
        {
          label: 'MultiSelect',
          url: 'demos/multiselect',
        },
      ],
    },
  },
  {
    path: 'form',
    loadComponent: () =>
      import('./form/form-demo.component').then((m) => m.FormDemoComponent),
    data: {
      breadcrumb: [
        {
          label: 'Form',
          url: 'demos/form',
        },
      ],
    },
  },
  {
    path: 'field-filter-editor',
    loadComponent: () =>
      import('./field-filter-editor/field-filter-editor-demo.component').then(
        (m) => m.FieldFilterEditorDemoComponent,
      ),
    data: {
      breadcrumb: [
        {
          label: 'Field Filter Editor',
          url: 'demos/field-filter-editor',
        },
      ],
    },
  },
  {
    path: 'time-range-picker',
    loadComponent: () =>
      import('./time-range-picker/time-range-picker-demo.component').then(
        (m) => m.TimeRangePickerDemoComponent,
      ),
    data: {
      breadcrumb: [
        {
          label: 'Time Range Picker',
          url: 'demos/time-range-picker',
        },
      ],
    },
  },
  {
    path: 'cron-builder',
    loadComponent: () =>
      import('./cron-builder/cron-builder-demo.component').then(
        (m) => m.CronBuilderDemoComponent,
      ),
    data: {
      breadcrumb: [
        {
          label: 'Cron Builder',
          url: 'demos/cron-builder',
        },
      ],
    },
  },
  {
    path: 'copyable-text',
    loadComponent: () =>
      import('./copyable-text/copyable-text-demo.component').then(
        (m) => m.CopyableTextDemoComponent,
      ),
    data: {
      breadcrumb: [
        {
          label: 'Copyable Text',
          url: 'demos/copyable-text',
        },
      ],
    },
  },
  {
    path: 'runtime-browser',
    loadComponent: () =>
      import('./runtime-browser/runtime-browser-demo.component').then(
        (m) => m.RuntimeBrowserDemoComponent,
      ),
    data: {
      breadcrumb: [
        {
          label: 'Runtime Browser',
          url: 'demos/runtime-browser',
        },
      ],
    },
  },
];
