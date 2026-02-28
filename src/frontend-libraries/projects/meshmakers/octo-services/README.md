# @meshmakers/octo-services

Angular library providing services for interacting with OctoMesh backend APIs.

Part of the [@meshmakers](https://www.npmjs.com/org/meshmakers) package ecosystem.

## Features

- **HTTP Services** - REST API clients for Asset Repository, Identity Service, Bot Service, Communication Controller
- **GraphQL Services** - Construction Kit queries for types, attributes, and models
- **Job Management** - Background job execution with progress tracking
- **TUS Upload** - Resumable file uploads for large database restores
- **Error Handling** - Apollo Link for GraphQL error handling with user notifications

## Build & Test

```bash
# Build
npm run build:octo-services

# Lint
npm run lint:octo-services

# Run tests
npm test -- --project=@meshmakers/octo-services --watch=false
```

## Architecture

```
octo-services/
├── src/
│   ├── public-api.ts
│   └── lib/
│       ├── services/
│       │   ├── health.service.ts            # Backend health checks
│       │   ├── asset-repo.service.ts        # Tenant and model management
│       │   ├── identity-service.ts          # User, role, client management
│       │   ├── bot-service.ts               # Background job execution
│       │   ├── job-management.service.ts    # Job progress tracking with UI
│       │   ├── communication.service.ts     # Adapter and pipeline management
│       │   ├── tus-upload.service.ts        # Resumable file uploads (TUS)
│       │   ├── ck-type-selector.service.ts  # Query CK types (GraphQL)
│       │   ├── ck-type-attribute.service.ts # Query CK type attributes (GraphQL)
│       │   ├── ck-model.service.ts          # Check model availability (GraphQL)
│       │   ├── attribute-selector.service.ts # Query columns (GraphQL)
│       │   ├── configuration.service.ts     # Configuration injection token
│       │   └── tenant-provider.ts           # Tenant ID injection token
│       ├── graphQL/                         # GraphQL queries and generated types
│       ├── shared/                          # DTOs, models, and utilities
│       ├── options/                         # Configuration options
│       └── compat/                          # Backward compatibility exports
```

## Services

### HTTP Services

| Service | Description |
|---------|-------------|
| `HealthService` | Backend health checks (Asset Repo, Identity, Bot, Communication, Mesh Adapter) |
| `AssetRepoService` | Tenant management, model import/export, user merging |
| `IdentityService` | User, role, and OAuth client management |
| `BotService` | Background job execution (fixup scripts, dump/restore) |
| `JobManagementService` | Job progress tracking with UI dialogs |
| `CommunicationService` | Adapter deployment, pipeline execution, and debugging |
| `TusUploadService` | Resumable file uploads via TUS protocol |

### GraphQL Services

| Service | Description |
|---------|-------------|
| `CkTypeSelectorService` | Query CK types with filtering, pagination, and derived types |
| `CkTypeAttributeService` | Query CK type and record attributes |
| `CkModelService` | Check model availability and versions |
| `AttributeSelectorService` | Query available query columns for a CK type |

## Quick Start

### 1. Implement Configuration Service

```typescript
import { Injectable } from '@angular/core';
import { IConfigurationService, AddInConfiguration } from '@meshmakers/octo-services';

@Injectable({ providedIn: 'root' })
export class AppConfigurationService implements IConfigurationService {
  private _config: AddInConfiguration = {} as AddInConfiguration;

  get config(): AddInConfiguration {
    return this._config;
  }

  async loadConfigAsync(): Promise<void> {
    this._config = await fetch('/assets/config.json').then(r => r.json());
  }
}
```

### 2. Register Providers

```typescript
import { CONFIGURATION_SERVICE } from '@meshmakers/octo-services';
import { AppConfigurationService } from './services/app-configuration.service';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: CONFIGURATION_SERVICE, useClass: AppConfigurationService }
  ]
};
```

### 3. Use Services

```typescript
import { HealthService, CkTypeSelectorService } from '@meshmakers/octo-services';

@Component({ ... })
export class MyComponent {
  private readonly healthService = inject(HealthService);
  private readonly ckTypeSelector = inject(CkTypeSelectorService);

  async checkHealth(): Promise<void> {
    const health = await this.healthService.getAssetRepoServiceHealthAsync();
    console.log('Status:', health?.status);
  }

  loadTypes(): void {
    this.ckTypeSelector.getCkTypes({ searchText: 'Customer' })
      .subscribe(result => console.log('Types:', result.items));
  }
}
```

## Detailed Documentation

See [docs/README.md](docs/README.md) for complete API reference with all method signatures and usage examples.

See [CLAUDE.md](CLAUDE.md) for development guidelines, CK ID types, GraphQL utilities, and testing patterns.

## Dependencies

- **Angular 21** (core, common/http)
- **Apollo Angular** / **@apollo/client** (GraphQL client)
- **tus-js-client** (resumable uploads)
- **@meshmakers/shared-auth** (AuthorizeService for TUS uploads)
- **@meshmakers/shared-services** (MessageService, PagedResultDto)
- **@meshmakers/shared-ui** (ProgressWindowService for job tracking)

## Documentation and Testing Standards

- **All developer documentation must be written in English**
- **Every code change must include updated documentation** — update README.md, CLAUDE.md, docs/README.md, or inline docs when adding, modifying, or removing features
- **Unit tests and integration tests must be executed** after every code change
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features, components, or services are implemented
- Never commit code with failing tests
