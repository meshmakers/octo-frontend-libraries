# @meshmakers/shared-auth

Angular library for OAuth2/OIDC authentication with OpenID Connect support.

## Table of Contents

- [Installation](#installation)
- [Setup](#setup)
- [Services](#services)
  - [AuthorizeService](#authorizeservice)
  - [AuthorizeGuard](#authorizeguard)
  - [AuthorizeInterceptor](#authorizeinterceptor)
- [Components](#components)
  - [LoginAppBarSectionComponent](#loginappbarsectioncomponent)
- [Roles](#roles)
- [Examples](#examples)

## Installation

The library is part of the meshmakers monorepo. Import it from `@meshmakers/shared-auth`.

```typescript
import {
  AuthorizeService,
  AuthorizeGuard,
  AuthorizeInterceptor,
  LoginAppBarSectionComponent,
  AuthorizeOptions,
  Roles
} from '@meshmakers/shared-auth';
```

## Setup

### 1. Configure Providers in `app.config.ts`

```typescript
import { ApplicationConfig, provideAppInitializer, inject } from '@angular/core';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AuthorizeService, AuthorizeInterceptor, AuthorizeOptions } from '@meshmakers/shared-auth';

// Define your authorization options
const authorizeOptions: AuthorizeOptions = {
  issuer: 'https://your-identity-server.com/',
  redirectUri: window.location.origin + '/',
  postLogoutRedirectUri: window.location.origin + '/',
  clientId: 'your-client-id',
  scope: 'openid profile email offline_access',
  showDebugInformation: true,
  sessionChecksEnabled: true,
  wellKnownServiceUris: [
    'https://api.your-service.com'
  ]
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    AuthorizeService,
    { provide: HTTP_INTERCEPTORS, useClass: AuthorizeInterceptor, multi: true },
    provideAppInitializer(initAuth)
  ]
};

async function initAuth(): Promise<void> {
  const authorizeService = inject(AuthorizeService);
  await authorizeService.initialize(authorizeOptions);
}
```

### 2. Alternative: Use Provider Function

```typescript
import { provideMmSharedAuth } from '@meshmakers/shared-auth';

export const appConfig: ApplicationConfig = {
  providers: [
    provideMmSharedAuth(),
    // ... other providers
  ]
};
```

## Services

### AuthorizeService

The main authentication service that handles OAuth2/OIDC flows.

#### Properties (Observables)

| Property | Type | Description |
|----------|------|-------------|
| `isAuthenticated` | `Observable<boolean>` | Whether the user is authenticated |
| `user` | `Observable<IUser \| null>` | Current user information |
| `userInitials` | `Observable<string \| null>` | User initials (e.g., "JD" for John Doe) |
| `accessToken` | `Observable<string \| null>` | Current access token |
| `issuer` | `Observable<string \| null>` | Identity provider URL |
| `sessionLoading` | `Observable<boolean>` | Whether session is being restored |

#### Methods

| Method | Description |
|--------|-------------|
| `initialize(options: AuthorizeOptions)` | Initialize the OAuth client |
| `uninitialize()` | Clean up and stop token refresh |
| `login()` | Redirect to identity provider for login |
| `logout()` | Log out and clear tokens |
| `isInRole(role: Roles)` | Check if user has a specific role |
| `getRoles()` | Get observable of user's roles |
| `getServiceUris()` | Get configured service URIs for token injection |

#### Usage Example

```typescript
import { Component, inject } from '@angular/core';
import { AuthorizeService, Roles } from '@meshmakers/shared-auth';

@Component({
  selector: 'app-user-info',
  template: `
    @if (authorizeService.isAuthenticated | async) {
      <p>Welcome, {{ (authorizeService.user | async)?.name }}</p>
      @if (isAdmin) {
        <button (click)="openAdminPanel()">Admin Panel</button>
      }
      <button (click)="logout()">Logout</button>
    } @else {
      <button (click)="login()">Login</button>
    }
  `
})
export class UserInfoComponent {
  protected readonly authorizeService = inject(AuthorizeService);

  get isAdmin(): boolean {
    return this.authorizeService.isInRole(Roles.AdminPanelManagement);
  }

  login(): void {
    this.authorizeService.login();
  }

  logout(): void {
    this.authorizeService.logout();
  }
}
```

### AuthorizeGuard

Route guard that protects routes and enforces role-based access.

#### Features

- Redirects unauthenticated users to login
- Supports role-based route protection
- Works with `canActivate` and `canActivateChild`

#### Usage Example

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { AuthorizeGuard, Roles } from '@meshmakers/shared-auth';

export const routes: Routes = [
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthorizeGuard]  // Requires authentication
  },
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [AuthorizeGuard],
    data: {
      roles: [Roles.AdminPanelManagement]  // Requires specific role
    }
  },
  {
    path: 'tenant/:tenantId',
    component: TenantComponent,
    canActivateChild: [AuthorizeGuard],  // Protect all child routes
    children: [
      { path: 'settings', component: SettingsComponent },
      { path: 'users', component: UsersComponent }
    ]
  }
];
```

### AuthorizeInterceptor

HTTP interceptor that automatically adds Bearer tokens to requests.

#### Behavior

- Adds `Authorization: Bearer <token>` header to:
  - Same-origin requests (relative URLs)
  - Requests to configured `wellKnownServiceUris`
- Does NOT add tokens to external/unknown URLs (security measure)

#### Configuration

```typescript
// app.config.ts
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthorizeInterceptor } from '@meshmakers/shared-auth';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthorizeInterceptor, multi: true }
  ]
};
```

#### Service URIs

Configure which external services should receive tokens:

```typescript
const authorizeOptions: AuthorizeOptions = {
  // ... other options
  wellKnownServiceUris: [
    'https://api.example.com',
    'https://graphql.example.com/v1'
  ]
};
```

## Components

### LoginAppBarSectionComponent

Pre-built login/logout UI component for application bars.

#### Selector

```html
<mm-login-app-bar-section></mm-login-app-bar-section>
```

#### Inputs

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `showRegister` | `boolean` | `false` | Show registration button |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| `register` | `EventEmitter<void>` | Emitted when register button is clicked |

#### Features

- Shows login button when unauthenticated
- Displays user avatar with initials when authenticated
- Popup menu with logout and profile management options
- Loading indicator during session restoration
- Keyboard accessible (ESC to close popup)

#### Usage Example

```typescript
// app.component.ts
import { Component } from '@angular/core';
import { LoginAppBarSectionComponent } from '@meshmakers/shared-auth';
import { AppBarComponent, AppBarSectionComponent } from '@progress/kendo-angular-navigation';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    AppBarComponent,
    AppBarSectionComponent,
    LoginAppBarSectionComponent
  ],
  template: `
    <kendo-appbar>
      <kendo-appbar-section>
        <h1>My Application</h1>
      </kendo-appbar-section>

      <kendo-appbar-spacer></kendo-appbar-spacer>

      <kendo-appbar-section>
        <mm-login-app-bar-section
          [showRegister]="true"
          (register)="onRegister()">
        </mm-login-app-bar-section>
      </kendo-appbar-section>
    </kendo-appbar>
  `
})
export class AppComponent {
  onRegister(): void {
    // Handle registration
  }
}
```

## Roles

Predefined roles for role-based access control:

```typescript
import { Roles } from '@meshmakers/shared-auth';

enum Roles {
  ReportingManagement = 'ReportingManagement',
  ReportingViewer = 'ReportingViewer',
  AdminPanelManagement = 'AdminPanelManagement',
  BotManagement = 'BotManagement',
  UserManagement = 'UserManagement',
  CommunicationManagement = 'CommunicationManagement',
  TenantManagement = 'TenantManagement',
  Development = 'Development'
}
```

## Examples

### Complete Setup (from template-app)

See `projects/template-app/src/app/app.config.ts` for a complete configuration example including:

- OAuth configuration with identity server
- HTTP interceptor setup
- App initialization with authentication

### Route Protection

See `projects/template-app/src/app/app.routes.ts` for route guard examples.

### App Bar Integration

See `projects/template-app/src/app/app.component.ts` for login component integration.

## AuthorizeOptions Reference

```typescript
interface AuthorizeOptions {
  // Identity Provider URL
  issuer?: string;

  // Redirect after login
  redirectUri?: string;

  // Redirect after logout
  postLogoutRedirectUri?: string;

  // Client ID registered with IdP
  clientId?: string;

  // OAuth scopes to request
  scope?: string;

  // Enable console logging
  showDebugInformation?: boolean;

  // Enable session checks
  sessionChecksEnabled?: boolean;

  // External APIs that should receive tokens
  wellKnownServiceUris?: string[];
}
```

## IUser Interface

```typescript
interface IUser {
  family_name: string | null;
  given_name: string | null;
  name: string;
  role: string[] | null;
  sub: string;          // Subject (unique user ID)
  idp: string;          // Identity Provider
  email: string | null;
}
```
