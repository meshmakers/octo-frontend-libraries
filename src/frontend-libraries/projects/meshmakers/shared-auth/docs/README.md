# @meshmakers/shared-auth

Angular library for OAuth2/OIDC authentication with OpenID Connect support.

## Table of Contents

- [Installation](#installation)
- [Setup](#setup)
- [Services](#services)
  - [AuthorizeService](#authorizeservice)
- [Guards](#guards)
- [Interceptor](#interceptor)
- [Components](#components)
  - [LoginAppBarSectionComponent](#loginappbarsectioncomponent)
- [Roles](#roles)
- [Examples](#examples)

## Installation

The library is part of the meshmakers monorepo. It has two entry points:

```typescript
// Core auth (no Kendo dependency)
import {
  AuthorizeService,
  authorizeGuard,
  authorizeInterceptor,
  provideMmSharedAuth,
  AuthorizeOptions,
  IUser,
  Roles
} from '@meshmakers/shared-auth';

// UI component (requires Kendo UI)
import { LoginAppBarSectionComponent } from '@meshmakers/shared-auth/login-ui';
```

## Setup

### Using Provider Function (Recommended)

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

### Initialize in App Component

```typescript
// app.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { AuthorizeService, AuthorizeOptions } from '@meshmakers/shared-auth';

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

@Component({...})
export class AppComponent implements OnInit {
  private readonly authorizeService = inject(AuthorizeService);

  async ngOnInit() {
    await this.authorizeService.initialize(authorizeOptions);
  }
}
```

## Services

### AuthorizeService

The main authentication service that handles OAuth2/OIDC flows.

#### Signals

All auth state is exposed via Angular Signals for reactive, synchronous access:

| Signal | Type | Description |
|--------|------|-------------|
| `isAuthenticated` | `Signal<boolean>` | Current authentication status |
| `user` | `Signal<IUser \| null>` | Current user information |
| `accessToken` | `Signal<string \| null>` | OAuth access token |
| `userInitials` | `Signal<string \| null>` | User initials (e.g., "JD") |
| `issuer` | `Signal<string \| null>` | OAuth issuer URL |
| `sessionLoading` | `Signal<boolean>` | Session loading state |
| `roles` | `Signal<string[]>` | User roles (computed) |

#### Methods

| Method | Description |
|--------|-------------|
| `initialize(options: AuthorizeOptions)` | Initialize the OAuth client |
| `uninitialize()` | Clean up and stop token refresh |
| `login()` | Redirect to identity provider for login |
| `logout()` | Log out and clear tokens |
| `isInRole(role: Roles)` | Check if user has a specific role |
| `getAccessTokenSync()` | Get current access token synchronously |
| `getServiceUris()` | Get configured service URIs for token injection |

#### Usage Example

```typescript
import { Component, inject, computed, effect } from '@angular/core';
import { AuthorizeService, Roles } from '@meshmakers/shared-auth';

@Component({
  selector: 'app-user-info',
  template: `
    @if (authorizeService.isAuthenticated()) {
      <p>Welcome, {{ authorizeService.user()?.name }}</p>
      @if (isAdmin()) {
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

  // Computed signal for role check
  isAdmin = computed(() =>
    this.authorizeService.roles().includes('AdminPanelManagement')
  );

  // Effect for reacting to auth changes
  constructor() {
    effect(() => {
      console.log('Auth status:', this.authorizeService.isAuthenticated());
    });
  }

  login(): void {
    this.authorizeService.login();
  }

  logout(): void {
    this.authorizeService.logout();
  }
}
```

## Guards

Functional route guards for authentication and role-based access control.

| Guard | Type | Description |
|-------|------|-------------|
| `authorizeGuard` | `CanActivateFn` | Route activation with optional role check |
| `authorizeChildGuard` | `CanActivateFn` | Child route guard |
| `authorizeMatchGuard` | `CanMatchFn` | Lazy-load matching guard |
| `authorizeDeactivateGuard` | Function | Deactivation guard (always true) |

### Features

- Redirects unauthenticated users to login
- Supports role-based route protection via `route.data['roles']`
- Works with `canActivate`, `canActivateChild`, and `canMatch`

### Usage Example

```typescript
import { Routes } from '@angular/router';
import { authorizeGuard, authorizeMatchGuard, Roles } from '@meshmakers/shared-auth';

export const routes: Routes = [
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
    data: { roles: [Roles.AdminPanelManagement] }
  },

  // Protect all child routes
  {
    path: 'tenant/:tenantId',
    component: TenantComponent,
    canActivateChild: [authorizeGuard],
    children: [
      { path: 'settings', component: SettingsComponent },
      { path: 'users', component: UsersComponent }
    ]
  },

  // Lazy-loaded module (authentication only, no role check)
  {
    path: 'reports',
    loadChildren: () => import('./reports/routes'),
    canMatch: [authorizeMatchGuard]
  }
];
```

## Interceptor

Functional HTTP interceptor that automatically adds Bearer tokens to requests.

### Behavior

- Adds `Authorization: Bearer <token>` header to:
  - Same-origin requests (relative URLs)
  - Requests to configured `wellKnownServiceUris`
- Does NOT add tokens to external/unknown URLs (security measure)

### Setup

```typescript
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authorizeInterceptor } from '@meshmakers/shared-auth';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authorizeInterceptor]))
  ]
};
```

### Service URIs

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

**Important:** This component is available via the secondary entry point `@meshmakers/shared-auth/login-ui` because it depends on Kendo UI components. The core auth library has no Kendo dependency.

#### Import

```typescript
import { LoginAppBarSectionComponent } from '@meshmakers/shared-auth/login-ui';
```

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
- Optional registration button
- Displays user avatar with initials when authenticated
- Popup menu with logout and profile management options
- Loading indicator during session restoration
- Keyboard accessible (ESC to close popup)
- Theme-agnostic styling via CSS custom properties

#### Usage Example

```typescript
import { Component } from '@angular/core';
import { LoginAppBarSectionComponent } from '@meshmakers/shared-auth/login-ui';
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

#### CSS Custom Properties

Override these variables in the host application to theme the component:

```scss
mm-login-app-bar-section {
  --mm-login-bg-start: #394555;
  --mm-login-bg-end: #1f2e40;
  --mm-login-accent: #64ceb9;
  --mm-login-accent-rgb: 100, 206, 185;
  --mm-login-text: #ffffff;
  --mm-login-btn-primary-start: #64ceb9;
  --mm-login-btn-primary-end: #4db8a4;
  --mm-login-btn-primary-text: #07172b;
  --mm-login-font: var(--my-app-font);
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

## AuthorizeOptions Reference

```typescript
interface AuthorizeOptions {
  issuer?: string;                    // Identity Provider URL
  redirectUri?: string;               // Redirect after login
  postLogoutRedirectUri?: string;     // Redirect after logout
  clientId?: string;                  // Client ID registered with IdP
  scope?: string;                     // OAuth scopes to request
  showDebugInformation?: boolean;     // Enable console logging
  sessionChecksEnabled?: boolean;     // Enable session checks
  wellKnownServiceUris?: string[];    // External APIs that should receive tokens
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
