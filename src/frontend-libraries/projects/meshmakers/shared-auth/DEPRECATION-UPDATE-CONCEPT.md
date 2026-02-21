# shared-auth Deprecation Update Concept

## Status: COMPLETED - DEPRECATED CODE REMOVED

All phases have been implemented and deprecated code has been removed.

| Phase | Status |
|-------|--------|
| Phase 1: Functional Guards | COMPLETED |
| Phase 2: Functional Interceptor | COMPLETED |
| Phase 3: Modern Control Flow | COMPLETED |
| Phase 4: Angular Signals | COMPLETED |
| Phase 5: Remove Deprecated Code | COMPLETED |

---

## Overview

This document outlines the migration from deprecated patterns to modern Angular patterns in `@meshmakers/shared-auth`.

**Angular Version**: 21.0.6
**angular-oauth2-oidc Version**: 20.0.2

---

## Current API

### AuthorizeService Signals

| Signal | Type | Description |
|--------|------|-------------|
| `isAuthenticated` | `Signal<boolean>` | User authentication status |
| `user` | `Signal<IUser \| null>` | Current user information |
| `accessToken` | `Signal<string \| null>` | OAuth access token |
| `userInitials` | `Signal<string \| null>` | User initials (e.g., "JD") |
| `issuer` | `Signal<string \| null>` | OAuth issuer URL |
| `sessionLoading` | `Signal<boolean>` | Session loading state |
| `roles` | `Signal<string[]>` | User roles (computed) |

### Functional Guards

| Guard | Type | Description |
|-------|------|-------------|
| `authorizeGuard` | `CanActivateFn` | Route activation guard |
| `authorizeChildGuard` | `CanActivateFn` | Child route guard |
| `authorizeMatchGuard` | `CanMatchFn` | Lazy-load matching guard |
| `authorizeDeactivateGuard` | Function | Deactivation guard (always true) |

### Functional Interceptor

| Interceptor | Type | Description |
|-------------|------|-------------|
| `authorizeInterceptor` | `HttpInterceptorFn` | Adds Bearer token to requests |

---

## Removed in Phase 5

The following deprecated APIs have been removed:

### Removed Classes
- `AuthorizeGuard` - Use functional guards instead
- `AuthorizeInterceptor` - Use `authorizeInterceptor` instead

### Removed Observable API
- `isAuthenticated$` - Use `isAuthenticated` signal
- `user$` - Use `user` signal
- `accessToken$` - Use `accessToken` signal
- `userInitials$` - Use `userInitials` signal
- `issuer$` - Use `issuer` signal
- `sessionLoading$` - Use `sessionLoading` signal
- `getRoles()` - Use `roles` signal

---

## Usage Examples

### Guards

```typescript
import { authorizeGuard, authorizeChildGuard } from '@meshmakers/shared-auth';

const routes: Routes = [
  {
    path: 'protected',
    component: ProtectedComponent,
    canActivate: [authorizeGuard],
    data: { roles: ['AdminPanelManagement'] }
  },
  {
    path: 'parent',
    canActivateChild: [authorizeChildGuard],
    children: [...]
  }
];
```

### Interceptor

```typescript
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authorizeInterceptor, provideMmSharedAuth } from '@meshmakers/shared-auth';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authorizeInterceptor])),
    provideMmSharedAuth(),
  ]
};
```

### Signal API

```typescript
// In templates
@if (authorizeService.isAuthenticated()) {
  <div>Welcome, {{ authorizeService.user()?.name }}</div>
}

// In TypeScript
const isAuth = this.authorizeService.isAuthenticated();
const roles = this.authorizeService.roles();

// With computed
showDashboard = computed(() => this.authorizeService.isAuthenticated());

// With effect
effect(() => {
  console.log('Auth status:', this.authorizeService.isAuthenticated());
});
```

---

## References

- [Angular Functional Guards](https://angular.dev/guide/routing/route-guards#functional-guards)
- [Angular Functional Interceptors](https://angular.dev/guide/http/interceptors#functional-interceptors)
- [Angular Control Flow](https://angular.dev/guide/templates/control-flow)
- [Angular Signals](https://angular.dev/guide/signals)
