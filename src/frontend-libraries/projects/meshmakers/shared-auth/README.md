# @meshmakers/shared-auth

OAuth2/OIDC authentication library for Angular applications using [angular-oauth2-oidc](https://github.com/manfredsteyer/angular-oauth2-oidc).

## Installation

```bash
npm install @meshmakers/shared-auth
```

## Quick Start

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideMmSharedAuth, authorizeInterceptor } from '@meshmakers/shared-auth';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authorizeInterceptor])),
    provideMmSharedAuth(),
  ]
};
```

```typescript
// app.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { AuthorizeService } from '@meshmakers/shared-auth';

@Component({...})
export class AppComponent implements OnInit {
  private readonly authorizeService = inject(AuthorizeService);

  async ngOnInit() {
    await this.authorizeService.initialize({
      issuer: 'https://your-identity-provider.com/',
      redirectUri: window.location.origin,
      clientId: 'your-client-id',
      scope: 'openid profile email',
      wellKnownServiceUris: ['https://api.your-service.com']
    });
  }
}
```

## API Reference

### AuthorizeService

The main service for authentication.

#### Signals (Recommended)

| Signal | Type | Description |
|--------|------|-------------|
| `isAuthenticated` | `Signal<boolean>` | Current authentication status |
| `user` | `Signal<IUser \| null>` | Current user information |
| `accessToken` | `Signal<string \| null>` | OAuth access token |
| `userInitials` | `Signal<string \| null>` | User initials (e.g., "JD") |
| `issuer` | `Signal<string \| null>` | OAuth issuer URL |
| `sessionLoading` | `Signal<boolean>` | Session loading state |
| `roles` | `Signal<string[]>` | User roles (computed) |

```typescript
// Usage in template
@if (authorizeService.isAuthenticated()) {
  <p>Welcome, {{ authorizeService.user()?.name }}</p>
}

// Usage in TypeScript
const isAuth = this.authorizeService.isAuthenticated();
const roles = this.authorizeService.roles();
```

#### Methods

| Method | Description |
|--------|-------------|
| `initialize(options)` | Initialize OAuth with configuration |
| `uninitialize()` | Clean up OAuth session |
| `login()` | Start OAuth login flow |
| `logout()` | Log out user |
| `isInRole(role)` | Check if user has specific role |
| `getAccessTokenSync()` | Get current access token synchronously |
| `getServiceUris()` | Get configured service URIs |

### Guards

Functional guards for route protection.

```typescript
import { authorizeGuard, authorizeMatchGuard } from '@meshmakers/shared-auth';

const routes: Routes = [
  // Basic authentication check
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authorizeGuard]
  },

  // With role requirement
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [authorizeGuard],
    data: { roles: ['AdminPanelManagement'] }
  },

  // Lazy-loaded module
  {
    path: 'reports',
    loadChildren: () => import('./reports/routes'),
    canMatch: [authorizeMatchGuard]
  }
];
```

| Guard | Type | Description |
|-------|------|-------------|
| `authorizeGuard` | `CanActivateFn` | Route activation with optional role check |
| `authorizeChildGuard` | `CanActivateFn` | Child route guard |
| `authorizeMatchGuard` | `CanMatchFn` | Lazy-load matching guard |
| `authorizeDeactivateGuard` | Function | Always allows deactivation |

### Interceptor

Automatically adds Bearer token to HTTP requests.

```typescript
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authorizeInterceptor } from '@meshmakers/shared-auth';

providers: [
  provideHttpClient(withInterceptors([authorizeInterceptor]))
]
```

The interceptor adds the `Authorization: Bearer <token>` header to:
- Same-origin requests (relative URLs)
- Requests to configured `wellKnownServiceUris`

It also recovers from an expired access token: when a request that carried a token
comes back `401`, the token is refreshed and the request is retried once with the new
bearer. The refresh is single-flight (concurrent 401s share one refresh), and a `401`
that arrives after that refresh already finished reuses its result instead of starting
another one. A retry is never itself retried. Requests without a token, the service health
report (`/health`, which needs the bearer since AB#6739 but is never refreshed on `401`) and the token
endpoint itself are left alone, and if the refresh fails the original `401` reaches the
caller.

### TenantTopologyService

`await inject(TenantTopologyService).load(rootTenantId)` returns which of the user's tenants lie below the app root
(`topologyLeaves`, `topologyDirectChildren`, `topologyTenantIds`) or a `topologyKnown: false` result with a reason; it
never throws. Map every unknown result to "token tenant only". See
[docs/README.md](docs/README.md#tenant-topology-ab7053).

### Error classification

`authorizationRefusal(error)` tells a `401` and a `403` apart on an error typed `unknown`,
so each host can phrase the outcome in its own words without writing that status check again.

```typescript
import { authorizationRefusal } from '@meshmakers/shared-auth';

switch (authorizationRefusal(error)) {
  case 'forbidden': return this.translate.instant('pipeline.forbidden');
  case 'unauthorized': return this.translate.instant('pipeline.unauthorized');
  default: return null;   // not an authorization problem — leave it to the caller
}
```

The status is read structurally and must be a `number`, so a rethrown error that lost its
`HttpErrorResponse` prototype still classifies, while a body that merely carries `"403"` does not.

### UI Components

#### LoginAppBarSectionComponent

A pre-built login/logout component for the app bar. Available via the secondary entry point `@meshmakers/shared-auth/login-ui` (requires Kendo UI).

```typescript
import { LoginAppBarSectionComponent } from '@meshmakers/shared-auth/login-ui';

@Component({
  imports: [LoginAppBarSectionComponent],
  template: `
    <mm-login-app-bar-section
      [showRegister]="true"
      (register)="onRegister()">
    </mm-login-app-bar-section>
  `
})
```

## Observability: session identity (AB#7327)

Opt-in: an app can tell its browser monitoring (Dash0 RUM) **who is signed in and on which tenant**. Apps that do
not opt in see no change, and `@dash0/sdk-web` is not required (it is an *optional* peer dependency used only by the
`@meshmakers/shared-auth/dash0` entry point).

```typescript
// app.config.ts — after the Dash0 SDK was initialised (init()) in main.ts
import { provideMmSharedAuth } from '@meshmakers/shared-auth';
import { provideDash0SessionIdentity } from '@meshmakers/shared-auth/dash0';

providers: [provideMmSharedAuth(), provideDash0SessionIdentity()]
```

| Attribute | Value |
|-----------|-------|
| `user.id` | `sub` claim |
| `user.name` | user name |
| `user.email` | e-mail address (omitted when the identity has none) |
| `octo.tenant.id` | tenant of the current access token (same key as the backend services) |

- **When:** set after sign-in and after every tenant switch (in-place token exchange and redirect fallback), only when
  the identity actually changed (a token refresh does not repeat it); cleared when the session ends (logout,
  `session_terminated`, `token_refresh_error`, cross-tab logout, the reset before a redirect tenant switch). The page
  load before sign-in stays anonymous.
- **Never breaks auth:** the sink is driven from one `effect()` over the user and token-tenant signals; an exception in
  it is caught and logged as one `console.warn` with a fixed text (no name, no e-mail).
- **Privacy:** name and e-mail are personal data and are sent to Dash0 (EU region). Only enable it in apps and
  environments where that is covered by the data protection information (decision 2026-10-22, AB#7326).
- **Other monitoring tools:** provide your own `SessionIdentitySink` (`{ set(identity), clear() }`) under the
  `SESSION_IDENTITY_SINK` token of the main entry point; the Dash0 adapter is just one implementation.

## Configuration Options

```typescript
interface AuthorizeOptions {
  issuer?: string;                    // Identity Provider URL
  redirectUri?: string;               // Redirect after login
  postLogoutRedirectUri?: string;     // Redirect after logout
  clientId?: string;                  // OAuth client ID
  scope?: string;                     // OAuth scopes
  showDebugInformation?: boolean;     // Enable debug logging
  sessionChecksEnabled?: boolean;     // Enable session checks
  wellKnownServiceUris?: string[];    // APIs that should receive auth token
}
```

## User Interface

```typescript
interface IUser {
  sub: string;                    // Subject (user ID)
  name: string;                   // Display name
  given_name: string | null;      // First name
  family_name: string | null;     // Last name
  email: string | null;           // Email address
  role: string[] | null;          // User roles
  idp: string;                    // Identity provider
}
```

## Roles

Pre-defined role constants:

```typescript
import { Roles } from '@meshmakers/shared-auth';

if (authorizeService.isInRole(Roles.AdminPanelManagement)) {
  // Admin access
}
```

`Roles.FileViewer` / `Roles.FileManagement` gate the platform file system (browse+download / manage),
next to `Roles.ReportingViewer` / `Roles.ReportingManagement` (AB#6171 decision D5). They are seeded by
`System.Identity.Bootstrap`; a one-off identity migration grants them to every holder of the matching
Reporting role.

## Detailed Documentation

See [docs/README.md](docs/README.md) for complete API reference with usage examples.

## Architecture

```
shared-auth/
├── src/                              # Main entry point (@meshmakers/shared-auth)
│   ├── public-api.ts
│   └── lib/
│       ├── authorize.service.ts      # Core OAuth2/OIDC service
│       ├── authorize.guard.ts        # Functional route guards
│       ├── authorize.interceptor.ts  # Functional HTTP interceptor
│       ├── roles.ts                  # Role enum
│       └── mm-login-app-bar-section/ # Component (internal, not exported)
│
└── login-ui/                         # Secondary entry point (@meshmakers/shared-auth/login-ui)
    └── src/
        ├── public-api.ts
        └── mm-login-app-bar-section/ # LoginAppBarSectionComponent (Kendo-dependent)
```

### Entry Points

| Entry Point | Import Path | Description |
|-------------|-------------|-------------|
| Main | `@meshmakers/shared-auth` | Core auth service, guards, interceptor (no Kendo dependency) |
| Login UI | `@meshmakers/shared-auth/login-ui` | LoginAppBarSectionComponent (requires Kendo UI) |
| Dash0 | `@meshmakers/shared-auth/dash0` | `provideDash0SessionIdentity()` (requires the optional peer `@dash0/sdk-web`) |

## Dependencies

- **Angular 21** (core, common/http, router)
- **angular-oauth2-oidc** v20 (OAuth2/OIDC client)
- **@progress/kendo-angular-*** (optional, only for login-ui entry point)

## Build & Test

```bash
# Build
npm run build:shared-auth

# Lint
npm run lint:shared-auth

# Run tests
npm run test:shared-auth
```

## Documentation and Testing Standards

- **All developer documentation must be written in English**
- **Every code change must include updated documentation** — update README.md, CLAUDE.md, docs/README.md, or inline docs when adding, modifying, or removing features
- **Unit tests and integration tests must be executed** after every code change
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features, components, or services are implemented
- Never commit code with failing tests
