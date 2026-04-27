# LCARS Theme

The LCARS theme for the OctoMesh suite. Implemented as a two-tier
semantic-token model with a pluggable themes registry — see the
parent library's `octo-ui/CLAUDE.md` for the complete architecture
and usage docs.

## File structure

```
lcars-theme/
├─ _index.scss              styles() mixin (theme rules)
├─ _variables.scss          variables() mixin (token composition)
├─ _kendo-theme.scss        Kendo color map → var(--theme-*) wiring
│
├─ tokens/
│   ├─ _semantic.scss       19 role tokens (--theme-primary, etc.)
│   ├─ _derived.scss        ~110 hover/active/alpha vars via color-mix()
│   ├─ _typography.scss
│   ├─ _radius.scss
│   ├─ _motion.scss
│   ├─ _designer.scss
│   ├─ _components.scss
│   └─ _index.scss
│
├─ themes/                  palette providers (plug-in registry)
│   ├─ _lcars-dark.scss     LCARS palette → semantic surface
│   ├─ _lcars-light.scss    LCARS light variant
│   └─ _index.scss
│
├─ primitives/              LCARS-original UI patterns
├─ kendo/                   per-widget Kendo overrides
├─ chrome/                  app-shell pieces (login popup)
├─ forms/                   composite forms
├─ thirdparty/              third-party library overrides (dockview)
└─ host-overrides/          opt-in LCARS overrides for library
                            components that ship neutral by default
```

## Usage (host applications)

```scss
@use "@meshmakers/octo-ui/styles" as octo;

:root, :root[data-theme="lcars-dark"] {
  @include octo.variables();
  @include octo.lcars-dark;
  @include octo.derived;
}

:root[data-theme="lcars-light"] {
  @include octo.lcars-light;
  @include octo.derived;
}

@include octo.styles();
@include octo.host-overrides();   // opt-in: LCARS look for library widgets
```

The public theming surface is `--theme-*` (19 role tokens). Tenants
override at runtime via `documentElement.style.setProperty(...)`;
all derived tokens follow automatically via `color-mix()`.

Browser baseline: `color-mix()` requires Chromium 111+, Firefox 113+,
Safari 16.2+ (all evergreen since early 2023).
