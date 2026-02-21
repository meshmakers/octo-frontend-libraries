# @meshmakers/shared-ui

Angular UI component library for Octo Mesh Platform applications.

Includes list views, confirmation dialogs, cron builder, tree view, entity select input, file upload, and more.

Part of the [@meshmakers](https://www.npmjs.com/org/meshmakers) package ecosystem.

**Note:** This library requires a [Kendo UI for Angular](https://www.telerik.com/kendo-angular-ui) license.

## Installation

```bash
npm install @meshmakers/shared-ui
```

## Key Components

| Component | Selector | Description |
|-----------|----------|-------------|
| `ListViewComponent` | `mm-list-view` | Configurable list/grid view with search, pagination |
| `ConfirmationWindowComponent` | - | Confirmation dialog via `ConfirmationService` |
| `CronBuilderComponent` | `mm-cron-builder` | Visual cron expression editor |
| `TreeComponent` | `mm-tree` | Hierarchical tree view |
| `EntitySelectInputComponent` | `mm-entity-select-input` | Entity autocomplete input |
| `BaseFormComponent` | `mm-base-form` | Form wrapper with save/cancel |
| `CopyableTextComponent` | `mm-copyable-text` | Text with copy-to-clipboard |

## Key Services

| Service | Description |
|---------|-------------|
| `ConfirmationService` | Show confirmation dialogs |
| `FileUploadService` | File upload dialog |
| `InputService` | Text input dialog |
| `NotificationDisplayService` | Toast notifications |

## Build

```bash
npm run build:shared-ui
```

## Test

```bash
npm test -- --project=@meshmakers/shared-ui --watch=false
```

## Documentation

See [Octo Mesh Platform documentation](https://docs.meshmakers.cloud).
