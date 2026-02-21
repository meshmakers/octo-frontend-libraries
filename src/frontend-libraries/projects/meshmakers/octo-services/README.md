# @meshmakers/octo-services

Angular library providing services for interacting with OctoMesh backend APIs.

## Features

- **HTTP Services** - REST API clients for Asset Repository, Identity Service, Bot Service
- **GraphQL Services** - Construction Kit queries for types, attributes, and models
- **Job Management** - Background job execution with progress tracking
- **Error Handling** - Apollo Link for GraphQL error handling with user notifications

## Documentation

- [Developer Documentation](docs/README.md) - Complete API reference and usage examples
- [AI Context](CLAUDE.md) - Guidelines for AI-assisted development

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

## Available Services

| Service | Description |
|---------|-------------|
| `HealthService` | Backend health checks |
| `AssetRepoService` | Tenant and model management |
| `IdentityService` | User, role, and client management |
| `BotService` | Background job execution |
| `JobManagementService` | Job progress tracking with UI |
| `CkTypeSelectorService` | Query CK types |
| `CkTypeAttributeService` | Query CK type/record attributes |
| `CkModelService` | Check model availability and versions |
| `AttributeSelectorService` | Query available query columns |

## Build

```bash
# From frontend-libraries directory
npm run build:octo-services
```

## Test

```bash
npm test -- --project=@meshmakers/octo-services --watch=false
```

## Lint

```bash
npx ng lint @meshmakers/octo-services
```
