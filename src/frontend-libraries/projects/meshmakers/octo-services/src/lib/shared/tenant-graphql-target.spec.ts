import { MM_CALLER_HANDLED_STATUSES } from '@meshmakers/shared-services';
import { tenantGraphQlContext, tenantGraphQlUri } from './tenant-graphql-target';
import { IConfigurationService } from '../services/configuration.service';
import { AddInConfiguration } from './addInConfiguration';

describe('tenant GraphQL target (AB#8985)', () => {
  const configuration = (assetServices: string | undefined): IConfigurationService => ({
    config: { assetServices } as AddInConfiguration,
    loadConfigAsync: () => Promise.resolve()
  });

  it('builds the tenant endpoint under the asset repository URL, with the tenant id encoded', () => {
    expect(tenantGraphQlUri('https://assets.example/', 'plant-b')).toBe('https://assets.example/tenants/plant-b/GraphQL');
    expect(tenantGraphQlUri('https://assets.example/', 'a/b?c')).toBe('https://assets.example/tenants/a%2Fb%3Fc/GraphQL');
    expect(tenantGraphQlUri(undefined, 'plant-b')).toBe('tenants/plant-b/GraphQL');
    expect(tenantGraphQlUri('https://assets.example', 'plant-b')).toBe('https://assets.example/tenants/plant-b/GraphQL');
  });

  it('returns a uri context for a target tenant that leaves a 403 to the caller, and an empty context without one', () => {
    const context = tenantGraphQlContext(configuration('https://assets.example/'), 'plant-b');
    expect(context.uri).toBe('https://assets.example/tenants/plant-b/GraphQL');
    expect(context.httpContext?.get(MM_CALLER_HANDLED_STATUSES)).toEqual([403]);
    // Apollo must not merge reads of two tenants with the same variables into one request.
    expect(context.queryDeduplication).toBe(false);
    expect(tenantGraphQlContext(configuration('https://assets.example/'), null)).toEqual({});
    expect(tenantGraphQlContext(configuration('https://assets.example/'), '')).toEqual({});
    expect(tenantGraphQlContext(null, 'plant-b').uri).toBe('tenants/plant-b/GraphQL');
  });
});
