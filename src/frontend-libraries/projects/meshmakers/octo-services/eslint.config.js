// @ts-check
const tseslint = require("typescript-eslint");
const rootConfig = require("../../../eslint.config.js");

module.exports = tseslint.config(
  ...rootConfig,
  {
    ignores: ["**/graphQL/**"],
  },
  {
    files: ["**/*.ts"],
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "mm",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "mm",
          style: "kebab-case",
        },
      ],
    },
  },
  {
    // AB#9650: every app loads octo-services at start, so a value import of @meshmakers/shared-ui here pulls
    // shared-ui and Kendo into the initial bundle of every app (maco-app 2.37 MB -> 5.56 MB). Type imports
    // (`import type`) are erased and stay allowed. Specs may import shared-ui (they are not shipped).
    // Covers both entry points and, since AB#9654, the secondary entry points of shared-ui (`@meshmakers/shared-ui/*`).
    files: ["**/*.ts"],
    ignores: ["**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        "paths": [{
          "name": "@meshmakers/shared-ui",
          "allowTypeImports": true,
          "message": "octo-services must not import @meshmakers/shared-ui at runtime (it lands in every app's initial bundle, AB#9650). Use `import type`, or move the code out of octo-services."
        }],
        "patterns": [{
          "group": ["@meshmakers/shared-ui/*"],
          "allowTypeImports": true,
          "message": "octo-services must not import a @meshmakers/shared-ui entry point at runtime (it lands in every app's initial bundle, AB#9650/AB#9654). Use `import type`, or move the code out of octo-services."
        }]
      }],
    },
  },
  {
    // Ignore generated GraphQL files
    files: ["**/graphQL/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-indexed-object-style": "off",
      "@angular-eslint/prefer-inject": "off",
    },
  }
);
