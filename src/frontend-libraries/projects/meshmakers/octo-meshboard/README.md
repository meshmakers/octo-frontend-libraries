# OctoMesh MeshBoard Library

A flexible, widget-based dashboard library for Angular applications in the OctoMesh platform.

## Overview

MeshBoard provides a grid-based dashboard system with configurable widgets that can display data from various sources including runtime entities, persistent queries, and aggregations.

## Installation

```bash
npm install @meshmakers/octo-meshboard
```

## Quick Start

### Basic Integration

Add the MeshBoard route to your application:

```typescript
import { Routes } from '@angular/router';
import { UnsavedChangesGuard } from '@meshmakers/shared-ui';

export const routes: Routes = [
  {
    path: "dashboard",
    loadComponent: () =>
      import('@meshmakers/octo-meshboard').then(m => m.MeshBoardViewComponent),
    canDeactivate: [UnsavedChangesGuard]
  }
];
```

### Load Specific MeshBoard by rtId

```typescript
{
  path: "dashboard/:rtId",
  loadComponent: () =>
    import('@meshmakers/octo-meshboard').then(m => m.MeshBoardViewComponent),
  canDeactivate: [UnsavedChangesGuard]
}
```

### Load MeshBoard by Well-Known Name

Use `meshBoardWellKnownName` in route data to load a specific MeshBoard:

```typescript
{
  path: "cockpit",
  loadComponent: () =>
    import('@meshmakers/octo-meshboard').then(m => m.MeshBoardViewComponent),
  canDeactivate: [UnsavedChangesGuard],
  data: {
    meshBoardWellKnownName: 'cockpit',
    breadcrumb: [{ label: "Cockpit", url: "cockpit" }]
  }
}
```

**Note:** If the MeshBoard with the specified `rtWellKnownName` does not exist, an error message will be displayed with instructions on how to create it.

### Setting the Well-Known Name

To set a Well-Known Name for a MeshBoard:

1. Open the MeshBoard Settings dialog
2. Enter a unique identifier in the "Well-Known Name" field (e.g., `cockpit`, `sales-dashboard`)
3. Save the MeshBoard

The Well-Known Name should be lowercase with hyphens, similar to URL slugs.

## Architecture

```
octo-meshboard/
├── containers/
│   └── meshboard-view/          # Main view component
├── widgets/                      # Widget implementations
│   ├── bar-chart-widget/
│   ├── entity-card-widget/
│   ├── gauge-widget/
│   ├── kpi-widget/
│   ├── pie-chart-widget/
│   ├── service-health-widget/
│   ├── stats-grid-widget/
│   ├── status-indicator-widget/
│   └── table-widget/
├── services/
│   ├── meshboard-state.service.ts      # State management
│   ├── meshboard-data.service.ts       # Data fetching
│   ├── meshboard-persistence.service.ts # Backend persistence
│   ├── meshboard-variable.service.ts   # Variable resolution
│   ├── widget-factory.service.ts       # Widget creation
│   └── widget-registry.service.ts      # Widget registration
├── dialogs/                      # Configuration dialogs
├── models/                       # TypeScript interfaces
└── graphQL/                      # GraphQL queries/mutations
```

## Widget Types

### KPI Widget
Displays a single value with optional label, prefix, suffix, and trend indicator.

```typescript
interface KpiWidgetConfig {
  type: 'kpi';
  valueAttribute: string;
  labelAttribute?: string;
  prefix?: string;
  suffix?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  // For persistent query mode
  queryMode?: 'simpleCount' | 'aggregation' | 'groupedAggregation';
  queryValueField?: string;
  filters?: WidgetFilterConfig[];
}
```

### Gauge Widget
Displays a numeric value as arc, circular, linear, or radial gauge.

```typescript
interface GaugeWidgetConfig {
  type: 'gauge';
  gaugeType: 'arc' | 'circular' | 'linear' | 'radial';
  valueAttribute: string;
  min?: number;
  max?: number;
  ranges?: GaugeRange[];
  showLabel?: boolean;
  prefix?: string;
  suffix?: string;
}
```

### Table Widget
Displays data in a configurable table with sorting and filtering.

```typescript
interface TableWidgetConfig {
  type: 'table';
  columns: TableColumn[];
  sorting?: TableSortConfig[];
  filters?: WidgetFilterConfig[];
  pageSize?: number;
  sortable?: boolean;
}
```

### Pie Chart Widget
Displays data as pie or donut chart.

```typescript
interface PieChartWidgetConfig {
  type: 'pieChart';
  chartType: 'pie' | 'donut';
  categoryField: string;
  valueField: string;
  showLabels?: boolean;
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  filters?: WidgetFilterConfig[];
}
```

### Bar Chart Widget
Displays data as column, bar, or stacked charts.

```typescript
interface BarChartWidgetConfig {
  type: 'barChart';
  chartType: 'column' | 'bar' | 'stackedColumn' | 'stackedBar' | 'stackedColumn100' | 'stackedBar100';
  categoryField: string;
  series: BarChartSeries[];
  // Dynamic series mode
  seriesGroupField?: string;
  valueField?: string;
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  filters?: WidgetFilterConfig[];
}
```

### Stats Grid Widget
Displays multiple KPIs in a grid layout.

```typescript
interface StatsGridWidgetConfig {
  type: 'statsGrid';
  stats: StatItem[];
  columns?: number;
}
```

### Service Health Widget
Displays service health status with pulse animation.

```typescript
interface ServiceHealthWidgetConfig {
  type: 'serviceHealth';
  navigateOnClick?: boolean;
  detailRoute?: string;
  showPulse?: boolean;
}
```

### Status Indicator Widget
Displays boolean status (e.g., ENABLED/DISABLED).

```typescript
interface StatusIndicatorWidgetConfig {
  type: 'statusIndicator';
  trueLabel?: string;
  falseLabel?: string;
  trueColor?: string;
  falseColor?: string;
}
```

## Data Sources

### Runtime Entity Data Source
Fetches a single entity by CK type or rtId.

```typescript
interface RuntimeEntityDataSource {
  type: 'runtimeEntity';
  ckTypeId?: string;
  rtId?: string;
  attributePaths?: string[];
  includeAssociations?: boolean;
}
```

### Persistent Query Data Source
Executes a saved query by its rtId.

```typescript
interface PersistentQueryDataSource {
  type: 'persistentQuery';
  queryRtId: string;
  queryName?: string;
}
```

### Aggregation Data Source
Performs aggregation queries (count, sum, avg, min, max).

```typescript
interface AggregationDataSource {
  type: 'aggregation';
  queries: AggregationQuery[];
}

interface AggregationQuery {
  id: string;
  ckTypeId: string;
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  attribute?: string;
  filters?: WidgetFilterConfig[];
}
```

### Construction Kit Query Data Source
Queries Construction Kit metadata (models, types, attributes).

```typescript
interface ConstructionKitQueryDataSource {
  type: 'constructionKitQuery';
  queryTarget: 'models' | 'types' | 'attributes' | 'associationRoles' | 'enums' | 'records';
  groupBy?: string;
  valueField?: string;
  categoryField?: string;
}
```

### Service Call Data Source
Calls services for status/health information.

```typescript
interface ServiceCallDataSource {
  type: 'serviceCall';
  callType: 'modelAvailable' | 'healthCheck';
  modelName?: string;
  serviceType?: 'identity' | 'asset-repository' | 'bot' | 'communication-controller' | 'mesh-adapter' | 'custom';
  customEndpoint?: string;
}
```

## Variables

MeshBoard supports variables that can be used in filter values. Variables use the syntax `${variableName}` or `$variableName`.

### Defining Variables

Variables are defined at the MeshBoard level:

```typescript
interface MeshBoardVariable {
  name: string;           // Variable name (without $)
  label?: string;         // Display label
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime';
  source: 'static' | 'timeFilter';
  value: string;
  defaultValue?: string;
}
```

### Using Variables in Filters

```typescript
const filter: WidgetFilterConfig = {
  attributePath: 'createdDate',
  operator: 'gte',
  comparisonValue: '${timeRangeFrom}'
};
```

### Time Filter Variables

When the time filter is enabled, two variables are automatically available:
- `${timeRangeFrom}` - Start of selected time range (ISO string)
- `${timeRangeTo}` - End of selected time range (ISO string)

## Time Filter

Enable a global time filter for the MeshBoard:

```typescript
interface MeshBoardTimeFilterConfig {
  enabled: boolean;
  pickerConfig?: {
    availableTypes?: ('year' | 'quarter' | 'month' | 'relative' | 'custom')[];
    minYear?: number;
    maxYear?: number;
    defaultRelativeValue?: number;
    defaultRelativeUnit?: 'hours' | 'days' | 'weeks' | 'months';
    showTime?: boolean;
  };
  selection?: TimeRangeSelection;
}
```

## Services

### MeshBoardStateService

Central state management for MeshBoard.

```typescript
// Load initial MeshBoard
await stateService.loadInitialMeshBoard();

// Switch to specific MeshBoard
await stateService.switchToMeshBoard(rtId);

// Switch by well-known name
await stateService.switchToMeshBoardByWellKnownName('cockpit');

// Save current MeshBoard
await stateService.saveMeshBoard();

// Access state
const config = stateService.meshBoardConfig();
const isLoading = stateService.isLoading();
const availableBoards = stateService.availableMeshBoards();
```

### MeshBoardVariableService

Resolves variables in filter values.

```typescript
// Resolve variables in a string
const resolved = variableService.resolveVariables('${timeRangeFrom}', variables);

// Convert filters to DTO with resolved variables
const dtoFilters = variableService.convertToFieldFilterDto(filters, variables);
```

### WidgetRegistryService

Registry for widget types and their configurations.

```typescript
// Get widget component
const component = registry.getWidgetComponent('kpi');

// Get default size
const size = registry.getDefaultSize('table');

// Get registration
const registration = registry.getRegistration('barChart');
```

## Creating Custom Widgets

### 1. Create Widget Component

```typescript
@Component({
  selector: 'my-custom-widget',
  standalone: true,
  template: `...`
})
export class MyCustomWidgetComponent implements OnInit {
  @Input() config!: MyCustomWidgetConfig;

  private readonly dataService = inject(MeshBoardDataService);
  private readonly stateService = inject(MeshBoardStateService);
}
```

### 2. Create Config Dialog Component

```typescript
@Component({
  selector: 'my-custom-config-dialog',
  standalone: true,
  template: `...`
})
export class MyCustomConfigDialogComponent {
  @Input() initialTitle = '';
  @Input() initialDataSource?: DataSource;

  @Output() save = new EventEmitter<MyCustomConfigResult>();
  @Output() cancelled = new EventEmitter<void>();
}
```

### 3. Register Widget

In your app initialization:

```typescript
const registry = inject(WidgetRegistryService);

registry.registerWidget({
  type: 'myCustom',
  component: MyCustomWidgetComponent,
  configDialogComponent: MyCustomConfigDialogComponent,
  defaultSize: { colSpan: 2, rowSpan: 2 },
  getInitialConfig: (widget) => ({
    initialTitle: widget.title,
    initialDataSource: widget.dataSource
  }),
  applyConfigResult: (widget, result) => ({
    ...widget,
    title: result.title,
    dataSource: result.dataSource,
    customOption: result.customOption
  })
});
```

## Persistence

MeshBoards are persisted using the `System.UI/Dashboard` and `System.UI/DashboardWidget` Construction Kit types.

### Required CK Model

The MeshBoard feature requires the `System.UI` CK model version >= 1.0.1.

### Backend Structure

- **Dashboard**: Contains grid configuration (columns, rowHeight, gap) and metadata
- **DashboardWidget**: Contains widget type, position, and serialized config

## Build

```bash
npm run build:octo-meshboard
```

## Dependencies

- `@angular/core` >= 17
- `@progress/kendo-angular-layout` (TileLayout)
- `@progress/kendo-angular-charts` (Charts)
- `@progress/kendo-angular-gauges` (Gauges)
- `@progress/kendo-angular-grid` (Table)
- `@meshmakers/octo-services` (GraphQL services)
- `@meshmakers/octo-ui` (UI components)
- `@meshmakers/shared-ui` (Shared components)
