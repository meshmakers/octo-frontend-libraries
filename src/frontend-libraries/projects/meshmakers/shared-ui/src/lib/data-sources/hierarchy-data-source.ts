import {TreeItemData} from '@meshmakers/shared-services';

export abstract class HierarchyDataSource {

  protected expandAllByDefault = false;

  public hasChildren(item: TreeItemData): boolean{
      return item.expandable;
  }

  public isExpanded(item: TreeItemData): boolean{
      return item.isExpanded || this.expandAllByDefault;
  }

  public abstract fetchChildren(item: TreeItemData): Promise<TreeItemData[]>;

  public abstract fetchRootNodes(): Promise<TreeItemData[]>;
}

