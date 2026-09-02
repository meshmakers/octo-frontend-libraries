import { TestBed } from '@angular/core/testing';
import {
  ApolloTestingController,
  ApolloTestingModule,
} from 'apollo-angular/testing';
import { TreeNavigationConfigService } from './tree-navigation-config.service';

describe('TreeNavigationConfigService', () => {
  let service: TreeNavigationConfigService;
  let controller: ApolloTestingController;

  const typeExistsResponse = (present: boolean) => ({
    data: {
      constructionKit: {
        types: {
          items: present
            ? [{ rtCkTypeId: 'System.UI/TreeNavigationConfiguration' }]
            : [],
        },
      },
    },
  });

  const configResponse = (
    roles: {
      sourceCkTypeId: string;
      roleId: string;
      visible?: boolean;
      displayName?: string;
      sortIndex?: number;
      grouped?: boolean;
      icon?: string;
    }[],
  ) => ({
    data: {
      runtime: {
        systemUITreeNavigationConfiguration: {
          items: [{ rtId: 'cfg-1', roles }],
        },
      },
    },
  });

  const perspectivesResponse = (perspectives: Record<string, unknown>[]) => ({
    data: {
      runtime: {
        systemUITreeNavigationConfiguration: {
          items: [{ rtId: 'cfg-1', perspectives }],
        },
      },
    },
  });

  // Waits up to a few macrotask turns for the named operation to be issued, then flushes it.
  // A microtask yield is not enough: Apollo's testing backend delivers the previous
  // flush across a timer, so the follow-up query is only issued after the task queue drains.
  async function flushOp(
    operationName: string,
    response: { data: Record<string, unknown> },
  ): Promise<void> {
    await withOp(operationName, (op) => op.flush(response));
  }

  // Waits for the named operation, then rejects it with GraphQL errors (e.g. the
  // System.UI 2.2.0 "Cannot query field 'perspectives'" validation error).
  async function failOp(
    operationName: string,
    message: string,
  ): Promise<void> {
    await withOp(operationName, (op) =>
      op.graphqlErrors([{ message } as never]),
    );
  }

  async function withOp(
    operationName: string,
    act: (op: ReturnType<ApolloTestingController['match']>[number]) => void,
  ): Promise<void> {
    for (let i = 0; i < 10; i++) {
      const matches = controller.match(
        (op) => op.operationName === operationName,
      );
      if (matches.length > 0) {
        act(matches[0]);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error(`operation not issued: ${operationName}`);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ApolloTestingModule],
      providers: [TreeNavigationConfigService],
    });
    controller = TestBed.inject(ApolloTestingController);
    service = TestBed.inject(TreeNavigationConfigService);
  });

  afterEach(() => {
    controller.verify();
  });

  it('returns undefined and does not query the singleton when the CK type is absent', async () => {
    const promise = service.resolve('EnergyIQ/Space', 'EnergyIQ/SpaceSensors');
    await flushOp('treeNavigationConfigTypeExists', typeExistsResponse(false));
    const result = await promise;
    expect(result).toBeUndefined();
    // No singleton query must have been issued.
    controller.expectNone((op) => op.operationName === 'getTreeNavigationConfiguration');
  });

  it('resolves an exact (sourceCkTypeId, roleId) override', async () => {
    const promise = service.resolve('EnergyIQ/Space', 'EnergyIQ/SpaceSensors');
    await flushOp('treeNavigationConfigTypeExists', typeExistsResponse(true));
    await flushOp(
      'getTreeNavigationConfiguration',
      configResponse([
        {
          sourceCkTypeId: 'EnergyIQ/Space',
          roleId: 'EnergyIQ/SpaceSensors',
          visible: false,
          displayName: 'Sensoren',
          sortIndex: 2,
        },
      ]),
    );
    const result = await promise;
    expect(result).toEqual({
      visible: false,
      displayName: 'Sensoren',
      sortIndex: 2,
      grouped: undefined,
      icon: undefined,
    });
  });

  it('prefers an exact match over a wildcard rule and caches the load', async () => {
    const promise = service.resolve('EnergyIQ/Space', 'EnergyIQ/SpaceSensors');
    await flushOp('treeNavigationConfigTypeExists', typeExistsResponse(true));
    await flushOp(
      'getTreeNavigationConfiguration',
      configResponse([
        { sourceCkTypeId: '*', roleId: 'EnergyIQ/SpaceSensors', displayName: 'Wildcard' },
        { sourceCkTypeId: 'EnergyIQ/Space', roleId: 'EnergyIQ/SpaceSensors', displayName: 'Exact' },
      ]),
    );
    expect((await promise)?.displayName).toBe('Exact');

    // Wildcard fallback for a different source type, served from cache (no new query).
    const fallback = await service.resolve('EnergyIQ/Building', 'EnergyIQ/SpaceSensors');
    expect(fallback?.displayName).toBe('Wildcard');

    // Unconfigured role → undefined.
    expect(await service.resolve('EnergyIQ/Space', 'Other/Role')).toBeUndefined();
  });

  it('returns no perspectives when the CK type is absent (System.UI < 2.3.0)', async () => {
    const promise = service.perspectives();
    await flushOp('treeNavigationConfigTypeExists', typeExistsResponse(false));
    expect(await promise).toEqual([]);
    // No perspectives query must have been issued when the type is absent.
    controller.expectNone((op) => op.operationName === 'getTreeNavigationPerspectives');
  });

  it('loads, normalizes and sorts configured perspectives', async () => {
    const promise = service.perspectives();
    await flushOp('treeNavigationConfigTypeExists', typeExistsResponse(true));
    await flushOp(
      'getTreeNavigationPerspectives',
      perspectivesResponse([
        {
          key: 'Systems',
          displayName: 'Systems',
          sortIndex: 2,
          rootMode: 'Type',
          rootCkTypeId: 'EnergyIQ/DistributionSystem',
          primaryRoleId: 'EnergyIQ/SystemMembers',
          primaryDirection: 'Outbound',
          secondaryRoleIds: ['EnergyIQ/SystemSpaces', ''],
        },
        // Invalid: no key → dropped.
        { key: '', displayName: 'nope', rootMode: 'Type' },
        {
          key: 'Types',
          displayName: 'Types',
          sortIndex: 1,
          rootMode: 'Type',
          rootCkTypeId: 'EnergyIQ/Sensor',
        },
      ]),
    );

    const result = await promise;
    expect(result.map((p) => p.key)).toEqual(['Types', 'Systems']); // sorted by sortIndex
    const systems = result.find((p) => p.key === 'Systems')!;
    expect(systems.rootMode).toBe('Type');
    expect(systems.rootCkTypeId).toBe('EnergyIQ/DistributionSystem');
    expect(systems.primaryRoleId).toBe('EnergyIQ/SystemMembers');
    expect(systems.primaryDirection).toBe('Outbound');
    expect(systems.secondaryRoleIds).toEqual(['EnergyIQ/SystemSpaces']); // empty entry dropped
  });

  it('keeps roles working and perspectives empty on System.UI 2.2.0 (perspectives field absent)', async () => {
    // Roles resolve normally via the separate roles query.
    const rolePromise = service.resolve('EnergyIQ/Space', 'EnergyIQ/SpaceSensors');
    await flushOp('treeNavigationConfigTypeExists', typeExistsResponse(true));
    await flushOp(
      'getTreeNavigationConfiguration',
      configResponse([
        {
          sourceCkTypeId: 'EnergyIQ/Space',
          roleId: 'EnergyIQ/SpaceSensors',
          displayName: 'Sensoren',
        },
      ]),
    );
    expect((await rolePromise)?.displayName).toBe('Sensoren');

    // Perspectives query hits the 2.2.0 validation error → degrades to [].
    const perspPromise = service.perspectives();
    await flushOp('treeNavigationConfigTypeExists', typeExistsResponse(true));
    await failOp(
      'getTreeNavigationPerspectives',
      "Cannot query field 'perspectives' on type 'SystemUITreeNavigationConfiguration'",
    );
    expect(await perspPromise).toEqual([]);
  });
});
