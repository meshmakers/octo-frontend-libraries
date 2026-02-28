# shared-services Library Guidelines

## Overview

The `@meshmakers/shared-services` library provides common Angular services for messaging, navigation, breadcrumbs, and HTTP error handling. It is a foundational library used by all OctoMesh frontend applications.

## Build Commands

```bash
# From frontend-libraries directory
npm run build:shared-services

# Run tests
npm test -- --project=@meshmakers/shared-services --watch=false

# Run lint
npm run lint:shared-services
```

## Documentation and Testing Standards

- **All developer documentation must be written in English**
- **Every code change must include updated documentation** — update README.md, CLAUDE.md, docs/README.md, or inline docs when adding, modifying, or removing features
- **Unit tests and integration tests must be executed** after every code change
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features, components, or services are implemented
- Never commit code with failing tests

## Project Structure

```
src/lib/
├── services/                          # Core services
│   ├── message.service.ts             # Notification messages
│   ├── app-title.service.ts           # Application title
│   ├── bread-crumb.service.ts         # Breadcrumb navigation
│   ├── command.service.ts             # Drawer navigation
│   ├── command-base.service.ts        # Navigation base class
│   ├── command-settings.service.ts    # Navigation configuration
│   ├── component-menu.service.ts      # Context menus
│   └── error-message.utils.ts         # Error message transformation
├── shared/
│   └── mm-http-error-interceptor.service.ts
├── models/                            # TypeScript interfaces
├── data-sources/                      # Data source interfaces
├── options/                           # Configuration classes
└── compat/                            # Backward compatibility exports
```

## Key Patterns

### Provider Function

The library provides `provideMmSharedServices()` for standalone Angular app configuration:

```typescript
import { provideMmSharedServices } from '@meshmakers/shared-services';

export const appConfig: ApplicationConfig = {
  providers: [provideMmSharedServices()]
};
```

### CommandSettingsService Extension

Applications define navigation by extending `CommandSettingsService`:

```typescript
@Injectable({ providedIn: 'root' })
export class MyCommandSettingsService extends CommandSettingsService {
  override get commandItems(): CommandItem[] {
    return [
      { id: 'home', type: 'link', text: 'Home', link: '/' },
      { id: 'sep', type: 'separator' },
      { id: 'settings', type: 'link', text: 'Settings', link: '/settings' }
    ];
  }
}
```

### Breadcrumb Route Configuration

Routes define breadcrumbs via `data.breadcrumb` with `{{param}}` template syntax:

```typescript
{
  path: 'users/:userId',
  data: {
    breadcrumb: [
      { label: 'Users', url: '/users' },
      { label: '{{userName}}', url: ':userId' }
    ]
  }
}
```

Labels are updated at runtime via `BreadCrumbService.updateBreadcrumbLabels({ userName: 'John' })`.

### Component Menu Route Configuration

Routes define context menus via `data.navigationMenu`:

```typescript
{
  path: 'editor',
  data: {
    navigationMenu: [
      { id: 'save', type: 'link', text: 'Save', onClick: async () => { ... } }
    ]
  }
}
```

### Error Message Transformation

`MessageService` transforms known error patterns into user-friendly messages. Currently handles:
- MongoDB E11000 duplicate key errors

### HTTP Error Interceptor

`MmHttpErrorInterceptor` handles:
- **Status 0**: Network connectivity errors
- **Status 400 with `ApiErrorDto`**: Parses structured error response with details

## Backward Compatibility Layer (compat/)

The `compat/` directory exports legacy types for older compiled libraries that import from `@meshmakers/shared-services`:

| Export | Purpose |
|--------|---------|
| `DataSourceBase` | Legacy data source base class |
| `IsoDateTime` | UTC/local date conversion utilities |
| `QrCodeScannerService` | BarcodeDetector API wrapper |
| `ErrorMessage` | Legacy error model |
| `AutoCompleteDataSource` | Legacy autocomplete interface |
| `BreadcrumbService` | Alias for `BreadCrumbService` (different casing) |

These exist for backward compatibility only. New code should use the primary exports.

## Dependencies

- **Angular 21** (core, common/http, router)
- **RxJS** (Observable patterns)
- **@progress/kendo-angular-layout** (DrawerItem interface)
- **@progress/kendo-angular-menu** (MenuItem interface)
- **@progress/kendo-angular-navigation** (BreadCrumbItem interface)
- **@progress/kendo-svg-icons** (SVGIcon type)
