import {HierarchyDataSource} from './hierarchy-data-source';
import {TreeItemDataTyped} from '@meshmakers/shared-services';

export abstract class HierarchyDataSourceBase<TQueryDto> extends HierarchyDataSource {

  public abstract override fetchChildren(item: TreeItemDataTyped<TQueryDto>): Promise<TreeItemDataTyped<TQueryDto>[]>;

  public abstract override fetchRootNodes(): Promise<TreeItemDataTyped<TQueryDto>[]>;
}

