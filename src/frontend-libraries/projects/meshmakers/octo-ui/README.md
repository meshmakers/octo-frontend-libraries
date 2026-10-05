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
| `PageComponent` (`MM_PAGE`) | `<mm-page>` page layout: optional header (title, subtitle, actions) + scrolling content, no footer |

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

## Page layout (`mm-page`)

`<mm-page>` (`PageComponent`) is the token-based page frame that replaces the
LCARS header / content panel / footer triple: an optional header (title,
subtitle, `[mmPageActions]`) and a scrolling content area, no footer. Import
`MM_PAGE` (component + slot directives); the title defaults to heading level 2
and the header is a plain `<div>`. See
[`src/lib/page/README.md`](./src/lib/page/README.md).

```html
<mm-page pageTitle="Adapters" pageSubtitle="12 registered">
  <div mmPageActions><button kendoButton themeColor="primary">New adapter</button></div>
  <mm-list-view …></mm-list-view>
</mm-page>
```

## Theme tokens (overridable CSS variables)

`@include octo.theme()` emits the "Deep Sea" token set on `:root` (dark
default, light via `prefers-color-scheme` or `data-theme="light"`); source:
`src/lib/runtime-browser/styles/_theme.scss`. Hosts may override any of these
custom properties after the include. Every LCARS-era name is kept; tokens
marked *new* were added in AB#5519.

| Group | Tokens |
|---|---|
| Surfaces | `--theme-bg-app`, `--theme-bg-app-end`, `--theme-bg-surface`, `--theme-bg-elevated`, `--theme-bg-overlay`, `--theme-bg-input`, *new:* `--theme-bg-sunken`, `--theme-bg-selected`, `--theme-bg-hover` |
| Text | `--theme-text-primary`, `--theme-text-secondary`, `--theme-text-muted`, `--theme-text-on-accent`, `--theme-text-accent`, *new:* `--theme-text-code` |
| Borders | `--theme-border-subtle`, `--theme-border-strong`, `--theme-border-divider` (= subtle), *new:* `--theme-border-default`, `--theme-focus-ring` (a `box-shadow` value) |
| Accent / AI (*new*) | `--theme-accent`, `--theme-accent-hover`, `--theme-accent-subtle`, `--theme-accent-2`, `--theme-ai`, `--theme-ai-subtle` |
| Status | `--theme-status-success`, `-warning`, `-error`, `-info`, *new:* `--theme-status-neutral`, `--theme-status-{success,warning,error,info,neutral}-subtle` |
| Effects | `--theme-shadow-panel`, `--theme-shadow-popup`; `--theme-glow-primary`, `--theme-glow-accent` (both `none`); `--theme-gradient-page`, `--theme-gradient-header`, `--theme-accent-bar`, `--theme-accent-line`, `--theme-panel-rule` (now flat colours) |
| Charts | `--theme-chart-1` … `--theme-chart-8` |
| Ink overlays | `--theme-ink-02` … `--theme-ink-70` (text colour at n % — flips with the theme) |
| Typography (*new*, theme-invariant) | `--theme-font-display` (Montserrat), `--theme-font-ui` (Roboto), `--theme-font-mono` (Roboto Mono) |
| Spacing (*new*) | `--theme-space-1` … `--theme-space-8` (4 px grid: 4, 8, 12, 16, 20, 24, 28, 32 px) |
| Radius (*new*) | `--theme-radius-xs` 2 px (chips), `-sm` 4 px (buttons, inputs), `-md` 6 px (cards, panels), `-lg` 8 px (dialogs, popovers) |
| Motion (*new*) | `--theme-motion-fast` 120 ms, `--theme-motion-base` 200 ms, `--theme-motion-easing`; both durations become `0ms` under `prefers-reduced-motion: reduce` |

Aliases kept for one release: `--lcars-font-primary` → `--theme-font-display`,
`--lcars-font-mono` → `--theme-font-mono`, `--lcars-radius-sm/md/lg` →
`--theme-radius-sm/md/lg`, `--lcars-input-focus` → `--theme-focus-ring`,
`--lcars-transition-fast/-normal` → `--theme-motion-fast/-base` + easing (so
reduced motion reaches them). `--lcars-glow-*` and `--lcars-btn-base*` still
carry the LCARS look and are removed with the LCARS classes (AB#5526).

Body text: `octo.styles()` sets `body { font-family: var(--lcars-font-primary) }`,
which now resolves to `--theme-font-display`, so body text **stays Montserrat**
for now; Kendo components (`--kendo-font-family`) and anything that opts into
`--theme-font-ui` use Roboto. Switching body text to Roboto is
deferred to AB#5526.

Deviations from concept §6.2 (contrast-driven): light `--theme-text-accent` /
`--theme-accent` `#2c7d6d` (concept `#2e8473`, 4.16:1 on the light canvas →
4.55:1), light `--theme-accent-hover` `#24685a` (concept `#266f61`),
`--theme-text-muted` dark `#77869c` (concept `#687890`) and light `#657189`
(concept `#75829a`), both ≥ 4.5:1 on `--theme-bg-input`. The Kendo bridge points `--kendo-color-primary`,
`--kendo-color-surface(-alt)`, `--kendo-color-border`, `--kendo-color-base*`,
`--kendo-border-radius-*` and `--kendo-font-family` at these tokens.

Fonts are not bundled: the host loads Montserrat, Roboto and Roboto Mono
(the Refinery Studio does so via Google Fonts in `index.html`).

## Secondary Entry Points

Heavy admin editors live in their own entry points so apps that do not use them keep the
primary bundle small. Each one imports only the public API of `@meshmakers/octo-ui`.

| Entry point | Contents |
|-------------|----------|
| `@meshmakers/octo-ui/branding` | Branding services, `provideOctoBranding`, theme switcher |
| `@meshmakers/octo-ui/branding-settings` | Branding settings page (`BRANDING_ROUTES`) |
| `@meshmakers/octo-ui/tree-navigation-settings` | Editor for `System.UI/TreeNavigationConfiguration` |
| `@meshmakers/octo-ui/entity-forms` | Form-driven entity list / create / edit pages (`<mm-entity-page>`, `<mm-entity-list>`, `<mm-entity-form>`, `entityFormRoutes()`), driven by `System.UI/EntityForm` — see [`entity-forms/README.md`](./entity-forms/README.md) |

## Build

```bash
# From frontend-libraries directory
npm run build:octo-ui
```

## Test

```bash
npm run test:octo-ui
```

## Lint

```bash
npm run lint:octo-ui
```
