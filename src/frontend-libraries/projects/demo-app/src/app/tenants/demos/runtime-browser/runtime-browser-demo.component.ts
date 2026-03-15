import { Component } from '@angular/core';
import { RuntimeBrowserComponent } from '@meshmakers/octo-ui';
import { KENDO_CARD } from '@progress/kendo-angular-layout';

@Component({
  selector: 'app-runtime-browser-demo',
  imports: [RuntimeBrowserComponent, KENDO_CARD],
  templateUrl: './runtime-browser-demo.component.html',
  styleUrl: './runtime-browser-demo.component.scss',
})
export class RuntimeBrowserDemoComponent {
  readonly themeCssVariables = `
<ul>
  <li>--octo-mint: <color> !important;</li>
  <li>--neo-cyan: <color> !important;</li>
  <li>--indigogo: <color> !important;</li>
  <li>--toffee: <color> !important;</li>
  <li>--bubblegum: <color> !important;</li>
  <li>--lilac-glow: <color> !important;</li>
  <li>--royal-violet: <color> !important;</li>
  <li>--ash-blue: <color> !important;</li>
  <li>--iron-navy: <color> !important;</li>
  <li>--deep-sea: <color> !important;</li>
  <li>--surface-elevated: <color> !important;</li>
  <li>--octo-text-color: <color> !important;</li>
</ul>
`;

  readonly i18nProvidersExample = `
provideOctoUi(),
provideTranslateService({
  loader: {
    provide: TranslateLoader,
    useFactory: (http: HttpClient, constants: ConstantService) =>
      createMergedTranslateLoader(
        new AppTranslationLoader(http), // custom loader for the host app
        http,
        constants
      ),
    deps: [HttpClient, ConstantService],
  },
}),
`;

  readonly runtimeBrowserUsageExample = `
<mm-runtime-browser [language]="language"></mm-runtime-browser>
`;

  readonly angularJsonTranslationsAssets = `
"assets": [
  {
    "glob": "**/*.json",
    "input": "node_modules/@meshmakers/octo-ui/i18n",
    "output": "/octo-ui/i18n"
  }
]
`;
}
