import {TreeItemDataTyped} from "@meshmakers/shared-services";
import {HierarchyDataSourceBase} from "@meshmakers/shared-ui";

export abstract class OctoGraphQlHierarchyDataSource<TQueryDto> extends HierarchyDataSourceBase<TQueryDto> {
  public abstract override fetchChildren(item: TreeItemDataTyped<TQueryDto>): Promise<TreeItemDataTyped<TQueryDto>[]>;

  public abstract override fetchRootNodes(): Promise<TreeItemDataTyped<TQueryDto>[]>;
}
