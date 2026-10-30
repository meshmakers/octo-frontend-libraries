import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { expectIconButtonsAccessible } from '@meshmakers/shared-ui/testing';
import { ConfirmationService } from '@meshmakers/shared-ui';
import { AttributeSelectorDialogService, CkTypeSelectorInputComponent } from '@meshmakers/octo-ui';
import { EntitySelectorEditorComponent } from './entity-selector-editor.component';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { EntitySelectorConfig, EntitySelectorScopeHop } from '../../models/meshboard.models';
import { GetCkTypeAssociationRolesDtoGQL } from '../../graphQL/getCkTypeAssociationRoles';
import { of } from 'rxjs';
import { EntitySelectorScopePathEditorComponent } from '../entity-selector-scope-path-editor/entity-selector-scope-path-editor.component';

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

/**
 * "Follows" option of the selector editor (AB#7722, wireframe agreed in the story
 * comments). Neutral fixtures only (Test/Site, Test/Room).
 */
describe('EntitySelectorEditorComponent — follows (AB#7722)', () => {
  /** The protected form state the template binds to. */
  interface EditorForm {
    editFollowsSelectorId: string;
    editCkTypeId: string;
    editMappings: { attributePath: string; variableName: string }[];
    editDefaultRtId: string;
    editShowInToolbar: boolean;
    editLabel: string;
    followNotice: string;
    leaderOptions: EntitySelectorConfig[];
    followError: string;
    isFollower: boolean;
    followedBy: EntitySelectorConfig[];
  }

  const site: EntitySelectorConfig = { id: 'site', label: 'Site', ckTypeId: 'Test/Site', attributeMappings: [{ attributePath: 'name', variableName: 'siteName' }] };
  const room: EntitySelectorConfig = { id: 'room', label: 'Room', ckTypeId: 'Test/Room', attributeMappings: [{ attributePath: 'name', variableName: 'roomName' }], showInToolbar: false, defaultRtId: 'room-1' };
  const grid: EntitySelectorConfig = { id: 'grid', label: 'Grid', ckTypeId: 'Test/Site', attributeMappings: [], showInToolbar: false, followsSelectorId: 'site' };

  let confirm: ReturnType<typeof vi.fn>;

  function create(selectors: EntitySelectorConfig[]) {
    confirm = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [EntitySelectorEditorComponent],
      providers: [
        { provide: AttributeSelectorDialogService, useValue: {} },
        { provide: MeshBoardVariableService, useValue: {} },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: {} },
        { provide: ConfirmationService, useValue: { showDangerConfirm: confirm } }
      ]
    });
    const fixture = TestBed.createComponent(EntitySelectorEditorComponent);
    fixture.componentInstance.entitySelectors = selectors;
    const form = fixture.componentInstance as unknown as EditorForm;
    return { fixture, editor: fixture.componentInstance, form };
  }

  it('lists only non-follower selectors other than itself as leaders', () => {
    const { editor, form } = create([site, grid, room]);

    editor.editSelector(2);

    expect(form.leaderOptions.map(s => s.id)).toEqual(['site']);
  });

  it('fixes the CK type to the leader\'s and tells why mappings and default were cleared', () => {
    const { editor, form } = create([site, room]);
    editor.editSelector(1);

    editor.onFollowsChanged('site');

    expect(form.editCkTypeId).toBe('Test/Site');
    expect(form.editMappings).toEqual([]);
    expect(form.editDefaultRtId).toBe('');
    expect(form.followNotice).toContain('Test/Site');
    expect(form.editShowInToolbar).toBe(false);
    // Followers need neither mappings nor a default entity.
    expect(editor.isEditValid()).toBe(true);
  });

  it('saves the follow setting as a hidden selector', () => {
    const { editor } = create([site, room]);
    const emitted: EntitySelectorConfig[][] = [];
    editor.entitySelectorsChange.subscribe(v => emitted.push(v));
    editor.editSelector(1);
    editor.onFollowsChanged('site');

    editor.saveEdit();

    expect(emitted[0][1]).toEqual(expect.objectContaining({ id: 'room', followsSelectorId: 'site', showInToolbar: false, ckTypeId: 'Test/Site' }));
  });

  it('does not let a followed selector follow another one', () => {
    const { editor, form } = create([site, grid, room]);
    editor.editSelector(0);

    // The template disables the "Follows" dropdown while followedBy is non-empty.
    expect(form.followedBy.map(s => s.id)).toEqual(['grid']);
    form.editFollowsSelectorId = 'room';
    expect(form.followError).toBe('Followed by Grid — a selector that is followed cannot follow another one.');
    expect(editor.isEditValid()).toBe(false);
  });

  it('tells the author when the stored leader no longer exists', () => {
    const { editor, form } = create([{ ...grid, followsSelectorId: 'gone' }]);

    editor.editSelector(0);

    expect(form.followError).toBe('The leader \'gone\' does not exist — pick another leader or none.');
    expect(editor.isEditValid()).toBe(false);
  });

  it('back to none makes the CK type editable again with "Show in Toolbar" unchecked', () => {
    const { editor, form } = create([site, grid]);
    editor.editSelector(1);

    editor.onFollowsChanged('');

    expect(form.isFollower).toBe(false);
    expect(form.editShowInToolbar).toBe(false);
  });

  it('shows the leader in the list and flags an orphan follower', () => {
    const { fixture } = create([site, grid, { ...grid, id: 'orphan', label: 'Orphan', followsSelectorId: 'gone' }]);
    fixture.detectChanges();

    const modes = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.selector-mode'));
    expect(modes.map(m => m.textContent?.trim())).toEqual(['Toolbar', 'Follows: Site', 'Follows: missing']);
    expect(modes[2].classList.contains('selector-mode-error')).toBe(true);
  });

  it('names the followers before removing their leader', async () => {
    const { editor } = create([site, grid]);

    await editor.removeSelector(0);

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ consequence: expect.stringContaining('Grid follows this selector') }));
    expect(editor.entitySelectors.map(s => s.id)).toEqual(['grid']);
  });

  it('keeps the leader when the removal is cancelled', async () => {
    const { editor } = create([site, grid]);
    confirm.mockResolvedValue(false);

    await editor.removeSelector(0);

    expect(editor.entitySelectors.map(s => s.id)).toEqual(['site', 'grid']);
  });
});

/** Stand-in for octo-ui's CK type picker (the real one needs Apollo); same selector, inputs and outputs. */
@Component({
  selector: 'mm-ck-type-selector-input',
  standalone: true,
  template: '',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CkTypeSelectorInputStubComponent), multi: true }]
})
class CkTypeSelectorInputStubComponent implements ControlValueAccessor {
  @Input() placeholder = '';
  @Input() derivedFromRtCkTypeId?: string;
  @Input() dialogTitle = '';
  @Input() disabled = false;
  @Output() ckTypeSelected = new EventEmitter<unknown>();
  @Output() ckTypeCleared = new EventEmitter<void>();
  writeValue(): void { /* stub */ }
  registerOnChange(): void { /* stub */ }
  registerOnTouched(): void { /* stub */ }
}

/**
 * Child scope hop list of the selector editor (AB#7723, wireframe agreed by
 * Freya in the story comments). One hop saves in the original top-level form,
 * two or more as `path`. Neutral fixtures only (Test/Site → Test/System → Test/Device).
 */
describe('EntitySelectorEditorComponent — child scope path (AB#7723)', () => {
  interface EditorForm {
    editScopeHops: EntitySelectorScopeHop[];
    scopeHopsError: string;
  }

  const toSystem: EntitySelectorScopeHop = { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/System' };
  const toDevice: EntitySelectorScopeHop = { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Device' };
  const base: EntitySelectorConfig = {
    id: 'site', label: 'Site', ckTypeId: 'Test/Site', attributeMappings: [{ attributePath: 'name', variableName: 'siteName' }], showInToolbar: true
  };

  function create(selectors: EntitySelectorConfig[]) {
    TestBed.configureTestingModule({
      imports: [EntitySelectorEditorComponent],
      providers: [
        { provide: AttributeSelectorDialogService, useValue: {} },
        { provide: MeshBoardVariableService, useValue: {} },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: {} },
        { provide: GetCkTypeAssociationRolesDtoGQL, useValue: { fetch: () => of({ data: null }) } },
        provideNoopAnimations()
      ]
    });
    for (const component of [EntitySelectorEditorComponent, EntitySelectorScopePathEditorComponent]) {
      TestBed.overrideComponent(component, {
        remove: { imports: [CkTypeSelectorInputComponent] },
        add: { imports: [CkTypeSelectorInputStubComponent] }
      });
    }
    const fixture = TestBed.createComponent(EntitySelectorEditorComponent);
    fixture.componentInstance.entitySelectors = selectors;
    const emitted: EntitySelectorConfig[][] = [];
    fixture.componentInstance.entitySelectorsChange.subscribe(v => emitted.push(v));
    return { fixture, editor: fixture.componentInstance, form: fixture.componentInstance as unknown as EditorForm, emitted };
  }

  it('shows an existing one-hop scope as one hop and saves it back in the top-level form', () => {
    const { editor, form, emitted } = create([{ ...base, childScope: { targetCkTypeId: 'Test/Device', roleId: 'System/ParentChild', direction: 'in' } }]);
    editor.editSelector(0);
    expect(form.editScopeHops).toEqual([toDevice]);

    editor.saveEdit();

    expect(JSON.stringify(emitted[0][0].childScope)).toBe('{"targetCkTypeId":"Test/Device","roleId":"System/ParentChild","direction":"in"}');
  });

  it('saves two hops as path', () => {
    const { editor, emitted } = create([base]);
    editor.editSelector(0);

    editor.onScopeHopsChanged([toSystem, toDevice]);
    editor.saveEdit();

    expect(emitted[0][0].childScope).toEqual({ path: [toSystem, toDevice] });
  });

  it('loads a saved path as its hops', () => {
    const { editor, form } = create([{ ...base, childScope: { path: [toSystem, toDevice] } }]);

    editor.editSelector(0);

    expect(form.editScopeHops).toEqual([toSystem, toDevice]);
  });

  it('saves no hops as no child scope', () => {
    const { editor, emitted } = create([{ ...base, childScope: { path: [toSystem, toDevice] } }]);
    editor.editSelector(0);

    editor.onScopeHopsChanged([]);
    editor.saveEdit();

    expect(emitted[0][0].childScope).toBeUndefined();
  });

  it('blocks saving while a hop lacks its association or target type', () => {
    const { editor, form } = create([base]);
    editor.editSelector(0);

    editor.onScopeHopsChanged([toSystem, { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: '' }]);

    expect(form.scopeHopsError).toBe('Hop 2 needs an association and a target type.');
    expect(editor.isEditValid()).toBe(false);
  });

  it('renders the hop list in the edit form, also for a follower', async () => {
    const leader: EntitySelectorConfig = base;
    const follower: EntitySelectorConfig = {
      id: 'devices', label: 'Devices', ckTypeId: 'Test/Site', attributeMappings: [], showInToolbar: false,
      followsSelectorId: 'site', childScope: { path: [toSystem, toDevice] }
    };
    const { fixture, editor } = create([leader, follower]);
    editor.editSelector(1);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('mm-entity-selector-scope-path-editor .hop-card').length).toBe(2);
    expect(el.querySelector('[data-test="scope-path"]')?.textContent).toContain('Test/Site → Test/System → Test/Device');
  });
});
