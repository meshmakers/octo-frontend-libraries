# @meshmakers/shared-ui

Angular UI component library for OctoMesh Platform applications.

Provides reusable components, dialog services, data sources, pipes, and guards for building consistent UIs across OctoMesh frontend applications.

**Note:** This library requires a [Kendo UI for Angular](https://www.telerik.com/kendo-angular-ui) license.

Part of the [@meshmakers](https://www.npmjs.com/org/meshmakers) package ecosystem.

## Installation

```bash
npm install @meshmakers/shared-ui
```

### Environment Setup

Register all services via the environment provider:

```typescript
import { provideMmSharedUi } from '@meshmakers/shared-ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideMmSharedUi(),
    // ...
  ]
};
```

## Build & Test

```bash
# Build
npm run build:shared-ui

# Lint
npm run lint:shared-ui

# Run tests
npm test -- --project=@meshmakers/shared-ui --watch=false
```

## Architecture

```
shared-ui/
├── src/
│   ├── public-api.ts                          # Public API exports
│   └── lib/
│       ├── list-view/                         # Configurable grid/table
│       │   ├── list-view.component.ts|html|scss
│       │   └── list-view.model.ts             # TableColumn, StatusIconMapping
│       ├── base-form/                         # Form wrapper with save/cancel
│       │   └── base-form.component.ts|html|scss
│       ├── base-tree-detail/                  # Tree + detail panel layout
│       │   └── base-tree-detail.component.ts|scss
│       ├── tree/                              # Hierarchical tree view
│       │   └── tree.component.ts|html|scss
│       ├── cron-builder/                      # Visual cron expression editor
│       │   ├── cron-builder.component.ts|html|scss
│       │   ├── cron-builder.models.ts
│       │   ├── cron-parser.service.ts
│       │   ├── cron-humanizer.service.ts
│       │   └── cron-builder.constants.ts
│       ├── time-range-picker/                 # Flexible time range selector
│       │   ├── time-range-picker.component.ts|html|scss
│       │   ├── time-range-picker.models.ts
│       │   └── time-range-utils.ts
│       ├── copyable-text/                     # Text with copy-to-clipboard
│       │   └── copyable-text.component.ts|html|scss
│       ├── entity-select-input/               # Entity autocomplete input
│       │   └── entity-select-input.component.ts
│       ├── entity-select-dialog/              # Entity selection modal
│       │   ├── entity-select-dialog.component.ts
│       │   ├── entity-select-dialog.service.ts
│       │   └── entity-select-dialog-data-source.ts
│       ├── confirmation-window/               # Confirmation dialog
│       │   └── confirmation-window.component.ts|html
│       ├── input-dialog/                      # Text input dialog
│       │   └── input-dialog.component.ts|html|scss
│       ├── progress-window/                   # Progress dialog
│       │   ├── progress-window.component.ts|html|scss
│       │   ├── progress-window.service.ts
│       │   └── USAGE.md
│       ├── upload-file-dialog/                # File upload dialog
│       │   └── upload-file-dialog.component.ts|html
│       ├── save-as-dialog/                    # Save-as dialog
│       │   ├── save-as-dialog.component.ts
│       │   ├── save-as-dialog.service.ts
│       │   └── save-as-dialog-data-source.ts
│       ├── import-strategy-dialog/            # Import strategy dialog
│       │   ├── import-strategy-dialog.component.ts|html
│       │   └── import-strategy-dialog.service.ts
│       ├── message-details-dialog/            # Message details dialog
│       │   ├── message-details-dialog.component.ts
│       │   └── message-details-dialog.service.ts
│       ├── data-sources/                      # Base data source classes
│       │   ├── data-source-base.ts
│       │   ├── data-source-typed.ts
│       │   ├── hierarchy-data-source-base.ts
│       │   └── hierarchy-data-source.ts
│       ├── guards/                            # Unsaved changes protection
│       │   ├── unsaved-changes.interface.ts
│       │   ├── unsaved-changes.guard.ts
│       │   └── unsaved-changes.directive.ts
│       ├── directives/
│       │   └── mm-list-view-data-binding.directive.ts
│       ├── pipes/
│       │   ├── pascal-case.pipe.ts
│       │   └── bytes-to-size.pipe.ts
│       ├── models/
│       │   ├── fetchResult.ts                 # FetchResult, FetchResultTyped<T>
│       │   ├── confirmation.ts                # ConfirmationWindowData, DialogType
│       │   ├── progressValue.ts               # ProgressValue
│       │   ├── inputDialogResult.ts
│       │   ├── importStrategyDto.ts
│       │   └── node-dropped-event.ts
│       ├── services/
│       │   ├── confirmation.service.ts
│       │   ├── file-upload.service.ts
│       │   ├── input.service.ts
│       │   ├── notification-display.service.ts
│       │   └── message-listener.service.ts
│       └── svg-icons.ts                       # Kendo SVG icon re-exports
├── docs/
│   ├── time-range-picker.md                   # Time Range Picker guide
│   └── unsaved-changes-guard.md               # Unsaved Changes Guard guide
```

## Components

### ListViewComponent (`mm-list-view`)

Configurable data grid with Kendo Grid integration.

**Features:** Pagination, sorting, filtering, row selection, search, context menus, action menus, Excel/PDF export, toolbar actions, column types (text, numeric, boolean, date, bytes, status icons, cron expressions).

```html
<mm-list-view
  appMyDataSource
  #dir="appMyDataSource"
  [sortable]="true"
  [rowFilterEnabled]="true"
  [searchTextBoxEnabled]="true"
  [selectable]="{mode: 'single', enabled: true}"
  [pageable]="{buttonCount: 3, pageSizes: [10, 20, 50, 100]}"
  [pageSize]="20"
  [columns]="columns"
  [contextMenuCommandItems]="contextMenu"
  [leftToolbarActions]="toolbarActions"
  (rowClicked)="onRowClicked($event)">
</mm-list-view>
```

### BaseFormComponent (`mm-base-form`)

Form wrapper with save/cancel buttons, title, validation, and unsaved changes detection.

```html
<mm-base-form [form]="form" [config]="formConfig" (saveForm)="onSave()" (cancelForm)="onCancel()">
  <!-- Form fields -->
</mm-base-form>
```

### CronBuilderComponent (`mm-cron-builder`)

Visual cron expression editor with 6-field format support, preset quick-selects, human-readable descriptions, next execution preview, and `ControlValueAccessor` integration.

### TimeRangePickerComponent (`mm-time-range-picker`)

Flexible time range selector with Year, Quarter, Month, Relative, and Custom modes. Outputs both `Date` objects and ISO 8601 strings.

See [Time Range Picker Documentation](docs/time-range-picker.md) for detailed API and examples.

### TreeComponent (`mm-tree`)

Hierarchical tree view with Kendo TreeView, drag-drop support, and expandable nodes.

### CopyableTextComponent (`mm-copyable-text`)

Display text with a one-click copy-to-clipboard button.

### EntitySelectInputComponent (`mm-entity-select-input`)

Autocomplete input for entity selection with dialog fallback.

## Dialog Services

All complex dialogs are opened via injected services:

| Service | Method | Description |
|---------|--------|-------------|
| `ConfirmationService` | `showYesNoConfirmationDialog()` | Yes/No confirmation |
| | `showYesNoCancelConfirmationDialog()` | Yes/No/Cancel with result |
| | `showOkCancelConfirmationDialog()` | Ok/Cancel confirmation |
| | `showOkDialog()` | Ok-only information dialog |
| `InputService` | — | Text input dialog |
| `FileUploadService` | — | File upload dialog |
| `ProgressWindowService` | `showDeterminateProgress()` | Progress bar with percentage |
| | `showIndeterminateProgress()` | Spinning loader |
| `NotificationDisplayService` | `showSuccess()`, `showError()`, `showWarning()`, `showInfo()` | Toast notifications |
| `EntitySelectDialogService` | — | Entity selection modal |
| `SaveAsDialogService` | — | Save-as dialog with path navigation |
| `ImportStrategyDialogService` | — | Import strategy selection |
| `MessageDetailsDialogService` | — | Detailed message/error display |

See [Progress Window Usage](src/lib/progress-window/USAGE.md) for progress dialog examples.

## Data Sources

Base classes for data binding with `ListViewComponent`:

| Class | Description |
|-------|-------------|
| `DataSourceBase` | Abstract base with pagination, filtering, sorting |
| `DataSourceTyped<T>` | Generic typed data source |
| `HierarchyDataSourceBase` | Base for tree/hierarchical data |
| `HierarchyDataSource` | Implementation for tree structures |

## Guards & Directives

### Unsaved Changes Protection

Two-level protection against accidental data loss:

| Component | Protects Against |
|-----------|-----------------|
| `UnsavedChangesDirective` | Browser back/refresh/close (beforeunload) |
| `UnsavedChangesGuard` | In-app navigation (Angular Router canDeactivate) |
| `HasUnsavedChanges` | Interface for components to implement |

See [Unsaved Changes Guard Documentation](docs/unsaved-changes-guard.md) for implementation guide.

### MmListViewDataBindingDirective

Data binding directive for `ListViewComponent`, managing data source and pagination.

## Pipes

| Pipe | Usage | Example |
|------|-------|---------|
| `PascalCasePipe` | `{{ value \| pascalCase }}` | `"my_field"` → `"MyField"` |
| `BytesToSizePipe` | `{{ value \| bytesToSize }}` | `1048576` → `"1.0 MB"` |

## Models

| Model | Description |
|-------|-------------|
| `FetchResult` / `FetchResultTyped<T>` | Paginated query result wrapper |
| `TableColumn` / `ColumnDefinition` | Column definitions for ListViewComponent |
| `StatusIconMapping` / `StatusFieldConfig` | Status icon configuration |
| `ProgressValue` | Progress status text + percentage |
| `TimeRange` / `TimeRangeISO` / `TimeRangeSelection` | Time range types |
| `CronBuilderConfig` / `CronSchedule` / `CronFields` | Cron builder types |
| `ImportStrategyDto` | Import configuration |
| `NodeDroppedEvent` | Tree drag-drop event data |
| `ConfirmationWindowData` / `ConfirmationWindowResult` | Dialog configuration |

## Dependencies

- **Angular 21** with standalone components and signals
- **Kendo UI Angular 21** (Grid, Buttons, Dialog, Dropdowns, Inputs, Indicators, Layout, Notifications, TreeView)
- **@meshmakers/shared-services** (sibling library)

## Detailed Documentation

- [Time Range Picker](docs/time-range-picker.md) — Full API reference, configuration, examples
- [Unsaved Changes Guard](docs/unsaved-changes-guard.md) — Implementation guide with checklists
- [Progress Window Usage](src/lib/progress-window/USAGE.md) — Progress dialog examples, migration from Angular Material

## Documentation and Testing Standards

- **All developer documentation must be written in English**
- **Every code change must include updated documentation** — update README.md, CLAUDE.md, or inline docs when adding, modifying, or removing features
- **Unit tests and integration tests must be executed** after every code change
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features, components, or services are implemented
- Never commit code with failing tests
