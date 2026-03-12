# octo-meshboard Library Guidelines

## Overview

The `@meshmakers/octo-meshboard` library provides a configurable dashboard (MeshBoard) system for OctoMesh applications. It includes widget components, state management, grid layout, variable system, and persistence services. The library requires the `System.UI` Construction Kit model (>= 1.0.1) to be installed in the tenant.

## Build Commands

```bash
# From frontend-libraries directory
npm run build:octo-meshboard

# Run tests
npm test -- --project=@meshmakers/octo-meshboard --watch=false

# Run lint
npm run lint:octo-meshboard
```

## Documentation and Testing Standards

- **All developer documentation must be written in English**
- **Every code change must include updated documentation** — update README.md, CLAUDE.md, or inline docs when adding, modifying, or removing features
- **Unit tests and integration tests must be executed** after every code change
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features, components, or services are implemented
- Never commit code with failing tests

## Project Structure

```
src/lib/
├── components/               # Shared components (VariablesEditor, EntitySelectorEditor, EntitySelectorToolbar)
├── containers/               # Main container components
│   └── meshboard-view/       # MeshBoard view component
├── dialogs/                  # Dialog components
│   ├── add-widget-dialog/    # Add widget selection
│   ├── edit-widget-dialog/   # Edit widget properties
│   ├── meshboard-manager-dialog/   # MeshBoard selection/management
│   └── meshboard-settings-dialog/  # MeshBoard settings
├── graphQL/                  # GraphQL queries and mutations
├── models/                   # TypeScript interfaces
├── services/                 # Angular services
├── utils/                    # Pure utility functions
└── widgets/                  # Widget components
    ├── bar-chart-widget/
    ├── entity-associations-widget/
    ├── entity-card-widget/
    ├── gauge-widget/
    ├── kpi-widget/
    ├── markdown-widget/      # Static markdown content display
    ├── pie-chart-widget/
    ├── process-widget/       # Process designer (see parent CLAUDE.md)
    ├── service-health-widget/
    ├── status-indicator-widget/
    └── table-widget/
```

---

## Core Services

### MeshBoardStateService

Central state management service using Angular signals.

```typescript
import { MeshBoardStateService } from '@meshmakers/octo-meshboard';

@Component({...})
export class MyComponent {
  private readonly stateService = inject(MeshBoardStateService);

  // Reactive signals
  readonly config = this.stateService.meshBoardConfig;
  readonly widgets = this.stateService.widgets;
  readonly isLoading = this.stateService.isLoading;
  readonly isModelAvailable = this.stateService.isModelAvailable;

  async ngOnInit() {
    // Load initial MeshBoard from backend
    await this.stateService.loadInitialMeshBoard();
  }
}
```

**Public Signals:**

| Signal | Type | Description |
|--------|------|-------------|
| `meshBoardConfig` | `Signal<MeshBoardConfig>` | Current MeshBoard configuration |
| `widgets` | `Signal<AnyWidgetConfig[]>` | Widget configurations |
| `persistedMeshBoardId` | `Signal<string \| null>` | ID of loaded MeshBoard |
| `availableMeshBoards` | `Signal<PersistedMeshBoard[]>` | Available MeshBoards |
| `isLoading` | `Signal<boolean>` | Loading state |
| `isModelAvailable` | `Signal<boolean \| null>` | System.UI model availability |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `loadInitialMeshBoard()` | `Promise<AnyWidgetConfig[]>` | Load first available MeshBoard |
| `switchToMeshBoard(rtId)` | `Promise<AnyWidgetConfig[]>` | Switch to specific MeshBoard |
| `createNewMeshBoard(name, description?)` | `Promise<string>` | Create new MeshBoard |
| `deleteMeshBoard(rtId)` | `Promise<void>` | Delete MeshBoard |
| `addWidget(widget)` | `void` | Add widget to current MeshBoard |
| `updateWidget(id, changes)` | `void` | Update widget configuration |
| `removeWidget(id)` | `void` | Remove widget |
| `getVariables()` | `MeshBoardVariable[]` | Get all variables |
| `setVariableValue(name, value)` | `void` | Set variable value |
| `getEntitySelectors()` | `EntitySelectorConfig[]` | Get configured entity selectors |
| `getEntitySelector(selectorId)` | `EntitySelectorConfig \| undefined` | Get specific selector |
| `updateEntitySelectorSelection(selectorId, rtId, displayName?)` | `void` | Update selector selection |
| `setEntitySelectorVariables(selectorId, values[])` | `void` | Set variables from entity selection |
| `clearEntitySelectorVariables(selectorId)` | `void` | Clear variables for a selector |

### MeshBoardGridService

Grid layout and collision detection service.

```typescript
import { MeshBoardGridService } from '@meshmakers/octo-meshboard';

@Component({...})
export class MyComponent {
  private readonly gridService = inject(MeshBoardGridService);

  onWidgetDrop(widget: AnyWidgetConfig, targetCol: number, targetRow: number) {
    const wouldOverlap = this.gridService.wouldCauseOverlap(
      this.widgets,
      widget.id,
      targetCol,
      targetRow,
      widget.colSpan,
      widget.rowSpan
    );

    if (!wouldOverlap) {
      // Safe to move
    }
  }
}
```

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `wouldCauseOverlap(widgets, id, col, row, colSpan, rowSpan)` | `boolean` | Check if position causes overlap |
| `findAvailablePosition(widgets, columns, colSpan, rowSpan)` | `{col, row}` | Find next free position |
| `resolveOverlaps(widgets, columns)` | `AnyWidgetConfig[]` | Returns list of moved widgets |
| `getOccupiedCells(widget)` | `GridCell[]` | Get cells occupied by widget |

### MeshBoardVariableService

Variable parsing and resolution service.

```typescript
import { MeshBoardVariableService } from '@meshmakers/octo-meshboard';

const variables: MeshBoardVariable[] = [
  { name: 'customerId', type: 'string', source: 'static', value: 'C-001' }
];

// Resolve variable references in strings
const resolved = service.resolveVariables('Customer: $customerId', variables);
// Result: "Customer: C-001"

// Also supports ${name} syntax
const resolved2 = service.resolveVariables('ID: ${customerId}', variables);
// Result: "ID: C-001"
```

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `resolveVariables(text, variables)` | `string` | Replace variable references |
| `parseVariables(text)` | `string[]` | Extract variable names from text |
| `validateVariableName(name)` | `boolean` | Check if name is valid |
| `convertToFieldFilterDto(filters, variables)` | `FieldFilterDto[]` | Convert filters with variable resolution |
| `mapAttributeTypeToVariableType(attrType)` | `MeshBoardVariableType` | Map CK attribute type to variable type |
| `attributePathToVariableName(path)` | `string` | Convert attribute path to camelCase variable name |

### MeshBoardDataService

Data fetching service for widgets.

```typescript
import { MeshBoardDataService } from '@meshmakers/octo-meshboard';

@Component({...})
export class MyWidget {
  private readonly dataService = inject(MeshBoardDataService);

  async loadData() {
    // Fetch runtime entity
    const entity = await firstValueFrom(
      this.dataService.fetchRuntimeEntity({
        type: 'runtimeEntity',
        ckTypeId: 'OctoSdk/Customer',
        rtId: 'customer-123'
      })
    );

    // Fetch aggregations (e.g., for KPI widgets)
    const aggregations = await this.dataService.fetchAggregations([
      { id: 'totalCount', ckTypeId: 'OctoSdk/Customer', aggregation: 'count' }
    ]);
    const count = aggregations.get('totalCount');
  }
}
```

### WidgetRegistryService

Widget type registration and factory service.

```typescript
import { WidgetRegistryService, WidgetRegistration } from '@meshmakers/octo-meshboard';

// Register a custom widget type
const registration: WidgetRegistration<MyWidgetConfig, MyConfigResult> = {
  type: 'myWidget',
  label: 'My Custom Widget',
  component: MyWidgetComponent,
  configDialogComponent: MyWidgetConfigDialogComponent,
  defaultSize: { colSpan: 2, rowSpan: 2 },
  supportedDataSources: ['runtimeEntity', 'static'],
  createDefaultConfig: (base) => ({ ...base, type: 'myWidget', /* ... */ }),
  toPersistedConfig: (widget) => ({ /* ... */ }),
  fromPersistedConfig: (data, base) => ({ /* ... */ })
};

service.registerWidget(registration);

// Create widget instance
const widget = service.createWidget('myWidget', {
  id: 'w-1',
  title: 'My Widget',
  col: 1, row: 1, colSpan: 2, rowSpan: 2
});
```

---

## Data Source Types

Widgets support multiple data source types:

```typescript
type DataSourceType =
  | 'runtimeEntity'      // Single entity by rtId
  | 'persistentQuery'    // Execute saved query
  | 'aggregation'        // Count/sum/avg queries
  | 'serviceCall'        // Health checks
  | 'constructionKitQuery' // CK data (models, types)
  | 'static';            // Static data for testing
```

### RuntimeEntityDataSource

```typescript
interface RuntimeEntityDataSource {
  type: 'runtimeEntity';
  ckTypeId?: string;      // CK type of entity
  rtId?: string;          // Runtime ID of entity
  attributePaths?: string[];
  includeAssociations?: boolean;
}
```

### PersistentQueryDataSource

```typescript
interface PersistentQueryDataSource {
  type: 'persistentQuery';
  queryRtId: string;      // rtId of the persistent query
  queryName?: string;     // Display name
}
```

### AggregationDataSource

```typescript
interface AggregationDataSource {
  type: 'aggregation';
  queries: AggregationQuery[];
}

interface AggregationQuery {
  id: string;                     // Reference ID
  ckTypeId: string;               // Type to aggregate
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  attribute?: string;             // For sum/avg/min/max
  filters?: WidgetFilterConfig[]; // Optional filters
}
```

---

## Widget Types

### Built-in Widgets

| Type | Description | Data Sources |
|------|-------------|--------------|
| `kpi` | Single numeric value with optional trend | runtimeEntity, persistentQuery, aggregation, static |
| `gauge` | Arc, Circular, Linear, or Radial gauge | runtimeEntity, persistentQuery, aggregation, static |
| `barChart` | Bar/Column chart | persistentQuery, constructionKitQuery |
| `pieChart` | Pie/Donut chart | persistentQuery, constructionKitQuery |
| `table` | Data grid with pagination | persistentQuery |
| `entityCard` | UML-style entity display | runtimeEntity |
| `entityWithAssociations` | Entity with relationships | runtimeEntity |
| `statusIndicator` | Traffic light status | serviceCall, aggregation |
| `serviceHealth` | Backend service health | serviceCall |
| `process` | Process diagram (HMI) | - |
| `markdown` | Static markdown content with themed styling | static |

### Widget Configuration Interface

```typescript
interface BaseWidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  col: number;        // Grid column (1-based)
  row: number;        // Grid row (1-based)
  colSpan: number;    // Width in columns
  rowSpan: number;    // Height in rows
  configurable?: boolean;
  dataSource: DataSource;
}
```

### Markdown Widget

The Markdown Widget displays static markdown content with customizable styling via CSS variables. It supports variable interpolation for dynamic content.

**Configuration Interface:**

```typescript
interface MarkdownWidgetConfig extends BaseWidgetConfig {
  type: 'markdown';
  content: string;           // Markdown content
  resolveVariables?: boolean; // Replace $var with MeshBoard variables
  padding?: string;          // CSS padding (default: '16px')
  textAlign?: 'left' | 'center' | 'right';
}
```

**Features:**
- Full GitHub Flavored Markdown (GFM) support via `ngx-markdown`
- Themed rendering via CSS custom properties (neutral defaults, customizable by host app)
- Variable interpolation using `$variableName` or `${variableName}` syntax
- Configurable padding and text alignment
- Edit/Preview toggle in configuration dialog

**Styling Note:** The markdown prose styles should use CSS custom properties with neutral defaults. Host applications can override these to match their theme. Avoid hardcoding theme-specific colors in the library.

**Required Provider:**
Applications using the Markdown Widget must include `provideMarkdown()` from `ngx-markdown`:

```typescript
// app.config.ts
import { provideMarkdown } from 'ngx-markdown';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... other providers
    provideMarkdown(),
  ]
};
```

**Example Usage:**

```typescript
const markdownWidget: MarkdownWidgetConfig = {
  id: 'markdown-1',
  type: 'markdown',
  title: 'Welcome',
  col: 1, row: 1, colSpan: 2, rowSpan: 2,
  dataSource: { type: 'static' },
  content: `# Welcome to $dashboardName

This dashboard shows data for **$customerName**.

## Features
- Real-time monitoring
- Historical analysis
- Alerts and notifications`,
  resolveVariables: true,
  textAlign: 'left'
};
```

---

## Variable System

MeshBoards support variables for dynamic content:

```typescript
interface MeshBoardVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'datetime';
  source: 'static' | 'timeFilter' | 'entitySelector';
  value: string;
  defaultValue?: string;
  entitySelectorId?: string;     // Which entity selector generated this variable
}
```

**Variable Sources:**
- `static` - User-defined value
- `timeFilter` - Auto-generated from time range picker
- `entitySelector` - Auto-generated from entity selector selections (toolbar or fixed)

**Usage in Widget Configs:**
- `${variableName}` - Bracket syntax (recommended)

**Example:**
```typescript
// Variable
{ name: 'customerId', type: 'string', source: 'static', value: 'C-001' }

// In filter config
{ attributePath: 'customerId', comparisonValue: '$customerId', operator: 'eq' }
```

---

## Entity Selectors

Entity selectors populate MeshBoard variables from a selected entity's attributes. They come in two modes:

- **Toolbar mode** (`showInToolbar: true`, default): Users select an entity from a dropdown in the toolbar
- **Fixed mode** (`showInToolbar: false`): Variables are resolved from a pre-configured default entity (no UI)

This unified mechanism replaces both the old "runtime entity variables" and the toolbar entity selector concepts.

### Configuration

Entity selectors are configured in the MeshBoard Settings Dialog (4th tab "Entity Selectors"):

```typescript
interface EntitySelectorConfig {
  id: string;                  // Stable ID for URL params (e.g., "mp")
  label: string;               // Display label (e.g., "Metering Point")
  ckTypeId: string;            // CK type to select from
  attributeMappings: EntitySelectorAttributeMapping[];
  showInToolbar?: boolean;     // Show in toolbar (default: true). If false, uses defaultRtId
  defaultRtId?: string;       // Pre-selected entity (required when showInToolbar=false)
  selectedRtId?: string;      // Current selection (transient, not persisted)
  selectedDisplayName?: string; // Current display name (transient)
}

interface EntitySelectorAttributeMapping {
  attributePath: string;       // Attribute path on the entity
  variableName: string;        // Variable name to populate (e.g., "meteringPointName")
  attributeValueType?: string; // Attribute value type
}
```

### URL Parameters

Entity selector selections are synced to URL query parameters for bookmarkability and sharing:

```
?es_<selectorId>=<rtId>
```

Example: `?es_mp=rt-123&es_anlage=rt-456`

### External Embedding via Route Data

When embedding a MeshBoard in another application, entity selectors can be pre-populated via route data:

```typescript
{
  path: 'dashboard/:id',
  component: MeshBoardViewComponent,
  data: {
    entitySelectors: {
      mp: 'rt-123',        // selectorId: rtId
      anlage: 'rt-456'
    }
  }
}
```

**Priority order:** route data > URL params > defaultRtId > selectedRtId

### State Service Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getEntitySelectors()` | `EntitySelectorConfig[]` | Get all configured entity selectors |
| `getEntitySelector(selectorId)` | `EntitySelectorConfig \| undefined` | Get specific selector by ID |
| `updateEntitySelectors(selectors)` | `void` | Bulk update selector configs |
| `updateEntitySelectorSelection(selectorId, rtId, displayName?)` | `void` | Update one selector's selection |
| `setEntitySelectorVariables(selectorId, values[])` | `void` | Create/replace variables for a selector |
| `clearEntitySelectorVariables(selectorId)` | `void` | Remove variables for a selector |

### Components

| Component | Selector | Description |
|-----------|----------|-------------|
| `EntitySelectorEditorComponent` | `mm-entity-selector-editor` | Settings editor for managing selectors |
| `EntitySelectorToolbarComponent` | `mm-entity-selector-toolbar` | Toolbar rendering entity select dropdowns |

### Persistence

Entity selector configs are persisted in the MeshBoard description field alongside variables and time filter config. Transient fields (`selectedRtId`, `selectedDisplayName`) are stripped before persisting. Variables with `source: 'entitySelector'` are derived at runtime and not persisted.

---

## Utility Functions

Pure functions for data transformation (in `utils/widget-data-utils.ts`):

```typescript
import {
  sanitizeFieldName,
  parseNumericValue,
  extractAggregationValue,
  extractGroupedAggregationValue,
  processStaticSeriesData,
  processDynamicSeriesData,
  processPieChartData
} from '@meshmakers/octo-meshboard';

// Sanitize GraphQL attribute paths (dots -> underscores)
sanitizeFieldName('entity.attribute'); // 'entity_attribute'

// Parse numeric values safely
parseNumericValue('42.5'); // 42.5
parseNumericValue(null);   // 0

// Extract values from query results
const value = extractAggregationValue(queryResult, 'sum_revenue');
const groupedValue = extractGroupedAggregationValue(queryResult, 'category', 'A', 'value');

// Process chart data
const barData = processStaticSeriesData(rows, 'month', [
  { field: 'revenue', name: 'Revenue' },
  { field: 'cost', name: 'Cost' }
]);

const pieData = processPieChartData(rows, 'category', 'value');
```

---

## Testing

### Test Structure

Tests use Jasmine with Angular TestBed. Mock services appropriately:

```typescript
import { TestBed } from '@angular/core/testing';

describe('MeshBoardStateService', () => {
  let service: MeshBoardStateService;
  let persistenceServiceSpy: jasmine.SpyObj<MeshBoardPersistenceService>;

  beforeEach(() => {
    persistenceServiceSpy = jasmine.createSpyObj('MeshBoardPersistenceService', [
      'getMeshBoards', 'getMeshBoardWithWidgets', 'createMeshBoard'
    ]);

    TestBed.configureTestingModule({
      providers: [
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: persistenceServiceSpy },
        { provide: CkModelService, useValue: jasmine.createSpyObj('CkModelService', ['isModelAvailableWithMinVersion']) }
      ]
    });

    service = TestBed.inject(MeshBoardStateService);
  });
});
```

### Running Tests

```bash
# Run all octo-meshboard tests
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  npm test -- --project=@meshmakers/octo-meshboard --watch=false

# Run with coverage
npm test -- --project=@meshmakers/octo-meshboard --watch=false --code-coverage

# CI mode
ng test @meshmakers/octo-meshboard --no-watch --browsers=ChromeHeadless
```

### Test Coverage

Current test files:
- `meshboard-grid.service.spec.ts` - Grid collision detection (39 tests)
- `meshboard-variable.service.spec.ts` - Variable resolution (67 tests)
- `meshboard-state.service.spec.ts` - State management (71 tests, includes entity selector management)
- `meshboard-data.service.spec.ts` - Data fetching (32 tests)
- `widget-registry.service.spec.ts` - Widget registration (45 tests)
- `widget-data-utils.spec.ts` - Utility functions (61 tests)

---

## GraphQL Queries

Located in `src/lib/graphQL/`:

| File | Description |
|------|-------------|
| `getDashboards.ts` | List MeshBoards |
| `getDashboardWithWidgets.ts` | MeshBoard with widget details |
| `createDashboard.ts` | Create MeshBoard |
| `updateDashboard.ts` | Update MeshBoard |
| `createDashboardWidget.ts` | Create widget |
| `updateDashboardWidget.ts` | Update widget |
| `deleteEntities.ts` | Delete entities |
| `executeRuntimeQuery.ts` | Execute persistent query |
| `getSystemPersistentQueries.ts` | List available queries |
| `getDashboardEntity.ts` | Fetch single entity |
| `getEntitiesByCkType.ts` | Fetch entities by type |
| `getCkModelsWithState.ts` | CK models with state |

---

## Dependencies

- `@angular/core` - Angular framework
- `@progress/kendo-angular-grid` - Kendo Grid
- `@progress/kendo-angular-charts` - Kendo Charts
- `@progress/kendo-angular-gauges` - Kendo Gauges
- `@progress/kendo-angular-dialog` - Kendo Dialog
- `@progress/kendo-angular-buttons` - Kendo Buttons
- `@progress/kendo-angular-inputs` - Kendo Inputs
- `apollo-angular` - GraphQL client
- `@meshmakers/octo-services` - Backend services, DTOs
- `@meshmakers/octo-ui` - UI components, CK type selector
- `@meshmakers/shared-ui` - Shared UI utilities

---

## Process Designer

The Process Designer widget is documented in the parent `frontend-libraries/CLAUDE.md` file. See sections:
- Process Designer Overview
- Key Components and Services
- SVG Import
- Primitive Types
- Grouping
