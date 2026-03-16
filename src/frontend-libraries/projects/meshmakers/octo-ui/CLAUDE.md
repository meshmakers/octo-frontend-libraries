# octo-ui Library Guidelines

## Overview

The `@meshmakers/octo-ui` library provides reusable Angular UI components for OctoMesh applications. It includes data source abstractions for GraphQL-based list views, property grids, selector dialogs, and filter editors. All components are designed to be theme-independent and work with any Kendo UI theme.

## Build Commands

```bash
# From frontend-libraries directory
npm run build:octo-ui

# Run tests
npm test -- --project=@meshmakers/octo-ui --watch=false

# Run lint
npm run lint:octo-ui
```

## Project Structure

```
src/lib/
├── attribute-selector-dialog/    # Attribute selection dialog
├── attribute-sort-selector-dialog/  # Attribute selection with sort order
├── ck-type-selector-dialog/      # CK type selection dialog
├── ck-type-selector-input/       # CK type autocomplete input
├── data-sources/                 # GraphQL data source abstractions
├── entity-id-info/               # Entity ID display with copy dropdown
├── field-filter-editor/          # Filter editor component
├── octo-loader/                  # Animated loading indicator
└── property-grid/                # Property grid component
    ├── components/               # Grid and value display components
    ├── models/                   # TypeScript interfaces and enums
    └── services/                 # Property converter service
```

## Runtime Browser Localization

`RuntimeBrowserComponent` does not load translations internally. Host applications must supply
`RuntimeBrowserMessages` via the `messages` input. Use
`DEFAULT_RUNTIME_BROWSER_MESSAGES` for English defaults or build translated values using the
app's translation system.

## Documentation and Testing Standards

- **All developer documentation must be written in English**
- **Every code change must include updated documentation** — update README.md, CLAUDE.md, or inline docs when adding, modifying, or removing features
- **Unit tests and integration tests must be executed** after every code change
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features, components, or services are implemented
- Never commit code with failing tests

---

## Data Sources

### OctoGraphQlDataSource

Abstract base class for GraphQL-based data sources used with `mm-list-view` components.

```typescript
import { OctoGraphQlDataSource } from '@meshmakers/octo-ui';

@Directive({
  selector: "[appCustomerDataSource]",
  exportAs: 'appCustomerDataSource',
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => CustomerDataSourceDirective) }]
})
export class CustomerDataSourceDirective extends OctoGraphQlDataSource<CustomerDto> {
  private readonly getCustomersGQL = inject(GetCustomersDtoGQL);

  constructor() {
    super(inject(ListViewComponent));
    this.searchFilterAttributePaths = ['name', 'email'];  // Fields for text search
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
      fetchPolicy: "network-only"
    }).pipe(map(result => new FetchResultTyped<CustomerDto>(
      result.data?.runtime?.customers?.items ?? [],
      result.data?.runtime?.customers?.totalCount ?? 0
    )));
  }
}
```

**Protected Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `getFieldFilterDefinitions(state)` | `FieldFilterDto[] \| null` | Converts Kendo filter state to GraphQL field filters |
| `getSearchFilterDefinitions(textSearch)` | `SearchFilterDto \| null` | Creates search filter for text search |
| `getSortDefinitions(state)` | `SortDto[] \| null` | Converts Kendo sort state to GraphQL sort definitions |

**Supported Filter Operators:**

| Kendo Operator | GraphQL Operator |
|----------------|------------------|
| `eq` | `EqualsDto` |
| `neq` | `NotEqualsDto` |
| `lt` | `LessThanDto` |
| `lte` | `LessEqualThanDto` |
| `gt` | `GreaterThanDto` |
| `gte` | `GreaterEqualThanDto` |
| `contains` | `LikeDto` |
| `startswith` | `MatchRegExDto` |
| `endswith` | `MatchRegExDto` |
| `isnull` | `EqualsDto` (value: null) |
| `isnotnull` | `NotEqualsDto` (value: null) |

### OctoGraphQlHierarchyDataSource

Abstract base class for hierarchical/tree data sources.

```typescript
import { OctoGraphQlHierarchyDataSource } from '@meshmakers/octo-ui';

export class FolderDataSource extends OctoGraphQlHierarchyDataSource<FolderDto> {
  async fetchRootNodes(): Promise<TreeItemDataTyped<FolderDto>[]> {
    // Fetch root folders
  }

  async fetchChildren(item: TreeItemDataTyped<FolderDto>): Promise<TreeItemDataTyped<FolderDto>[]> {
    // Fetch child folders
  }
}
```

---

## Property Grid

### PropertyGridComponent

Displays and edits entity properties in a two-column grid format.

```typescript
import { PropertyGridComponent, PropertyGridItem, AttributeValueTypeDto } from '@meshmakers/octo-ui';

@Component({
  template: `
    <mm-property-grid
      [properties]="properties"
      [readOnlyMode]="false"
      [height]="400"
      (propertyChange)="onPropertyChange($event)"
      (binaryDownload)="onBinaryDownload($event)">
    </mm-property-grid>
  `
})
export class MyComponent {
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
}
```

**Inputs:**

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `properties` | `PropertyGridItem[]` | `[]` | Properties to display |
| `readOnlyMode` | `boolean` | `false` | Disable editing |
| `height` | `number` | `400` | Grid height in pixels |
| `showTypeIcons` | `boolean` | `true` | Show type icons |

**Outputs:**

| Output | Type | Description |
|--------|------|-------------|
| `propertyChange` | `PropertyChangeEvent` | Emitted when a property value changes |
| `binaryDownload` | `BinaryDownloadEvent` | Emitted when binary download is requested |

### PropertyConverterService

Converts OctoMesh entities to PropertyGridItem arrays.

```typescript
import { PropertyConverterService } from '@meshmakers/octo-ui';

@Component({...})
export class EntityDetailComponent {
  private readonly converter = inject(PropertyConverterService);

  loadEntity(entity: RtEntityDto) {
    // Convert entity attributes to property grid items
    const properties = this.converter.convertRtEntityAttributes(entity);

    // Or convert any object
    const objectProperties = this.converter.convertObjectToProperties(
      myObject,
      'Custom Category'
    );
  }
}
```

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `convertRtEntityAttributes(entity)` | `PropertyGridItem[]` | Convert RtEntity attributes |
| `convertObjectToProperties(obj, category?)` | `PropertyGridItem[]` | Convert plain object |
| `mapCkAttributeTypeToDto(ckType)` | `AttributeValueTypeDto` | Map CK type string to enum |

### AttributeValueTypeDto

Enum for property value types:

```typescript
enum AttributeValueTypeDto {
  BinaryDto = 'BINARY',
  BinaryLinkedDto = 'BINARY_LINKED',
  BooleanDto = 'BOOLEAN',
  DateTimeDto = 'DATE_TIME',
  DateTimeOffsetDto = 'DATE_TIME_OFFSET',
  DoubleDto = 'DOUBLE',
  EnumDto = 'ENUM',
  IntegerDto = 'INTEGER',
  Integer_64Dto = 'INTEGER_64',
  IntegerArrayDto = 'INTEGER_ARRAY',
  RecordDto = 'RECORD',
  RecordArrayDto = 'RECORD_ARRAY',
  StringDto = 'STRING',
  StringArrayDto = 'STRING_ARRAY',
  TimeSpanDto = 'TIME_SPAN',
  GeospatialPointDto = 'GEOSPATIAL_POINT'
}
```

---

## Selector Dialogs

### AttributeSelectorDialogService

Opens a dialog for selecting entity attributes (columns for queries).

```typescript
import { AttributeSelectorDialogService } from '@meshmakers/octo-ui';

@Component({...})
export class QueryBuilderComponent {
  private readonly dialogService = inject(AttributeSelectorDialogService);

  async selectColumns() {
    const result = await this.dialogService.openAttributeSelector({
      ckTypeId: 'OctoSdkDemo/Customer',
      selectedAttributes: this.currentColumns,
      dialogTitle: 'Select Columns'
    });

    if (result.confirmed) {
      this.columns = result.selectedAttributes;
    }
  }
}
```

**Options:**

| Property | Type | Description |
|----------|------|-------------|
| `ckTypeId` | `string` | CK type to get attributes for |
| `selectedAttributes` | `AttributeItem[]` | Pre-selected attributes |
| `dialogTitle` | `string` | Custom dialog title |

### AttributeSortSelectorDialogService

Opens a dialog for selecting attributes with sort order configuration.

```typescript
import { AttributeSortSelectorDialogService, AttributeSortItem } from '@meshmakers/octo-ui';

@Component({...})
export class QueryBuilderComponent {
  private readonly dialogService = inject(AttributeSortSelectorDialogService);

  async configureSorting() {
    const result = await this.dialogService.openAttributeSortSelector({
      ckTypeId: 'OctoSdkDemo/Customer',
      selectedAttributes: this.sortConfig,
      dialogTitle: 'Configure Sort Order'
    });

    if (result.confirmed) {
      // result.selectedAttributes contains AttributeSortItem[]
      // Each item has: attributePath, attributeValueType, sortOrder
      this.sortConfig = result.selectedAttributes;
    }
  }
}
```

**AttributeSortItem:**

```typescript
interface AttributeSortItem {
  attributePath: string;
  attributeValueType: string;
  sortOrder: 'standard' | 'ascending' | 'descending';
}
```

### CkTypeSelectorDialogService

Opens a dialog for selecting a Construction Kit type.

```typescript
import { CkTypeSelectorDialogService } from '@meshmakers/octo-ui';

@Component({...})
export class TypeSelectorComponent {
  private readonly dialogService = inject(CkTypeSelectorDialogService);

  async selectType() {
    const result = await this.dialogService.openCkTypeSelector({
      selectedCkTypeId: this.currentTypeId,
      ckModelIds: ['OctoSdkDemo'],  // Optional: filter by models
      allowAbstract: false,         // Allow abstract types?
      dialogTitle: 'Select Entity Type'
    });

    if (result.confirmed && result.selectedCkType) {
      // Use result.selectedCkType.rtCkTypeId for runtime queries
      this.selectedType = result.selectedCkType;
    }
  }
}
```

### CkTypeSelectorInputComponent

Autocomplete input for CK type selection with dialog support.

```typescript
import { CkTypeSelectorInputComponent } from '@meshmakers/octo-ui';

@Component({
  template: `
    <mm-ck-type-selector-input
      [(ngModel)]="selectedCkType"
      [ckModelIds]="['OctoSdkDemo']"
      [allowAbstract]="false"
      [placeholder]="'Select type...'"
      [minSearchLength]="2"
      (ckTypeSelected)="onTypeSelected($event)"
      (ckTypeCleared)="onTypeCleared()">
    </mm-ck-type-selector-input>
  `
})
export class MyComponent {
  selectedCkType: CkTypeSelectorItem | null = null;
}
```

**Features:**
- Implements `ControlValueAccessor` for reactive forms
- Implements `Validator` with required validation
- Autocomplete with debounced search
- Advanced search dialog button
- Auto-select on blur when single result

**Inputs:**

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `placeholder` | `string` | `'Select a CK type...'` | Placeholder text |
| `minSearchLength` | `number` | `2` | Min chars before search |
| `maxResults` | `number` | `50` | Max autocomplete results |
| `debounceMs` | `number` | `300` | Search debounce delay |
| `ckModelIds` | `string[]` | `undefined` | Filter by models |
| `allowAbstract` | `boolean` | `true` | Allow abstract types |
| `dialogTitle` | `string` | `'Select Construction Kit Type'` | Dialog title |
| `disabled` | `boolean` | `false` | Disable input |
| `required` | `boolean` | `false` | Required validation |

---

## Field Filter Editor

### FieldFilterEditorComponent

Visual editor for query field filters.

```typescript
import { FieldFilterEditorComponent } from '@meshmakers/octo-ui';

@Component({
  template: `
    <mm-field-filter-editor
      [filters]="filters"
      [availableFields]="availableFields"
      (filtersChange)="onFiltersChange($event)">
    </mm-field-filter-editor>
  `
})
export class QueryEditorComponent {
  filters: FieldFilterDto[] = [];
  availableFields: AttributeItem[] = [];
}
```

---

## Component Styling Guidelines

### Theme-Independent Components

All components in this library MUST be theme-independent. This ensures they work correctly with any Kendo UI theme (light, dark, custom).

### Rules for Styling

1. **NO hardcoded colors** - Never use hardcoded color values like `#64ceb9`, `#9292a6`, `rgba(100, 206, 185, 0.2)`, etc.

2. **Use Kendo CSS Variables** - Always use Kendo theme variables for colors:
   ```css
   /* Good */
   color: var(--kendo-color-primary);
   background-color: var(--kendo-color-surface);
   border-color: var(--kendo-color-border);

   /* Bad */
   color: #64ceb9;
   background-color: #1f2e40;
   border-color: #d5d5d5;
   ```

3. **Common Kendo CSS Variables**:
   - `--kendo-color-primary` - Primary theme color
   - `--kendo-color-secondary` - Secondary theme color
   - `--kendo-color-success` - Success/green color
   - `--kendo-color-warning` - Warning/yellow color
   - `--kendo-color-error` - Error/red color
   - `--kendo-color-info` - Info/blue color
   - `--kendo-color-border` - Border color
   - `--kendo-color-surface` - Surface background
   - `--kendo-color-surface-alt` - Alternative surface
   - `--kendo-color-on-primary` - Text on primary background
   - `--kendo-color-on-success` - Text on success background
   - `--kendo-color-subtle` - Subtle/muted text color

4. **Fallback values** - When using CSS variables, provide a neutral fallback:
   ```css
   color: var(--kendo-color-primary, #ff6358);
   ```

5. **No theme-specific overrides** - Do not override Kendo component styles with `::ng-deep` for colors. Let the theme handle it.

6. **Layout-only styles are OK** - Styles for layout (flexbox, grid, padding, margins, sizing) are fine:
   ```css
   /* These are OK */
   display: flex;
   gap: 16px;
   padding: 12px 20px;
   min-width: 800px;
   border-radius: 4px;
   ```

7. **Use opacity for subtle effects** instead of hardcoded colors:
   ```css
   /* Good */
   opacity: 0.7;

   /* Bad */
   color: #666;
   ```

### Dialog Components

Dialog components should:
- Extend `DialogContentBase` from Kendo
- Not override `kendo-dialog-actions` styles
- Let the Kendo theme handle all color-related styling
- Only define layout and structural styles

### Example Component Style

```typescript
styles: [`
  :host {
    display: block;
  }

  .container {
    display: flex;
    flex-direction: column;
    padding: 16px 20px;
    gap: 16px;
  }

  .header {
    font-size: 0.85rem;
    font-weight: 600;
  }

  .highlight {
    color: var(--kendo-color-primary);
    font-weight: bold;
  }

  .separator {
    height: 1px;
    background-color: var(--kendo-color-border, #dee2e6);
  }

  .grid ::ng-deep .k-grid-table tbody tr {
    cursor: pointer;
  }
`]
```

### Kendo SVG Icons

Use Kendo SVG icons instead of custom icons:
```typescript
import { searchIcon, arrowRightIcon, chevronDoubleRightIcon } from '@progress/kendo-svg-icons';
```

Available icon patterns:
- Single arrows: `arrowLeftIcon`, `arrowRightIcon`, `arrowUpIcon`, `arrowDownIcon`
- Double arrows: `chevronDoubleLeftIcon`, `chevronDoubleRightIcon`
- Sort: `sortAscSmallIcon`, `sortDescSmallIcon`
- Actions: `searchIcon`, `filterClearIcon`, `plusIcon`, `minusIcon`, `downloadIcon`
- Files: `fileIcon`, `folderIcon`
- Date/Time: `calendarIcon`, `clockIcon`

---

## Testing

### Test Structure

Tests use Jasmine with Angular TestBed. For Kendo Grid components, include `@angular/localize/init`:

```typescript
import '@angular/localize/init';  // Required for Kendo Grid i18n
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

describe('MyComponent', () => {
  let component: MyComponent;
  let fixture: ComponentFixture<MyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent, ...KendoModules],
      providers: [
        { provide: MyService, useValue: jasmine.createSpyObj('MyService', ['method']) }
      ],
      animationsEnabled: false  // Use TestBed option instead of NoopAnimationsModule
    }).compileComponents();
  });
});
```

### Dialog Service Test Pattern

```typescript
describe('CkTypeSelectorDialogService', () => {
  let service: CkTypeSelectorDialogService;
  let dialogServiceMock: jasmine.SpyObj<DialogService>;
  let dialogClosedSubject: Subject<CkTypeSelectorDialogResult | undefined>;

  beforeEach(() => {
    dialogClosedSubject = new Subject();
    dialogServiceMock = jasmine.createSpyObj('DialogService', ['open']);
    dialogServiceMock.open.and.returnValue({
      content: { instance: { data: null } },
      result: dialogClosedSubject.asObservable()
    } as any);

    // ... setup TestBed
  });

  it('should return confirmed result', async () => {
    const promise = service.openCkTypeSelector({ ... });
    dialogClosedSubject.next({ selectedCkType: mockType });
    const result = await promise;
    expect(result.confirmed).toBeTrue();
  });
});
```

### Running Tests

```bash
# Run all octo-ui tests
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  npm test -- --project=@meshmakers/octo-ui --watch=false

# Run with coverage
npm test -- --project=@meshmakers/octo-ui --watch=false --code-coverage

# CI mode
ng test @meshmakers/octo-ui --no-watch --browsers=ChromeHeadless
```

---

## Dependencies

- `@angular/core` - Angular framework
- `@angular/forms` - Reactive forms, ControlValueAccessor
- `@progress/kendo-angular-grid` - Kendo Grid component
- `@progress/kendo-angular-dialog` - Kendo Dialog component
- `@progress/kendo-angular-dropdowns` - Kendo Dropdown/Autocomplete
- `@progress/kendo-angular-buttons` - Kendo Buttons
- `@progress/kendo-angular-inputs` - Kendo Input components
- `@progress/kendo-angular-icons` - Kendo Icons
- `@progress/kendo-svg-icons` - Kendo SVG icon library
- `@meshmakers/octo-services` - Backend services, DTOs
- `@meshmakers/shared-ui` - Shared UI components (ListViewComponent, DataSourceBase)
