# @meshmakers/octo-services

Angular library providing services for interacting with OctoMesh backend APIs. Includes HTTP-based REST services and GraphQL services for Construction Kit operations.

## Table of Contents

- [Installation](#installation)
- [Setup](#setup)
- [Configuration](#configuration)
- [HTTP Services](#http-services)
  - [HealthService](#healthservice)
  - [AssetRepoService](#assetreposervice)
  - [IdentityService](#identityservice)
  - [BotService](#botservice)
  - [JobManagementService](#jobmanagementservice)
  - [CommunicationService](#communicationservice)
  - [TusUploadService](#tusuploadservice)
- [GraphQL Services](#graphql-services)
  - [CkTypeSelectorService](#cktypeselectorservice)
  - [CkTypeAttributeService](#cktypeattributeservice)
  - [CkModelService](#ckmodelservice)
  - [AttributeSelectorService](#attributeselectorservice)
- [Error Handling](#error-handling)
- [Models](#models)
- [Testing](#testing)

## Installation

The library is part of the meshmakers monorepo. Import it from `@meshmakers/octo-services`.

```typescript
import {
  // Configuration
  CONFIGURATION_SERVICE,
  IConfigurationService,
  AddInConfiguration,

  // HTTP Services
  HealthService,
  AssetRepoService,
  IdentityService,
  BotService,
  JobManagementService,
  CommunicationService,
  TusUploadService,

  // GraphQL Services
  CkTypeSelectorService,
  CkTypeAttributeService,
  CkModelService,
  AttributeSelectorService,

  // Error Handling
  OctoErrorLink,

  // DTOs
  TenantDto,
  UserDto,
  RoleDto,
  ClientDto,
  JobDto,
  HealthCheck
} from '@meshmakers/octo-services';
```

## Setup

### 1. Implement IConfigurationService

Each application must provide its own configuration service:

```typescript
// services/app-configuration.service.ts
import { Injectable } from '@angular/core';
import { IConfigurationService, AddInConfiguration } from '@meshmakers/octo-services';

@Injectable({ providedIn: 'root' })
export class AppConfigurationService implements IConfigurationService {
  private _config: AddInConfiguration = {} as AddInConfiguration;

  get config(): AddInConfiguration {
    return this._config;
  }

  async loadConfigAsync(): Promise<void> {
    const response = await fetch('/assets/config.json');
    this._config = await response.json();
  }
}
```

### 2. Register Configuration Provider

```typescript
// app.config.ts
import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { CONFIGURATION_SERVICE, IConfigurationService } from '@meshmakers/octo-services';
import { AppConfigurationService } from './services/app-configuration.service';

function initializeApp(configService: IConfigurationService) {
  return () => configService.loadConfigAsync();
}

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: CONFIGURATION_SERVICE, useClass: AppConfigurationService },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [CONFIGURATION_SERVICE],
      multi: true
    }
  ]
};
```

### 3. Configure Apollo Client with OctoErrorLink (Optional)

```typescript
// app.config.ts
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache, ApolloLink } from '@apollo/client/core';
import { OctoErrorLink, CONFIGURATION_SERVICE } from '@meshmakers/octo-services';

export const appConfig: ApplicationConfig = {
  providers: [
    provideApollo((httpLink: HttpLink, errorLink: OctoErrorLink, configService: IConfigurationService) => {
      return {
        link: ApolloLink.from([
          errorLink,
          httpLink.create({ uri: configService.config.assetServices + 'graphql' })
        ]),
        cache: new InMemoryCache()
      };
    }, [HttpLink, OctoErrorLink, CONFIGURATION_SERVICE])
  ]
};
```

## Configuration

### AddInConfiguration

```typescript
interface AddInConfiguration {
  communicationServices: string;  // Communication Controller base URL
  assetServices: string;          // Asset Repository base URL
  botServices: string;            // Bot Service base URL
  meshAdapterUrl: string;         // Mesh Adapter base URL
  crateDbAdminUrl: string;        // CrateDB Admin URL
  issuer: string;                 // Identity Service / OAuth issuer URL
  grafanaUrl: string;             // Grafana URL
  systemTenantId: string;         // System tenant ID
  clientId: string;               // OAuth client ID
  redirectUri: string;            // OAuth redirect URI
  postLogoutRedirectUri: string;  // OAuth post-logout redirect URI
}
```

### Example config.json

```json
{
  "assetServices": "https://api.example.com/assets/",
  "botServices": "https://api.example.com/bot/",
  "issuer": "https://identity.example.com/",
  "communicationServices": "https://api.example.com/comm/",
  "meshAdapterUrl": "https://api.example.com/mesh/",
  "crateDbAdminUrl": "https://cratedb.example.com:4200/",
  "grafanaUrl": "https://grafana.example.com/",
  "systemTenantId": "system",
  "clientId": "my-app",
  "redirectUri": "https://myapp.example.com/callback",
  "postLogoutRedirectUri": "https://myapp.example.com/"
}
```

## HTTP Services

### HealthService

Check health status of backend services.

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { HealthService, HealthCheck } from '@meshmakers/octo-services';

@Component({
  selector: 'app-health-dashboard',
  template: `
    <div *ngFor="let service of services">
      {{ service.name }}: {{ service.status }}
    </div>
  `
})
export class HealthDashboardComponent implements OnInit {
  private readonly healthService = inject(HealthService);
  services: { name: string; status: string }[] = [];

  async ngOnInit(): Promise<void> {
    const [assetRepo, identity, bot] = await Promise.all([
      this.healthService.getAssetRepoServiceHealthAsync(),
      this.healthService.getIdentityServiceAsync(),
      this.healthService.getBotServiceAsync()
    ]);

    this.services = [
      { name: 'Asset Repository', status: assetRepo?.status ?? 'Unknown' },
      { name: 'Identity Service', status: identity?.status ?? 'Unknown' },
      { name: 'Bot Service', status: bot?.status ?? 'Unknown' }
    ];
  }
}
```

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getAssetRepoServiceHealthAsync()` | `Promise<HealthCheck \| null>` | Asset Repository health |
| `getIdentityServiceAsync()` | `Promise<HealthCheck \| null>` | Identity Service health |
| `getBotServiceAsync()` | `Promise<HealthCheck \| null>` | Bot Service health |
| `getCommunicationControllerServiceAsync()` | `Promise<HealthCheck \| null>` | Communication Controller health |
| `getMeshAdapterAsync()` | `Promise<HealthCheck \| null>` | Mesh Adapter health |

---

### AssetRepoService

Manage tenants and model import/export operations.

#### Tenant Management

```typescript
import { Component, inject } from '@angular/core';
import { AssetRepoService, TenantDto } from '@meshmakers/octo-services';

@Component({ ... })
export class TenantManagerComponent {
  private readonly assetRepoService = inject(AssetRepoService);

  async loadTenants(): Promise<void> {
    const result = await this.assetRepoService.getTenants(0, 50);
    if (result) {
      console.log('Tenants:', result.list);
      console.log('Total:', result.totalCount);
    }
  }

  async createTenant(): Promise<void> {
    const tenant: TenantDto = {
      tenantId: 'new-tenant',
      database: 'new_tenant_db'
    };
    await this.assetRepoService.createTenant(tenant);
  }

  async deleteTenant(tenantId: string): Promise<void> {
    await this.assetRepoService.deleteTenant(tenantId);
  }
}
```

#### Model Import/Export

```typescript
// Import runtime model
async importModel(tenantId: string, file: File): Promise<void> {
  const jobId = await this.assetRepoService.importRtModel(tenantId, file);
  if (jobId) {
    // Wait for import job to complete
    await this.jobManagementService.waitForJob(jobId, 'Import', 'Model Import');
  }
}

// Export by query
async exportByQuery(tenantId: string, queryId: string): Promise<void> {
  const jobId = await this.assetRepoService.exportRtModelByQuery(tenantId, queryId);
  if (jobId) {
    const success = await this.jobManagementService.waitForJob(jobId, 'Export', 'Model Export');
    if (success) {
      await this.jobManagementService.downloadJobResult(tenantId, jobId, 'export.zip');
    }
  }
}
```

#### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `getTenants(skip, take)` | `skip: number, take: number` | `Promise<PagedResultDto<TenantDto> \| null>` | List tenants |
| `getTenantDetails(tenantId)` | `tenantId: string` | `Promise<TenantDto \| null>` | Get tenant details |
| `createTenant(tenant)` | `tenant: TenantDto` | `Promise<void>` | Create tenant |
| `attachTenant(tenant)` | `tenant: TenantDto` | `Promise<void>` | Attach existing DB |
| `detachTenant(tenantId)` | `tenantId: string` | `Promise<void>` | Detach tenant |
| `deleteTenant(tenantId)` | `tenantId: string` | `Promise<void>` | Delete tenant |
| `importRtModel(tenantId, file)` | `tenantId: string, file: File` | `Promise<string \| null>` | Import RT model |
| `importCkModel(tenantId, file)` | `tenantId: string, file: File` | `Promise<string \| null>` | Import CK model |
| `exportRtModelByQuery(tenantId, queryId)` | `tenantId: string, queryId: string` | `Promise<string \| null>` | Export by query |
| `exportRtModelDeepGraph(tenantId, rtIds, ckTypeId)` | `tenantId: string, rtIds: string[], ckTypeId: string` | `Promise<string \| null>` | Export deep graph |

---

### IdentityService

Manage users, roles, and OAuth clients.

#### User Management

```typescript
import { Component, inject } from '@angular/core';
import { IdentityService, UserDto, RoleDto } from '@meshmakers/octo-services';

@Component({ ... })
export class UserManagerComponent {
  private readonly identityService = inject(IdentityService);

  async loadUsers(): Promise<void> {
    const result = await this.identityService.getUsers(0, 50);
    console.log('Users:', result?.list);
  }

  async createUser(user: UserDto): Promise<void> {
    await this.identityService.createUser(user);
  }

  async assignRole(userName: string, roleName: string): Promise<void> {
    await this.identityService.addUserToRole(userName, roleName);
  }

  async resetUserPassword(userName: string): Promise<void> {
    const generated = await this.identityService.generatePassword();
    if (generated) {
      await this.identityService.resetPassword(userName, generated.password);
    }
  }
}
```

#### Role Management

```typescript
async loadRoles(): Promise<void> {
  const result = await this.identityService.getRoles(0, 100);
  console.log('Roles:', result?.list);
}

async createRole(role: RoleDto): Promise<void> {
  await this.identityService.createRole(role);
}
```

#### Client Management

```typescript
async loadClients(): Promise<void> {
  const result = await this.identityService.getClients(0, 50);
  console.log('OAuth Clients:', result?.list);
}
```

#### Methods

**User Management:**

| Method | Returns | Description |
|--------|---------|-------------|
| `getUsers(skip, take)` | `Promise<PagedResultDto<UserDto> \| null>` | List users |
| `getUserDetails(userName)` | `Promise<UserDto \| null>` | Get user |
| `createUser(user)` | `Promise<void>` | Create user |
| `updateUser(userName, user)` | `Promise<void>` | Update user |
| `deleteUser(userName)` | `Promise<void>` | Delete user |
| `getUserRoles(userName)` | `Promise<RoleDto[] \| null>` | Get user's roles |
| `updateUserRoles(userName, roles)` | `Promise<void>` | Set user's roles |
| `addUserToRole(userName, roleName)` | `Promise<void>` | Add role to user |
| `removeRoleFromUser(userName, roleName)` | `Promise<void>` | Remove role |
| `resetPassword(userName, password)` | `Promise<any>` | Reset password |
| `generatePassword()` | `Promise<GeneratedPasswordDto \| null>` | Generate password |
| `mergeUsers(targetUserName, sourceUserName)` | `Promise<void>` | Merge source user into target user |

**Role Management:**

| Method | Returns | Description |
|--------|---------|-------------|
| `getRoles(skip, take)` | `Promise<PagedResultDto<RoleDto> \| null>` | List roles |
| `getRoleDetails(roleName)` | `Promise<RoleDto \| null>` | Get role |
| `createRole(role)` | `Promise<void>` | Create role |
| `updateRole(roleName, role)` | `Promise<void>` | Update role |
| `deleteRole(roleName)` | `Promise<void>` | Delete role |

**Client Management:**

| Method | Returns | Description |
|--------|---------|-------------|
| `getClients(skip, take)` | `Promise<PagedResultDto<ClientDto> \| null>` | List clients |
| `getClientDetails(clientId)` | `Promise<ClientDto \| null>` | Get client |
| `createClient(client)` | `Promise<void>` | Create client |
| `updateClient(clientId, client)` | `Promise<void>` | Update client |
| `deleteClient(clientId)` | `Promise<void>` | Delete client |

---

### BotService

Execute background jobs and manage repository operations.

```typescript
import { Component, inject } from '@angular/core';
import { BotService, JobManagementService } from '@meshmakers/octo-services';

@Component({ ... })
export class AdminComponent {
  private readonly botService = inject(BotService);
  private readonly jobManagementService = inject(JobManagementService);

  async runFixupScripts(tenantId: string): Promise<void> {
    const response = await this.botService.runFixupScripts(tenantId);
    if (response?.jobId) {
      await this.jobManagementService.waitForJob(
        response.jobId,
        'Running Fixup Scripts',
        'Fixup Scripts'
      );
    }
  }

  async dumpRepository(tenantId: string): Promise<void> {
    const response = await this.botService.dumpRepository(tenantId);
    if (response?.jobId) {
      const success = await this.jobManagementService.waitForJob(
        response.jobId,
        'Creating Backup',
        'Repository Dump'
      );
      if (success) {
        await this.jobManagementService.downloadJobResult(
          tenantId,
          response.jobId,
          `backup-${tenantId}.zip`
        );
      }
    }
  }
}
```

#### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `runFixupScripts(tenantId)` | `tenantId: string` | `Promise<JobResponseDto \| null>` | Run fixup scripts |
| `dumpRepository(tenantId)` | `tenantId: string` | `Promise<JobResponseDto \| null>` | Create backup |
| `restoreRepository(tenantId, dbName, file)` | `tenantId: string, dbName: string, file: File` | `Promise<JobResponseDto \| null>` | Restore backup |
| `downloadJobResultBinary(tenantId, jobId)` | `tenantId: string, jobId: string` | `Promise<Blob \| null>` | Download result |
| `getJobStatus(jobId)` | `jobId: string` | `Promise<JobDto \| null>` | Get job status |

---

### JobManagementService

High-level job management with progress UI.

```typescript
import { Component, inject } from '@angular/core';
import { JobManagementService } from '@meshmakers/octo-services';

@Component({ ... })
export class ExportComponent {
  private readonly jobManagementService = inject(JobManagementService);

  async exportAndDownload(tenantId: string, jobId: string): Promise<void> {
    // Wait for job with progress dialog
    const success = await this.jobManagementService.waitForJob(
      jobId,
      'Exporting Data',      // Dialog title
      'Export Operation'      // Operation name for error messages
    );

    if (success) {
      // Download the result
      await this.jobManagementService.downloadJobResult(
        tenantId,
        jobId,
        'export-data.zip'
      );
    }
  }
}
```

#### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `waitForJob(jobId, title, operation)` | `jobId: string, title: string, operation: string` | `Promise<boolean>` | Wait with progress dialog |
| `downloadJobResult(tenantId, jobId, fileName)` | `tenantId: string, jobId: string, fileName: string` | `Promise<void>` | Download and save file |

---

### CommunicationService

Manages adapter deployment, pipeline execution, and pipeline debugging via the Communication Controller API.

```typescript
import { CommunicationService } from '@meshmakers/octo-services';

@Component({ ... })
export class PipelineComponent {
  private readonly communicationService = inject(CommunicationService);

  async deployAndExecute(tenantId: string, pipelineRtId: string): Promise<void> {
    // Deploy a data flow
    await this.communicationService.deployDataFlow(tenantId, pipelineRtId);

    // Execute it manually
    const result = await this.communicationService.executePipeline(tenantId, pipelineRtId);

    // Check execution history
    const executions = await this.communicationService.getPipelineExecutions(
      tenantId, pipelineRtId, 'MyModel/MyPipeline', 0, 10
    );
  }
}
```

#### Methods

**Trigger Deployment:**

| Method | Returns | Description |
|--------|---------|-------------|
| `deployTrigger(tenantId)` | `Promise<void>` | Deploy all data pipeline triggers |

**Adapter Configuration:**

| Method | Returns | Description |
|--------|---------|-------------|
| `deployAdapterConfigurationUpdate(tenantId, adapterRtId, adapterCkTypeId)` | `Promise<void>` | Deploy adapter config update |

**Pool-Level Adapter Management:**

| Method | Returns | Description |
|--------|---------|-------------|
| `deployAllAdaptersOfPool(tenantId, poolRtId)` | `Promise<void>` | Deploy all adapters of a pool |
| `undeployAllAdaptersOfPool(tenantId, poolRtId)` | `Promise<void>` | Undeploy all adapters of a pool |

**Individual Adapter Management:**

| Method | Returns | Description |
|--------|---------|-------------|
| `deployAdapter(tenantId, poolRtId, adapterRtId, adapterCkTypeId)` | `Promise<void>` | Deploy single adapter |
| `undeployAdapter(tenantId, poolRtId, adapterRtId, adapterCkTypeId)` | `Promise<void>` | Undeploy single adapter |

**Pipeline Execution:**

| Method | Returns | Description |
|--------|---------|-------------|
| `executePipeline(tenantId, dataPipelineRtId)` | `Promise<PipelineExecutionDataDto \| null>` | Execute pipeline manually |

**Pipeline Deployment:**

| Method | Returns | Description |
|--------|---------|-------------|
| `deployPipelineDefinition(tenantId, adapterRtId, adapterCkTypeId, pipelineRtId, pipelineCkTypeId, pipelineDefinition)` | `Promise<void>` | Deploy pipeline definition |
| `deployDataFlow(tenantId, dataFlowRtId)` | `Promise<void>` | Deploy data flow |
| `undeployDataFlow(tenantId, dataFlowRtId)` | `Promise<void>` | Undeploy data flow |
| `getPipelineStatus(tenantId, pipelineRtId, pipelineCkTypeId)` | `Promise<DeploymentResultDto \| null>` | Get deployment status |
| `getPipelineSchema(tenantId, adapterRtId, adapterCkTypeId)` | `Promise<Record<string, unknown> \| null>` | Get JSON Schema for adapter |

**Pipeline Debugging:**

| Method | Returns | Description |
|--------|---------|-------------|
| `getPipelineExecutions(tenantId, pipelineRtId, pipelineCkTypeId, skip, take)` | `Promise<PipelineExecutionDataDto[]>` | Get execution history |
| `getLatestPipelineExecution(tenantId, pipelineRtId, pipelineCkTypeId)` | `Promise<PipelineExecutionDataDto \| null>` | Get latest execution |
| `getPipelineExecutionDebugPointNodes(tenantId, pipelineRtId, pipelineCkTypeId, executionId)` | `Promise<DebugPointNode[] \| null>` | Get debug point tree |
| `getDebugPoint(tenantId, pipelineRtId, pipelineCkTypeId, executionId, nodeId)` | `Promise<DebugPointDataDto \| null>` | Get data at debug point |

---

### TusUploadService

Resumable file uploads using the [TUS protocol](https://tus.io/). Used for uploading large database dump files for repository restore operations.

```typescript
import { TusUploadService, TusUploadOptions } from '@meshmakers/octo-services';

@Component({ ... })
export class RestoreComponent {
  private readonly tusUploadService = inject(TusUploadService);

  async uploadAndRestore(file: File, tenantId: string, dbName: string): Promise<void> {
    const result = await this.tusUploadService.startUpload({
      file,
      tenantId,
      databaseName: dbName,
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = (bytesUploaded / bytesTotal * 100).toFixed(1);
        console.log(`Upload progress: ${percentage}%`);
      }
    });

    console.log('Restore job started:', result.jobId);
  }
}
```

#### TusUploadOptions

```typescript
interface TusUploadOptions {
  file: File;                      // File to upload
  tenantId: string;                // Target tenant
  databaseName: string;            // Target database name
  oldDatabaseName?: string;        // Original database name (for rename)
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
}
```

#### TusUploadResult

```typescript
interface TusUploadResult {
  jobId: string;                   // Job ID for tracking restore progress
}
```

**Features:**
- Chunk size: 50 MB
- Automatic retries with backoff (0s, 1s, 3s, 5s, 10s)
- Automatic Bearer token injection
- Returns job ID for tracking via `JobManagementService.waitForJob()`

---

## GraphQL Services

### CkTypeSelectorService

Query Construction Kit types.

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { CkTypeSelectorService, CkTypeSelectorItem } from '@meshmakers/octo-services';

@Component({ ... })
export class TypeSelectorComponent implements OnInit {
  private readonly ckTypeSelectorService = inject(CkTypeSelectorService);
  types: CkTypeSelectorItem[] = [];

  ngOnInit(): void {
    this.loadTypes();
  }

  loadTypes(searchText?: string): void {
    this.ckTypeSelectorService.getCkTypes({
      ckModelIds: ['System.Core', 'MyModel'],  // Optional: filter by models
      searchText: searchText,                   // Optional: search filter
      first: 50,                                // Page size
      skip: 0                                   // Offset
    }).subscribe(result => {
      this.types = result.items;
      console.log('Total types:', result.totalCount);
    });
  }

  getTypeById(rtCkTypeId: string): void {
    this.ckTypeSelectorService.getCkTypeByRtCkTypeId(rtCkTypeId)
      .subscribe(item => {
        if (item) {
          console.log('Found type:', item.fullName);
        }
      });
  }

  getDerivedTypes(baseTypeId: string): void {
    this.ckTypeSelectorService.getDerivedCkTypes(baseTypeId, {
      searchText: '',
      ignoreAbstractTypes: true
    }).subscribe(result => {
      console.log('Derived types:', result.items);
    });
  }
}
```

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getCkTypes(options?)` | `Observable<{items, totalCount}>` | Query types with filtering and pagination |
| `getCkTypeByRtCkTypeId(rtCkTypeId)` | `Observable<CkTypeSelectorItem \| null>` | Get single type by runtime ID |
| `getDerivedCkTypes(rtCkTypeId, options)` | `Observable<{items, totalCount}>` | Get derived types of a base type |

#### CkTypeSelectorItem Interface

```typescript
interface CkTypeSelectorItem {
  fullName: string;           // e.g., "OctoSdkDemo-1.0.0/Customer-1"
  rtCkTypeId: string;         // e.g., "OctoSdkDemo/Customer" - USE THIS FOR QUERIES!
  baseTypeFullName?: string;
  baseTypeRtCkTypeId?: string;
  isAbstract: boolean;
  isFinal: boolean;
  description?: string;
}
```

---

### CkTypeAttributeService

Get attributes for CK types and records.

```typescript
import { Component, inject } from '@angular/core';
import { CkTypeAttributeService, CkTypeAttributeInfo } from '@meshmakers/octo-services';

@Component({ ... })
export class AttributeListComponent {
  private readonly attributeService = inject(CkTypeAttributeService);

  loadTypeAttributes(ckTypeId: string): void {
    this.attributeService.getCkTypeAttributes(ckTypeId)
      .subscribe(attributes => {
        attributes.forEach(attr => {
          console.log(`${attr.attributeName}: ${attr.attributeValueType}`);
        });
      });
  }

  loadRecordAttributes(ckRecordId: string): void {
    this.attributeService.getCkRecordAttributes(ckRecordId)
      .subscribe(attributes => {
        console.log('Record attributes:', attributes);
      });
  }
}
```

---

### CkModelService

Check model availability and versions.

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { CkModelService } from '@meshmakers/octo-services';

@Component({ ... })
export class FeatureComponent implements OnInit {
  private readonly ckModelService = inject(CkModelService);
  featureAvailable = false;

  async ngOnInit(): Promise<void> {
    // Check if required model is available
    this.featureAvailable = await this.ckModelService.isModelAvailable('System.UI');

    // Check minimum version requirement
    const hasRequiredVersion = await this.ckModelService.isModelAvailableWithMinVersion(
      'System.UI',
      '1.2.0'
    );

    if (hasRequiredVersion) {
      console.log('Required version available');
    }

    // Get current version
    const version = await this.ckModelService.getModelVersion('System.UI');
    console.log('Current version:', version);
  }
}
```

#### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `isModelAvailable(modelName)` | `modelName: string` | `Promise<boolean>` | Check if model exists |
| `isModelAvailableWithMinVersion(modelName, minVersion)` | `modelName: string, minVersion: string` | `Promise<boolean>` | Check minimum version |
| `getModelVersion(modelName)` | `modelName: string` | `Promise<string \| null>` | Get model version |

---

### AttributeSelectorService

Get available query columns for a CK type.

```typescript
import { Component, inject } from '@angular/core';
import { AttributeSelectorService } from '@meshmakers/octo-services';

@Component({ ... })
export class QueryBuilderComponent {
  private readonly attributeSelectorService = inject(AttributeSelectorService);

  loadAvailableColumns(rtCkTypeId: string): void {
    this.attributeSelectorService.getAvailableAttributes(
      rtCkTypeId,
      'name',       // Optional: filter by attribute path
      100,          // Optional: page size (default: 1000)
      undefined     // Optional: cursor for pagination
    ).subscribe(result => {
      result.items.forEach(col => {
        console.log(`${col.attributePath}: ${col.attributeValueType}`);
      });
    });
  }
}
```

---

## Error Handling

### OctoErrorLink

Apollo Link that handles GraphQL errors and displays them via `MessageService`.

```typescript
// The OctoErrorLink automatically:
// - Extracts error messages from GraphQL errors
// - Shows user-friendly error notifications
// - Logs detailed error information to console
// - Handles network errors gracefully
```

#### Error Response Format

The link handles errors with `extensions.OctoDetails`:

```json
{
  "errors": [{
    "message": "Validation failed",
    "extensions": {
      "OctoDetails": {
        "code": "VALIDATION_ERROR",
        "details": "Field 'name' is required"
      }
    }
  }]
}
```

---

## Models

### TenantDto

```typescript
interface TenantDto {
  tenantId: string;
  database: string;
}
```

### UserDto

```typescript
interface UserDto {
  id?: string;
  userName?: string;
  email?: string;
  emailConfirmed?: boolean;
  phoneNumber?: string;
  phoneNumberConfirmed?: boolean;
  twoFactorEnabled?: boolean;
  lockoutEnd?: string;
  lockoutEnabled?: boolean;
  accessFailedCount?: number;
  roles?: RoleDto[];
}
```

### RoleDto

```typescript
interface RoleDto {
  id?: string;
  name?: string;
  normalizedName?: string;
}
```

### ClientDto

```typescript
interface ClientDto {
  id?: number;
  clientId?: string;
  clientName?: string;
  description?: string;
  grantTypes?: GrantTypes[];
  scopes?: ClientScope[];
}
```

### JobDto

```typescript
interface JobDto {
  id: string;
  createdAt: Date | null;
  stateChangedAt: Date | null;
  status: string | null;       // 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Deleted'
  reason: string | null;
  errorMessage: string | null;
}
```

### HealthCheck

```typescript
enum HealthStatus {
  Unhealthy = 'Unhealthy',
  Degraded = 'Degraded',
  Healthy = 'Healthy'
}

interface HealthCheckResult {
  title: string;
  data: Map<string, any> | null;
  description: string | null;
  status: HealthStatus;
}

interface HealthCheck {
  status: HealthStatus;
  results: HealthCheckResult[];
}
```

### PagedResultDto

```typescript
interface PagedResultDto<T> {
  skip: number;
  take: number;
  totalCount: number;
  list: T[];
}
```

---

## Testing

### HTTP Service Tests

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AssetRepoService, CONFIGURATION_SERVICE, AddInConfiguration } from '@meshmakers/octo-services';

describe('AssetRepoService', () => {
  let service: AssetRepoService;
  let httpMock: HttpTestingController;
  let mockConfigService: { config: AddInConfiguration | null };

  beforeEach(() => {
    mockConfigService = {
      config: {
        assetServices: 'https://api.example.com/',
        // ... other config
      } as AddInConfiguration
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AssetRepoService,
        { provide: CONFIGURATION_SERVICE, useValue: mockConfigService }
      ]
    });

    service = TestBed.inject(AssetRepoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should get tenants', async () => {
    const mockResponse = { skip: 0, take: 10, totalCount: 1, list: [{ tenantId: 't1', database: 'db1' }] };

    const promise = service.getTenants(0, 10);

    const req = httpMock.expectOne('https://api.example.com/octosystem/v1/tenants?skip=0&take=10');
    req.flush(mockResponse);

    const result = await promise;
    expect(result?.list.length).toBe(1);
  });
});
```

### GraphQL Service Tests

```typescript
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CkTypeSelectorService, GetCkTypesDtoGQL } from '@meshmakers/octo-services';

describe('CkTypeSelectorService', () => {
  let service: CkTypeSelectorService;
  let getCkTypesGQLMock: jasmine.SpyObj<GetCkTypesDtoGQL>;

  beforeEach(() => {
    getCkTypesGQLMock = jasmine.createSpyObj('GetCkTypesDtoGQL', ['fetch']);

    TestBed.configureTestingModule({
      providers: [
        CkTypeSelectorService,
        { provide: GetCkTypesDtoGQL, useValue: getCkTypesGQLMock }
      ]
    });

    service = TestBed.inject(CkTypeSelectorService);
  });

  it('should fetch types', (done) => {
    const mockResponse = {
      data: {
        constructionKit: {
          types: {
            totalCount: 1,
            items: [{
              ckTypeId: { fullName: 'Model-1.0.0/Type-1' },
              rtCkTypeId: 'Model/Type',
              isAbstract: false,
              isFinal: false,
              description: 'Test',
              baseType: null
            }]
          }
        }
      }
    } as any;

    getCkTypesGQLMock.fetch.and.returnValue(of(mockResponse));

    service.getCkTypes().subscribe(result => {
      expect(result.items.length).toBe(1);
      expect(result.items[0].rtCkTypeId).toBe('Model/Type');
      done();
    });
  });
});
```

### Run Tests

```bash
# Run all octo-services tests
npm test -- --project=@meshmakers/octo-services --watch=false

# With Chrome Headless
CHROME_BIN="/path/to/chrome" npm test -- --project=@meshmakers/octo-services --watch=false --browsers=ChromeHeadless

# With coverage
npm test -- --project=@meshmakers/octo-services --watch=false --code-coverage
```
