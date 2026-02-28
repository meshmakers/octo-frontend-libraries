# Frontend Libraries

Angular monorepo containing shared libraries and the template application for OctoMesh frontend development.

## Project Structure

```
projects/
├── demo-app/                      # Demo application
├── meshmakers/
│   ├── shared-auth/                   # Authentication library
│   ├── shared-services/               # Common services library
│   ├── shared-ui/                     # Shared UI utilities
│   ├── shared-ui-legacy/             # Legacy Material UI (backward compat)
│   ├── octo-services/                 # GraphQL services library
│   ├── octo-ui/                       # OctoMesh UI components
│   ├── octo-ui-legacy/               # Legacy Material UI (backward compat)
│   ├── octo-process-diagrams/         # Process diagram library
│   └── octo-meshboard/                # MeshBoard widget library
```

## Libraries Documentation

| Library | Description | Documentation |
|---------|-------------|---------------|
| **@meshmakers/shared-auth** | OAuth2/OIDC authentication with route guards and interceptors | [Documentation](projects/meshmakers/shared-auth/docs/README.md) |
| **@meshmakers/shared-services** | Common services for messaging, navigation, breadcrumbs | [Documentation](projects/meshmakers/shared-services/docs/README.md) |
| **@meshmakers/shared-ui** | Shared UI utilities and components | [Documentation](projects/meshmakers/shared-ui/README.md) |
| **@meshmakers/octo-services** | REST/GraphQL services for OctoMesh backend APIs | [Documentation](projects/meshmakers/octo-services/docs/README.md) |
| **@meshmakers/octo-ui** | OctoMesh-specific UI components | [Documentation](projects/meshmakers/octo-ui/README.md) |
| **@meshmakers/octo-process-diagrams** | Process diagram editor components | [Documentation](projects/meshmakers/octo-process-diagrams/README.md) |
| **@meshmakers/octo-meshboard** | Dashboard and widget components | [Documentation](projects/meshmakers/octo-meshboard/README.md) |
| **@meshmakers/shared-ui-legacy** | Legacy Material UI (backward compatibility) | [Documentation](projects/meshmakers/shared-ui-legacy/README.md) |
| **@meshmakers/octo-ui-legacy** | Legacy Material UI components (backward compatibility) | [Documentation](projects/meshmakers/octo-ui-legacy/README.md) |

## Quick Start

### Prerequisites

- Node.js 22.x or later
- npm
- **Telerik/Kendo UI License** (see [License Setup](#telerikendo-ui-license-setup) below)

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
npm run build:shared-ui-legacy
npm run build:octo-ui-legacy
npm run build:demo-app

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
npm run lint:shared-ui
npm run lint:octo-services
npm run lint:octo-ui
npm run lint:octo-meshboard
npm run lint:octo-process-diagrams
npm run lint:shared-ui-legacy
npm run lint:octo-ui-legacy
```

### GraphQL Code Generation

```bash
npm run codegen
```

## Styling Guidelines

### Theme-Agnostic Components

All library components **must use neutral, theme-agnostic styling**. No LCARS-specific or other theme-specific colors, fonts, or design language should appear in library code.

Components use **CSS custom properties (variables)** with neutral defaults, so host applications can apply their own theme via overrides.

**Pattern:**

```scss
// In the library component SCSS — neutral defaults
:host {
  --mm-component-bg: #f5f5f5;
  --mm-component-accent: #1976d2;
  --mm-component-text: #333333;
}

.my-element {
  background: var(--mm-component-bg);
  color: var(--mm-component-text);
}
```

```scss
// In the host application styles.scss — theme overrides
mm-my-component {
  --mm-component-bg: #394555;
  --mm-component-accent: #64ceb9;
  --mm-component-text: #ffffff;
}
```

### CSS Variable Naming Convention

All CSS custom properties follow the pattern `--mm-{component}-{property}`:

| Component | Prefix | Example |
|-----------|--------|---------|
| Login App Bar Section | `--mm-login-*` | `--mm-login-bg-start`, `--mm-login-accent` |
| Markdown Widget | `--mm-prose-*` | `--mm-prose-text`, `--mm-prose-heading` |
| Stats Grid Widget | `--mm-stat-{variant}-*` | `--mm-stat-mint-bg`, `--mm-stat-cyan-text` |
| Process Designer | `--designer-*` | `--designer-canvas-color`, `--designer-grid-color` |

### Important Notes

- Theme-specific styling (e.g., LCARS dark theme) is the responsibility of the consuming host application
- Host apps set overrides in their `styles.scss` by targeting the component selector
- Components rendered outside the component scope (e.g., Kendo popups) may need direct global styles in the host app in addition to CSS variable overrides

## Telerik/Kendo UI License Setup

This project uses **Kendo UI for Angular** (commercial, licensed by Progress/Telerik). A valid license is required for development and CI/CD builds.

The license is automatically activated via `scripts/setup-license.js` on `npm start` and `npm run build`.

### Local Development

1. Download your license key from [Telerik Account](https://www.telerik.com/account/your-products)
2. Set the `TELERIK_LICENSE` environment variable:

**macOS/Linux (Zsh):**
```bash
# Add to ~/.zshrc
export TELERIK_LICENSE="eyJhbGciOiJSUzI1NiIsInR5cCI6IlRlbGVyaWsgTGljZW5zZSBLZXkifQ..."
source ~/.zshrc
```

**Windows (PowerShell):**
```powershell
# Set permanently for current user
[Environment]::SetEnvironmentVariable("TELERIK_LICENSE", "eyJhbGciOiJSUzI1NiIsInR5cCI6IlRlbGVyaWsgTGljZW5zZSBLZXkifQ...", "User")
```

3. Verify: run `npm start` — the license will be set up automatically

### CI/CD (Azure DevOps)

1. Upload `telerik-license.txt` to Azure DevOps **Secure Files** (Project Settings > Pipelines > Library > Secure Files)
2. The pipeline downloads and sets `TELERIK_LICENSE` automatically via the setup template

### Security

- **Never commit** the license key to Git
- `kendo-ui-license.txt` and `telerik-license.txt` are in `.gitignore`
- In CI/CD, the license is stored as a Secure File

### Troubleshooting

If you see `TELERIK_LICENSE environment variable is not set!`:
1. Ensure the variable is set in your shell profile
2. Restart your terminal or run `source ~/.zshrc`
3. Verify with `echo $TELERIK_LICENSE`

If the license expires, download a new key from [Telerik Account](https://www.telerik.com/account/your-products) and update the environment variable.

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

## Demo Application

The `demo-app` project demonstrates usage of all libraries. Key files:

| File | Description |
|------|-------------|
| `app.config.ts` | Complete provider configuration |
| `app.routes.ts` | Route configuration with guards |
| `app.component.ts` | Main layout with navigation |
| `services/my-command-settings.service.ts` | Navigation menu configuration |
| `tenants/demos/message/` | Message service demo |

## Technology Stack

- **Angular 21** with standalone components and signals
- **Kendo UI for Angular 21** - UI components (commercial, requires [license](#telerikendo-ui-license-setup))
- **Apollo Angular** - GraphQL client
- **angular-oauth2-oidc** - OAuth2/OIDC
- **RxJS** - Reactive programming
- **ngx-markdown** - Markdown rendering

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
- [Kendo UI Licensing](https://www.telerik.com/kendo-angular-ui/components/licensing)
- [Apollo Angular](https://the-guild.dev/graphql/apollo-angular)
