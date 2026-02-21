# Frontend Libraries

Angular monorepo containing shared libraries and the template application for OctoMesh frontend development.

## Project Structure

```
projects/
├── template-app/                      # Demo/Template application
├── meshmakers/
│   ├── shared-auth/                   # Authentication library
│   ├── shared-services/               # Common services library
│   ├── shared-ui/                     # Shared UI utilities
│   ├── octo-services/                 # GraphQL services library
│   ├── octo-ui/                       # OctoMesh UI components
│   ├── octo-process-diagrams/         # Process diagram library
│   └── octo-meshboard/                # MeshBoard widget library
```

## Libraries Documentation

| Library | Description | Documentation |
|---------|-------------|---------------|
| **@meshmakers/shared-auth** | OAuth2/OIDC authentication with route guards and interceptors | [Documentation](projects/meshmakers/shared-auth/docs/README.md) |
| **@meshmakers/shared-services** | Common services for messaging, navigation, breadcrumbs | [Documentation](projects/meshmakers/shared-services/docs/README.md) |
| **@meshmakers/shared-ui** | Shared UI utilities and components | - |
| **@meshmakers/octo-services** | REST/GraphQL services for OctoMesh backend APIs | [Documentation](projects/meshmakers/octo-services/docs/README.md) |
| **@meshmakers/octo-ui** | OctoMesh-specific UI components | - |
| **@meshmakers/octo-process-diagrams** | Process diagram editor components | - |
| **@meshmakers/octo-meshboard** | Dashboard and widget components | - |

## Quick Start

### Prerequisites

- Node.js 20.x
- npm

### Installation

```bash
npm ci
```

### Development Server

```bash
npm start
```

Navigate to `https://localhost:4201/`. The application will automatically reload on file changes.

### Building Libraries

```bash
# Build all libraries
npm run build

# Build individual libraries
npm run build:shared-auth
npm run build:shared-services
npm run build:shared-ui
npm run build:octo-services
npm run build:octo-ui
npm run build:octo-process-diagrams
npm run build:octo-meshboard
npm run build:template-app

# Production build
npm run build:prod
```

### Running Unit Tests

```bash
# Run all tests
npm test

# Run tests for specific library
npm test -- --project=@meshmakers/shared-auth
npm test -- --project=@meshmakers/shared-services
npm test -- --project=@meshmakers/octo-services
npm test -- --project=@meshmakers/octo-process-diagrams
```

### Linting

```bash
# Lint all projects
npm run lint

# Lint specific library
npm run lint:shared-auth
npm run lint:shared-services
npx ng lint @meshmakers/octo-services
```

### GraphQL Code Generation

```bash
npm run codegen
```

## Library Usage

### @meshmakers/shared-auth

Authentication library with OAuth2/OIDC support.

```typescript
// app.config.ts
import { AuthorizeService, AuthorizeInterceptor, provideMmSharedAuth } from '@meshmakers/shared-auth';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideMmSharedAuth(),
    { provide: HTTP_INTERCEPTORS, useClass: AuthorizeInterceptor, multi: true }
  ]
};
```

**Features:**
- `AuthorizeService` - OAuth2/OIDC authentication
- `AuthorizeGuard` - Route protection with role-based access
- `AuthorizeInterceptor` - Automatic token injection
- `LoginAppBarSectionComponent` - Pre-built login UI

See [shared-auth documentation](projects/meshmakers/shared-auth/docs/README.md) for details.

### @meshmakers/shared-services

Common application services.

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

**Features:**
- `MessageService` - Notification messages (error, warning, info, success)
- `AppTitleService` - Application title management
- `BreadCrumbService` - Automatic breadcrumb generation
- `CommandService` - Navigation drawer management
- `MmHttpErrorInterceptor` - HTTP error handling

See [shared-services documentation](projects/meshmakers/shared-services/docs/README.md) for details.

### @meshmakers/octo-services

OctoMesh backend API services for REST and GraphQL.

```typescript
// app.config.ts
import { CONFIGURATION_SERVICE, IConfigurationService } from '@meshmakers/octo-services';
import { AppConfigurationService } from './services/app-configuration.service';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: CONFIGURATION_SERVICE, useClass: AppConfigurationService }
  ]
};
```

**Services:**

| Service | Description |
|---------|-------------|
| `HealthService` | Backend health checks |
| `AssetRepoService` | Tenant and model management |
| `IdentityService` | User, role, client management |
| `BotService` | Background job execution |
| `JobManagementService` | Job progress tracking |
| `CkTypeSelectorService` | Query CK types |
| `CkTypeAttributeService` | Query CK type attributes |
| `CkModelService` | Check model availability |
| `AttributeSelectorService` | Query available columns |

See [octo-services documentation](projects/meshmakers/octo-services/docs/README.md) for details.

## Template Application

The `template-app` project demonstrates usage of all libraries. Key files:

| File | Description |
|------|-------------|
| `app.config.ts` | Complete provider configuration |
| `app.routes.ts` | Route configuration with guards |
| `app.component.ts` | Main layout with navigation |
| `services/my-command-settings.service.ts` | Navigation menu configuration |
| `tenants/demos/message/` | Message service demo |

## Technology Stack

- **Angular 21** with standalone components
- **Kendo UI for Angular** - UI components
- **Apollo Angular** - GraphQL client
- **angular-oauth2-oidc** - OAuth2/OIDC
- **RxJS** - Reactive programming

## Configuration

### Locale

German locale (de-DE) is configured by default:

```typescript
import { LOCALE_ID } from '@angular/core';
import localeDe from '@angular/common/locales/de';
import '@progress/kendo-angular-intl/locales/de/all';

registerLocaleData(localeDe, 'de-DE');

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'de-DE' }
  ]
};
```

### Karma Configuration

Tests use Chrome Headless with JUnit reporter for CI:

```bash
# CI command
npm test -- --project=@meshmakers/shared-auth --watch=false --browsers=ChromeHeadlessCI --reporters=junit,progress
```

## Additional Resources

- [Angular CLI Documentation](https://angular.dev/tools/cli)
- [Kendo UI for Angular](https://www.telerik.com/kendo-angular-ui)
- [Apollo Angular](https://the-guild.dev/graphql/apollo-angular)
