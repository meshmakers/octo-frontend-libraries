import {Component, inject, ViewChild} from '@angular/core';
import {TreeComponent} from '@meshmakers/shared-ui';
import {TreeDemoDataSource} from '../data-sources/tree-demo-data-source.service';

@Component({
  selector: 'app-tree-demo',
  imports: [TreeComponent, TreeComponent],
  templateUrl: './tree-demo.component.html',
  styleUrl: './tree-demo.component.scss'
})
export class TreeDemoComponent {
  protected readonly dataSource = inject(TreeDemoDataSource);

  @ViewChild('treeComponent', { static: false })
  treeComponent!: TreeComponent;

  private expandedKeys: any[] | null = null;

  protected onNodeSelected(event: any) {

    console.info('Node selected', event);
  }

  onTestExpand() {
     if (this.expandedKeys) {
       this.treeComponent.setExpandedKeys(this.expandedKeys);
     }
  }

  onTestCollapse() {

    this.expandedKeys = this.treeComponent.getExpandedKeys();

    this.treeComponent.collapseAll();
  }
}
