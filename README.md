# octo-frontend-libraries

Angular monorepo containing shared libraries and the template application for OctoMesh frontend development.

See [src/frontend-libraries/README.md](src/frontend-libraries/README.md) for full documentation including project structure, build commands, styling guidelines, and Telerik/Kendo UI license setup.

## Backend Setup

`npm run codegen` needs the local `meshtest` tenant with all construction kit models referenced by the `.graphql` documents. Run `./scripts/om-setup-meshtest-tenant.ps1` (idempotent, requires services started via Start-Octo); the script header documents the CK models, how each one gets installed, and the available options.

## System CK guard

The libraries may depend on **System CK models only** (epic AB#6186). `scripts/check-system-ck-only.mjs`
enforces this for everything under `src/frontend-libraries/projects/` plus `schema.graphql`. It runs with
`--strict` as the first step of `npm run lint` and of the Lint step in `azure-pipelines.yml`, takes about three
seconds, and can be run directly with `npm run check:system-ck` (in `src/frontend-libraries`).

What it checks:

1. CK ids in string literals, templates, JSON and Markdown (`Model/Type`, `Model.Sub-1.0.0/Type`) must use an
   allowlisted model. Specs, `testing/` folders and Markdown under `docs/` may use the synthetic models `Test` /
   `TestModel` (also dotted models such as `Test.Sub`); README and CLAUDE.md files must use System examples.
   Ids in comments are warnings; `--strict` (used by lint and CI) makes them errors.
2. GraphQL documents (`*.graphql` and `gql` tagged templates in `.ts`) may only use System CK types: named
   types, fields under `runtime` and subscription fields, also through inline fragments, fragment spreads and
   fragments on the runtime/subscription root types. `*.graphql` documents are also validated against
   `schema.graphql` (unknown types and fields). `gql` templates with `${...}` substitutions are only scanned for
   non-System GraphQL type names.
3. `schema.graphql` and the generated GraphQL TypeScript (`globalTypes.ts`, `possibleTypes.ts`, operations)
   must not contain non-System CK types.
4. Library projects (`projects/meshmakers/**`) must not import from `demo-app` or `legacy-demo-app`.

The demo apps may additionally use the demo model `OctoSdkDemo` (decision in AB#6208); this is the `scopes`
entry of the allowlist. The CK meta-model pseudo ids used by the Meshboard (`ConstructionKit/CkModel`,
`ConstructionKit/CkType`, ...) are listed in `ignoreTokens`.

Limits: ids built at runtime (`` `Basic/${name}` ``, string concatenation, ids read from data) are not detected.

Files:

- `scripts/system-ck-allowlist.json` — allowed models (`models`, plus every `System.*` via `modelPrefixes`; the
  prefix must end with a dot), synthetic models and where they are allowed (`syntheticPaths`), path scopes,
  import boundaries, known non-System model names that are always reported, and `ignoreTokens` for `A/B` text
  that is not a CK id. **To add a new System model**, add it to `models`. Any `System.*` model passes anyway, but
  listing it documents it.
- `scripts/system-ck-exceptions.json` — `{ "path": "<glob>", "pattern": "<regex>", "maxCount": <n>, "reason":
  "...", "workItem": "AB#1234", "expires": "YYYY-MM-DD" (optional) }`. `pattern` (matched against the finding)
  and `maxCount` are required unless the path is the schema or a generated GraphQL file. An entry without
  `reason` or `workItem`, with an invalid regex, an expired one, or one with more findings than `maxCount` fails;
  an entry that matches nothing (or fewer than `maxCount`) is reported. The baseline points at the clean-up items
  of AB#6186 (AB#6204 codegen, AB#6205 runtime browser, AB#6207 specs/docs/hints, AB#6208 demo apps). Lower
  `maxCount` or remove the entry when a file gets cleaner; the list should only shrink.
  `node ../../scripts/check-system-ck-only.mjs --strict --json` lists the findings not covered by an exception.

The same script (with its own configuration) runs in octo-frontend-refinery-studio. Keep both copies identical:
when the sibling checkout exists next to this repo (`siblingCopies` in the allowlist), the guard warns if the
copies differ.
