# @meshmakers/octo-ui

Angular library providing reusable UI components for OctoMesh applications.

## Features

- **Data Sources** - GraphQL-based data source abstractions for list views and hierarchies
- **Property Grid** - Dynamic property editor with type-aware value display
- **Runtime Browser** - Tree/detail view with create and update editors for runtime entities
- **Selector Dialogs** - Attribute and CK type selection dialogs
- **Filter Editor** - Visual query filter configuration
- **Theme Independent** - Works with any Kendo UI theme

## Documentation

- [Developer Documentation](CLAUDE.md) - Complete API reference and usage examples

## Quick Start

### 1. Import Components

```typescript
import {
  PropertyGridComponent,
  CkTypeSelectorInputComponent,
  AttributeSelectorDialogService
} from '@meshmakers/octo-ui';

@Component({
  imports: [PropertyGridComponent, CkTypeSelectorInputComponent],
  // ...
})
export class MyComponent {}
```

### 2. Use Property Grid

```typescript
import { PropertyGridComponent, PropertyGridItem, AttributeValueTypeDto } from '@meshmakers/octo-ui';

@Component({
  template: `
    <mm-property-grid
      [properties]="properties"
      [readOnlyMode]="false"
      (propertyChange)="onPropertyChange($event)">
    </mm-property-grid>
  `
})
export class EntityDetailComponent {
  properties: PropertyGridItem[] = [
    {
      id: 'name',
      name: 'name',
      displayName: 'Customer Name',
      value: 'Acme Corp',
      type: AttributeValueTypeDto.StringDto,
      readOnly: false,
      category: 'General'
    }
  ];

  onPropertyChange(event: PropertyChangeEvent) {
    console.log('Property changed:', event.propertyId, event.newValue);
  }
}
```

### 3. Use CK Type Selector

```typescript
import { CkTypeSelectorInputComponent, CkTypeSelectorItem } from '@meshmakers/octo-ui';

@Component({
  template: `
    <mm-ck-type-selector-input
      [(ngModel)]="selectedType"
      [ckModelIds]="['OctoSdkDemo']"
      (ckTypeSelected)="onTypeSelected($event)">
    </mm-ck-type-selector-input>
  `
})
export class TypeSelectorComponent {
  selectedType: CkTypeSelectorItem | null = null;

  onTypeSelected(type: CkTypeSelectorItem) {
    // Use type.rtCkTypeId for runtime queries
    console.log('Selected:', type.rtCkTypeId);
  }
}
```

### 4. Use Data Source with List View

```typescript
import { OctoGraphQlDataSource, FetchDataOptions, FetchResultTyped } from '@meshmakers/octo-ui';
import { DataSourceBase, ListViewComponent } from '@meshmakers/shared-ui';

@Directive({
  selector: '[appCustomerDataSource]',
  exportAs: 'appCustomerDataSource',
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => CustomerDataSourceDirective) }]
})
export class CustomerDataSourceDirective extends OctoGraphQlDataSource<CustomerDto> {
  private readonly getCustomersGQL = inject(GetCustomersDtoGQL);

  constructor() {
    super(inject(ListViewComponent));
    this.searchFilterAttributePaths = ['name', 'email'];
  }

  fetchData(options: FetchDataOptions): Observable<FetchResultTyped<CustomerDto>> {
    return this.getCustomersGQL.fetch({
      variables: {
        first: options.state.take,
        after: GraphQL.offsetToCursor(options.state.skip ?? 0),
        sortOrder: this.getSortDefinitions(options.state),
        fieldFilter: this.getFieldFilterDefinitions(options.state),
        searchFilter: this.getSearchFilterDefinitions(options.textSearch)
      },
      fetchPolicy: 'network-only'
    }).pipe(map(result => new FetchResultTyped<CustomerDto>(
      result.data?.runtime?.customers?.items ?? [],
      result.data?.runtime?.customers?.totalCount ?? 0
    )));
  }
}
```

## Available Components

| Component | Description |
|-----------|-------------|
| `PropertyGridComponent` | Dynamic property grid with type-aware editing |
| `PropertyValueDisplayComponent` | Read-only value display with type formatting |
| `CkTypeSelectorInputComponent` | Autocomplete input for CK type selection |
| `FieldFilterEditorComponent` | Visual filter editor for queries |
| `EntityIdInfoComponent` | Entity ID display with copy-to-clipboard dropdown |
| `OctoLoaderComponent` | Animated OctoMesh logo loading indicator |

## Available Services

| Service | Description |
|---------|-------------|
| `PropertyConverterService` | Convert entities to property grid items |
| `AttributeSelectorDialogService` | Open attribute selection dialog |
| `AttributeSortSelectorDialogService` | Open attribute selection with sort order |
| `CkTypeSelectorDialogService` | Open CK type selection dialog |

## Data Source Classes

| Class | Description |
|-------|-------------|
| `OctoGraphQlDataSource` | Base class for GraphQL list data sources |
| `OctoGraphQlHierarchyDataSource` | Base class for tree/hierarchy data sources |
| `FetchResultTyped` | Typed result wrapper with items and totalCount |

## Branding

Per-tenant branding (logo, title, palette) with light/dark mode and a configurable
Settings page. See [`src/lib/branding/BRANDING_USAGE.md`](./src/lib/branding/BRANDING_USAGE.md).

```typescript
// app.config.ts
import { provideOctoBranding } from '@meshmakers/octo-ui';

providers: [
  provideOctoBranding({
    defaults: { appName: 'MyApp', appTitle: 'MyApp' },
    fallbackAssets: { headerLogo: '/logo.svg', favicon: '/favicon.ico' },
  }),
];
```

Wire `/settings` route:

```typescript
// app.routes.ts
import { BRANDING_ROUTES } from '@meshmakers/octo-ui';

{ path: 'settings', canActivate: [adminGuard], children: BRANDING_ROUTES }
```

Drop the standalone components into your shell wherever they belong, and
bind your header/footer chrome to the CSS vars the library writes:

```html
<header class="my-header">
  <mm-theme-switcher />
  <!-- Render the logo inline; inject BrandingDataSource and bind .branding().headerLogoUrl -->
  <img [src]="logoUrl()" alt="" class="my-header-logo" />
</header>
```

```scss
.my-header {
  background: linear-gradient(
    to right,
    var(--app-header-gradient-start),
    var(--app-header-gradient-end)
  );
  color: var(--app-header-text);
}
```

See [`src/lib/branding/BRANDING_USAGE.md`](./src/lib/branding/BRANDING_USAGE.md)
for the full list of CSS variables the library updates and the host-app
contract for the surface ladder.

## Build

```bash
# From frontend-libraries directory
npm run build:octo-ui
```

## Test

```bash
npm test -- --project=@meshmakers/octo-ui --watch=false
```

## Lint

```bash
npm run lint:octo-ui
```
