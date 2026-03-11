# @meshmakers/octo-ui-legacy

Legacy Angular UI library based on **Angular Material** for backward compatibility with older OctoMesh applications.

**Note:** For new projects, use `@meshmakers/octo-ui` (Kendo UI based) instead.

Part of the [@meshmakers](https://www.npmjs.com/org/meshmakers) package ecosystem.

## Purpose

This library provides Material Design-based UI components for applications that have not yet migrated to the Kendo UI based `@meshmakers/octo-ui`. It contains modernized Material Design versions of table, breadcrumb, notification, and entity selection components.

## Build & Test

```bash
# Build
npm run build:octo-ui-legacy

# Lint
npm run lint:octo-ui-legacy

# Run tests
npm test -- --project=@meshmakers/octo-ui-legacy --watch=false
```

## Architecture

```
octo-ui-legacy/
├── src/
│   ├── public-api.ts
│   └── lib/
│       ├── table/
│       │   ├── mm-octo-table.component.ts    # Data table
│       │   ├── mm-octo-table.component.html
│       │   ├── mm-octo-table.component.scss
│       │   └── mm-octo-table.model.ts        # Column/action models
│       ├── breadcrumb/
│       │   └── mm-breadcrumb.component.ts     # Breadcrumb navigation
│       ├── notification-bar/
│       │   └── mm-notification-bar.component.ts # Error snack bar
│       └── entity-select-input/
│           └── mm-entity-select-input.component.ts # Entity autocomplete
```

## Components

| Component | Selector | Description |
|-----------|----------|-------------|
| `MmOctoTableComponent` | `mm-octo-table` | Material table with sorting, pagination, search, action columns, responsive mobile layout |
| `MmBreadcrumbComponent` | `mm-breadcrumb` | Breadcrumb navigation using `BreadCrumbService` |
| `MmNotificationBarComponent` | `mm-notification-bar` | Error notification via Material SnackBar with auto-dismiss |
| `MmEntitySelectInputComponent` | `mm-entity-select-input` | Material Autocomplete for entity selection with `ControlValueAccessor` |

### MmOctoTableComponent

Material Design data table with GraphQL data source integration.

**Features:** Sorting, pagination, search with debounce, action columns with menus, responsive mobile layout (card-based under 959px), toolbar actions, row selection.

**Inputs:**

| Input | Type | Description |
|-------|------|-------------|
| `dataSource` | `AssetRepoGraphQlDataSource` | GraphQL data source |
| `columns` | `ColumnDefinition[]` | Column definitions (string or TableColumn) |
| `actionColumns` | `ActionColumn[]` | Action button columns |
| `optionActions` | `ActionColumn[]` | Dropdown menu actions |
| `searchFilterColumns` | `string[]` | Columns to include in search |
| `pageSizeOptions` | `number[]` | Page size options |
| `defaultSortColumn` | `string` | Default sort field |
| `rowIsClickable` | `boolean` | Enable row click events |

**Outputs:**

| Output | Type | Description |
|--------|------|-------------|
| `rowClicked` | `EventEmitter<any>` | Emitted on row click |
| `actionColumnClick` | `EventEmitter<{action, id, entry}>` | Emitted on action click |
| `searchFilterStringUpdated` | `EventEmitter<string>` | Emitted on search text change |

### MmEntitySelectInputComponent

Material Autocomplete input implementing `ControlValueAccessor`, `MatFormFieldControl`, and `Validator`.

**Features:** Debounced search (300ms), min 3 chars before filtering, loading spinner, auto-select on blur with single result, prefix support for direct lookup.

## Models

| Model | Description |
|-------|-------------|
| `TableColumn` | Column definition with displayName, dataKey, templateName, sortingDisabled |
| `ColumnDefinition` | Union type: `string \| TableColumn` |
| `ActionColumn` | Action button with displayText, actionId, iconName, svgIconName |
| `ToolbarAction` | Toolbar action with route, clickHandler, isDisabled, isHidden |

## Dependencies

- **Angular 21** with Angular Material and CDK
- **@meshmakers/octo-services** (GraphQL data sources, DTOs)
- **@meshmakers/shared-services** (BreadCrumbService, MessageService, EntitySelectDataSource)

## Migration to octo-ui / shared-ui

| Legacy (Material) | Modern (Kendo) |
|-------------------|----------------|
| `MmOctoTableComponent` | `ListViewComponent` from `@meshmakers/shared-ui` |
| `MmBreadcrumbComponent` | Kendo Breadcrumb or custom (in host app) |
| `MmNotificationBarComponent` | `NotificationDisplayService` from `@meshmakers/shared-ui` |
| `MmEntitySelectInputComponent` | `EntitySelectInputComponent` from `@meshmakers/shared-ui` |

## Documentation and Testing Standards

- **All developer documentation must be written in English**
- **Every code change must include updated documentation** — update README.md, CLAUDE.md, or inline docs when adding, modifying, or removing features
- **Unit tests and integration tests must be executed** after every code change
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features, components, or services are implemented
- Never commit code with failing tests
