# @meshmakers/shared-ui - CLAUDE.md

## Build Commands

```bash
# From frontend-libraries root
npm run build:shared-ui

# Lint
npm run lint:shared-ui

# Run tests
npm test -- --project=@meshmakers/shared-ui --watch=false
```

## Documentation and Testing Standards

- **All developer documentation must be written in English**
- **Every code change must include updated documentation** — update README.md, CLAUDE.md, or inline docs when adding, modifying, or removing features
- **Unit tests and integration tests must be executed** after every code change
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features, components, or services are implemented
- Never commit code with failing tests

## Architecture Overview

### Components

| Component | Selector | Key Pattern |
|-----------|----------|-------------|
| `ListViewComponent` | `mm-list-view` | Data-source directive binding, Kendo Grid |
| `BaseFormComponent` | `mm-base-form` | Form wrapper, auto unsaved changes detection |
| `BaseTreeDetailComponent` | — | Base class for tree + detail layouts |
| `TreeComponent` | `mm-tree` | Kendo TreeView with drag-drop |
| `CronBuilderComponent` | `mm-cron-builder` | ControlValueAccessor, reactive forms |
| `TimeRangePickerComponent` | `mm-time-range-picker` | Multiple modes, Date + ISO outputs |
| `CopyableTextComponent` | `mm-copyable-text` | Clipboard API |
| `EntitySelectInputComponent` | `mm-entity-select-input` | Autocomplete with dialog fallback |

### Dialog Services Pattern

All complex dialogs use the service pattern — inject the service, call `show*()` method, get back a `DialogRef` or `Promise`:

```typescript
// Confirmation
const confirmed = await this.confirmationService.showYesNoConfirmationDialog('Title', 'Message');

// Progress
const dialogRef = this.progressWindowService.showDeterminateProgress('Title', progress$, options);

// Input
const result = await this.inputService.showInputDialog('Title', 'Label');
```

Services registered via `provideMmSharedUi()`:
- `ConfirmationService`
- `FileUploadService`
- `InputService`
- `ProgressWindowService`
- `NotificationDisplayService`
- `MessageListenerService`
- `MessageDetailsDialogService`
- `EntitySelectDialogService`
- `SaveAsDialogService`
- `ImportStrategyDialogService`

### Data Source Pattern

For `mm-list-view` data binding, create directive extending `DataSourceBase`:

```typescript
@Directive({
  selector: "[appMyDataSource]",
  exportAs: 'appMyDataSource',
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => MyDataSourceDirective) }]
})
export class MyDataSourceDirective extends OctoGraphQlDataSource<MyType> {
  constructor() {
    super(inject(ListViewComponent));
    this.searchFilterAttributePaths = ['fieldName'];
  }

  fetchData(options: FetchDataOptions): Observable<FetchResultTyped<MyType>> {
    // ... GraphQL query ...
  }
}
```

### Unsaved Changes System

Two-level protection:
1. **Browser level** — `UnsavedChangesDirective` hooks `beforeunload`
2. **Router level** — `UnsavedChangesGuard` as `canDeactivate` guard

Components implement `HasUnsavedChanges` interface:
```typescript
export class MyComponent implements HasUnsavedChanges {
  hasUnsavedChanges(): boolean { return this.form.dirty; }
  async saveChanges(): Promise<boolean> { /* optional save */ }
}
```

### ListViewComponent Column Types

```typescript
interface TableColumn {
  field: string;
  displayName: string;
  dataType: 'text' | 'numeric' | 'boolean' | 'date' | 'bytes' | 'statusIcons' | 'cronExpression';
  // ... width, sortable, filterable, hidden, etc.
  formatter?: (value: unknown, item: unknown) => string;
}
```

Status icon columns use `StatusIconMapping` for icon/color/tooltip per value.

**Custom cell formatting (`formatter`)**

Use the optional `formatter` callback when the standard `dataType` rendering is not enough — currency, units, conditional labels, etc. The callback receives the raw field value and the full row item, and returns the cell's display string. Filtering and sorting still operate on the underlying field, so a numeric column with a currency formatter still sorts numerically and filters via the numeric input cell.

```typescript
{
  field: 'grossTotal',
  dataType: 'numeric',
  formatter: (value) => new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' })
    .format(Number(value))
}
```

### Styling

All components use **neutral, theme-agnostic defaults**. Host applications override via CSS custom properties or `::ng-deep`. No hardcoded theme colors in the library.

## Key Development Patterns

1. **Service-based dialogs** — Dialogs opened via injected services, not direct component instantiation
2. **ControlValueAccessor** — CronBuilder integrates with reactive forms via CVA
3. **Data source abstraction** — `DataSourceBase` handles pagination/filtering/sorting for list views
4. **Environment providers** — `provideMmSharedUi()` registers all services at app level
5. **Command pattern** — ListViewComponent uses `CommandItem` for toolbar/context menu actions

## Detailed Documentation

- [Time Range Picker](docs/time-range-picker.md) — Full API, configuration, examples
- [Unsaved Changes Guard](docs/unsaved-changes-guard.md) — Implementation guide with checklists
- [Progress Window Usage](src/lib/progress-window/USAGE.md) — Examples, migration guide
