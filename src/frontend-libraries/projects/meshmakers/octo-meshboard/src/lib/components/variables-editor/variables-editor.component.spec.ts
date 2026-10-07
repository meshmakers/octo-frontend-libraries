import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { expectIconButtonsAccessible } from '@meshmakers/shared-ui/testing';
import { VariablesEditorComponent } from './variables-editor.component';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { MeshBoardVariable } from '../../models/meshboard.models';

/** Row remove buttons of the variables editor are named per variable (AB#5580). */
describe('VariablesEditorComponent — actions (AB#5580)', () => {
  it('names every icon-only action (AB#5581 guard)', async () => {
    TestBed.configureTestingModule({
      imports: [VariablesEditorComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MeshBoardVariableService, useValue: { isValidVariableName: () => true } },
      ],
    });
    const fixture = TestBed.createComponent(VariablesEditorComponent);
    fixture.componentInstance.variables = [
      { name: 'plant', type: 'string', source: 'static', value: 'A' } as unknown as MeshBoardVariable,
    ];
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const remove = el.querySelector('button[title="Remove variable"]');
    expect(remove?.getAttribute('aria-label')).toBe('Remove variable plant');
    expectIconButtonsAccessible(fixture);
  });
});
