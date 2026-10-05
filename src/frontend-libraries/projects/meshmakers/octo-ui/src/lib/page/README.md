# mm-page — page layout

`PageComponent` (`<mm-page>`) is the page frame of the Deep Sea theme (AB#5519).
It replaces the LCARS triple `lcars-page-header` / `lcars-content-panel` /
`lcars-footer`: an **optional header** (title, subtitle, actions) above a
**content area**. There is no footer — the LCARS "READY" bar has no successor.

Existing pages are migrated to it per area in AB#5526.

## Usage

```typescript
import { PageActionsDirective, PageComponent } from '@meshmakers/octo-ui';

@Component({
  imports: [PageComponent, PageActionsDirective, ButtonModule],
  template: `
    <mm-page pageTitle="Adapters" pageSubtitle="12 registered">
      <div mmPageActions>
        <button kendoButton>Import</button>
        <button kendoButton themeColor="primary">New adapter</button>
      </div>

      <mm-list-view …></mm-list-view>
    </mm-page>
  `,
})
```

Inside a space shell that already shows the area title, drop the header and
use `<mm-page>` as a bare content frame:

```html
<mm-page>
  <mm-list-view …></mm-list-view>
</mm-page>
```

Rich title or subtitle content is projected instead of passed as text:

```html
<mm-page>
  <span mmPageTitle>Adapter <code>{{ rtId }}</code></span>
  <span mmPageSubtitle><span class="status-dot"></span> Online</span>
  …
</mm-page>
```

## API

| Input | Type | Default | Description |
|---|---|---|---|
| `pageTitle` | `string \| null \| undefined` | — | Title text. Named `pageTitle` (not `title`) so the host never gets a native tooltip. |
| `pageSubtitle` | `string \| null \| undefined` | — | Text under the title. |
| `headingLevel` | `1 \| 2 \| 3` | `1` | `aria-level` of the title (`role="heading"`). |
| `padded` | `boolean` | `true` | Pads the content area with the page gutter. `false` for full-bleed grids, editors and canvases (adds `mm-page--flush`). |

| Projection slot | Directive | Placement |
|---|---|---|
| `[mmPageTitle]` | `PageTitleDirective` | Title (after `pageTitle` text, if both are given) |
| `[mmPageSubtitle]` | `PageSubtitleDirective` | Subtitle |
| `[mmPageActions]` | `PageActionsDirective` | End of the header; wraps below the title on narrow screens |
| default | — | Content area |

The header is rendered only when there is a title, subtitle or actions;
otherwise the host gets `mm-page--headerless` and the content starts at the
gutter.

## Layout and styling

- The host is a flex column with `height: 100%` and `min-height: 0`; the
  content area takes the remaining height and scrolls (`overflow: auto`).
  The routed component that renders `<mm-page>` must itself fill its outlet
  (`:host { display: block; height: 100% }`).
- Styling uses only theme tokens with neutral fallbacks:
  `--theme-font-display` (title, 20/28, 600), `--theme-font-ui`,
  `--theme-text-primary` / `--theme-text-secondary`, and the
  `--theme-space-*` scale (page gutter `--theme-space-4`).
- `ChangeDetectionStrategy.OnPush`, standalone, signal inputs.
