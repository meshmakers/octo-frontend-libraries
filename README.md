# octo-frontend-libraries

Angular monorepo containing shared libraries and the template application for OctoMesh frontend development.

See [src/frontend-libraries/README.md](src/frontend-libraries/README.md) for full documentation including project structure, build commands, styling guidelines, and Telerik/Kendo UI license setup.

## Backend Setup

`npm run codegen` needs the local `meshtest` tenant with all construction kit models referenced by the `.graphql` documents. Run `./scripts/om-setup-meshtest-tenant.ps1` (idempotent, requires services started via Start-Octo); the script header documents the CK models, how each one gets installed, and the available options.

## System CK guard

The libraries may depend on **System CK models only** (epic AB#6186). `scripts/check-system-ck-only.mjs`
enforces this for everything under `src/frontend-libraries/projects/` plus `schema.graphql`. It is the first
step of `npm run lint` and of the Lint step in `azure-pipelines.yml`, takes about three seconds, and can be run
directly with `npm run check:system-ck` (in `src/frontend-libraries`).

What it checks:

1. CK ids in string literals, templates, JSON and Markdown (`Model/Type`, `Model.Sub-1.0.0/Type`) must use an
   allowlisted model. Specs and `testing/` folders may use the synthetic models `Test` / `TestModel` (also
   dotted, e.g. `Test.Sub/Type`). Ids in comments are warnings (`--strict` makes them errors).
2. `*.graphql` documents may only use System CK types: named types, fields under `runtime` and subscription
   fields. A type that is missing from `schema.graphql` is an error, too.
3. `schema.graphql` and the generated GraphQL TypeScript (`globalTypes.ts`, `possibleTypes.ts`, operations)
   must not contain non-System CK types.
4. Library projects (`projects/meshmakers/**`) must not import from `demo-app` or `legacy-demo-app`.

The demo apps may additionally use the demo model `OctoSdkDemo` (decision in AB#6208); this is the `scopes`
entry of the allowlist. `ConstructionKit/*` (the platform meta model) is allowed as `platformModels`.

Files:

- `scripts/system-ck-allowlist.json` — allowed models (`models`, plus every `System.*` via `modelPrefixes`),
  synthetic models, path scopes, import boundaries, and known non-System model names that are always reported.
  **To add a new System model**, add it to `models`. Any `System.*` model passes anyway, but listing it
  documents it.
- `scripts/system-ck-exceptions.json` — `{ "path": "<glob>", "pattern": "<regex, optional>", "reason": "...",
  "workItem": "AB#1234", "expires": "YYYY-MM-DD" (optional) }`. An entry without `reason` or `workItem` fails,
  an expired entry fails, and an entry that matches nothing is reported as stale. The baseline points at the
  clean-up items of AB#6186 (AB#6204 codegen, AB#6205 runtime browser, AB#6207 specs/docs/hints, AB#6208 demo
  apps). Remove an entry when its file is clean. The list should only shrink.

The same script (with its own configuration) runs in octo-frontend-refinery-studio. Keep both copies in sync.
