import { Injectable, inject } from '@angular/core';
import {
  AssociationModOptionsDto,
  BasicTreeNodeInputUpdateDto,
  CkModelDto,
  CkTypeDto,
  CkTypeMetaData,
  GetCkModelByIdDtoGQL,
  GetCkTypesDtoGQL,
  GraphDirectionDto,
  LevelMetaData,
  RtAssociationDto,
  RtAssociationMetaData,
  RtEntityDto,
} from '@meshmakers/octo-services';
import { OctoGraphQlHierarchyDataSource } from '@meshmakers/octo-ui';
import { TreeItemDataTyped } from '@meshmakers/shared-services';
import {
  fileIcon,
  folderMoreIcon,
  folderOpenIcon,
  gearIcon,
} from '@progress/kendo-svg-icons';
import { Apollo } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { DeleteEntitiesDtoGQL } from '../graphQL/deleteEntities';
import { GetCkModelsDtoGQL } from '../graphQL/getCkModels';
import {
  GetRuntimeEntityAssociationsByIdDtoGQL,
  GetRuntimeEntityAssociationsByIdQueryDto,
} from '../graphQL/getRuntimeEntityAssociationsById';
import { GetTreeNodesDtoGQL } from '../graphQL/getTreeNodes';
import { GetTreesDtoGQL } from '../graphQL/getTrees';
import { UpdateTreeNodesDtoGQL } from '../graphQL/updateTreeNodes';
import { code, storage } from '../icons/custom-svg-icons';
import { TypeHelperService } from '../services/type-helper.service';

// Extended type to handle both Runtime Entities and CK Models/Types
type BrowserItem =
  | RtEntityDto
  | CkModelDto
  | CkTypeDto
  | { isCkModelsRoot?: boolean; ckModelId?: string };

@Injectable({
  providedIn: 'root',
})
export class RuntimeBrowserDataSource extends OctoGraphQlHierarchyDataSource<BrowserItem> {
  private readonly getTreesDtoGQL = inject(GetTreesDtoGQL);
  private readonly getTreeNodesDtoGQL = inject(GetTreeNodesDtoGQL);
  private readonly getCkModelsGQL = inject(GetCkModelsDtoGQL);
  private readonly getCkTypesGQL = inject(GetCkTypesDtoGQL);
  private readonly getCkModelByIdDtoGQL = inject(GetCkModelByIdDtoGQL);
  private readonly deleteEntitiesDtoGQL = inject(DeleteEntitiesDtoGQL);
  private readonly getRuntimeEntityAssociationsByIdDtoGQL = inject(
    GetRuntimeEntityAssociationsByIdDtoGQL,
  );
  private readonly updateTreeNodesDtoGQL = inject(UpdateTreeNodesDtoGQL);
  private readonly typeHelperService = inject(TypeHelperService);

  // Define metadata for different entity types and their hierarchical relationships
  private static readonly levelMetaData: LevelMetaData[] = [
    new LevelMetaData(
      'Basic/Tree',
      [new RtAssociationMetaData('System/ParentChild', 'Basic/TreeNode')],
      [
        new RtAssociationMetaData('System/ParentChild', 'Basic/TreeNode'),
        new RtAssociationMetaData('Basic/RelatedClassification', 'Basic/Asset'),
      ],
    ),
    new LevelMetaData(
      '*',
      [
        new RtAssociationMetaData('System/ParentChild', 'Basic/TreeNode'),
        new RtAssociationMetaData('Basic/RelatedClassification', 'Basic/Asset'),
      ],
      [
        new RtAssociationMetaData('System/ParentChild', 'Basic/TreeNode'),
        new RtAssociationMetaData('Basic/RelatedClassification', 'Basic/Asset'),
      ],
    ),
  ];

  // Define visual metadata for different entity types
  private static readonly ckTypeMetaData: CkTypeMetaData[] = [
    new CkTypeMetaData('Basic/Tree', 'Tree', 'Tree Structure', folderMoreIcon),
    new CkTypeMetaData('Basic/TreeNode', 'Node', 'Tree Node', fileIcon),
    new CkTypeMetaData('Basic/Asset', 'Asset', 'Asset Entity', code),
    new CkTypeMetaData('System/Database', 'Database', 'Database', storage),
  ];

  public override async fetchChildren(
    item: TreeItemDataTyped<BrowserItem>,
  ): Promise<TreeItemDataTyped<BrowserItem>[]> {
    // Handle CK Models root node
    if ((item.item as any).isCkModelsRoot) {
      return this.fetchCkModels();
    }

    // Handle CK Model node - fetch its types
    if ((item.item as any).id && !(item.item as any).rtId) {
      const modelId = (item.item as any).id.fullName;
      return this.fetchCkTypes(modelId);
    }

    // Handle CK Type node - no children
    if (
      (item.item as any).ckTypeId &&
      !(item.item as any).rtId &&
      !(item.item as any).id
    ) {
      return [];
    }

    // Handle regular runtime entity
    const rtEntity = item.item as RtEntityDto;
    if (!rtEntity.rtId || !rtEntity.ckTypeId) {
      return [];
    }

    // Find metadata for the current item type
    let metaData = RuntimeBrowserDataSource.levelMetaData.find(
      (x) => x.ckTypeId === rtEntity.ckTypeId,
    );
    if (!metaData) {
      metaData = RuntimeBrowserDataSource.levelMetaData.find(
        (x) => x.ckTypeId === '*',
      );
    }
    if (!metaData) {
      return [];
    }

    const mergedResultsMap: Record<string, TreeItemDataTyped<BrowserItem>> = {};

    // Fetch children based on direct and indirect associations
    for (const directRole of metaData.directRoles) {
      const rtEntitiesOrigins = new Array<RtEntityDto>();

      for (const indirectRole of metaData.indirectRoles) {
        try {
          const result = await firstValueFrom(
            this.getTreeNodesDtoGQL
              .fetch({
                variables: {
                  rtId: rtEntity.rtId,
                  ckTypeId: rtEntity.ckTypeId,
                  directRoleId: directRole.roleId,
                  directTargetCkTypeId: directRole.ckTypeId,
                  indirectRoleId: indirectRole.roleId,
                  indirectTargetCkTypeId: indirectRole.ckTypeId,
                },
              })
              .pipe(map((r) => r.data?.runtime?.runtimeEntities?.items?.at(0))),
          );

          if (result) {
            rtEntitiesOrigins.push(result as RtEntityDto);
          }
        } catch (error) {
          console.error('Error fetching tree nodes:', error);
        }
      }

      // Process children and build tree items
      for (const root of rtEntitiesOrigins) {
        if (!root?.associations?.targets?.items) {
          continue;
        }

        for (const child of root.associations.targets.items) {
          if (!child?.rtId || !child?.ckTypeId) {
            continue;
          }
          const rtId = child?.rtId;

          if (!mergedResultsMap[rtId]) {
            // Find or create metadata for this child type
            let childMetaData = RuntimeBrowserDataSource.ckTypeMetaData.find(
              (x) => x.ckTypeId === child?.ckTypeId,
            );
            if (!childMetaData) {
              childMetaData = new CkTypeMetaData(
                child?.ckTypeId || 'Unknown',
                child?.ckTypeId || 'Unknown',
                child?.ckTypeId || 'Unknown',
                code,
              );
            }

            // Extract display name and description from attributes
            const nameValue = child.attributes?.items?.find(
              (x: any) => x?.attributeName === 'name',
            )?.value;
            const displayNameValue = child.attributes?.items?.find(
              (x: any) => x?.attributeName === 'displayName',
            )?.value;

            // Debug logging
            if (typeof nameValue === 'object') {
              console.warn('Child name value is an object:', nameValue);
            }

            const text =
              (typeof nameValue === 'string'
                ? nameValue
                : typeof nameValue === 'object' && nameValue !== null
                  ? JSON.stringify(nameValue)
                  : null) ||
              (typeof displayNameValue === 'string'
                ? displayNameValue
                : null) ||
              child.ckTypeId ||
              'Unknown';
            const descValue = child.attributes?.items?.find(
              (x: any) => x?.attributeName === 'description',
            )?.value;
            const tooltip =
              (typeof descValue === 'string' ? descValue : null) ||
              `${child.ckTypeId} - ${child.rtId}`;

            mergedResultsMap[rtId] = new TreeItemDataTyped<BrowserItem>(
              rtId,
              text,
              tooltip,
              child,
              childMetaData.svgIcon,
              (child?.associations?.targets?.totalCount ?? 0) > 0,
            );
          } else {
            // Update expandable status if object already exists
            mergedResultsMap[rtId].expandable ||=
              (child?.associations?.targets?.totalCount ?? 0) > 0;
          }
        }
      }
    }

    return Object.values(mergedResultsMap);
  }

  public override async fetchRootNodes(): Promise<
    TreeItemDataTyped<BrowserItem>[]
  > {
    try {
      const result = new Array<TreeItemDataTyped<BrowserItem>>();

      // Add CK Models root node
      result.push(
        new TreeItemDataTyped<BrowserItem>(
          'ck-models-root',
          'CK Models',
          'Construction Kit Models',
          { isCkModelsRoot: true } as any,
          folderOpenIcon,
          true, // expandable
        ),
      );

      // Check if Basic construction kit is available before trying to fetch Tree entities
      const isBasicCkAvailable =
        await this.checkBasicConstructionKitAvailable();

      if (isBasicCkAvailable) {
        // Fetch all Tree entities as root nodes
        const r = await firstValueFrom(
          this.getTreesDtoGQL.fetch({
            variables: { ckTypeId: 'Basic/Tree' },
            fetchPolicy: 'network-only',
          }),
        );

        for (const item of (r.data?.runtime?.runtimeEntities
          ?.items as RtEntityDto[]) ?? []) {
          // Find or create metadata for this item type
          let metaData = RuntimeBrowserDataSource.ckTypeMetaData.find(
            (x) => x.ckTypeId === item?.ckTypeId,
          );
          if (!metaData) {
            metaData = new CkTypeMetaData(
              item?.ckTypeId || 'Unknown',
              item?.ckTypeId || 'Unknown',
              item?.ckTypeId || 'Unknown',
              code,
            );
          }

          // Extract display information
          const nameValue = item.attributes?.items?.find(
            (x) => x?.attributeName === 'name',
          )?.value;
          const displayNameValue = item.attributes?.items?.find(
            (x) => x?.attributeName === 'displayName',
          )?.value;

          // Debug logging
          if (typeof nameValue === 'object') {
            console.warn('Name value is an object:', nameValue);
          }

          const text =
            (typeof nameValue === 'string'
              ? nameValue
              : typeof nameValue === 'object' && nameValue !== null
                ? JSON.stringify(nameValue)
                : null) ||
            (typeof displayNameValue === 'string' ? displayNameValue : null) ||
            item.ckTypeId ||
            'Unknown';
          const descValue = item.attributes?.items?.find(
            (x) => x?.attributeName === 'description',
          )?.value;
          const tooltip =
            (typeof descValue === 'string' ? descValue : null) ||
            `${item.ckTypeId} - ${item.rtId}`;

          result.push(
            new TreeItemDataTyped<BrowserItem>(
              `${item.ckTypeId}@${item.rtId}`,
              text,
              tooltip,
              item,
              metaData.svgIcon,
              (item?.associations?.targets?.totalCount ?? 0) > 0,
            ),
          );
        }
      } else {
        console.debug(
          '⚠️ Basic construction kit not available, skipping Tree entities',
        );
      }

      return result;
    } catch (error) {
      console.error('Error fetching root nodes:', error);
      return [];
    }
  }

  /**
   * Gets ParentChild association of given Runtime Entity.
   *
   * @param ckTypeId Ck Type Id.
   * @param rtId Runtime Id.
   * @param isParentAssoc if true, fetches only parent, otherwise children.
   *
   * @returns Fetches configured association.
   */
  public async getParentChildAssociation(
    ckTypeId: string,
    rtId: string,
    isParentAssoc: boolean,
  ): Promise<RtAssociationDto[] | undefined> {
    let response: Apollo.QueryResult<GetRuntimeEntityAssociationsByIdQueryDto>;

    try {
      response = await firstValueFrom(
        this.getRuntimeEntityAssociationsByIdDtoGQL.fetch({
          variables: {
            ckTypeId,
            rtId,
            direction: isParentAssoc
              ? GraphDirectionDto.OutboundDto
              : GraphDirectionDto.InboundDto,
            roleId: 'System/ParentChild',
          },
          fetchPolicy: 'network-only',
        }),
      );
    } catch (error) {
      console.error('Error on attempt to get association', error);
      return undefined;
    }

    const assocs = response?.data?.runtime?.runtimeEntities?.items?.[0]
      ?.associations?.definitions?.items as RtAssociationDto[];

    return assocs;
  }

  /**
   * Swaps parent of the given object.
   *
   * @param srcObjRtId Runtime Entity Id of the object that is supposed to have its association changed.
   * @param oldParentCkTypeId CkTypeId of the current parent.
   * @param oldParentRtId Runtime Entity Id of the current parent.
   * @param newParentCkTypeId CkTypeId of the target parent.
   * @param newParentRtId Runtime Entity Id of the target parent.
   *
   * @returns true if association was successfully swapped.
   */
  public async updateParentChildAssociation(
    srcObjRtId: string,
    oldParentCkTypeId: string,
    oldParentRtId: string,
    newParentCkTypeId: string,
    newParentRtId: string,
  ) {
    const entitiesToUpdate: BasicTreeNodeInputUpdateDto[] = [
      // source
      {
        rtId: srcObjRtId,
        item: {
          parent: [
            {
              target: {
                rtId: oldParentRtId,
                ckTypeId: oldParentCkTypeId,
              },
              modOption: AssociationModOptionsDto.DeleteDto,
            },
          ],
        },
      },
      // target
      {
        rtId: srcObjRtId,
        item: {
          parent: [
            {
              target: {
                rtId: newParentRtId,
                ckTypeId: newParentCkTypeId,
              },
              modOption: AssociationModOptionsDto.CreateDto,
            },
          ],
        },
      },
    ];

    try {
      const response = await firstValueFrom(
        this.updateTreeNodesDtoGQL.mutate({
          variables: {
            entities: entitiesToUpdate,
          },
          fetchPolicy: 'network-only',
        }),
      );

      if (response.error) {
        throw response.error;
      }
    } catch (error) {
      console.error(
        'Error on attempt to switch object parents by changing ParentChild association',
        srcObjRtId,
        error,
      );
      return false;
    }

    return true;
  }

  /**
   * Returns ckTypeId and rtId of a parent of given runtime entity.
   *
   * @param ckTypeId Runtime entity's ck type
   * @param rtId Runtime entity's runtime id
   * @returns object with parent's ckTypeId and rtId, or undefined when not found or on error.
   */
  public async getRuntimeEntityParentData(
    ckTypeId: string,
    rtId: string,
  ): Promise<
    | {
        ckTypeId: string;
        rtId: string;
      }
    | undefined
  > {
    const isParentAssoc = true;
    const parentAssocs = await this.getParentChildAssociation(
      ckTypeId,
      rtId,
      isParentAssoc,
    );

    if (!parentAssocs || parentAssocs.length === 0) {
      return undefined;
    }

    // the non-null assertion operator can be used because we've checked array length before
    const parentAssoc = parentAssocs[0]!;

    return {
      ckTypeId: parentAssoc.targetCkTypeId,
      rtId: parentAssoc.targetRtId,
    };
  }

  /**
   * Performs cascade delete operation on given runtime entity.
   *
   * @param itemToDelete Potential runtime entity.
   * @returns true on successful delete, false on database error or if object is not a runtime entity.
   */
  public async deleteRtEntityAndChildren(
    itemToDelete: TreeItemDataTyped<BrowserItem>,
  ): Promise<boolean> {
    const runtimeEntity = itemToDelete.item;

    if (!this.typeHelperService.isRuntimeEntity(runtimeEntity)) {
      console.error(
        'The item given for deletion is not a runtime entity',
        itemToDelete,
      );
      return false;
    }

    try {
      const result = await firstValueFrom(
        this.deleteEntitiesDtoGQL.mutate({
          variables: {
            rtEntityIds: [
              {
                ckTypeId: runtimeEntity.ckTypeId,
                rtId: runtimeEntity.rtId,
              },
            ],
          },
        }),
      );

      if (result.error) {
        throw result.error;
      }

      return result.data?.runtime?.runtimeEntities?.delete ?? false;
    } catch (error) {
      console.error(
        'Error on attempt to cascade delete nodes during Delete Node operation',
        error,
      );
      return false;
    }
  }

  /**
   * Check if the Basic construction kit is available in the system
   */
  private async checkBasicConstructionKitAvailable(): Promise<boolean> {
    try {
      // Check if any types exist in the Basic model
      const response = await firstValueFrom(
        this.getCkModelByIdDtoGQL.fetch({
          variables: {
            model: 'Basic',
          },
          fetchPolicy: 'network-only',
        }),
      );

      const hasBasicTypes =
        (response.data?.constructionKit?.models?.items?.length ?? 0) > 0;

      if (hasBasicTypes) {
        console.debug('✅ Basic construction kit is available');
      } else {
        console.debug(
          '⚠️ Basic construction kit not found - no types in Basic model',
        );
      }

      return hasBasicTypes;
    } catch (error) {
      console.warn(
        '⚠️ Error checking Basic construction kit availability:',
        error,
      );
      return false; // Assume not available on error
    }
  }

  private async fetchCkModels(): Promise<TreeItemDataTyped<BrowserItem>[]> {
    try {
      const response = await firstValueFrom(
        this.getCkModelsGQL.fetch({
          variables: {},
          fetchPolicy: 'network-only',
        }),
      );

      const result: TreeItemDataTyped<BrowserItem>[] = [];
      const models = response.data?.constructionKit?.models?.items || [];

      for (const model of models) {
        if (!model) {
          continue;
        }

        result.push(
          new TreeItemDataTyped<BrowserItem>(
            `model:${model.id.fullName}`,
            model.id.fullName || 'Unknown Model',
            `Model: ${model.id.fullName} (${model.modelState || 'Unknown State'})`,
            model as any,
            folderMoreIcon,
            true, // Models have types as children
          ),
        );
      }

      return result;
    } catch (error) {
      console.error('Error fetching CK models:', error);
      return [];
    }
  }

  private async fetchCkTypes(
    modelId: string,
  ): Promise<TreeItemDataTyped<BrowserItem>[]> {
    try {
      const response = await firstValueFrom(
        this.getCkTypesGQL.fetch({
          variables: {
            ckModelIds: [modelId],
          },
          fetchPolicy: 'network-only',
        }),
      );

      const result: TreeItemDataTyped<BrowserItem>[] = [];
      const types = response.data?.constructionKit?.types?.items || [];

      for (const type of types) {
        if (!type) continue;

        const isAbstract = type.isAbstract ? ' (Abstract)' : '';
        const isFinal = type.isFinal ? ' (Final)' : '';

        result.push(
          new TreeItemDataTyped<BrowserItem>(
            `type:${type.ckTypeId.fullName}`,
            type.ckTypeId.fullName || 'Unknown Type',
            `Type: ${type.ckTypeId.fullName}${isAbstract}${isFinal}`,
            type as any,
            gearIcon,
            false, // Types don't have children in this view
          ),
        );
      }

      return result;
    } catch (error) {
      console.error('Error fetching CK types:', error);
      return [];
    }
  }
}
