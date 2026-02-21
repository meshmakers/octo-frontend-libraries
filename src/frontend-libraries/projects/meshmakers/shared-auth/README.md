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

### UI Components

#### LoginAppBarSectionComponent

A pre-built login/logout component for the app bar.

```typescript
import { LoginAppBarSectionComponent } from '@meshmakers/shared-auth';

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

## Build

```bash
npm run build:shared-auth
```

## Test

```bash
npm test -- --project=@meshmakers/shared-auth --watch=false
```
