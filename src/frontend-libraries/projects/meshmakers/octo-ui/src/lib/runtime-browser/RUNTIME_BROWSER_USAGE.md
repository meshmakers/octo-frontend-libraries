# Runtime Browser Component

## Description

The Runtime Browser component (`mm-runtime-browser`) provides a hierarchical view for browsing Construction Kit models, types, and runtime entities. It displays a tree structure in the left pane with entity details in the right pane. Users can navigate to entities, create new entities, edit existing ones, and use the "Goto Entity" feature for direct navigation.

For navigation details (Goto Entity, toolbar actions), see [NAVIGATION_USAGE.md](./NAVIGATION_USAGE.md).

## Basic Usage

```html
<mm-runtime-browser></mm-runtime-browser>
```

With custom messages (internationalization):

```html
<mm-runtime-browser [messages]="runtimeBrowserMessages" />
```

## Themes

The component supports custom themes. To adjust the look & feel to match your CI, override the following CSS variables at the root of your application:

- `--octo-mint: <color> !important;`
- `--neo-cyan: <color> !important;`
- `--indigogo: <color> !important;`
- `--toffee: <color> !important;`
- `--bubblegum: <color> !important;`
- `--lilac-glow: <color> !important;`
- `--royal-violet: <color> !important;`
- `--ash-blue: <color> !important;`
- `--iron-navy: <color> !important;`
- `--deep-sea: <color> !important;`
- `--surface-elevated: <color> !important;`
- `--octo-text-color: <color> !important;`

## Internationalization

The component does **not** load translations internally. Host applications must supply `RuntimeBrowserMessages` via the `messages` input.

### Option 1: English defaults

Use `DEFAULT_RUNTIME_BROWSER_MESSAGES` from `@meshmakers/octo-ui` for English:

```typescript
import { DEFAULT_RUNTIME_BROWSER_MESSAGES } from '@meshmakers/octo-ui';

@Component({
  template: `<mm-runtime-browser [messages]="messages" />`,
})
export class MyComponent {
  protected readonly messages = DEFAULT_RUNTIME_BROWSER_MESSAGES;
}
```

### Option 2: Translated messages via @ngx-translate

Build translated messages using your app's translation system (e.g. [@ngx-translate/core](https://www.npmjs.com/package/@ngx-translate/core)):

```typescript
import { RuntimeBrowserMessages } from '@meshmakers/octo-ui';
import { TranslateService } from '@ngx-translate/core';

export function buildRuntimeBrowserMessages(
  translate: TranslateService
): RuntimeBrowserMessages {
  const t = (key: string, fallback: string) => {
    const value = translate.instant(key);
    return value && value !== key ? value : fallback;
  };
  return {
    title: t('RuntimeBrowser_Title', 'Runtime Browser'),
    badgeLabel: t('RuntimeBrowser_BadgeLabel', 'Entities & Data'),
    // ... map all RuntimeBrowserMessages keys to translation keys
  };
}

@Component({
  template: `<mm-runtime-browser [messages]="messages()" />`,
})
export class MyComponent {
  private readonly translate = inject(TranslateService);
  protected readonly messages = computed(() =>
    buildRuntimeBrowserMessages(this.translate)
  );
}
```

### App configuration

Ensure `provideOctoUi()` is included in your app config:

```typescript
import { provideOctoUi } from '@meshmakers/octo-ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideOctoUi(),
    // ... other providers
  ],
};
```

### Translation assets (angular.json)

If using translations from `@meshmakers/octo-ui` i18n files, add to your `angular.json`:

```json
"assets": [
  {
    "glob": "**/*.json",
    "input": "node_modules/@meshmakers/octo-ui/i18n",
    "output": "/octo-ui/i18n"
  }
]
```
