# @meshmakers/shared-ui-legacy

Legacy Angular UI library based on **Angular Material** for backward compatibility with older OctoMesh applications.

**Note:** For new projects, use `@meshmakers/shared-ui` (Kendo UI based) instead.

Part of the [@meshmakers](https://www.npmjs.com/org/meshmakers) package ecosystem.

## Purpose

This library provides Material Design-based UI components for applications that have not yet migrated to the Kendo UI based `@meshmakers/shared-ui`. It contains dialog services, form utilities, and base classes that were part of the original shared UI layer.

## Build & Test

```bash
# Build
npm run build:shared-ui-legacy

# Lint
npm run lint:shared-ui-legacy

# Run tests
npm test -- --project=@meshmakers/shared-ui-legacy --watch=false
```

## Architecture

```
shared-ui-legacy/
├── src/
│   ├── public-api.ts
│   └── lib/
│       ├── shared-ui-module/
│       │   └── mm-shared-ui-module.ts       # NgModule (backward compat)
│       ├── abstract-details/
│       │   └── abstract-details-component.ts # Base class for detail forms
│       ├── common-validators/
│       │   └── common-validators.ts          # Custom form validators
│       ├── confirmation/
│       │   ├── confirmation.model.ts         # Dialog types/enums
│       │   ├── confirmation.service.ts       # Dialog service (Material)
│       │   └── confirmation-dialog.component.ts
│       ├── progress-window/
│       │   ├── progress-value.ts             # Progress data model
│       │   ├── progress-window.component.ts  # Progress dialog
│       │   └── progress-window.service.ts    # Progress service
│       └── import-strategy/
│           └── import-strategy-dto.ts        # ImportStrategyDto enum
```

## Components

| Component | Description |
|-----------|-------------|
| `ConfirmationDialogComponent` | Material Dialog with configurable buttons (Yes/No, Ok/Cancel) |
| `ProgressWindowComponent` | Determinate/indeterminate progress dialog with cancel |

## Services

| Service | Description |
|---------|-------------|
| `ConfirmationService` | Show confirmation dialogs (YesNo, YesNoCancel, OkCancel, Ok) |
| `ProgressWindowService` | Show progress dialogs (determinate/indeterminate) |

## Base Classes & Utilities

| Class | Description |
|-------|-------------|
| `AbstractDetailsComponent<T>` | Generic base for form-based detail components |
| `CommonValidators` | Form validators: `phoneNumber()`, `httpUri()`, `ensureSameValue()`, `conditionalRequired()`, `dependentControls()` |
| `MmSharedUiModule` | NgModule with `forRoot()` for legacy module-based apps |

## Models

| Model | Description |
|-------|-------------|
| `DialogType` | Enum: YesNo, YesNoCancel, OkCancel, Ok |
| `ButtonTypes` | Enum: Ok, Cancel, Yes, No |
| `ConfirmationWindowData` | Dialog configuration interface |
| `ConfirmationWindowResult` | Dialog result with button type |
| `ProgressValue` | Status text + progress percentage |
| `ImportStrategyDto` | Enum: InsertOnly, Upsert |

## Dependencies

- **Angular 21** with Angular Material and CDK
- **@meshmakers/shared-services** (sibling library)

## Migration to shared-ui

| Legacy (Material) | Modern (Kendo) |
|-------------------|----------------|
| `ConfirmationService` | `ConfirmationService` from `@meshmakers/shared-ui` |
| `ProgressWindowService` | `ProgressWindowService` from `@meshmakers/shared-ui` |
| `AbstractDetailsComponent` | `BaseFormComponent` from `@meshmakers/shared-ui` |
| `CommonValidators` | Angular built-in validators or custom |
| `MmSharedUiModule.forRoot()` | `provideMmSharedUi()` |

## Documentation and Testing Standards

- **All developer documentation must be written in English**
- **Every code change must include updated documentation** — update README.md, CLAUDE.md, or inline docs when adding, modifying, or removing features
- **Unit tests and integration tests must be executed** after every code change
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features, components, or services are implemented
- Never commit code with failing tests
