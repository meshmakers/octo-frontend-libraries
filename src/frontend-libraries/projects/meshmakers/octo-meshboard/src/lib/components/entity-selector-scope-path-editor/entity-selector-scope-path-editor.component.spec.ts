import { TestBed } from '@angular/core/testing';
import { Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CkTypeSelectorInputComponent } from '@meshmakers/octo-ui';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { expectIconButtonsAccessible } from '@meshmakers/shared-ui/testing';
import { of, throwError } from 'rxjs';
import { EntitySelectorScopePathEditorComponent, OTHER_ASSOCIATION } from './entity-selector-scope-path-editor.component';
import { GetCkTypeAssociationRolesDtoGQL } from '../../graphQL/getCkTypeAssociationRoles';
import { MAX_SCOPE_HOPS, type EntitySelectorScopeHop } from '../../models/meshboard.models';

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
 * Hop list of the child-scope editor (AB#7723, wireframe agreed by Freya,
 * comment 6625315): add / remove / reorder, association from the CK metadata
 * with "Other role…", target type restricted to the association's target,
 * warnings for associations not defined on the source type, metadata failure,
 * empty state, accessible icon buttons. Neutral fixtures only.
 */
describe('EntitySelectorScopePathEditorComponent (AB#7723)', () => {
  const toSystem: EntitySelectorScopeHop = { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/System' };
  const toDevice: EntitySelectorScopeHop = { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Device' };
  const toSensor: EntitySelectorScopeHop = { roleId: 'Test/Measures', direction: 'out', targetCkTypeId: 'Test/Sensor' };

  /** Associations per CK type, as getCkTypeAssociationRoles returns them. */
  const ROLES: Record<string, { in: [string, string][]; out: [string, string][] }> = {
    'Test/Site': { in: [['System/ParentChild', 'System/Entity']], out: [] },
    'Test/System': { in: [['System/ParentChild', 'System/Entity']], out: [['System/ParentChild', 'System/Entity']] },
    'Test/Device': { in: [], out: [['Test/Measures', 'Test/Sensor']] }
  };

  let fetch: ReturnType<typeof vi.fn>;

  function rolesResponse(ckTypeId: string) {
    const roles = ROLES[ckTypeId];
    const all = (list: [string, string][]) => list.map(([rtRoleId, rtTargetCkTypeId]) => ({ rtRoleId, rtTargetCkTypeId }));
    return of({
      data: {
        constructionKit: {
          types: { items: roles ? [{ rtCkTypeId: ckTypeId, associations: { in: { all: all(roles.in) }, out: { all: all(roles.out) } } }] : [] }
        }
      }
    });
  }

  async function create(hops: EntitySelectorScopeHop[], sourceCkTypeId = 'Test/Site') {
    fetch = vi.fn((options: { variables: { ckTypeId: string } }) => rolesResponse(options.variables.ckTypeId));
    TestBed.configureTestingModule({
      imports: [EntitySelectorScopePathEditorComponent],
      providers: [provideNoopAnimations(), { provide: GetCkTypeAssociationRolesDtoGQL, useValue: { fetch } }]
    });
    TestBed.overrideComponent(EntitySelectorScopePathEditorComponent, {
      remove: { imports: [CkTypeSelectorInputComponent] },
      add: { imports: [CkTypeSelectorInputStubComponent] }
    });
    const fixture = TestBed.createComponent(EntitySelectorScopePathEditorComponent);
    const editor = fixture.componentInstance;
    editor.sourceCkTypeId = sourceCkTypeId;
    editor.hops = hops;
    const emitted: EntitySelectorScopeHop[][] = [];
    editor.hopsChange.subscribe(v => emitted.push(v));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, editor, emitted, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the empty state without hops', async () => {
    const { el } = await create([]);

    expect(el.querySelector('[data-test="scope-empty"]')?.textContent)
      .toContain('No child scope: widgets use the picked entity\'s own rtId.');
    expect(el.querySelector('[data-test="scope-path"]')).toBeNull();
  });

  it('adds hops up to the maximum and then disables "Add hop"', async () => {
    const { fixture, editor, emitted, el } = await create([]);

    for (let i = 0; i < MAX_SCOPE_HOPS + 1; i++) editor.addHop();
    fixture.detectChanges();

    expect(emitted.at(-1)).toHaveLength(MAX_SCOPE_HOPS);
    expect(emitted.at(-1)![0]).toEqual({ roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: '' });
    expect((el.querySelector('[data-test="add-hop"]') as HTMLButtonElement).disabled).toBe(true);
    expect(el.textContent).toContain(`At most ${MAX_SCOPE_HOPS} hops.`);
  });

  it('removes a hop; removing the last one returns to the empty state', async () => {
    const { fixture, editor, emitted, el } = await create([toSystem, toDevice]);

    editor.removeHop(0);
    expect(emitted.at(-1)).toEqual([toDevice]);
    editor.removeHop(0);
    fixture.detectChanges();

    expect(emitted.at(-1)).toEqual([]);
    expect(el.querySelector('[data-test="scope-empty"]')).not.toBeNull();
  });

  it('reorders hops and keeps each hop\'s own values', async () => {
    const { editor, emitted } = await create([toSystem, toDevice, toSensor]);

    editor.moveHop(2, -1);
    expect(emitted.at(-1)).toEqual([toSystem, toSensor, toDevice]);
    editor.moveHop(0, 1);
    expect(emitted.at(-1)).toEqual([toSensor, toSystem, toDevice]);
    // Out of range: no change, no emission.
    const count = emitted.length;
    editor.moveHop(0, -1);
    expect(emitted.length).toBe(count);
  });

  it('names the hop actions and offers no "up" on the first and no "down" on the last hop', async () => {
    const { fixture, el } = await create([toSystem, toDevice]);

    expect(el.querySelector('button[aria-label="Move hop 1 up"]')).toBeNull();
    expect(el.querySelector('button[aria-label="Move hop 1 down"]')).not.toBeNull();
    expect(el.querySelector('button[aria-label="Move hop 2 up"]')).not.toBeNull();
    expect(el.querySelector('button[aria-label="Move hop 2 down"]')).toBeNull();
    expect(el.querySelector('button[aria-label="Remove hop 2"]')?.getAttribute('title')).toBe('Remove hop 2');
    expectIconButtonsAccessible(fixture);
  });

  it('offers the source type\'s associations and "Other role…", and fills role and direction from a choice', async () => {
    const { editor, emitted } = await create([{ roleId: '', direction: 'in', targetCkTypeId: '' }], 'Test/System');

    const options = editor.associationOptions(0);
    expect(options.map(o => o.label)).toEqual([
      'System/ParentChild · inbound · System/Entity',
      'System/ParentChild · outbound · System/Entity',
      'Other role…'
    ]);

    editor.onAssociationChanged(0, options[1].key);

    expect(emitted.at(-1)).toEqual([{ roleId: 'System/ParentChild', direction: 'out', targetCkTypeId: '' }]);
    expect(editor.baseTargetOf(0)).toBe('System/Entity');
    expect(editor.isFreeText(0)).toBe(false);
  });

  it('loads the associations of each hop\'s source type: the selector type, then the previous target', async () => {
    const { editor } = await create([toSystem, toDevice, toSensor]);

    expect(fetch.mock.calls.map(c => c[0].variables.ckTypeId)).toEqual(['Test/Site', 'Test/System', 'Test/Device']);
    expect(editor.sourceTypeOf(2)).toBe('Test/Device');
    // Hop 3's association comes from Test/Device's metadata; the target picker is restricted to it.
    expect(editor.baseTargetOf(2)).toBe('Test/Sensor');
  });

  it('switches to free text for "Other role…" and keeps the typed role', async () => {
    const { editor, emitted } = await create([toSystem]);

    editor.onAssociationChanged(0, OTHER_ASSOCIATION);
    editor.onRoleChanged(0, 'Test/Custom');
    editor.onDirectionChanged(0, 'out');

    expect(editor.isFreeText(0)).toBe(true);
    expect(emitted.at(-1)).toEqual([{ roleId: 'Test/Custom', direction: 'out', targetCkTypeId: 'Test/System' }]);
    expect(editor.associationWarning(0)).toBe('Association Test/Custom is not defined on Test/Site.');
  });

  it('warns, without losing values, when a moved hop\'s association is not defined on its new source type', async () => {
    const { editor, emitted } = await create([toSystem, toDevice, toSensor]);
    expect(editor.associationWarning(2)).toBe('');

    editor.moveHop(2, -1);

    expect(emitted.at(-1)![1]).toEqual(toSensor);
    expect(editor.associationWarning(1)).toBe('Association Test/Measures is not defined on Test/System.');
    expect(editor.isFreeText(1)).toBe(true);
  });

  it('shows free-text fields and a hint when the associations cannot be loaded', async () => {
    TestBed.configureTestingModule({
      imports: [EntitySelectorScopePathEditorComponent],
      providers: [provideNoopAnimations(), {
        provide: GetCkTypeAssociationRolesDtoGQL,
        useValue: { fetch: () => throwError(() => new Error('metadata down')) }
      }]
    });
    vi.spyOn(console, 'warn').mockReturnValue(undefined);
    TestBed.overrideComponent(EntitySelectorScopePathEditorComponent, {
      remove: { imports: [CkTypeSelectorInputComponent] },
      add: { imports: [CkTypeSelectorInputStubComponent] }
    });
    const fixture = TestBed.createComponent(EntitySelectorScopePathEditorComponent);
    fixture.componentInstance.sourceCkTypeId = 'Test/Site';
    fixture.componentInstance.hops = [toSystem];
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-test="metadata-failed"]')?.textContent)
      .toContain('Associations could not be loaded; enter the role manually.');
    expect(fixture.componentInstance.isFreeText(0)).toBe(true);
    expect(fixture.componentInstance.associationWarning(0)).toBe('');
  });

  it('marks a hop without target type as invalid', async () => {
    const { fixture, editor, el } = await create([toSystem]);

    editor.onTargetCleared(0);
    fixture.detectChanges();

    expect(el.querySelector('[data-test="hop-error"]')?.textContent).toContain('Hop 1 needs an association and a target type.');
    expect(el.querySelector('mm-ck-type-selector-input.k-invalid')).not.toBeNull();
  });

  it('keeps later hops when a target type changes and re-matches their associations', async () => {
    const { editor, emitted } = await create([toSystem, toDevice]);

    editor.onTargetSelected(0, { fullName: 'Test/Device', rtCkTypeId: 'Test/Device', isAbstract: false, isFinal: false });

    expect(emitted.at(-1)).toEqual([{ ...toSystem, targetCkTypeId: 'Test/Device' }, toDevice]);
    expect(editor.sourceTypeOf(1)).toBe('Test/Device');
  });

  it('shows the path line', async () => {
    const { el } = await create([toSystem, toDevice]);

    expect(el.querySelector('[data-test="scope-path"]')?.textContent).toContain('Path: Test/Site → Test/System → Test/Device');
  });

  it('does not rebuild its rows from its own emission (free-text mode survives the two-way binding)', async () => {
    const { editor, emitted } = await create([toSystem]);
    editor.onAssociationChanged(0, OTHER_ASSOCIATION);

    editor.hops = emitted.at(-1)!;

    expect(editor.isFreeText(0)).toBe(true);
  });
});

/**
 * Fixed last-hop target (AB#7917): the scope source path of a dependent
 * selector always ends at the selector's own CK type. Neutral fixtures only.
 */
describe('EntitySelectorScopePathEditorComponent — locked last target (AB#7917)', () => {
  const toBuilding: EntitySelectorScopeHop = { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Building' };
  const toStorey: EntitySelectorScopeHop = { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Storey' };
  const toRoom: EntitySelectorScopeHop = { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Room' };

  async function create(hops: EntitySelectorScopeHop[], locked = 'Test/Room') {
    TestBed.configureTestingModule({
      imports: [EntitySelectorScopePathEditorComponent],
      providers: [provideNoopAnimations(), { provide: GetCkTypeAssociationRolesDtoGQL, useValue: { fetch: () => of({ data: null }) } }]
    });
    TestBed.overrideComponent(EntitySelectorScopePathEditorComponent, {
      remove: { imports: [CkTypeSelectorInputComponent] },
      add: { imports: [CkTypeSelectorInputStubComponent] }
    });
    const fixture = TestBed.createComponent(EntitySelectorScopePathEditorComponent);
    const editor = fixture.componentInstance;
    editor.sourceCkTypeId = 'Test/Site';
    editor.lockedTargetCkTypeId = locked;
    editor.hops = hops;
    editor.description = 'Path from the leader pick.';
    editor.sourceDescription = 'pick of Site';
    editor.emptyText = 'Add at least one hop.';
    const emitted: EntitySelectorScopeHop[][] = [];
    editor.hopsChange.subscribe(v => emitted.push(v));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, editor, emitted, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the last target read-only and the host texts', async () => {
    const { el } = await create([toBuilding, toStorey, toRoom]);

    expect(el.querySelectorAll('mm-ck-type-selector-input').length).toBe(2);
    expect(el.querySelector('[data-test="hop-3"] [data-test="locked-target"]')?.textContent).toContain('Test/Room');
    expect(el.querySelector('[data-test="hop-3"] [data-test="locked-target"]')?.textContent).toContain("fixed: this selector's CK type");
    expect(el.textContent).toContain('Path from the leader pick.');
    expect(el.querySelector('.scope-from')?.textContent).toContain('(pick of Site)');
    expect(el.querySelector('[data-test="scope-path"]')?.textContent).toContain('Test/Site → Test/Building → Test/Storey → Test/Room');
  });

  it('shows the host empty text without hops and adds the first hop at the fixed type', async () => {
    const { editor, emitted, el } = await create([]);
    expect(el.querySelector('[data-test="scope-empty"]')?.textContent).toContain('Add at least one hop.');

    editor.addHop();

    expect(emitted.at(-1)).toEqual([{ roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Room' }]);
  });

  it('inserts new hops before the fixed last hop, up to the maximum', async () => {
    const { editor, emitted } = await create([toRoom]);

    editor.addHop();
    expect(emitted.at(-1)).toEqual([{ roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: '' }, toRoom]);
    for (let i = 0; i < MAX_SCOPE_HOPS; i++) editor.addHop();
    expect(emitted.at(-1)).toHaveLength(MAX_SCOPE_HOPS);
    expect(emitted.at(-1)!.at(-1)).toEqual(toRoom);
  });

  it('never moves the fixed last hop and offers no move buttons for it', async () => {
    const { fixture, editor, emitted, el } = await create([toBuilding, toStorey, toRoom]);

    expectIconButtonsAccessible(fixture);
    expect(el.querySelector('[aria-label="Move hop 3 up"]')).toBeNull();
    expect(el.querySelector('[aria-label="Move hop 2 down"]')).toBeNull();
    editor.moveHop(2, -1);
    editor.moveHop(1, 1);
    expect(emitted).toEqual([]);

    editor.moveHop(1, -1);
    expect(emitted.at(-1)).toEqual([toStorey, toBuilding, toRoom]);
  });

  it('makes the previous hop the fixed one when the last hop is removed', async () => {
    const { editor, emitted } = await create([toBuilding, toStorey, toRoom]);

    editor.removeHop(2);

    expect(emitted.at(-1)).toEqual([toBuilding, { ...toStorey, targetCkTypeId: 'Test/Room' }]);
  });

  it('does not report a missing target on the fixed hop', async () => {
    const { editor } = await create([{ ...toBuilding, targetCkTypeId: '' }, { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: '' }]);

    expect(editor.hopError(0)).toBe('Hop 1 needs an association and a target type.');
    expect(editor.hopError(1)).toBe('');
  });
});
