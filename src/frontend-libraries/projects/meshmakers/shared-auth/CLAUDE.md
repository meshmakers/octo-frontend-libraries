# shared-auth Library Guidelines

## Overview

The `@meshmakers/shared-auth` library provides OAuth2/OIDC authentication for Angular applications using `angular-oauth2-oidc`. It exposes auth state via Angular Signals, uses functional guards and a functional interceptor (modern Angular 21 patterns).

## Build Commands

```bash
# From frontend-libraries directory
npm run build:shared-auth

# Run tests
npm test -- --project=@meshmakers/shared-auth --watch=false

# Run lint
npm run lint:shared-auth
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
shared-auth/
├── src/                              # Main entry point
│   ├── public-api.ts                 # Exports: AuthorizeService, guards, interceptor, models
│   └── lib/
│       ├── authorize.service.ts      # Core OAuth2/OIDC service (Signals-based)
│       ├── authorize.guard.ts        # Functional route guards
│       ├── authorize.interceptor.ts  # Functional HTTP interceptor
│       ├── roles.ts                  # Roles enum
│       └── mm-login-app-bar-section/ # Component copy (NOT exported from main)
│
├── login-ui/                         # Secondary entry point (Kendo-dependent)
│   └── src/
│       ├── public-api.ts             # Exports: LoginAppBarSectionComponent
│       └── mm-login-app-bar-section/ # Login UI component
│
├── docs/
│   └── README.md                     # Detailed API reference
├── DEPRECATION-UPDATE-CONCEPT.md     # Migration history (all phases completed)
└── README.md                         # Quick start and overview
```

## Key Architecture Decisions

### Two Entry Points

The library has two entry points to keep Kendo UI as an optional dependency:

- **`@meshmakers/shared-auth`** — Core auth (no Kendo dependency). Services, guards, interceptor.
- **`@meshmakers/shared-auth/login-ui`** — UI component (requires Kendo). `LoginAppBarSectionComponent`.

The `LoginAppBarSectionComponent` exists in both `src/lib/` and `login-ui/src/` but is only exported from the secondary entry point. The copy in `src/lib/` is NOT exported via `public-api.ts`.

### Signals (Not Observables)

All auth state is exposed via Angular Signals (not Observables). The deprecated Observable API (`isAuthenticated$`, `user$`, etc.) was removed in the deprecation Phase 5. See `DEPRECATION-UPDATE-CONCEPT.md` for history.

### Functional Guards and Interceptor

All guards and the interceptor are functional (not class-based):
- `authorizeGuard` (CanActivateFn)
- `authorizeChildGuard` (CanActivateFn)
- `authorizeMatchGuard` (CanMatchFn)
- `authorizeInterceptor` (HttpInterceptorFn)

The deprecated class-based `AuthorizeGuard` and `AuthorizeInterceptor` were removed.

### Cross-Tab Logout

The service detects logout from other tabs via:
1. **Storage events** — Listens for `localStorage` changes (token removal)
2. **BroadcastChannel API** — For iframe-based Single Logout (SLO)

### Token Injection Security

The interceptor only adds tokens to:
- **Same-origin requests** (relative URLs)
- **Known service URIs** (configured in `AuthorizeOptions.wellKnownServiceUris`)

External/unknown URLs never receive the token.

## Styling

The `LoginAppBarSectionComponent` uses CSS custom properties with neutral defaults. Host applications override these to apply their theme:

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

**Important:** The `.buttons` container uses `flex-direction: column` (vertical layout). Do not change to row.

## Dependencies

- **Angular 21** (core, common/http, router)
- **angular-oauth2-oidc** v20 (OAuth2/OIDC client)
- **@progress/kendo-angular-buttons, -indicators, -layout, -popup** (optional, only for login-ui)
