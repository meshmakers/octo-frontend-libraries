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

  // Waits up to a few microtasks for the named operation to be issued, then flushes it.
  async function flushOp(
    operationName: string,
    response: { data: Record<string, unknown> },
  ): Promise<void> {
    for (let i = 0; i < 10; i++) {
      const matches = controller.match(
        (op) => op.operationName === operationName,
      );
      if (matches.length > 0) {
        matches[0].flush(response);
        return;
      }
      await Promise.resolve();
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
});
