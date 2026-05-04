# Octo Branding — Integration Guide

Per-tenant branding (logo, app title, color palette, light/dark mode) backed
by the `SystemUIBranding` Construction-Kit runtime entity. Library mirrors
the maco-app reference implementation; this document is the migration recipe
when wiring `@meshmakers/octo-ui`'s branding feature into a host app.

> **Audience:** Claude Code agents (and human devs) bootstrapping the
> branding feature in a fresh Angular host. Steps are ordered, copy-paste
> ready, and intentionally explicit about *why* each piece exists — most
> failures stem from skipping a step that looks redundant.

## At a glance — what `provideOctoBranding` gives you

| Surface | Owner |
|---|---|
| `<mm-theme-switcher>` standalone component | library |
| Logo rendering — host `<img>` bound to `BrandingDataSource.branding().headerLogoUrl` (no library component) | host |
| `SettingsPageComponent` mounted via `BRANDING_ROUTES` | library |
| `BrandingDataSource` (signal-based GraphQL CRUD), `ThemeService`, `BrandingApplicationService`, `AppTitleService` (TitleStrategy) | library |
| Inline writes to `--kendo-color-primary/secondary/tertiary/base/app-surface/...`, `--app-header-gradient-*`, `--app-footer-*` on `<html>` | library (`BrandingApplicationService`) |
| Surface ladder aliases (`--kendo-color-surface`, `-surface-alt`, `-base-subtle*`, `-border*`) on top of the surface var | **host `styles.scss`** |
| Kendo theme module imports (Grid/Card/Dialog/Forms/etc. — anything beyond what `octo-ui` already loads) | **host `styles.scss`** |
| Shell layout (header / footer / nav / drawer) — host composes its own and binds to the CSS vars below | **host components** |
| Auth-aware `BrandingDataSource.load()` trigger | **host `AppComponent`** |
| Bundled fallback assets (logo, favicon) | **host config** |
| `BrandingSettingsMessages` strings (the Settings page's only required input) | **host i18n** |

---

## Import paths — use the secondary entry points

The branding feature ships as **two** secondary ng-package entries; the host
chooses which to import from based on where the symbols are loaded:

| Path | Contents | When to use |
|---|---|---|
| `@meshmakers/octo-ui/branding` | `BrandingDataSource`, `BrandingApplicationService`, `ThemeService`, `AppTitleService`, `<mm-theme-switcher>`, `provideOctoBranding`, `OCTO_BRANDING_DEFAULTS`, `OCTO_BRANDING_FALLBACK_ASSETS`, `OCTO_TITLE_TRANSLATOR`, `NEUTRAL_BRANDING_DEFAULTS`, `BrandingData`, `ThemePalette`, `BrandingUpdate`, … | **Eager** imports in `app.config.ts`, `app.component.ts`, header/footer/menu/login-panel/error-panel components |
| `@meshmakers/octo-ui/branding-settings` | `SettingsPageComponent`, `BrandingSettingsMessages`, `BRANDING_ROUTES` | **Lazy** import in the host's `/settings` route wrapper |

> **Always import from the secondary entries.** The primary
> `@meshmakers/octo-ui` does **not** re-export branding symbols — branding
> lives in its own FESM so consumers don't pay for `RuntimeBrowser`,
> `FieldFilterEditor`, `AttributeSelectors`, `PropertyGrid`, … just to get
> a theme switcher. In maco-app this split shrunk the initial bundle from
> **5.6 MB → 2.3 MB**. The snippets below already use the correct paths.

The library does **not** ship a `<mm-theme-header>` / `<mm-theme-footer>`
component — shell composition (drawer, search bar, version chip,
notifications, language switcher, …) is too app-specific to template
generically. Hosts compose their own shell and bind directly to the CSS
custom properties the library writes (see Step 6 below).

The library does **not** load branding from the backend automatically — the
GraphQL URI bakes in the tenant ID at first-request time, so loading before
authentication settles targets `/tenants/undefined/GraphQL`. The host owns
the auth-aware trigger.

---

## Step 1 — Register providers in `app.config.ts`

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideOctoBranding } from '@meshmakers/octo-ui/branding';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...existing providers (router, http, apollo, auth, etc.)...

    provideOctoBranding({
      defaults: {
        appName: 'TecLink',
        appTitle: 'TecLink',
        lightTheme: {
          primaryColor: '#007dc5',
          secondaryColor: '#5ac4be',
          tertiaryColor: '#0b5c92',
          neutralColor: '#64748b',
          backgroundColor: '#ffffff',
          headerGradient: { startColor: '#ffffff', endColor: '#f1f5f9' },
          footerGradient: { startColor: '#007dc5', endColor: '#5ac4be' },
        },
        // Pass `darkTheme: null` to publish a single-theme tenant; the theme
        // switcher will be locked to light. Otherwise repeat the palette.
        darkTheme: {
          primaryColor: '#007dc5',
          secondaryColor: '#5ac4be',
          tertiaryColor: '#0b5c92',
          neutralColor: '#94a3b8',
          backgroundColor: '#0d1b17',
          headerGradient: { startColor: '#0d1b17', endColor: '#152822' },
          footerGradient: { startColor: '#007dc5', endColor: '#5ac4be' },
        },
      },
      fallbackAssets: {
        headerLogo: '/maco-logo.svg',
        footerLogo: '/maco-logo.svg',
        favicon: '/favicon.ico',
      },
    }),
  ],
};
```

`provideOctoBranding` registers `OCTO_BRANDING_DEFAULTS`,
`OCTO_BRANDING_FALLBACK_ASSETS`, and binds `AppTitleService` as the app's
`TitleStrategy`. Pass `registerTitleStrategy: false` if the host already
owns title composition.

The factory deep-merges your `defaults` over `NEUTRAL_BRANDING_DEFAULTS`, so
omitted fields fall through to library defaults (Kendo Default tomato).

---

## Step 2 — Drive the load from the shell component

In whichever long-lived component anchors your shell (typically
`AppComponent`), inject `BrandingApplicationService` once for its
apply-effect side-effect, then trigger `load()` from an effect that watches
auth state:

```typescript
import { Component, effect, inject } from '@angular/core';
import { AuthorizeService } from '@meshmakers/shared-auth';
import {
  BrandingApplicationService,
  BrandingDataSource,
} from '@meshmakers/octo-ui/branding';

@Component({ /* ... */ })
export class AppComponent {
  private readonly auth = inject(AuthorizeService);
  private readonly branding = inject(BrandingDataSource);
  private loadTriggered = false;

  constructor() {
    inject(BrandingApplicationService); // activate the apply effect
    effect(() => {
      if (this.auth.isAuthenticated() && !this.loadTriggered) {
        this.loadTriggered = true;
        this.branding.load().catch((e) =>
          console.error('[AppComponent] Initial branding load failed', e),
        );
      }
    });
  }
}
```

> **Why:** `provideAppInitializer` would fire before auth settles. If your
> host shells per-tenant Apollo creation in a different component (e.g. a
> `TenantComponent` keyed by `:tenantId`), set `loadTriggered = false` again
> on tenant change so a re-login picks up the new tenant's branding.

---

## Step 3 — Mount the Settings page

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { BRANDING_ROUTES } from '@meshmakers/octo-ui/branding-settings';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  // ...
  {
    path: 'settings',
    canActivate: [adminGuard],
    children: BRANDING_ROUTES,
  },
];
```

`BRANDING_ROUTES` is a single `loadComponent` route at `path: ''` resolving
to `SettingsPageComponent`. Always wrap it in an admin guard — the page
mutates the tenant-wide branding entity.

---

## Step 4 — Compose your shell template (host-side)

Drop `<mm-theme-switcher>` into your existing header/footer/menu wherever it
belongs — it reads directly from `ThemeService`. Bind your shell chrome to
the CSS custom properties the library updates on `<html>` (full list in
Step 7).

The logo is **not** a library component — render an `<img>` bound to
`BrandingDataSource` directly. The host owns sizing, layout, classes, and
the fallback asset:

```ts
// header.component.ts
import { Component, computed, inject } from '@angular/core';
import { BrandingDataSource } from '@meshmakers/octo-ui/branding';

const FALLBACK_LOGO = '/your-logo.svg';

@Component({ /* ... */ })
export class HeaderComponent {
  private readonly branding = inject(BrandingDataSource);

  protected readonly logoUrl = computed(
    () => this.branding.branding().headerLogoUrl ?? FALLBACK_LOGO,
  );
}
```

```html
<!-- header.component.html -->
<header class="my-shell-header">
  <button kendoButton fillMode="flat" (click)="drawer.toggle()">
    <kendo-svg-icon [icon]="menuIcon" />
  </button>
  <my-search-bar />
  <app-login-panel />
  <mm-theme-switcher />

  <a [routerLink]="homeUrl()" aria-label="Home">
    <img [src]="logoUrl()" alt="" class="header-logo" />
  </a>
</header>

<router-outlet />

<footer class="my-shell-footer">
  <img [src]="footerLogoUrl()" alt="" class="footer-logo" />
</footer>
```

```scss
.my-shell-header {
  background: linear-gradient(
    to right,
    var(--app-header-gradient-start),
    var(--app-header-gradient-end)
  );
  color: var(--app-header-text);
}

.my-shell-footer {
  background: linear-gradient(
    to right,
    var(--app-footer-gradient-start),
    var(--app-footer-gradient-end)
  );
  color: var(--app-footer-text);
}

/* Size the logo wherever you mount it — the library doesn't impose presets. */
.header-logo {
  display: block;
  max-height: 48px;
  max-width: 192px;
  height: auto;
  width: auto;
}
```

For the footer position, read `footerLogoUrl` (and fall back to
`headerLogoUrl` yourself if you want a single-asset tenant to share).

---

## Step 5 — Provide `BrandingSettingsMessages` for the Settings page

`SettingsPageComponent` has no built-in i18n — it requires a populated
`BrandingSettingsMessages` object. Build a small wrapper component that
sources strings from your translation system:

```typescript
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import {
  BrandingSettingsMessages,
  SettingsPageComponent,
} from '@meshmakers/octo-ui/branding-settings';

@Component({
  selector: 'app-branding-settings-page',
  imports: [SettingsPageComponent],
  template: `<mm-branding-settings [messages]="messages()" />`,
})
export class BrandingSettingsPage {
  private readonly t = inject(TranslateService);

  // `t.onLangChange` fires AFTER the new translation file has been loaded —
  // unlike a synchronous "current language" signal that flips the moment
  // the user clicks a language (before `translate.use()` resolves).
  // Bridging through `toSignal` guarantees `messages` only re-computes once
  // `t.instant(...)` will actually return the new strings; otherwise the
  // page exhibits an off-by-one (every other switch renders the previously-
  // loaded language). Required pattern — do not "simplify" by depending on
  // a host's language signal directly.
  private readonly langChange = toSignal(this.t.onLangChange, {
    initialValue: null,
  });

  protected readonly messages = computed<BrandingSettingsMessages>(() => {
    this.langChange();
    return {
      sectionGeneral: this.t.instant('Settings_Section_General'),
      sectionLogos: this.t.instant('Settings_Section_Logos'),
      sectionLightTheme: this.t.instant('Settings_Section_LightTheme'),
      sectionDarkTheme: this.t.instant('Settings_Section_DarkTheme'),
      enableDarkTheme: this.t.instant('Settings_EnableDarkTheme'),
      appName: this.t.instant('Settings_AppName'),
      appTitle: this.t.instant('Settings_AppTitle'),
      logoHeader: this.t.instant('Settings_Logo_header'),
      logoFooter: this.t.instant('Settings_Logo_footer'),
      logoFavicon: this.t.instant('Settings_Logo_favicon'),
      logoRemove: this.t.instant('Settings_Logo_Remove'),
      colorPrimary: this.t.instant('Settings_Color_Primary'),
      colorSecondary: this.t.instant('Settings_Color_Secondary'),
      colorTertiary: this.t.instant('Settings_Color_Tertiary'),
      colorNeutral: this.t.instant('Settings_Color_Neutral'),
      colorBackground: this.t.instant('Settings_Color_Background'),
      gradientHeader: this.t.instant('Settings_Gradient_Header'),
      gradientFooter: this.t.instant('Settings_Gradient_Footer'),
      gradientStart: this.t.instant('Settings_Gradient_Start'),
      gradientEnd: this.t.instant('Settings_Gradient_End'),
      required: this.t.instant('Settings_Required'),
      save: this.t.instant('Settings_Save'),
      resetDefaults: this.t.instant('Settings_ResetDefaults'),
      saveSuccess: this.t.instant('Settings_Save_Success'),
      saveError: this.t.instant('Settings_Save_Error'),
      resetSuccess: this.t.instant('Settings_Reset_Success'),
      loadError: this.t.instant('Settings_Load_Error'),
    };
  });
}
```

Replace the `BRANDING_ROUTES` mount in step 3 with this wrapper component
if you want translated labels. Otherwise pass plain English strings inline.

The same component-local messages pattern applies to `ThemeSwitcherMessages`
(`DEFAULT_THEME_SWITCHER_MESSAGES`); override only if you localize.

---

## Step 6 — Surface ladder aliases in the host's `styles.scss`

`BrandingApplicationService` writes the tenant's **Background** picker into
`--kendo-color-app-surface` only. Kendo Grid/Card/Dialog/Pager/Toolbar read
`--kendo-color-surface` and friends — without a surface ladder, the
Background field is inert.

Append this snippet to your host's `styles.scss`. It mirrors maco-app's
contract precisely:

```scss
:root {
  --color-surface: var(--kendo-color-app-surface, #ffffff);
  --color-on-surface: var(--kendo-color-on-app-surface, #1a1a1a);

  --color-surface-50:  color-mix(in oklch, var(--color-surface), black 3%);
  --color-surface-100: color-mix(in oklch, var(--color-surface), black 6%);
  --color-surface-200: color-mix(in oklch, var(--color-surface), black 12%);
  --color-surface-300: color-mix(in oklch, var(--color-surface), black 20%);

  --kendo-color-surface: var(--color-surface-50);
  --kendo-color-surface-alt: var(--color-surface-100);
  --kendo-color-on-surface: var(--color-on-surface);
  --kendo-color-base-subtle: var(--color-surface-100);
  --kendo-color-base-subtle-hover: var(--color-surface-200);
  --kendo-color-base-subtle-active: var(--color-surface-300);
  --kendo-color-base-on-subtle: var(--color-on-surface);
  --kendo-color-border: var(--color-surface-200);
  --kendo-color-border-alt: var(--color-surface-100);
  --kendo-color-subtle: color-mix(
    in oklch,
    var(--color-on-surface),
    var(--color-surface) 50%
  );
}

/* Dark mode flip — tints lighten so card/panel surfaces stay above the page
 * surface instead of beneath it. */
html[data-theme='dark'] {
  --color-surface-50:  color-mix(in oklch, var(--color-surface), white 8%);
  --color-surface-100: color-mix(in oklch, var(--color-surface), white 12%);
  --color-surface-200: color-mix(in oklch, var(--color-surface), white 18%);
  --color-surface-300: color-mix(in oklch, var(--color-surface), white 24%);
}

body {
  background-color: var(--color-surface);
  color: var(--color-on-surface);
}
```

> **Why this is host-side, not library-side:** the SCSS partial would impose
> a layout choice (block-level body bg with on-surface text) that not every
> consumer wants. The ladder is also used by host's own pages, not just by
> branding components. Library shipping it would conflict with hosts that
> already have a different surface scheme.

> **Drawer/AppBar chrome stays driven by `--kendo-color-base`** (the
> **Neutral** picker), not the surface ladder. Flat content-area + neutral
> chrome reads better than a single uniform colour everywhere.

---

## Step 7 — Kendo theme modules (host responsibility)

`@meshmakers/octo-ui` only loads a slim Kendo theme bundle (core/list/
popup/table). Apps that use Grid, Pager, Dialog, Card, Forms, Inputs,
ColorPicker, etc. **must** import the matching SCSS modules in their
`styles.scss` or the components render unstyled:

```scss
@use '@progress/kendo-theme-default/dist/all.scss';
// or, for finer control, per-module:
// @use '@progress/kendo-theme-material/scss/grid/_index.scss' as kgrid;
// @include kgrid.kendo-grid--styles();
```

Use `@progress/kendo-theme-default` if your host wants Kendo's tomato
fallback. Use `kendo-theme-material` for Material Design aesthetics. The
choice doesn't change branding behaviour — both expose the same Kendo CSS
variables.

---

## Step 8 (optional) — Localized `document.title`

`AppTitleService` composes `<branding.appTitle> | <route.breadcrumb>`. The
breadcrumb segment comes from `route.data['breadcrumb']`. Translate by
providing `OCTO_TITLE_TRANSLATOR`:

```typescript
import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { OCTO_TITLE_TRANSLATOR } from '@meshmakers/octo-ui/branding';

providers: [
  // ...
  {
    provide: OCTO_TITLE_TRANSLATOR,
    useFactory: () => {
      const t = inject(TranslateService);
      return (key: string) => t.instant(key);
    },
  },
];
```

Without a translator the breadcrumb key is rendered verbatim — fine for
single-locale apps.

---

## Pitfalls (debug checklist)

- **Tab title shows `/tenants/undefined/GraphQL` errors in the network tab.**
  → `BrandingDataSource.load()` fired before auth or before the per-tenant
  Apollo client was created. Move the `load()` trigger into the auth-gated
  effect (Step 2). Don't call it from `provideAppInitializer`.
- **Branding palette only takes hold after opening Settings.** → Same root
  cause; Settings page calls `load()` in `ngOnInit`, which masks the
  bootstrap failure. Fix Step 2.
- **Background picker has no visible effect.** → Surface ladder snippet
  (Step 6) is missing or placed before `@use 'kendo-theme-...'`. Snippet
  must come **after** Kendo's theme imports so source order wins the
  cascade tie.
- **Drawer/AppBar stays the same colour regardless of palette.** →
  Expected. Drawer/AppBar use `--kendo-color-base` driven by **Neutral**,
  not Background. Change Neutral picker to recolor chrome.
- **NG01203 on `<kendo-colorpicker>` inside `kendo-formfield`.** → Use
  `[formControl]="ctrl"` not `formControlName="..."` on color pickers in
  v23. The Settings page already follows this rule; if you copy patterns,
  carry the binding form across.
- **`Cannot find name 'jasmine'` when building the library.** → The
  `branding-stub.ts` test utility uses jasmine types. The shipped file
  has `/// <reference types="jasmine" />` at the top — keep it.
- **Light/dark switcher disabled on a tenant with `darkTheme = null`.** →
  Intentional. Single-theme tenants force light mode; the toggle is
  greyed-out to prevent stale `'dark'` in localStorage from showing
  unstyled UI. To enable dark, edit branding and toggle "Enable dark theme".
- **Settings page form doesn't reset cleanly between tenants.** →
  `SettingsPageComponent` calls `branding.load()` in `ngOnInit` and
  hydrates from the result. If you persist Settings page state across
  tenant switches, ensure the component is recreated (route change clears
  it; same-route navigation may not).
- **Settings page labels stay in the previous language for one switch
  (every other switch works).** → The wrapper's `computed` is depending on
  a synchronous "current language" signal that flips before
  `TranslateService.use()` finishes loading. Switch the dependency to
  `toSignal(t.onLangChange, { initialValue: null })` as shown in Step 5 —
  `onLangChange` only emits *after* the new translation file is loaded, so
  `t.instant(...)` returns fresh strings on the same tick.
- **Compile error: `BrandingDataSource` / `provideOctoBranding` / etc. is
  not exported by `@meshmakers/octo-ui`.** → The primary entry does not
  re-export branding symbols. Import from `@meshmakers/octo-ui/branding`
  for the runtime stack (services, theme switcher, provider) and from
  `@meshmakers/octo-ui/branding-settings` for the admin editor +
  `BRANDING_ROUTES`.

---

## Phase 12 maco-app migration map (reference)

When migrating maco-app to use this library:

| maco-app file | Action |
|---|---|
| `services/branding.data-source.ts` | Delete; import `BrandingDataSource` from `@meshmakers/octo-ui/branding` |
| `services/branding-application.service.ts` | Delete; library version is identical |
| `services/theme.service.ts` | Delete; library version is identical |
| `services/app-title.service.ts` | Delete; library `AppTitleService` is registered as TitleStrategy by `provideOctoBranding` |
| `pages/settings/settings.{ts,html,scss,spec.ts}` | Delete; create wrapper component (Step 5) that supplies messages from `TranslateService` |
| `shared/maco-logo/maco-logo.component.ts` | Delete; render the logo inline (`<img [src]="logoUrl()">` with `BrandingDataSource` injected — see Step 4) |
| `shared/theme-switcher/theme-switcher.component.ts` | Delete; replace with `<mm-theme-switcher>` |
| `shared/header/header.component` | Keep; replace `<app-maco-logo>` with the inline `<img>` pattern from Step 4 and `<app-theme-switcher>` with `<mm-theme-switcher>`. Header `<scss>` already binds to `--app-header-gradient-*` / `--app-header-text`. |
| `shared/footer/footer.component` | Keep; bind to `--app-footer-gradient-*` if you want the footer to follow the palette. |
| `app.config.ts` | Add `provideOctoBranding({ defaults: …TecLink palette… })` |
| `app.ts` (AppComponent) | Already follows the auth-gated effect pattern — keep |
| `styles.scss` | **No changes** — surface ladder, dark flip, Kendo modules, MACO constants stay maco-side. Only `--octo-mint`/`--neo-cyan`/etc aliases stay if maco still consumes octo-ui-legacy components |
| `graphQL/{create,update,get}Branding.{graphql,ts}` | Delete; library uses its own GraphQL operations |

The library's `BrandingApplicationService` is byte-equivalent to maco's
modulo:
- `applyFavicon` falls back through `OCTO_BRANDING_FALLBACK_ASSETS.favicon`
  (DI token) instead of a hardcoded `'favicon.ico'` constant. Pass the
  same value through `provideOctoBranding({ fallbackAssets: { favicon: '/favicon.ico' } })`.

The migration is one-PR-per-feature — do not batch all deletions, the
GraphQL schema swap and the styles.scss audit each warrant their own
review.

---

## Backend contract

Requires the `SystemUIBranding` CK type with `rtWellKnownName = "Branding"`.
This type is service-managed by `octo-admin-panel` (auto-imports on
startup) and is present on every tenant. Bumping the library's GraphQL
schema requires bumping the admin-panel image too — see
`reference_systemui_service_managed_ck` memory for ops sequencing.
