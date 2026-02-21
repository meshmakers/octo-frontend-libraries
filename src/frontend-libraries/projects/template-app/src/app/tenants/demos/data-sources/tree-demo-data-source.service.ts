import { Injectable, inject } from '@angular/core';
import {GetTreesDtoGQL} from '../../../graphQL/getTrees';
import {OctoGraphQlHierarchyDataSource} from '@meshmakers/octo-ui';
import {firstValueFrom} from 'rxjs';
import {RtEntityDto} from '@meshmakers/octo-services';
import {TreeItemDataTyped} from '@meshmakers/shared-services';
import {folderMoreIcon} from '@progress/kendo-svg-icons';
import {CkTypeMetaData, LevelMetaData, RtAssociationMetaData } from '@meshmakers/octo-services';
import {computer} from '../../../custom-svg-icons';
import {map} from 'rxjs/operators';
import {GetTreeNodesDtoGQL} from '../../../graphQL/getTreeNodes';


@Injectable({
  providedIn: 'root'
})
export class TreeDemoDataSource extends OctoGraphQlHierarchyDataSource<RtEntityDto> {
  private readonly getTreesDtoGQL = inject(GetTreesDtoGQL);
  private readonly getTreeNodesDtoGQL = inject(GetTreeNodesDtoGQL);


  private static readonly levelMetaData: LevelMetaData[] = [
    new LevelMetaData("Basic/Tree",
      [
        new RtAssociationMetaData("System/ParentChild", "Basic/TreeNode")
      ],
      [
        new RtAssociationMetaData("System/ParentChild", "Basic/TreeNode"),
        new RtAssociationMetaData("Basic/RelatedClassification", "Basic/Asset")
      ]
    ),
    new LevelMetaData("*",
      [
        new RtAssociationMetaData("System/ParentChild", "Basic/TreeNode"),
        new RtAssociationMetaData("Basic/RelatedClassification", "Basic/Asset")
      ],
      [
        new RtAssociationMetaData("System/ParentChild", "Basic/TreeNode"),
        new RtAssociationMetaData("Basic/RelatedClassification", "Basic/Asset")
      ]
    )
  ];

  private static readonly ckTypeMetaData: CkTypeMetaData[] = [
    new CkTypeMetaData("Basic/Tree", "Tree", "Tree", folderMoreIcon)
  ];


  public override async fetchChildren(item: TreeItemDataTyped<RtEntityDto>): Promise<TreeItemDataTyped<RtEntityDto>[]> {

    let metaData = TreeDemoDataSource.levelMetaData.find(x => x.ckTypeId === item.item.ckTypeId);
    if (!metaData) {
      metaData = TreeDemoDataSource.levelMetaData.find(x => x.ckTypeId === "*");
    }
    if (!metaData) {
      return [];
    }
    const mergedResultsMap: Record<string, TreeItemDataTyped<RtEntityDto>> = {};

    for (const directRole of metaData.directRoles) {
      const rtEntitiesOrigins = new Array<RtEntityDto>();

      for (const indirectRole of metaData.indirectRoles) {
        const result = await firstValueFrom(this.getTreeNodesDtoGQL.fetch({variables: {
          rtId: item.item.rtId,
          ckTypeId: item.item.ckTypeId,
          directRoleId: directRole.roleId,
          directTargetCkTypeId: directRole.ckTypeId,
          indirectRoleId: indirectRole.roleId,
          indirectTargetCkTypeId: indirectRole.ckTypeId
        }}).pipe(
          map(r => r.data?.runtime?.runtimeEntities?.items?.at(0))
        ));

        if (result) {
          rtEntitiesOrigins.push((result as RtEntityDto));
        }
      }

      for (const root of rtEntitiesOrigins) {

        if (!root?.associations?.targets?.items) {
          continue;
        }

        for (const child of root.associations.targets.items) {
          if (!child?.rtId || !child?.ckTypeId) {
            return [];
          }
          const rtId = child?.rtId;

          if (!mergedResultsMap[rtId]) {
            // Add a new object to the map
            let metaData = TreeDemoDataSource.ckTypeMetaData.find(x => x.ckTypeId === child?.ckTypeId);
            if (!metaData) {
              metaData = new CkTypeMetaData(child?.ckTypeId, child?.ckTypeId, child?.ckTypeId, computer);
            }

            const text = child.attributes?.items?.find(x=> x?.attributeName === "name")?.value;
            const tooltip = child.attributes?.items?.find(x=> x?.attributeName === "description")?.value;

            mergedResultsMap[rtId] = new TreeItemDataTyped<RtEntityDto>(
              child.rtId,
              text,
              tooltip,
              child,
              metaData.svgIcon,
              (child?.associations?.targets?.totalCount ?? 0) > 0
            );
          } else {
            // Sum up associations totalCount, if an object already exists
            mergedResultsMap[rtId].expandable ||= (child?.associations?.targets?.totalCount ?? 0) > 0;
          }
        }
      }
    }

    return Object.values(mergedResultsMap);
  }

  public override async fetchRootNodes(): Promise<TreeItemDataTyped<RtEntityDto>[]> {
    const r = await firstValueFrom(this.getTreesDtoGQL.fetch({variables: {ckTypeId: "Basic/Tree"}}));
    const result = new Array<TreeItemDataTyped<RtEntityDto>>();
    for (const item of r.data?.runtime?.runtimeEntities?.items as RtEntityDto[] ?? []) {

      let metaData = TreeDemoDataSource.ckTypeMetaData.find(x => x.ckTypeId === item?.ckTypeId);
      if (!metaData) {
        metaData = new CkTypeMetaData(item?.ckTypeId, item?.ckTypeId, item?.ckTypeId, computer);
      }

      const text = item.attributes?.items?.find(x=> x?.attributeName === "name")?.value;
      const tooltip = item.attributes?.items?.find(x=> x?.attributeName === "description")?.value;

      result.push(new TreeItemDataTyped<RtEntityDto>(item.rtId, text, tooltip, item, metaData.svgIcon, true));
    }
    return result;
  }
}
