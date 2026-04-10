import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { GetCkTypeAssociationRolesDtoGQL } from '../../graphQL/getCkTypeAssociationRoles';
import { AssociationValidationService } from './association-validation.service';

describe('AssociationValidationService', () => {
  let service: AssociationValidationService;
  let mockGetCkTypeAssociationRolesGQL: jasmine.SpyObj<{ fetch: jasmine.Spy }>;

  const mockMachineRolesResponse = {
    data: {
      constructionKit: {
        types: {
          items: [
            {
              rtCkTypeId: 'Industry.Basic/Machine',
              associations: {
                out: {
                  all: [
                    {
                      roleId: { fullName: 'System-2.0.8/ParentChild-1', semanticVersionedFullName: '' },
                      rtRoleId: 'System/ParentChild',
                      navigationPropertyName: 'Parent',
                      multiplicity: 'ONE',
                      targetCkTypeId: { fullName: 'Basic-2.0.2/Tree-1' },
                      rtTargetCkTypeId: 'Basic/Tree',
                    },
                    {
                      roleId: { fullName: 'System-2.0.8/ParentChild-1', semanticVersionedFullName: '' },
                      rtRoleId: 'System/ParentChild',
                      navigationPropertyName: 'Parent',
                      multiplicity: 'ONE',
                      targetCkTypeId: { fullName: 'Basic-2.0.2/TreeNode-1' },
                      rtTargetCkTypeId: 'Basic/TreeNode',
                    },
                    {
                      roleId: { fullName: 'Basic-2.0.2/RelatedClassification-1', semanticVersionedFullName: '' },
                      rtRoleId: 'Basic/RelatedClassification',
                      navigationPropertyName: 'RelatesTo',
                      multiplicity: 'N',
                      targetCkTypeId: { fullName: 'Basic-2.0.2/TreeNode-1' },
                      rtTargetCkTypeId: 'Basic/TreeNode',
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    },
  };

  const mockNoParentChildResponse = {
    data: {
      constructionKit: {
        types: {
          items: [
            {
              rtCkTypeId: 'Custom/Sensor',
              associations: {
                out: {
                  all: [
                    {
                      roleId: { fullName: 'System-2.0.8/Related-1', semanticVersionedFullName: '' },
                      rtRoleId: 'System/Related',
                      navigationPropertyName: 'RelatesTo',
                      multiplicity: 'N',
                      targetCkTypeId: { fullName: 'System-2.0.8/Entity-1' },
                      rtTargetCkTypeId: 'System/Entity',
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    },
  };

  beforeEach(() => {
    mockGetCkTypeAssociationRolesGQL = {
      fetch: jasmine.createSpy('fetch'),
    };

    TestBed.configureTestingModule({
      providers: [
        AssociationValidationService,
        { provide: GetCkTypeAssociationRolesDtoGQL, useValue: mockGetCkTypeAssociationRolesGQL },
      ],
    });

    service = TestBed.inject(AssociationValidationService);
  });

  afterEach(() => {
    service.clearCache();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('canMove', () => {
    it('should allow move when ParentChild outbound role matches destination type', async () => {
      mockGetCkTypeAssociationRolesGQL.fetch.and.returnValue(of(mockMachineRolesResponse));

      const result = await service.canMove('Industry.Basic/Machine', 'Basic/TreeNode');

      expect(result.allowed).toBeTrue();
      expect(result.rtRoleId).toBe('System/ParentChild');
      expect(result.navigationPropertyName).toBe('Parent');
    });

    it('should allow move to Tree root', async () => {
      mockGetCkTypeAssociationRolesGQL.fetch.and.returnValue(of(mockMachineRolesResponse));

      const result = await service.canMove('Industry.Basic/Machine', 'Basic/Tree');

      expect(result.allowed).toBeTrue();
      expect(result.rtRoleId).toBe('System/ParentChild');
    });

    it('should reject move when no ParentChild role matches destination', async () => {
      mockGetCkTypeAssociationRolesGQL.fetch.and.returnValue(of(mockMachineRolesResponse));

      const result = await service.canMove('Industry.Basic/Machine', 'Custom/UnrelatedType');

      expect(result.allowed).toBeFalse();
      expect(result.reason).toContain('Industry.Basic/Machine');
      expect(result.reason).toContain('Custom/UnrelatedType');
    });

    it('should reject move when type has no ParentChild outbound roles', async () => {
      mockGetCkTypeAssociationRolesGQL.fetch.and.returnValue(of(mockNoParentChildResponse));

      const result = await service.canMove('Custom/Sensor', 'Basic/TreeNode');

      expect(result.allowed).toBeFalse();
    });

    it('should not match non-ParentChild roles', async () => {
      mockGetCkTypeAssociationRolesGQL.fetch.and.returnValue(of(mockMachineRolesResponse));

      // RelatedClassification also points to Basic/TreeNode, but should not be used for move
      const result = await service.canMove('Industry.Basic/Machine', 'Basic/TreeNode');

      expect(result.rtRoleId).toBe('System/ParentChild');
      expect(result.navigationPropertyName).toBe('Parent');
    });

    it('should use cached roles on subsequent calls', async () => {
      mockGetCkTypeAssociationRolesGQL.fetch.and.returnValue(of(mockMachineRolesResponse));

      await service.canMove('Industry.Basic/Machine', 'Basic/TreeNode');
      await service.canMove('Industry.Basic/Machine', 'Basic/Tree');

      expect(mockGetCkTypeAssociationRolesGQL.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle empty type response', async () => {
      mockGetCkTypeAssociationRolesGQL.fetch.and.returnValue(of({
        data: { constructionKit: { types: { items: [] } } },
      }));

      const result = await service.canMove('Unknown/Type', 'Basic/TreeNode');

      expect(result.allowed).toBeFalse();
    });

    it('should handle null associations in response', async () => {
      mockGetCkTypeAssociationRolesGQL.fetch.and.returnValue(of({
        data: {
          constructionKit: {
            types: {
              items: [{ rtCkTypeId: 'Test/Type', associations: null }],
            },
          },
        },
      }));

      const result = await service.canMove('Test/Type', 'Basic/TreeNode');

      expect(result.allowed).toBeFalse();
    });
  });

  describe('clearCache', () => {
    it('should clear cache so next call fetches fresh data', async () => {
      mockGetCkTypeAssociationRolesGQL.fetch.and.returnValue(of(mockMachineRolesResponse));

      await service.canMove('Industry.Basic/Machine', 'Basic/TreeNode');
      service.clearCache();
      await service.canMove('Industry.Basic/Machine', 'Basic/TreeNode');

      expect(mockGetCkTypeAssociationRolesGQL.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
