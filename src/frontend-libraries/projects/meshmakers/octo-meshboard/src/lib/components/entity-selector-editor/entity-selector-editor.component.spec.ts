import { TestBed } from '@angular/core/testing';
import { expectIconButtonsAccessible } from '@meshmakers/shared-ui/testing';
import { AttributeSelectorDialogService } from '@meshmakers/octo-ui';
import { EntitySelectorEditorComponent } from './entity-selector-editor.component';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { EntitySelectorConfig } from '../../models/meshboard.models';

/** Edit / remove buttons of the entity selector list are named per selector (AB#5580). */
describe('EntitySelectorEditorComponent — actions (AB#5580)', () => {
  it('names every icon-only action (AB#5581 guard)', async () => {
    TestBed.configureTestingModule({
      imports: [EntitySelectorEditorComponent],
      providers: [
        { provide: AttributeSelectorDialogService, useValue: {} },
        { provide: MeshBoardVariableService, useValue: {} },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(EntitySelectorEditorComponent);
    fixture.componentInstance.entitySelectors = [
      { id: 'mp', label: 'Metering Point', ckTypeId: 'Energy/MeteringPoint', attributeMappings: [] } as EntitySelectorConfig,
    ];
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('button[aria-label="Remove selector Metering Point"]')).not.toBeNull();
    expectIconButtonsAccessible(fixture);
  });
});
