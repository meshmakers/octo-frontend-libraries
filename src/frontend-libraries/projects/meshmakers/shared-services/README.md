# @meshmakers/shared-services

Angular library providing shared services for Octo Mesh Platform applications.

Includes message service, navigation, breadcrumbs, command infrastructure, and utility services.

Part of the [@meshmakers](https://www.npmjs.com/org/meshmakers) package ecosystem.

## Installation

```bash
npm install @meshmakers/shared-services
```

## Quick Start

```typescript
// app.config.ts
import { provideMmSharedServices } from '@meshmakers/shared-services';

export const appConfig: ApplicationConfig = {
  providers: [
    provideMmSharedServices(),
  ]
};
```

## Available Services

| Service | Description |
|---------|-------------|
| `MessageService` | User-facing messages (info, warning, error) |
| `BreadCrumbService` | Navigation breadcrumb management |
| `CommandService` | Command execution infrastructure |
| `ProgressNotifierService` | Progress reporting and cancellation |

## Build

```bash
npm run build:shared-services
```

## Test

```bash
npm test -- --project=@meshmakers/shared-services --watch=false
```

## Documentation

See [Octo Mesh Platform documentation](https://docs.meshmakers.cloud).
