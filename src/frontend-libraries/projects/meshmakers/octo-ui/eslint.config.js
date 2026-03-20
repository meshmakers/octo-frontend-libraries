// @ts-check
const tseslint = require("typescript-eslint");
const rootConfig = require("../../../eslint.config.js");

module.exports = tseslint.config(
  ...rootConfig,
  {
    files: ["**/*.ts"],
    ignores: [
      "**/src/lib/graphQL/**.*"
    ],
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
    // Ignore unsupported lint rules for generated GraphQL files
    files: ["**/src/lib/graphQL/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-indexed-object-style": "off",
      "@angular-eslint/prefer-inject": "off",
    },
  }
);
