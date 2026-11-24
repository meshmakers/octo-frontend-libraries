# Runtime Browser Styles

Theme styles for the runtime-browser and related components. Token values follow the "Deep Sea" palette (AB#5519); since AB#5526 `_styles.scss` carries no LCARS decoration (flat buttons, no gradients/glows/uppercase, body text in `--theme-font-ui`). The only LCARS classes left are the neutral page pattern kept for the Meshmakers App (AB#5526 phase 2). The styles are **Kendo-independent** by default and integrate with Kendo when the host app already imports a Kendo theme.

## File Structure

| File | Purpose |
|------|---------|
| `_variables.scss` | Design tokens (SCSS variables) and `variables` mixin (CSS custom properties). No Kendo dependency. |
| `_theme.scss` | Semantic `--theme-*` tokens (Deep Sea, dark + light), `foundation-tokens` (fonts, spacing, radius, motion), Kendo bridge; `theme()` / `theme-overrides()` entry points. |
| `_flat-button.scss` | `flat-button` mixin: flat outline button in dialog action rows. |
| `_field-input.scss` | `field-input` mixin: token-driven inputs (text, number, select). |
| `_dialog-actions.scss` | `dialog-actions` mixin: the one dialog footer layout (`.mm-dialog-actions`: right-aligned, 34 px buttons, `--theme-space-2` gap, wraps instead of clipping; AB#6464). Included by `styles()`. |
| `_button.scss` | `octo-button` mixin: flat Deep Sea button used by toolbars and dialogs. `octo-segmented-toggle` mixin: outline-primary toggles in a button group read as a segmented control (see below). |
| `_styles.scss` | Main `styles` mixin – dockview, panels, Kendo overrides. Uses the button/input mixins. |
| `_index.scss` | Entry point. Forwards `variables` and `styles`. No Kendo imports. |
| `_kendo-theme.scss` | Optional. Imports Kendo Material theme and applies the theme color configuration. |
| `_with-kendo.scss` | Optional entry point for apps that don't import Kendo. Loads Kendo + base styles. |

## Usage

### When Kendo is already imported (recommended)

Use the main octo-ui styles entry:

```scss
@use "@meshmakers/octo-ui/styles" as octo;

:host {
  @include octo.variables();
}

.container ::ng-deep {
  @include octo.styles();
}
```

### When Kendo is not imported

Use the with-kendo entry to load Kendo Material + the Deep Sea theme:

```scss
@use "@meshmakers/octo-ui/lib/runtime-browser/styles/with-kendo" as octo;

:host {
  @include octo.variables();
}

.container ::ng-deep {
  @include octo.styles();
}
```

## How it works

- **`variables` mixin**: Applies CSS custom properties (`--octo-mint`, `--kendo-color-primary`, etc.) to the element. When Kendo is present, these override Kendo's defaults.
- **`styles` mixin**: Outputs dockview, panels, and Kendo component overrides. Kendo-specific selectors (`.k-*`) only apply when those elements exist.
- **Fallbacks**: Body and global styles use `var(--kendo-color-app-surface, var(--deep-sea, #1a2230))` so they work even when variables aren't applied to an ancestor.

## Segmented control (toggle button group)

A view switcher is a `kendo-buttongroup selection="single"` of `kendoButton fillMode="outline" themeColor="primary"
[toggleable]="true"` buttons. The filled button is the active one:

| State | Background | Border | Label |
|-------|------------|--------|-------|
| Unselected | transparent | `--theme-border-default` | `--theme-text-secondary` |
| Unselected, hover | `--theme-bg-hover` | `--theme-border-strong` | `--theme-text-primary` |
| Selected | `--theme-accent` | `--theme-accent` | `--theme-text-on-accent` |
| Selected, hover | `--theme-accent-hover` | `--theme-accent-hover` | `--theme-text-on-accent` |
| Disabled | transparent (selected: `--theme-text-muted` at 24 %) | `--theme-border-default` (selected: `--theme-text-muted`) | `--theme-text-muted` (selected: `--theme-text-secondary`) |

Keyboard focus shows `--theme-focus-ring`. The rule (`octo-segmented-toggle` in `_button.scss`) is emitted once, in the
`.k-button` block of `styles()`; its specificity also beats the solid primary branch of `octo-button` in the list, grid
and page toolbars, so the group reads the same on a page and in a toolbar. Measured label contrast: selected 4.9:1
(light) and 9.5:1 (dark), unselected at least 6.3:1 on `--theme-bg-app`, `--theme-bg-surface` and
`--theme-bg-elevated`. It applies only to toggles (Kendo sets `aria-pressed` on them) that are direct children of a
button group: a single outline-primary button, an action group without toggles, a `kendo-splitbutton` (which carries
`k-button-group` too), flat toggles (`fillMode="flat"`, quick-view segments) and base toggles (no `themeColor`) keep
their own look. Hosts need no own rule for it.
