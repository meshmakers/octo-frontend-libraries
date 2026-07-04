import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ConfirmationService } from '@meshmakers/shared-ui';
import { CommunicationService, GetEntitiesByCkTypeDtoGQL } from '@meshmakers/octo-services';
import { CreateEntitiesDtoGQL } from '../../../graphQL/createEntities';
import { DeleteEntitiesDtoGQL } from '../../../graphQL/deleteEntities';
import { GetLatestValidationExecutionDtoGQL } from '../../../graphQL/getLatestValidationExecution';
import { GetMappingCoverageNodeDtoGQL } from '../../../graphQL/getMappingCoverageNode';
import { GetNodeMappingsDtoGQL } from '../../../graphQL/getNodeMappings';
import { GetOrphanCandidatesDtoGQL } from '../../../graphQL/getOrphanCandidates';
import { GetRuntimeEntityByIdDtoGQL } from '../../../graphQL/getRuntimeEntityById';
import { UpdateRuntimeEntitiesDtoGQL } from '../../../graphQL/updateRuntimeEntities';
import { EntitySelectorDialogService } from '../../../entity-selector-dialog/entity-selector-dialog.service';
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

  beforeEach(async () => {
    getOrphanCandidatesGQL = jasmine.createSpyObj('GetOrphanCandidatesDtoGQL', ['fetch']);

    await TestBed.configureTestingModule({
      imports: [MappingCoverageTreeComponent],
      providers: [
        { provide: EntitySelectorDialogService, useValue: {} },
        { provide: MappingEditDialogService, useValue: {} },
        { provide: ConfirmationService, useValue: {} },
        { provide: CommunicationService, useValue: {} },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: {} },
        { provide: GetNodeMappingsDtoGQL, useValue: {} },
        { provide: GetRuntimeEntityByIdDtoGQL, useValue: {} },
        { provide: GetLatestValidationExecutionDtoGQL, useValue: {} },
        { provide: GetOrphanCandidatesDtoGQL, useValue: getOrphanCandidatesGQL },
        { provide: GetMappingCoverageNodeDtoGQL, useValue: {} },
        { provide: CreateEntitiesDtoGQL, useValue: {} },
        { provide: DeleteEntitiesDtoGQL, useValue: {} },
        { provide: UpdateRuntimeEntitiesDtoGQL, useValue: {} },
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
});
