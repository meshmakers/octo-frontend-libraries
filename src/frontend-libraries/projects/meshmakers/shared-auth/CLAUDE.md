# shared-auth Library Guidelines

## Overview

The `@meshmakers/shared-auth` library provides OAuth2/OIDC authentication for Angular applications using `angular-oauth2-oidc`. It exposes auth state via Angular Signals, uses functional guards and a functional interceptor (modern Angular 22 patterns).

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

### Discovery-Document Resilience

`AuthorizeService.initialize()` wraps `oauthService.loadDiscoveryDocumentAndTryLogin()` in a bounded exponential-backoff retry loop (defaults: 6 attempts, 1500 ms initial delay, 30 s cap). This covers the brief window during which the Identity service is unreachable after a redeploy — the symptom is otherwise reported by the browser as a CORS error (the ingress error page carries no `Access-Control-Allow-Origin` header), which is why a plain network-error catch upstream wouldn't help.

After the full budget is exhausted, the final error is rethrown **and** stored in `discoveryDocumentError` (`Signal<Error | null>`). Hosts can render a recovery screen and call `retryDiscoveryDocument()` to force another attempt.

The service also listens for `visibilitychange`: if the tab returns from the background while `discoveryDocumentError` is set, initialization is retried automatically with the last `AuthorizeOptions`. This catches the common case where the user switches tabs during a deploy and comes back to a stale loading icon.

Configure via `AuthorizeOptions.discoveryDocumentRetry: { attempts, initialDelayMs, maxDelayMs }` if a host needs a different policy.

### Cross-Tab Logout

The service detects logout from other tabs via:
1. **Storage events** — Listens for `localStorage` changes (token removal)
2. **BroadcastChannel API** — For iframe-based Single Logout (SLO)

### Token Injection Security

The interceptor only adds tokens to:
- **Same-origin requests** (relative URLs)
- **Known service URIs** (configured in `AuthorizeOptions.wellKnownServiceUris`)

External/unknown URLs never receive the token.

Matching is a prefix test, so **blank entries are skipped** — a host that leaves an
unset URL in its allow-list would otherwise match every URL and hand the operator's token to
every origin the app calls, telemetry included. The guard lives here rather than in each app,
because that is where the matching happens; apps do not need their own falsy filter.

For the same reason the prefix must end on a boundary (`/`, `?`, `#`, or end of string).
A bare `startsWith` also accepts `https://api.example.com.attacker.test`, a host anyone can
register, and hands it the operator's bearer. Entries that already end in `/` match as they
are, which is what `meshmakers-app` relies on: it normalises the issuer with `withSlash()`
and builds `{issuer}{tenantId}/v1/users/getPaged` by concatenation.

### Refresh and Retry on 401

A request the interceptor attached a token to and that comes back `401` triggers
`AuthorizeService.refreshAccessToken()` and is then retried once with the new bearer.
This is the only 401 recovery path in the stack — apps must not add their own, so that
pipeline calls behave exactly like every other authenticated call (AB#4185).

Two non-obvious properties:

- **Single-flight:** the in-flight refresh promise lives at module level (cleared in a
  `finally`), so ten parallel 401s cause one refresh. Per-request refreshes would spend one
  grant each. They would **not** end the session — that is true only for a client whose
  `RefreshTokenUsage` is `OneTimeOnly`, and ours inherit Duende's `ReUse` default because
  nothing in octo-identity-services sets the property (the CK attribute has no default and
  reaches Duende through AutoMapper's by-name convention, so grep finds no C# writing it).
  That covers only the window while the refresh runs, so there is a second guard: a 401 that
  lands **after** the refresh finished is retried with the token already in the service
  instead of triggering another one. Its failure is explained by the token that has since
  been replaced, so a fresh grant would only buy the same answer.
- **At most one retry, without a counter:** the retry goes out via `next()`, which
  continues down the chain instead of re-entering the interceptor. Do not add retry
  bookkeeping unless re-entry is actually proven.

Never retried: requests without a token, and the token endpoint itself
(`/connect/token`), matched on the path with query string, fragment and trailing slashes
stripped. Letting one through does not recurse loudly — it deadlocks silently: the refresh
posts to that endpoint through this chain, so the single-flight promise waits on itself,
never settles, never runs its `finally`, and every later 401 in the page then awaits a
promise that cannot resolve. **Therefore `refreshAccessToken()` must issue no other
`HttpClient` call**; `loadUserProfile()` and `loadJwks()` (reachable via `loadKeys` if the
default `NullValidationHandler` is ever replaced) would reproduce the same cycle on their
own URLs. A refresh that fails, or that yields no new token, rethrows the **original**
`HttpErrorResponse`, because hosts classify `401`/`403` to choose their user-facing
message. The library shows no UI: the `token_refresh_error` handler in `AuthorizeService`
clears the session and reloads.

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

- **Angular 22** (core, common/http, router)
- **angular-oauth2-oidc** v22 (OAuth2/OIDC client)
- **@progress/kendo-angular-buttons, -indicators, -layout, -popup** (optional, only for login-ui)
