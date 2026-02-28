# octo-services Library Guidelines

## Overview

The `@meshmakers/octo-services` library provides Angular services for interacting with the Octo Mesh backend services. It includes HTTP-based services for REST APIs and GraphQL services for Construction Kit queries.

## Build Commands

```bash
# From frontend-libraries directory
npm run build:octo-services

# Run tests
npm test -- --project=@meshmakers/octo-services --watch=false

# Run lint
npx ng lint @meshmakers/octo-services
```

## GraphQL Code Generation

After modifying any `.graphql` file, run the code generator:

```bash
npm run codegen
```

## Documentation and Testing Standards

- **All developer documentation must be written in English**
- **Every code change must include updated documentation** — update README.md, CLAUDE.md, or inline docs when adding, modifying, or removing features
- **Unit tests and integration tests must be executed** after every code change
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features, components, or services are implemented
- Never commit code with failing tests

## Project Structure

```
src/lib/
├── services/           # Angular services
├── shared/             # DTOs, models, and utilities
├── graphQL/            # Generated GraphQL types and services
└── options/            # Configuration options
```

---

## Configuration

### AddInConfiguration

The central configuration interface for all service URLs:

```typescript
export interface AddInConfiguration {
  communicationServices: string;  // Communication Controller API base URL
  assetServices: string;          // Asset Repository API base URL
  botServices: string;            // Bot Service API base URL
  meshAdapterUrl: string;         // Mesh Adapter API base URL
  crateDbAdminUrl: string;        // CrateDB Admin URL
  issuer: string;                 // Identity Service / OAuth issuer URL
  grafanaUrl: string;             // Grafana dashboard URL
  systemTenantId: string;         // System tenant identifier
  clientId: string;               // OAuth client ID
  redirectUri: string;            // OAuth redirect URI
  postLogoutRedirectUri: string;  // OAuth post-logout redirect URI
}
```

### IConfigurationService

Applications must provide their own implementation of `IConfigurationService`:

```typescript
// In your app
@Injectable({ providedIn: 'root' })
export class AppConfigurationService implements IConfigurationService {
  private _config: AddInConfiguration = {} as AddInConfiguration;

  get config(): AddInConfiguration {
    return this._config;
  }

  async loadConfigAsync(): Promise<void> {
    // Load configuration from server/environment
    this._config = await fetch('/config.json').then(r => r.json());
  }
}

// In app.config.ts
providers: [
  { provide: CONFIGURATION_SERVICE, useClass: AppConfigurationService }
]
```

---

## HTTP-Based Services

### HealthService

Checks health status of backend services.

| Method | Returns | Description |
|--------|---------|-------------|
| `getAssetRepoServiceHealthAsync()` | `Promise<HealthCheck \| null>` | Asset Repository health |
| `getIdentityServiceAsync()` | `Promise<HealthCheck \| null>` | Identity Service health |
| `getBotServiceAsync()` | `Promise<HealthCheck \| null>` | Bot Service health |
| `getCommunicationControllerServiceAsync()` | `Promise<HealthCheck \| null>` | Communication Controller health |
| `getMeshAdapterAsync()` | `Promise<HealthCheck \| null>` | Mesh Adapter health |

### AssetRepoService

Manages tenants and model import/export.

**Tenant Management:**

| Method | Description |
|--------|-------------|
| `getTenants(skip, take)` | List tenants with pagination |
| `getTenantDetails(tenantId)` | Get tenant details |
| `createTenant(tenantDto)` | Create a new tenant |
| `attachTenant(tenantDto)` | Attach existing database as tenant |
| `detachTenant(tenantId)` | Detach tenant (keep database) |
| `deleteTenant(tenantId)` | Delete tenant and database |

**Model Import/Export:**

| Method | Description |
|--------|-------------|
| `importRtModel(tenantId, file)` | Import runtime model from file |
| `importCkModel(tenantId, file)` | Import construction kit model |
| `exportRtModelByQuery(tenantId, queryId)` | Export RT model by query |
| `exportRtModelDeepGraph(tenantId, rtIds, ckTypeId)` | Export deep graph |

### IdentityService

Manages users, roles, and OAuth clients.

**User Management:**

| Method | Description |
|--------|-------------|
| `getUsers(skip, take)` | List users with pagination |
| `getUserDetails(userName)` | Get user details |
| `createUser(userDto)` | Create user |
| `updateUser(userName, userDto)` | Update user |
| `deleteUser(userName)` | Delete user |
| `resetPassword(userName, password)` | Reset user password |
| `getUserRoles(userName)` | Get user's roles |
| `updateUserRoles(userName, roles)` | Update user's roles |
| `addUserToRole(userName, roleName)` | Add user to role |
| `removeRoleFromUser(userName, roleName)` | Remove user from role |

**Role Management:**

| Method | Description |
|--------|-------------|
| `getRoles(skip, take)` | List roles with pagination |
| `getRoleDetails(roleName)` | Get role details |
| `createRole(roleDto)` | Create role |
| `updateRole(roleName, roleDto)` | Update role |
| `deleteRole(roleName)` | Delete role |

**Client Management:**

| Method | Description |
|--------|-------------|
| `getClients(skip, take)` | List OAuth clients |
| `getClientDetails(clientId)` | Get client details |
| `createClient(clientDto)` | Create client |
| `updateClient(clientId, clientDto)` | Update client |
| `deleteClient(clientId)` | Delete client |

**Utilities:**

| Method | Description |
|--------|-------------|
| `generatePassword()` | Generate secure password |
| `mergeUsers(targetUserName, sourceUserName)` | Merge source user into target user |
| `userDiagnostics()` | Get user diagnostics info |

### BotService

Manages background jobs and repository operations.

| Method | Description |
|--------|-------------|
| `runFixupScripts(tenantId)` | Run fixup scripts |
| `dumpRepository(tenantId)` | Create repository dump |
| `restoreRepository(tenantId, dbName, file)` | Restore from dump |
| `downloadJobResultBinary(tenantId, jobId)` | Download job result as Blob |
| `getJobStatus(jobId)` | Get job status |

### JobManagementService

High-level job management with progress UI.

| Method | Description |
|--------|-------------|
| `downloadJobResult(tenantId, jobId, fileName)` | Download and save job result |
| `waitForJob(jobId, title, operation)` | Wait for job with progress dialog |

### CommunicationService

Manages adapter deployment, pipeline execution, and pipeline debugging.

| Method | Description |
|--------|-------------|
| `deployTrigger(tenantId)` | Deploy all data pipeline triggers |
| `deployAdapterConfigurationUpdate(tenantId, adapterRtId, adapterCkTypeId)` | Deploy adapter config update |
| `deployAllAdaptersOfPool(tenantId, poolRtId)` | Deploy all adapters of a pool |
| `undeployAllAdaptersOfPool(tenantId, poolRtId)` | Undeploy all adapters of a pool |
| `deployAdapter(tenantId, poolRtId, adapterRtId, adapterCkTypeId)` | Deploy single adapter |
| `undeployAdapter(tenantId, poolRtId, adapterRtId, adapterCkTypeId)` | Undeploy single adapter |
| `executePipeline(tenantId, dataPipelineRtId)` | Execute pipeline manually |
| `deployPipelineDefinition(tenantId, adapterRtId, adapterCkTypeId, pipelineRtId, pipelineCkTypeId, definition)` | Deploy pipeline definition |
| `deployDataPipeline(tenantId, dataPipelineRtId)` | Deploy data pipeline |
| `undeployDataPipeline(tenantId, dataPipelineRtId)` | Undeploy data pipeline |
| `getPipelineStatus(tenantId, pipelineRtId, pipelineCkTypeId)` | Get deployment status |
| `getPipelineSchema(tenantId, adapterRtId, adapterCkTypeId)` | Get JSON Schema for adapter |
| `getPipelineExecutions(tenantId, pipelineRtId, pipelineCkTypeId, skip, take)` | Get execution history |
| `getLatestPipelineExecution(tenantId, pipelineRtId, pipelineCkTypeId)` | Get latest execution |
| `getPipelineExecutionDebugPointNodes(tenantId, pipelineRtId, pipelineCkTypeId, executionId)` | Get debug point tree |
| `getDebugPoint(tenantId, pipelineRtId, pipelineCkTypeId, executionId, nodeId)` | Get data at debug point |

### TusUploadService

Resumable file uploads using the TUS protocol for large database restore operations.

| Method | Description |
|--------|-------------|
| `startUpload(options: TusUploadOptions)` | Upload file and start restore job, returns `{ jobId }` |

---

## GraphQL-Based Services

### CkTypeSelectorService

Query Construction Kit types.

```typescript
// Get types with filtering
service.getCkTypes({
  ckModelIds: ['System.Core'],  // Optional: filter by models
  searchText: 'Customer',       // Optional: search filter
  first: 50,                    // Page size (default: 50)
  skip: 0                       // Offset for pagination
}).subscribe(result => {
  console.log(result.items);      // CkTypeSelectorItem[]
  console.log(result.totalCount); // Total count
});

// Get single type by rtCkTypeId
service.getCkTypeByRtCkTypeId('OctoSdkDemo/Customer')
  .subscribe(item => console.log(item));

// Get derived types of a base type
service.getDerivedCkTypes('OctoSdkDemo/BaseEntity', {
  searchText: '',
  ignoreAbstractTypes: true
}).subscribe(result => console.log(result.items));
```

### CkTypeAttributeService

Get attributes for CK types and records.

```typescript
// Get type attributes
service.getCkTypeAttributes('OctoSdkDemo-1.0.0/Customer-1')
  .subscribe(attrs => console.log(attrs));

// Get record attributes
service.getCkRecordAttributes('OctoSdkDemo-1.0.0/StatusRecord-1')
  .subscribe(attrs => console.log(attrs));
```

### CkModelService

Check model availability and versions.

```typescript
// Check if model exists
const available = await service.isModelAvailable('System.UI');

// Check minimum version
const hasMinVersion = await service.isModelAvailableWithMinVersion('System.UI', '1.2.0');

// Get model version
const version = await service.getModelVersion('System.UI');
```

### AttributeSelectorService

Get available query columns for a CK type.

```typescript
service.getAvailableAttributes('OctoSdkDemo/Customer', 'name')
  .subscribe(result => {
    console.log(result.items);      // Available columns
    console.log(result.totalCount);
  });
```

---

## Construction Kit ID Types

There are different ID types in the Construction Kit system. It's critical to use the correct one depending on the context:

### CkTypeId Fields

| Field                       | Example                        | Purpose                                                  |
|-----------------------------|--------------------------------|----------------------------------------------------------|
| `fullName`                  | `OctoSdkDemo-1.0.0/Customer-1` | Full versioned name including internal version numbers   |
| `semanticVersionedFullName` | `OctoSdkDemo-1/Customer`       | Semantic versioned name (model version, no type version) |

### Runtime IDs (for Runtime Queries)

| Field          | Example                | Purpose                                    |
|----------------|------------------------|--------------------------------------------|
| `rtCkTypeId`   | `OctoSdkDemo/Customer` | **Use this for runtime CK type queries**   |
| `rtCkRecordId` | `OctoSdkDemo/MyRecord` | **Use this for runtime CK record queries** |

### When to Use Which ID

- **`rtCkTypeId`**: Use when querying runtime entities by CK type, storing CK type references, or displaying CK type identifiers to users
- **`rtCkRecordId`**: Use when querying runtime entities by CK record, storing CK record references

### GraphQL Query Examples

```graphql
# Querying types - use rtCkTypeId
query getCkTypes {
  constructionKit {
    types {
      items {
        ckTypeId {
          fullName
        }
        rtCkTypeId  # Use this for runtime queries!
      }
    }
  }
}

# Querying by rtCkTypeId
query getCkTypeByRtCkTypeId($rtCkTypeId: String!) {
  constructionKit {
    types(rtCkId: $rtCkTypeId) {
      items {
        ckTypeId {
          fullName
        }
        rtCkTypeId
      }
    }
  }
}
```

### TypeScript Interface

The `CkTypeSelectorItem` interface uses:

```typescript
export interface CkTypeSelectorItem {
  fullName: string;           // Internal CK type ID
  rtCkTypeId: string;         // Runtime CK type ID - use for queries!
  baseTypeFullName?: string;
  baseTypeRtCkTypeId?: string;
  isAbstract: boolean;
  isFinal: boolean;
  description?: string;
}
```

**Important**: Always use `rtCkTypeId` when:
- Storing CK type references in widget configurations
- Querying runtime entities
- Displaying CK type identifiers in the UI

---

## GraphQL Utilities

### GraphQL Class

Utility class for cursor-based pagination:

```typescript
// Convert offset to cursor (for pagination)
const cursor = GraphQL.offsetToCursor(10); // Returns cursor for offset 10
const cursor = GraphQL.offsetToCursor(0);  // Returns null (no cursor needed)

// Get cursor for position
const cursor = GraphQL.getCursor(5); // Base64 encoded cursor
```

### Ignored Properties

```typescript
// Properties to ignore when processing GraphQL responses
export const GraphQLCommonIgnoredProperties = ['__typename'];

// Properties to ignore when cloning entities
export const GraphQLCloneIgnoredProperties = ['id', 'rtId', 'ckTypeId', '__typename'];
```

---

## Shared DTOs

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

---

## Error Handling

### OctoErrorLink

Apollo Link for handling GraphQL errors with user-friendly messages:

```typescript
// Automatically provided when using octo-services
// Shows error messages via MessageService
```

The error link:
- Displays GraphQL errors using `MessageService.showErrorWithDetails()`
- Handles network errors with generic error messages
- Extracts detailed error information from `extensions.OctoDetails`

---

## Testing

### Test Structure

Tests use Jasmine with Angular TestBed:

```typescript
// HTTP Service Test Pattern
describe('AssetRepoService', () => {
  let service: AssetRepoService;
  let httpMock: HttpTestingController;
  let mockConfigService: { config: AddInConfiguration | null; loadConfigAsync: jasmine.Spy };

  beforeEach(() => {
    mockConfigService = {
      config: {
        assetServices: 'https://api.example.com/',
        // ... other URLs
      } as AddInConfiguration,
      loadConfigAsync: jasmine.createSpy('loadConfigAsync')
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
});
```

```typescript
// GraphQL Service Test Pattern
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
    getCkTypesGQLMock.fetch.and.returnValue(of(mockResponse as any));

    service.getCkTypes().subscribe(result => {
      expect(result.items.length).toBe(1);
      done();
    });
  });
});
```

### Running Tests

```bash
# Run all octo-services tests
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  npm test -- --project=@meshmakers/octo-services --watch=false --browsers=ChromeHeadless

# Run with coverage
npm test -- --project=@meshmakers/octo-services --watch=false --code-coverage
```

---

## Dependencies

- `@angular/common/http` - HTTP client
- `@apollo/client` - GraphQL client
- `apollo-angular` - Angular Apollo integration
- `@meshmakers/shared-services` - Shared services (MessageService, PagedResultDto)
- `@meshmakers/shared-ui` - Shared UI (ProgressWindowService)
