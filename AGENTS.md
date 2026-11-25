# AGENTS.md

Instructions for coding agents in this repository. Detail lives in `docs/`; read the matching file before changing the
code it covers.

## What this repo is

An Angular npm workspace (Angular 22, Kendo UI for Angular, Apollo Client) that publishes the `@meshmakers/*` npm
packages used by the OctoMesh frontends, plus two demo applications. Everything lives in `src/frontend-libraries`;
run every npm command from that folder.

- Ten libraries under `projects/meshmakers/`: `shared-services`, `shared-auth`, `shared-ui`, `shared-ui-legacy`,
  `octo-services`, `octo-ui`, `octo-ui-legacy`, `octo-process-diagrams`, `octo-meshboard`, `octo-ai-console`.
- `projects/demo-app` (the demo application, also built as a Docker image), `projects/legacy-demo-app` and
  `projects/template-app`.
- Root `azure-pipelines.yml` runs lint, build and tests, then publishes the packages (public feed for tags `r*`,
  private feed for `main` and `test/*`). `scripts/` at the root holds the System CK guard.

The repository is public.

## Read before you change

<!-- >>> generated: routing -->
| When you change | Read first |
|---|---|
<!-- <<< end generated: routing -->

This repository has no routed `docs/` yet. Each library keeps its notes in a hand-written file next to its code
(Claude Code loads it automatically when working in that folder); read the one of the library you change:

- `src/frontend-libraries/CLAUDE.md`: workspace-wide toolchain, testing (Vitest), linting, CI.
- `src/frontend-libraries/projects/meshmakers/octo-meshboard/CLAUDE.md`
- `src/frontend-libraries/projects/meshmakers/octo-ui/CLAUDE.md`
- `src/frontend-libraries/projects/meshmakers/octo-services/CLAUDE.md`
- `src/frontend-libraries/projects/meshmakers/shared-ui/CLAUDE.md`
- `src/frontend-libraries/projects/meshmakers/shared-auth/CLAUDE.md`
- `src/frontend-libraries/projects/meshmakers/shared-auth/login-ui/src/mm-login-app-bar-section/CLAUDE.md`
- `src/frontend-libraries/projects/meshmakers/shared-services/CLAUDE.md`
- `src/frontend-libraries/projects/meshmakers/octo-process-diagrams/CLAUDE.md`

`README.md` and `src/frontend-libraries/README.md` cover the backend setup for `npm run codegen`, the System CK
guard and the Telerik/Kendo licence setup.

## Build & test

Needs Node.js 22.22.3 or newer (24.15 or 26 also work; Angular CLI 22 refuses older ones) and the environment
variable `TELERIK_LICENSE` (`npm run build` and `npm start` activate the Kendo licence through
`scripts/setup-license.js`). All commands run in `src/frontend-libraries`.

```bash
npm ci --prefer-offline --no-audit --no-fund   # install exactly the locked versions (what CI runs)
npm run lint                                   # System CK guard, i18n check, ng lint of all 12 projects
npm run build:prod                             # every library and the demo app, each with its lint first
npm test                                       # Vitest, one project after the other (ten scripts)
npm run test:shared-auth                       # one project; add `-- --include=<spec>` for a single spec
```

Build before you test on a fresh checkout: `tsconfig.json` maps `@meshmakers/*` to `./dist/meshmakers/*`, so the
specs of a library that depends on another one resolve the other's build output, and `npm test` stops at the first
such project without a prior build. `npm test -- <flag>` reaches only the last chained script; use
`npm run test:<lib> -- <flag>`. `npm run codegen` needs a running local backend, see `README.md`.

## Before you commit

1. `npm run lint` in `src/frontend-libraries`: 0 errors (CI runs it first and fails the build otherwise).
2. `npm run build:prod`, then `npm test`: both green. For a change inside one library, its `build:<lib>` and
   `test:<lib>` are enough while you work; run the full chain before the commit that touches more than one library.
3. Changed dependencies: use `npm install <pkg>` or `npm uninstall <pkg>` so `package.json` and `package-lock.json`
   stay in sync (CI runs `npm ci`); never regenerate the lock file as a side effect.
4. Update the `README.md` and the notes file of the library you changed in the same commit.
5. Touched `AGENTS.md` or a file in `docs/`: `Test-OctoAgentDocs -Fix` (octo-tools) reports 0 errors. It rewrites the
   generated routing table, so run it before you stage.

## Rules

- **This repository is public.** No work item ids, internal hostnames, customer or tenant names, or secrets in docs
  and in new or changed code comments and test names; remove an existing one when you touch its line.
  Exceptions: `CHANGELOG.md` references the work item of every entry by convention (`CHANGELOG.md:4`), and the
  `workItem` field of `scripts/system-ck-exceptions.json` is required by the System CK guard
  (`scripts/check-system-ck-only.mjs:139`).
- **The libraries use System CK models only.** Use System examples in code, GraphQL documents, README and library
  notes, and never import `demo-app` or `legacy-demo-app` from a library; `npm run lint` runs
  `scripts/check-system-ck-only.mjs --strict` and fails otherwise. Known findings are listed in
  `scripts/system-ck-exceptions.json`: the `maxCount` of an entry only goes down, and a new entry needs `reason` and
  `workItem` (checked at `scripts/check-system-ck-only.mjs:137-139`).
