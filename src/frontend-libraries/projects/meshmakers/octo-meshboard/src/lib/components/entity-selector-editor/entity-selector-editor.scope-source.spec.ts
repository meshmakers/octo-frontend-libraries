import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Observable, of, throwError } from 'rxjs';
import { ConfirmationService } from '@meshmakers/shared-ui';
import { AttributeSelectorDialogService, CkTypeSelectorInputComponent, FieldFilterEditorComponent } from '@meshmakers/octo-ui';
import { EntitySelectorEditorComponent, type DefaultScopeCheck } from './entity-selector-editor.component';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardPersistenceService, type PersistedMeshBoard } from '../../services/meshboard-persistence.service';
import { WidgetRegistryService } from '../../services/widget-registry.service';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { GetCkTypeAssociationRolesDtoGQL } from '../../graphQL/getCkTypeAssociationRoles';
import { GetDashboardsDtoGQL } from '../../graphQL/getDashboards';
import { GetDashboardWithWidgetsDtoGQL } from '../../graphQL/getDashboardWithWidgets';
import { CreateDashboardDtoGQL } from '../../graphQL/createDashboard';
import { UpdateDashboardDtoGQL } from '../../graphQL/updateDashboard';
import { CreateDashboardWidgetDtoGQL } from '../../graphQL/createDashboardWidget';
import { UpdateDashboardWidgetDtoGQL } from '../../graphQL/updateDashboardWidget';
import { DeleteEntitiesDtoGQL } from '../../graphQL/deleteEntities';
import type { EntitySelectorConfig, EntitySelectorScopeHop, MeshBoardConfig } from '../../models/meshboard.models';
import { EntitySelectorScopePathEditorComponent } from '../entity-selector-scope-path-editor/entity-selector-scope-path-editor.component';
import { SITE_GRAPH, TO_BUILDING, TO_ROOM, TO_STOREY } from '../../testing/entity-selector-scope-source.fixtures';

/** Stand-in for octo-ui's CK type picker (the real one needs Apollo). */
@Component({
  selector: 'mm-ck-type-selector-input',
  standalone: true,
  template: '',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CkTypeStubComponent), multi: true }]
})
class CkTypeStubComponent implements ControlValueAccessor {
  @Input() placeholder = '';
  @Input() derivedFromRtCkTypeId?: string;
  @Output() ckTypeSelected = new EventEmitter<unknown>();
  @Output() ckTypeCleared = new EventEmitter<void>();
  writeValue(): void { /* stub */ }
  registerOnChange(): void { /* stub */ }
  registerOnTouched(): void { /* stub */ }
}

/** Stand-in for octo-ui's field filter editor. */
@Component({ selector: 'mm-field-filter-editor', standalone: true, template: '' })
class FieldFilterEditorStubComponent {
  @Input() ckTypeId?: string;
  @Input() filters: unknown[] = [];
  @Input() enableVariables = false;
  @Input() availableVariables: unknown[] = [];
  @Output() filtersChange = new EventEmitter<unknown[]>();
}

/**
 * "List only entities inside" section of the selector editor (AB#7917,
 * wireframe agreed by Freya in the story). Neutral fixtures only
 * (Test/Site → Test/Building → Test/Storey → Test/Room).
 */
describe('EntitySelectorEditorComponent — dependent selector (AB#7917)', () => {
  interface EditorForm {
    editScopeSourceSelectorId: string;
    editScopeSourceHops: EntitySelectorScopeHop[];
    defaultScopeCheck: DefaultScopeCheck;
    scopeSourceLeaderOptions: EntitySelectorConfig[];
    scopeSourceError: string;
    isScopeSourceLocked: boolean;
    followError: string;
    isFollowsLocked: boolean;
  }

  const site: EntitySelectorConfig = {
    id: 'site', label: 'Site', ckTypeId: 'Test/Site', showInToolbar: true, defaultRtId: 'site-1',
    attributeMappings: [{ attributePath: 'name', variableName: 'siteName' }]
  };
  const room: EntitySelectorConfig = {
    id: 'room', label: 'Room', ckTypeId: 'Test/Room', showInToolbar: true,
    attributeMappings: [{ attributePath: 'name', variableName: 'roomName' }]
  };
  const dependentRoom: EntitySelectorConfig = { ...room, scopeSource: { selectorId: 'site', path: [TO_BUILDING, TO_STOREY, TO_ROOM] } };
  const zone: EntitySelectorConfig = {
    id: 'zone', label: 'Zone', ckTypeId: 'Test/Site', showInToolbar: false, followsSelectorId: 'site', attributeMappings: []
  };

  let fetchHop: ReturnType<typeof vi.fn>;

  function create(selectors: EntitySelectorConfig[], hop?: (sources: readonly string[], target: string) => Observable<string[]>) {
    fetchHop = vi.fn((sources: readonly string[], _sourceType: string, target: string) =>
      hop ? hop(sources, target) : of(sources.flatMap(s => SITE_GRAPH[target]?.[s] ?? [])));
    TestBed.configureTestingModule({
      imports: [EntitySelectorEditorComponent],
      providers: [
        { provide: AttributeSelectorDialogService, useValue: {} },
        { provide: MeshBoardVariableService, useValue: {} },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: { fetch: () => of({ data: null }) } },
        { provide: GetCkTypeAssociationRolesDtoGQL, useValue: { fetch: () => of({ data: null }) } },
        { provide: MeshBoardDataService, useValue: { fetchAssociationTargetRtIds: fetchHop } },
        { provide: ConfirmationService, useValue: { showDangerConfirm: vi.fn().mockResolvedValue(true) } },
        provideNoopAnimations()
      ]
    });
    for (const component of [EntitySelectorEditorComponent, EntitySelectorScopePathEditorComponent]) {
      TestBed.overrideComponent(component, {
        remove: { imports: [CkTypeSelectorInputComponent, FieldFilterEditorComponent] },
        add: { imports: [CkTypeStubComponent, FieldFilterEditorStubComponent] }
      });
    }
    const fixture = TestBed.createComponent(EntitySelectorEditorComponent);
    fixture.componentInstance.entitySelectors = selectors;
    const emitted: EntitySelectorConfig[][] = [];
    fixture.componentInstance.entitySelectorsChange.subscribe(v => emitted.push(v));
    return { fixture, editor: fixture.componentInstance, form: fixture.componentInstance as unknown as EditorForm, emitted };
  }

  async function render(fixture: ReturnType<typeof create>['fixture']): Promise<HTMLElement> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => vi.useRealTimers());

  describe('section', () => {
    it('is shown for a non-follower with a CK type, after the picker filter and before the mappings', async () => {
      const { fixture, editor } = create([site, room]);
      editor.editSelector(1);
      const el = await render(fixture);

      const section = el.querySelector('[data-test="scope-source-section"]');
      expect(section).not.toBeNull();
      expect(section?.querySelector('label[for="scopeSourceSelectorId"]')?.textContent).toContain('Inside the pick of');
      const labels = [...el.querySelectorAll('.form-field > .field-label')].map(l => l.textContent?.trim() ?? '');
      const filter = labels.indexOf('Picker filter');
      const inside = labels.indexOf('List only entities inside');
      const mappings = labels.findIndex(l => l.startsWith('Attribute Mappings'));
      expect(filter).toBeGreaterThanOrEqual(0);
      expect(inside).toBeGreaterThan(filter);
      expect(mappings).toBeGreaterThan(inside);
    });

    it('is hidden without a CK type', async () => {
      const { fixture, editor } = create([site]);
      editor.addSelector();
      const el = await render(fixture);
      expect(el.querySelector('[data-test="scope-source-section"]')).toBeNull();
    });

    it('is hidden for a follower; an existing scope source is removed on save with a notice', async () => {
      const handEdited: EntitySelectorConfig = { ...zone, scopeSource: { selectorId: 'site', path: [{ ...TO_BUILDING, targetCkTypeId: 'Test/Site' }] } };
      const { fixture, editor, emitted } = create([site, handEdited]);
      editor.editSelector(1);
      const el = await render(fixture);

      expect(el.querySelector('[data-test="scope-source-section"]')).toBeNull();
      expect(el.querySelector('[data-test="follower-scope-source-notice"]')?.textContent)
        .toContain('A follower has no picker: "List only entities inside Site" is removed when you save.');
      expect(editor.isEditValid()).toBe(true);

      editor.saveEdit();
      expect(emitted[0][1].scopeSource).toBeUndefined();
      expect(emitted[0][1].followsSelectorId).toBe('site');
    });

    it('hides the section and shows the notice when the selector is made a follower', async () => {
      const { fixture, editor, emitted } = create([site, dependentRoom]);
      editor.editSelector(1);
      editor.onFollowsChanged('site');
      const el = await render(fixture);

      expect(el.querySelector('[data-test="scope-source-section"]')).toBeNull();
      expect(el.querySelector('[data-test="follower-scope-source-notice"]')).not.toBeNull();
      editor.saveEdit();
      expect(emitted[0][1].scopeSource).toBeUndefined();
    });
  });

  describe('Inside the pick of', () => {
    it('lists only other selectors that are neither followers nor dependent', () => {
      const building: EntitySelectorConfig = { id: 'building', label: 'Building', ckTypeId: 'Test/Building', attributeMappings: [], scopeSource: { selectorId: 'site', path: [TO_BUILDING] } };
      const { editor, form } = create([site, room, zone, building]);
      editor.editSelector(1);
      expect(form.scopeSourceLeaderOptions.map(s => s.id)).toEqual(['site']);
    });

    it('is locked for a selector others depend on, and says why', async () => {
      const { fixture, editor, form } = create([site, dependentRoom]);
      editor.editSelector(0);
      const el = await render(fixture);

      expect(form.isScopeSourceLocked).toBe(true);
      expect((el.querySelector('#scopeSourceSelectorId') as HTMLSelectElement).disabled).toBe(true);
      expect(el.querySelector('[data-test="scope-source-locked"]')?.textContent)
        .toContain('Room lists only entities inside this selector. A selector with dependents cannot list only entities inside another one.');
    });

    it('lets a selector with dependents not follow another one either', () => {
      const other: EntitySelectorConfig = { id: 'other', label: 'Other', ckTypeId: 'Test/Site', attributeMappings: [] };
      const { editor, form } = create([site, dependentRoom, other]);
      editor.editSelector(0);
      expect(form.isFollowsLocked).toBe(true);

      editor.onFollowsChanged('other');
      expect(form.followError).toBe('Room lists only entities inside this selector. A selector with dependents cannot follow another one.');
      expect(editor.isEditValid()).toBe(false);
    });

    it('shows a stored leader that became a follower as unavailable and blocks save', async () => {
      const handEdited: EntitySelectorConfig = { ...room, scopeSource: { selectorId: 'zone', path: [TO_ROOM] } };
      const { fixture, editor, form } = create([site, zone, handEdited]);
      editor.editSelector(2);
      const el = await render(fixture);

      expect(form.scopeSourceError).toBe('Zone follows another selector - pick another leader or none.');
      expect(el.querySelector('[data-test="scope-source-error"]')?.textContent).toContain('Zone follows another selector');
      expect([...(el.querySelector('#scopeSourceSelectorId') as HTMLSelectElement).options].map(o => o.textContent?.trim()))
        .toContain('Zone (unavailable)');
      expect(editor.isEditValid()).toBe(false);
    });
  });

  describe('path', () => {
    it('starts with one hop at the leader type ending at this selector type, shown fixed', async () => {
      const { fixture, editor, form } = create([site, room]);
      editor.editSelector(1);
      editor.onScopeSourceChanged('site');
      const el = await render(fixture);

      expect(form.editScopeSourceHops).toEqual([{ roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Room' }]);
      const pathEditor = el.querySelector('[data-test="scope-source-section"] mm-entity-selector-scope-path-editor');
      expect(pathEditor?.querySelector('.scope-from')?.textContent).toContain('Test/Site');
      expect(pathEditor?.querySelector('[data-test="locked-target"]')?.textContent).toContain('Test/Room');
      expect(el.querySelector('[data-test="scope-source-path-title"]')?.textContent?.replace(/\s+/g, ' '))
        .toContain('Path from Site (Test/Site) to Room (Test/Room)');
      expect(el.querySelector('[data-test="scope-source-hint"]')?.textContent?.replace(/\s+/g, ' '))
        .toContain('The Room picker lists only the Room reached from the Site the user picked.');
    });

    it('allows at most five hops', async () => {
      const { fixture, editor } = create([site, room]);
      editor.editSelector(1);
      editor.onScopeSourceChanged('site');
      const el = await render(fixture);
      const add = () => el.querySelector<HTMLButtonElement>('[data-test="scope-source-section"] [data-test="add-hop"]')!;

      for (let i = 0; i < 6; i++) {
        add().click();
        fixture.detectChanges();
      }
      expect(el.querySelectorAll('[data-test="scope-source-section"] .hop-card').length).toBe(5);
      expect(add().disabled).toBe(true);
    });

    it('blocks save while a hop lacks its association or target type', () => {
      const { editor, form } = create([site, room]);
      editor.editSelector(1);
      editor.onScopeSourceChanged('site');
      editor.onScopeSourceHopsChanged([{ roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: '' }, TO_ROOM]);

      expect(form.scopeSourceError).toBe('Hop 1 needs an association and a target type.');
      expect(editor.isEditValid()).toBe(false);
    });

    it('keeps the last hop at this selector type when the hops or the CK type change', () => {
      const { editor, form } = create([site, room]);
      editor.editSelector(1);
      editor.onScopeSourceChanged('site');
      editor.onScopeSourceHopsChanged([TO_BUILDING, { ...TO_STOREY }]);
      expect(form.editScopeSourceHops[1].targetCkTypeId).toBe('Test/Room');

      editor.onCkTypeSelected({ fullName: 'Test/Desk', rtCkTypeId: 'Test/Desk', isAbstract: false, isFinal: false });
      expect(form.editScopeSourceHops.map(h => h.targetCkTypeId)).toEqual(['Test/Building', 'Test/Desk']);
    });
  });

  describe('save', () => {
    it('writes selectorId and path, also one hop as path', () => {
      const building: EntitySelectorConfig = { id: 'building', label: 'Building', ckTypeId: 'Test/Building', attributeMappings: [{ attributePath: 'name', variableName: 'buildingName' }] };
      const { editor, emitted } = create([site, building]);
      editor.editSelector(1);
      editor.onScopeSourceChanged('site');
      editor.saveEdit();

      expect(emitted[0][1].scopeSource).toEqual({ selectorId: 'site', path: [{ roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Building' }] });
    });

    it('keeps the scope source of a dependent selector edited without touching it (AB#7915 data loss)', () => {
      const { editor, emitted } = create([site, dependentRoom]);
      editor.editSelector(1);
      editor.saveEdit();

      expect(emitted[0][1].scopeSource).toEqual(dependentRoom.scopeSource);
    });

    it('removes the scope source for (none)', () => {
      const { editor, emitted } = create([site, dependentRoom]);
      editor.editSelector(1);
      editor.onScopeSourceChanged('');
      editor.saveEdit();

      expect(emitted[0][1].scopeSource).toBeUndefined();
      expect(JSON.stringify(emitted[0][1])).not.toContain('scopeSource');
    });

    it('keeps it through save and reopening the editor', () => {
      const { editor, form, emitted } = create([site, room]);
      editor.editSelector(1);
      editor.onScopeSourceChanged('site');
      editor.onScopeSourceHopsChanged([TO_BUILDING, TO_STOREY, TO_ROOM]);
      editor.saveEdit();

      editor.entitySelectors = emitted[0];
      editor.editSelector(1);
      expect(form.editScopeSourceSelectorId).toBe('site');
      expect(form.editScopeSourceHops).toEqual([TO_BUILDING, TO_STOREY, TO_ROOM]);
    });

    it('round-trips through the board encoding (save, reload, export/import)', async () => {
      const { editor, emitted } = create([site, room]);
      editor.editSelector(1);
      editor.onScopeSourceChanged('site');
      editor.onScopeSourceHopsChanged([TO_BUILDING, TO_STOREY, TO_ROOM]);
      editor.saveEdit();

      const updateDashboard = vi.fn().mockReturnValue(of({ data: {} }));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          MeshBoardPersistenceService,
          { provide: GetDashboardsDtoGQL, useValue: {} },
          { provide: GetDashboardWithWidgetsDtoGQL, useValue: {} },
          { provide: CreateDashboardDtoGQL, useValue: {} },
          { provide: UpdateDashboardDtoGQL, useValue: { mutate: updateDashboard } },
          { provide: CreateDashboardWidgetDtoGQL, useValue: {} },
          { provide: UpdateDashboardWidgetDtoGQL, useValue: {} },
          { provide: DeleteEntitiesDtoGQL, useValue: {} },
          { provide: WidgetRegistryService, useValue: {} }
        ]
      });
      const persistence = TestBed.inject(MeshBoardPersistenceService);
      const board: MeshBoardConfig = { id: 'board-1', name: 'Rooms', description: 'Rooms', columns: 6, rowHeight: 120, gap: 16, widgets: [], entitySelectors: emitted[0] };
      await persistence.updateMeshBoard('board-1', board);
      const description = updateDashboard.mock.calls[0][0].variables.entities[0].item.description as string;
      const persisted: PersistedMeshBoard = { rtId: 'board-1', ckTypeId: 'System.UI/Dashboard', name: 'Rooms', description, columns: 6, rowHeight: 120, gap: 16 };

      const reloaded = persistence.toMeshBoardConfig(persisted, []);

      expect(reloaded.entitySelectors?.[1].scopeSource).toEqual({ selectorId: 'site', path: [TO_BUILDING, TO_STOREY, TO_ROOM] });
    });
  });

  describe('list', () => {
    it('shows "Inside: <leader> (<n> hops)" next to the filter summary', async () => {
      const { fixture } = create([site, dependentRoom]);
      const el = await render(fixture);
      expect(el.querySelector('[data-test="scope-source-summary"]')?.textContent?.trim()).toBe('Inside: Site (3 hops)');
    });

    it('marks a dependent whose leader is gone as an error', async () => {
      const { fixture } = create([dependentRoom]);
      const el = await render(fixture);
      expect(el.querySelector('[data-test="scope-source-summary"]')?.classList).toContain('selector-mode-error');
    });

    it('names dependents when their leader is removed', async () => {
      const { editor } = create([site, dependentRoom]);
      const confirm = TestBed.inject(ConfirmationService).showDangerConfirm as ReturnType<typeof vi.fn>;
      await editor.removeSelector(0);
      expect(confirm.mock.calls[0][0].consequence)
        .toBe('Room lists only entities inside this selector. Their pickers list nothing until you choose another leader or none.');
    });
  });

  describe('default check', () => {
    it('warns when the default is not inside the leader default', async () => {
      vi.useFakeTimers();
      const { fixture, editor, form } = create([site, { ...dependentRoom, defaultRtId: 'room-5' }]);
      editor.editSelector(1);
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      expect(form.defaultScopeCheck).toEqual({ state: 'outside' });
      expect(fetchHop).toHaveBeenCalledTimes(3);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-test="scope-source-default-warning"]')?.textContent)
        .toContain('The default Room is not inside the default Site. It is cleared when the board opens.');
    });

    it('accepts a default inside the leader default', async () => {
      vi.useFakeTimers();
      const { editor, form } = create([site, { ...dependentRoom, defaultRtId: 'room-2' }]);
      editor.editSelector(1);
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      expect(form.defaultScopeCheck).toEqual({ state: 'inside' });
    });

    it('says the check failed on a resolution error', async () => {
      vi.useFakeTimers();
      const { fixture, editor, form } = create([site, { ...dependentRoom, defaultRtId: 'room-2' }], () => throwError(() => new Error('down')));
      editor.editSelector(1);
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      expect(form.defaultScopeCheck).toEqual({ state: 'error' });
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-test="scope-source-default-warning"]')?.textContent)
        .toContain('Could not check the default entity.');
    });

    it('does not check without a leader default', async () => {
      vi.useFakeTimers();
      const { editor, form } = create([{ ...site, defaultRtId: undefined }, { ...dependentRoom, defaultRtId: 'room-2' }]);
      editor.editSelector(1);
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      expect(form.defaultScopeCheck).toEqual({ state: 'none' });
      expect(fetchHop).not.toHaveBeenCalled();
    });

    it('never blocks saving', async () => {
      vi.useFakeTimers();
      const { editor, form } = create([site, { ...dependentRoom, defaultRtId: 'room-5' }]);
      editor.editSelector(1);
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();
      expect(form.defaultScopeCheck.state).toBe('outside');
      expect(editor.isEditValid()).toBe(true);
    });
  });

  describe('accessibility', () => {
    it('labels the leader choice and the hop controls', async () => {
      const { fixture, editor } = create([site, dependentRoom]);
      editor.editSelector(1);
      const el = await render(fixture);
      const section = el.querySelector('[data-test="scope-source-section"]')!;

      expect(section.getAttribute('role')).toBe('group');
      expect(section.getAttribute('aria-labelledby')).toBe('scopeSourceHeading');
      expect(el.querySelector('#scopeSourceHeading')?.textContent).toContain('List only entities inside');
      for (const button of section.querySelectorAll<HTMLButtonElement>('.hop-actions button')) {
        expect(button.getAttribute('aria-label')).toMatch(/^(Move hop \d (up|down)|Remove hop \d)$/);
      }
      // The fixed last hop cannot move: hop 3 has no up button, hop 2 no down button.
      expect(section.querySelector('[aria-label="Move hop 3 up"]')).toBeNull();
      expect(section.querySelector('[aria-label="Move hop 2 down"]')).toBeNull();
      expect(section.querySelector('[aria-label="Move hop 2 up"]')).not.toBeNull();
    });
  });
});
