import { TestBed } from '@angular/core/testing';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { TreeItemDataTyped } from '@meshmakers/shared-services';
import { fileIcon } from '@progress/kendo-svg-icons';
import { RtEntityDto } from '@meshmakers/octo-services';
import { EntitySelectorDialogComponent } from './entity-selector-dialog.component';
import { RuntimeBrowserDataSource } from '../runtime-browser/data-sources/runtime-browser-data-source.service';

describe('EntitySelectorDialogComponent', () => {
  let component: EntitySelectorDialogComponent;

  const dataSourceStub = {
    getPerspectives: () => Promise.resolve([]),
    getActivePerspectiveKey: () => 'Spatial',
    setActivePerspective: () => undefined,
  };

  beforeEach(() => {
    // Constructed through the injector rather than as a fixture: the assertions are about
    // onNodeSelected alone, and rendering would pull in the Kendo tree and the real data
    // source for nothing.
    TestBed.configureTestingModule({
      providers: [
        { provide: WindowRef, useValue: {} },
        { provide: RuntimeBrowserDataSource, useValue: dataSourceStub },
      ],
    });

    component = TestBed.runInInjectionContext(() => new EntitySelectorDialogComponent());
  });

  // The picker hands its result to the caller (a data mapping, for instance). Reading
  // rtDisplayName off the DTO would return the backend's "<ckTypeId>@<rtId>" fallback for
  // entities with no computed name - the very id the tree already resolved away (AB#5285).
  it('returns the resolved node label, not the raw display name', () => {
    const entity = {
      rtId: 'node-1',
      ckTypeId: 'Basic/TreeNode',
      rtDisplayName: 'Basic/TreeNode@node-1',
    } as unknown as RtEntityDto;

    component.onNodeSelected(
      new TreeItemDataTyped<RtEntityDto>('node-1', 'Endfertigung', '', entity, fileIcon, false),
    );

    expect(component.selectedEntity?.name).toBe('Endfertigung');
    expect(component.selectedEntity?.rtId).toBe('node-1');
  });

  it('clears the selection for a node that is not an entity', () => {
    component.onNodeSelected(
      new TreeItemDataTyped<{ isAssociationGroup: boolean }>(
        'group-1',
        'Sensors (3)',
        '',
        { isAssociationGroup: true },
        fileIcon,
        true,
      ),
    );

    expect(component.selectedEntity).toBeNull();
  });
});
