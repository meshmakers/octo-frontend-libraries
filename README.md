# octo-frontend-libraries

Angular monorepo containing shared libraries and the template application for OctoMesh frontend development.

See [src/frontend-libraries/README.md](src/frontend-libraries/README.md) for full documentation including project structure, build commands, styling guidelines, and Telerik/Kendo UI license setup.

## Backend Setup

`npm run codegen` needs the local `meshtest` tenant with all construction kit models referenced by the `.graphql` documents. Run `./scripts/om-setup-meshtest-tenant.ps1` (idempotent, requires services started via Start-Octo); the script header documents the CK models, how each one gets installed, and the available options.
