# Web fonts shipped by `@meshmakers/shared-ui` (AB#7682)

The shared theme asks for three font families: **Roboto** (UI, `--theme-font-ui`), **Montserrat** (headings and
avatar initials, `--theme-font-display`) and **Roboto Mono** (monospace, `--theme-font-mono`). The library ships
the font files, so an app does not load them from an external host (no request to Google, no problem on a
machine without internet access).

## What a host app adds

One entry in the `styles` of its build (`angular.json`), before its own stylesheet:

```json
"styles": [
  "node_modules/@meshmakers/shared-ui/fonts/fonts.css",
  "src/styles.scss"
]
```

The build emits the `woff2` files next to the app and the browser loads them from the app's own origin. An app
that used a Google Fonts `<link>` removes it.

## What is in the package

```
node_modules/@meshmakers/shared-ui/fonts/fonts.css                     (20 @font-face rules, with unicode-range)
node_modules/@meshmakers/shared-ui/fonts/<family>-<subset>-<weight>-normal.woff2   (20 files, 484 KB in total)
node_modules/@meshmakers/shared-ui/fonts/licenses/<family>-OFL.txt
```

| Family | Weights | Subsets |
|--------|---------|---------|
| Montserrat | 300, 400, 500, 600, 700 | latin, latin-ext |
| Roboto | 400, 500, 700 | latin, latin-ext |
| Roboto Mono | 400, 500 | latin, latin-ext |

The browser fetches only the files a page needs (the `unicode-range` of each rule): a page in German or English
loads the `latin` files; `latin-ext` covers Central European letters (for example Polish or Czech names).

## Licences

All three families are under the SIL Open Font License 1.1 (`licenses/`), which allows bundling and
redistribution with the licence text. The files are the `woff2` files of the `@fontsource` packages (version 5.3.0).

## Adding a weight or a subset

Take the matching `woff2` file from `@fontsource/<family>/files/`, put it into `fonts/`, copy its rule (and its
`unicode-range`) from `@fontsource/<family>/<weight>.css` into `fonts.css`, and say so in the CHANGELOG. The
fontsource rules list a `.woff` fallback next to the `woff2` file: replace the whole `src` with the single entry
`url("./<file>.woff2") format("woff2")`, because only the `woff2` file is copied and a host build cannot resolve a
`.woff` url that is not in the package. `ng-package.json` copies everything in `fonts/`.
