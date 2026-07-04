import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ConfirmationService } from '@meshmakers/shared-ui';
import {
  CommunicationService,
  GetEntitiesByCkTypeDtoGQL,
  GraphDirectionDto,
} from '@meshmakers/octo-services';
import { CreateEntitiesDtoGQL } from '../../../graphQL/createEntities';
import { DeleteEntitiesDtoGQL } from '../../../graphQL/deleteEntities';
import { GetLatestValidationExecutionDtoGQL } from '../../../graphQL/getLatestValidationExecution';
import { GetMappingCoverageNodeDtoGQL } from '../../../graphQL/getMappingCoverageNode';
import { GetNodeMappingsDtoGQL } from '../../../graphQL/getNodeMappings';
import { GetOrphanCandidatesDtoGQL } from '../../../graphQL/getOrphanCandidates';
import { GetRuntimeEntityByIdDtoGQL } from '../../../graphQL/getRuntimeEntityById';
import { UpdateRuntimeEntitiesDtoGQL } from '../../../graphQL/updateRuntimeEntities';
import { EntitySelectorDialogService } from '../../../entity-selector-dialog/entity-selector-dialog.service';
import {
  PerspectiveDefinition,
  TreeNavigationConfigService,
} from '../../services/tree-navigation-config.service';
import { MappingCoverageTreeComponent } from './mapping-coverage-tree.component';
import { MappingEditDialogService } from './mapping-edit-dialog.service';

interface OrphanItemStub {
  rtId: string;
  ckTypeId: string;
  rtWellKnownName: string | null;
  attributes: { items: { attributeName: string; value: unknown }[] };
  associations: {
    mappings: { totalCount: number };
    parent: { items: never[] };
  };
}

function orphanItem(rtId: string, name: string, mappingCount = 0): OrphanItemStub {
  return {
    rtId,
    ckTypeId: 'Loxone/Control',
    rtWellKnownName: null,
    attributes: { items: [{ attributeName: 'name', value: name }] },
    associations: {
      mappings: { totalCount: mappingCount },
      parent: { items: [] },
    },
  };
}

function orphanPage(items: OrphanItemStub[], hasNextPage: boolean, endCursor: string | null) {
  return {
    data: {
      runtime: {
        runtimeEntities: {
          totalCount: items.length,
          pageInfo: { hasNextPage, endCursor },
          items,
        },
      },
    },
  };
}

describe('MappingCoverageTreeComponent', () => {
  let component: MappingCoverageTreeComponent;
  let fixture: ComponentFixture<MappingCoverageTreeComponent>;
  let getOrphanCandidatesGQL: jasmine.SpyObj<GetOrphanCandidatesDtoGQL>;
  let getEntitiesByCkTypeGQL: jasmine.SpyObj<GetEntitiesByCkTypeDtoGQL>;
  let treeNavConfig: jasmine.SpyObj<TreeNavigationConfigService>;

  const SYSTEMS_PERSPECTIVE: PerspectiveDefinition = {
    key: 'Systems',
    displayName: 'Systems',
    rootMode: 'Type',
    rootCkTypeId: 'EnergyIQ/DistributionSystem',
    primaryRoleId: 'EnergyIQ/SystemMembers',
    primaryDirection: 'Outbound',
    sortIndex: 1,
  };

  beforeEach(async () => {
    getOrphanCandidatesGQL = jasmine.createSpyObj('GetOrphanCandidatesDtoGQL', ['fetch']);
    getEntitiesByCkTypeGQL = jasmine.createSpyObj('GetEntitiesByCkTypeDtoGQL', ['fetch']);
    getEntitiesByCkTypeGQL.fetch.and.returnValue(
      of({ data: { runtime: { runtimeEntities: { items: [] } } } }) as unknown as ReturnType<
        GetEntitiesByCkTypeDtoGQL['fetch']
      >,
    );
    treeNavConfig = jasmine.createSpyObj('TreeNavigationConfigService', ['perspectives']);
    treeNavConfig.perspectives.and.resolveTo([]);

    await TestBed.configureTestingModule({
      imports: [MappingCoverageTreeComponent],
      providers: [
        { provide: EntitySelectorDialogService, useValue: {} },
        { provide: MappingEditDialogService, useValue: {} },
        { provide: ConfirmationService, useValue: {} },
        { provide: CommunicationService, useValue: {} },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: getEntitiesByCkTypeGQL },
        { provide: GetNodeMappingsDtoGQL, useValue: {} },
        { provide: GetRuntimeEntityByIdDtoGQL, useValue: {} },
        { provide: GetLatestValidationExecutionDtoGQL, useValue: {} },
        { provide: GetOrphanCandidatesDtoGQL, useValue: getOrphanCandidatesGQL },
        { provide: GetMappingCoverageNodeDtoGQL, useValue: {} },
        { provide: CreateEntitiesDtoGQL, useValue: {} },
        { provide: DeleteEntitiesDtoGQL, useValue: {} },
        { provide: UpdateRuntimeEntitiesDtoGQL, useValue: {} },
        { provide: TreeNavigationConfigService, useValue: treeNavConfig },
      ],
    }).compileComponents();

    // No fixture.detectChanges(): ngOnInit would load roots/pipelines, which
    // is out of scope here — these specs exercise the orphan-catalogue load.
    fixture = TestBed.createComponent(MappingCoverageTreeComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadOrphanCandidates paging', () => {
    beforeEach(() => {
      component['orphanCkType'].set('Loxone/Control');
    });

    it('collects all pages until hasNextPage is false', async () => {
      getOrphanCandidatesGQL.fetch.and.returnValues(
        of(orphanPage([orphanItem('a1', 'Alpha'), orphanItem('b2', 'Beta', 3)], true, 'cursor-1')),
        of(orphanPage([orphanItem('c3', 'Gamma')], false, 'cursor-2')),
      );

      await component['loadOrphanCandidates']();

      expect(getOrphanCandidatesGQL.fetch).toHaveBeenCalledTimes(2);
      const candidates = component['orphanCandidates']();
      expect(candidates.length).toBe(3);
      // Unmapped first, then alphabetical.
      expect(candidates.map(c => c.name)).toEqual(['Alpha', 'Gamma', 'Beta']);
    });

    it('passes the previous endCursor as after on the follow-up page', async () => {
      getOrphanCandidatesGQL.fetch.and.returnValues(
        of(orphanPage([orphanItem('a1', 'Alpha')], true, 'cursor-1')),
        of(orphanPage([], false, null)),
      );

      await component['loadOrphanCandidates']();

      const secondCallVariables = getOrphanCandidatesGQL.fetch.calls.argsFor(1)[0]?.variables;
      expect(secondCallVariables?.after).toBe('cursor-1');
    });

    it('stops after a single page when hasNextPage is false', async () => {
      getOrphanCandidatesGQL.fetch.and.returnValue(
        of(orphanPage([orphanItem('a1', 'Alpha')], false, 'cursor-1')),
      );

      await component['loadOrphanCandidates']();

      expect(getOrphanCandidatesGQL.fetch).toHaveBeenCalledTimes(1);
      expect(component['orphanCandidates']().length).toBe(1);
    });

    it('sets the error signal when the query fails', async () => {
      getOrphanCandidatesGQL.fetch.and.throwError(new Error('boom'));

      await component['loadOrphanCandidates']();

      expect(component['orphanError']()).toBe('Failed to load source candidates.');
      expect(component['orphanCandidates']().length).toBe(0);
    });
  });

  describe('perspective switching', () => {
    it('merges the built-in Spatial perspective with the configured ones', async () => {
      treeNavConfig.perspectives.and.resolveTo([SYSTEMS_PERSPECTIVE]);

      await component['loadPerspectives']();

      expect(component['perspectives']().map(p => p.key)).toEqual(['Spatial', 'Systems']);
    });

    it('keeps only the built-in perspective when loading fails', async () => {
      treeNavConfig.perspectives.and.rejectWith(new Error('boom'));

      await component['loadPerspectives']();

      expect(component['perspectives']().map(p => p.key)).toEqual(['Spatial']);
    });

    it('applies the Type perspective: root nav override + roots from its root CK type', async () => {
      treeNavConfig.perspectives.and.resolveTo([SYSTEMS_PERSPECTIVE]);
      await component['loadPerspectives']();

      await component['onPerspectiveChange']('Systems');

      expect(component['activePerspectiveKey']()).toBe('Systems');
      expect(component['activeRootCkTypeId']()).toBe('EnergyIQ/DistributionSystem');
      expect(component['dataSource'].getRootPerspectiveNav()).toEqual({
        childRoleId: 'EnergyIQ/SystemMembers',
        childDirection: GraphDirectionDto.OutboundDto,
      });
      const rootQueryVariables =
        getEntitiesByCkTypeGQL.fetch.calls.mostRecent().args[0]?.variables;
      expect(rootQueryVariables?.ckTypeId).toBe('EnergyIQ/DistributionSystem');
      expect(component['selectedRoot']()).toBeNull();
      expect(component['selectedNode']()).toBeNull();
    });

    it('clears the nav override when switching back to Spatial', async () => {
      treeNavConfig.perspectives.and.resolveTo([SYSTEMS_PERSPECTIVE]);
      await component['loadPerspectives']();
      await component['onPerspectiveChange']('Systems');

      await component['onPerspectiveChange']('Spatial');

      expect(component['dataSource'].getRootPerspectiveNav()).toBeNull();
      expect(component['activeRootCkTypeId']()).toBe(component.config.rootCkTypeId);
      const rootQueryVariables =
        getEntitiesByCkTypeGQL.fetch.calls.mostRecent().args[0]?.variables;
      expect(rootQueryVariables?.ckTypeId).toBe(component.config.rootCkTypeId);
    });
  });
});
