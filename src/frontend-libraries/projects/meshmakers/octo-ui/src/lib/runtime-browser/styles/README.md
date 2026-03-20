# Runtime Browser Styles

LCARS-inspired theme styles for the runtime-browser and related components. The styles are **Kendo-independent** by default and integrate with Kendo when the host app already imports a Kendo theme.

## File Structure

| File | Purpose |
|------|---------|
| `_variables.scss` | Design tokens (SCSS variables) and `variables` mixin (CSS custom properties). No Kendo dependency. |
| `_lcars-flat-btn.scss` | Mixin for flat/outline button overrides in dialogs. |
| `_lcars-input.scss` | Mixin for LCARS input styling (text, number, select). |
| `_lcars-button.scss` | Mixin for LCARS button styles (toolbars, dialogs). |
| `_styles.scss` | Main `styles` mixin – dockview, panels, Kendo overrides. Uses the LCARS mixins. |
| `_index.scss` | Entry point. Forwards `variables` and `styles`. No Kendo imports. |
| `_kendo-theme.scss` | Optional. Imports Kendo Material theme and applies LCARS color configuration. |
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

Use the with-kendo entry to load Kendo Material + LCARS theme:

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
- **`styles` mixin**: Outputs dockview, LCARS panels, and Kendo component overrides. Kendo-specific selectors (`.k-*`) only apply when those elements exist.
- **Fallbacks**: Body and global styles use `var(--kendo-color-app-surface, var(--deep-sea, #1a2230))` so they work even when variables aren't applied to an ancestor.
