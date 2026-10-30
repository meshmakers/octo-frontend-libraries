import { TestBed } from '@angular/core/testing';
import { expectIconButtonsAccessible } from '@meshmakers/shared-ui/testing';
import { ConfirmationService } from '@meshmakers/shared-ui';
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
