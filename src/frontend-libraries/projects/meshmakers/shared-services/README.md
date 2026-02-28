# @meshmakers/shared-services

Angular library providing common application services for messaging, navigation, breadcrumbs, and HTTP error handling.

Part of the [@meshmakers](https://www.npmjs.com/org/meshmakers) package ecosystem.

## Build & Test

```bash
# Build
npm run build:shared-services

# Lint
npm run lint:shared-services

# Run tests
npm test -- --project=@meshmakers/shared-services --watch=false
```

## Architecture

```
shared-services/
├── src/
│   ├── public-api.ts
│   └── lib/
│       ├── services/
│       │   ├── message.service.ts          # Notification messages
│       │   ├── app-title.service.ts        # Application title management
│       │   ├── bread-crumb.service.ts      # Breadcrumb navigation
│       │   ├── command.service.ts           # Drawer navigation
│       │   ├── command-base.service.ts      # Navigation base class
│       │   ├── command-settings.service.ts  # Navigation configuration base
│       │   ├── component-menu.service.ts    # Component context menus
│       │   └── error-message.utils.ts       # Error message transformation
│       ├── shared/
│       │   └── mm-http-error-interceptor.service.ts  # HTTP error handling
│       ├── models/
│       │   ├── notification-message.ts      # Message model
│       │   ├── commandItem.ts               # Navigation item model
│       │   ├── breadCrumbData.ts            # Breadcrumb model
│       │   ├── breadCrumbRouteItem.ts       # Route breadcrumb config
│       │   ├── pagedResultDto.ts            # Paged result DTO
│       │   ├── treeItemData.ts              # Tree node model
│       │   ├── apiErrorDto.ts               # API error model
│       │   └── failedDetailsDto.ts          # Error details model
│       ├── data-sources/
│       │   └── entity-select-data-source.ts # Entity autocomplete interface
│       ├── options/
│       │   └── commandOptions.ts            # Command configuration
│       └── compat/                          # Backward compatibility
│           ├── data-source-base.ts          # Legacy DataSourceBase
│           ├── iso-date-time.ts             # Legacy date utilities
│           ├── qr-code-scanner.service.ts   # QR code scanner
│           ├── error-message.ts             # Legacy error model
│           └── auto-complete-data-source.ts # Legacy autocomplete
```

## Services

| Service | Description |
|---------|-------------|
| `MessageService` | User-facing notifications (error, warning, info, success) with error history |
| `AppTitleService` | Reactive application title management |
| `BreadCrumbService` | Automatic breadcrumb generation from route configuration |
| `CommandService` | Drawer navigation management with Kendo DrawerItem integration |
| `CommandSettingsService` | Base class for application navigation configuration |
| `ComponentMenuService` | Component-level context menus from route data |

## Interceptors

| Interceptor | Description |
|-------------|-------------|
| `MmHttpErrorInterceptor` | Handles HTTP errors (network errors, API 400 errors with details) |

## Models

| Model | Description |
|-------|-------------|
| `NotificationMessage` | Message with level, message, details, timestamp |
| `CommandItem` | Navigation item with link/href/onClick, visibility, children |
| `BreadCrumbRouteItem` | Route breadcrumb config with label/url/icon |
| `BreadCrumbData` | Kendo-compatible breadcrumb item |
| `PagedResultDto` | Paginated result with skip/take/totalCount/list |
| `TreeItemData` | Tree node interface |
| `EntitySelectDataSource` | Interface for entity autocomplete data sources |

## Quick Start

```typescript
// app.config.ts
import { provideMmSharedServices, MmHttpErrorInterceptor } from '@meshmakers/shared-services';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideMmSharedServices(),
    { provide: HTTP_INTERCEPTORS, useClass: MmHttpErrorInterceptor, multi: true }
  ]
};
```

## Detailed Documentation

See [docs/README.md](docs/README.md) for complete API reference with usage examples for all services.

## Dependencies

- **Angular 21** (core, common/http, router)
- **RxJS** (BehaviorSubject, Subject, Observable)
- **@progress/kendo-angular-layout** (DrawerItem)
- **@progress/kendo-angular-menu** (MenuItem)
- **@progress/kendo-angular-navigation** (BreadCrumbItem)
- **@progress/kendo-svg-icons** (SVGIcon)

## Documentation and Testing Standards

- **All developer documentation must be written in English**
- **Every code change must include updated documentation** — update README.md, docs/README.md, or inline docs when adding, modifying, or removing features
- **Unit tests and integration tests must be executed** after every code change
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features, components, or services are implemented
- Never commit code with failing tests
