import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { TreeDemoComponent } from './tree-demo.component';
import { TreeDemoDataSource } from '../data-sources/tree-demo-data-source.service';
import { GetTreesDtoGQL } from '../../../graphQL/getTrees';
import { GetTreeNodesDtoGQL } from '../../../graphQL/getTreeNodes';

describe('TreeDemoComponent', () => {
  let component: TreeDemoComponent;
  let fixture: ComponentFixture<TreeDemoComponent>;

  beforeEach(async () => {
    const mockGetTreesGQL = jasmine.createSpyObj('GetTreesDtoGQL', ['fetch']);
    mockGetTreesGQL.fetch.and.returnValue(of({ data: { runtime: { runtimeEntities: { items: [] } } } } as any));

    const mockGetTreeNodesGQL = jasmine.createSpyObj('GetTreeNodesDtoGQL', ['fetch']);
    mockGetTreeNodesGQL.fetch.and.returnValue(of({ data: { runtime: { runtimeEntities: { items: [] } } } } as any));

    const mockTreeDemoDataSource = jasmine.createSpyObj('TreeDemoDataSource', ['fetchRootNodes', 'fetchChildren']);
    mockTreeDemoDataSource.fetchRootNodes.and.returnValue(Promise.resolve([]));
    mockTreeDemoDataSource.fetchChildren.and.returnValue(Promise.resolve([]));

    await TestBed.configureTestingModule({
      imports: [TreeDemoComponent],
      providers: [
        provideNoopAnimations(),
        { provide: GetTreesDtoGQL, useValue: mockGetTreesGQL },
        { provide: GetTreeNodesDtoGQL, useValue: mockGetTreeNodesGQL },
        { provide: TreeDemoDataSource, useValue: mockTreeDemoDataSource }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TreeDemoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
