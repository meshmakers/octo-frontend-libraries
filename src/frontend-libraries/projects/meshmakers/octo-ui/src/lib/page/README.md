# mm-page — page layout

`PageComponent` (`<mm-page>`) is the page frame of the Deep Sea theme (AB#5519).
It replaces the retired LCARS page triple (header, content panel, READY
footer): an **optional header** (title, subtitle, actions) above a
**content area**. There is no footer.

All Refinery Studio pages and `mm-runtime-browser` use it since AB#5526; the
neutral LCARS page classes left in `octo.styles()` serve only the Meshmakers
App until it migrates.

## Usage

```typescript
import { MM_PAGE } from '@meshmakers/octo-ui';

@Component({
  imports: [MM_PAGE, ButtonModule],
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

`MM_PAGE` bundles `PageComponent` and the three slot directives
(`PageTitleDirective`, `PageSubtitleDirective`, `PageActionsDirective`).
Importing it is the recommended form, but the slots do not depend on it:
projected content is detected from the rendered DOM after each render, so a
template that imports only `PageComponent` still gets its header.

## API

| Input | Type | Default | Description |
|---|---|---|---|
| `pageTitle` | `string \| null \| undefined` | — | Title text. Named `pageTitle` (not `title`) so the host never gets a native tooltip. |
| `pageSubtitle` | `string \| null \| undefined` | — | Text under the title. |
| `headingLevel` | `1 \| 2 \| 3` | `2` | `aria-level` of the title (`role="heading"`). Level 1 belongs to the app/space shell. |
| `padded` | `boolean` (`booleanAttribute`) | `true` | Pads the content area with the page gutter. `padded="false"` or `[padded]="false"` for full-bleed grids, editors and canvases (adds `mm-page--flush`). |

| Projection slot | Directive | Placement |
|---|---|---|
| `[mmPageTitle]` | `PageTitleDirective` | Title (after `pageTitle` text, if both are given) |
| `[mmPageSubtitle]` | `PageSubtitleDirective` | Subtitle |
| `[mmPageActions]` | `PageActionsDirective` | End of the header; wraps below the title on narrow screens |
| default | — | Content area |

The header is a plain `<div>` (no `<header>`/banner landmark — the app shell
owns that) and is shown only when there is a title, subtitle or actions;
otherwise it is `hidden`, the host gets `mm-page--headerless` and the content
starts at the gutter. Slots that appear later (e.g. actions behind an `@if`)
are picked up on the next render.

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
