import { OctoGraphQlHierarchyDataSource } from './octo-graph-ql-hierarchy-data-source';
import { TreeItemDataTyped } from '@meshmakers/shared-services';
import { folderIcon } from '@progress/kendo-svg-icons';

interface TestDto {
  id: string;
  name: string;
}

class TestHierarchyDataSource extends OctoGraphQlHierarchyDataSource<TestDto> {
  public override async fetchChildren(_item: TreeItemDataTyped<TestDto>): Promise<TreeItemDataTyped<TestDto>[]> {
    return [];
  }

  public override async fetchRootNodes(): Promise<TreeItemDataTyped<TestDto>[]> {
    return [];
  }
}

describe('OctoGraphQlHierarchyDataSource', () => {
  let dataSource: TestHierarchyDataSource;

  beforeEach(() => {
    dataSource = new TestHierarchyDataSource();
  });

  it('should create an instance', () => {
    expect(dataSource).toBeTruthy();
  });

  it('should return empty array from fetchRootNodes', async () => {
    const result = await dataSource.fetchRootNodes();
    expect(result).toEqual([]);
  });

  it('should return empty array from fetchChildren', async () => {
    const testDto: TestDto = { id: '1', name: 'Test' };
    const parentItem = new TreeItemDataTyped<TestDto>('1', 'Test', 'Test tooltip', testDto, folderIcon, true, false);
    const result = await dataSource.fetchChildren(parentItem);
    expect(result).toEqual([]);
  });
});
