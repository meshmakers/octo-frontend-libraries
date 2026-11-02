import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { WindowService } from '@progress/kendo-angular-dialog';
import { ProcessBindingCardsComponent, ProcessBindingRename } from './process-binding-cards.component';
import { ProcessBindingDraft } from './process-binding-editor';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { DiagramPropertyMapping } from './process-widget-config.model';

/**
 * Binding cards of the process widget dialog (AB#8025): empty state, add,
 * rename (inline errors, mappings follow valid names only), duplicate,
 * delete with confirmation, keyboard and the missing-selector warning.
 */
describe('ProcessBindingCardsComponent (AB#8025)', () => {
  let fixture: ComponentFixture<ProcessBindingCardsComponent>;
  let cmp: ProcessBindingCardsComponent;
  let renames: ProcessBindingRename[];
  let deleted: string[];
  let changes: number;

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function q<T extends HTMLElement = HTMLElement>(selector: string): T | null {
    return el().querySelector<T>(selector);
  }

  function all(selector: string): HTMLElement[] {
    return Array.from(el().querySelectorAll<HTMLElement>(selector));
  }

  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  function drafts(): ProcessBindingDraft[] {
    return [
      { uid: 1, name: 'netz', mode: 'persistentQuery', queryRtId: 'q1', queryName: 'Netz', queryFamily: 'streamData', entitySelectorId: 'netz', expanded: false, committedName: 'netz' },
      { uid: 2, name: 'geraete', mode: 'persistentQuery', queryRtId: 'q2', entitySelectorId: 'geraete_alt', expanded: false, committedName: 'geraete' }
    ];
  }

  async function open(list: ProcessBindingDraft[], mappings: DiagramPropertyMapping[] = []): Promise<void> {
    fixture = TestBed.createComponent(ProcessBindingCardsComponent);
    cmp = fixture.componentInstance;
    renames = [];
    deleted = [];
    changes = 0;
    cmp.bindingRenamed.subscribe(r => renames.push(r));
    cmp.bindingDeleted.subscribe(n => deleted.push(n));
    cmp.draftsChange.subscribe(() => changes++);
    cmp.drafts = list;
    cmp.selectors = [{ id: 'netz', label: 'Netz', ckTypeId: 'Test/Grid', attributeMappings: [] }, { id: 'pv', label: 'PV', ckTypeId: 'Test/Pv', attributeMappings: [], followsSelectorId: 'site' }];
    cmp.mappings = mappings;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProcessBindingCardsComponent],
      providers: [
        provideNoopAnimations(),
        { provide: WindowService, useValue: { open: vi.fn() } },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: { fetch: vi.fn(() => of({ data: {} })) } }
      ]
    });
  });

  afterEach(() => fixture?.nativeElement.remove());

  it('without bindings shows the empty state with one "Add binding" action', async () => {
    await open([]);

    expect(q('[data-binding-empty]')?.textContent).toContain('No data binding yet');
    expect(all('[data-binding-action="add"]')).toHaveLength(1);
  });

  it('"Add binding" opens a new card with a unique name, the source and the selector field, focused on the name', async () => {
    const list: ProcessBindingDraft[] = [];
    await open(list);

    q<HTMLButtonElement>('[data-binding-action="add"]')!.click();
    fixture.detectChanges();
    await settle();

    expect(list.map(d => d.name)).toEqual(['binding']);
    expect(list[0].expanded).toBe(true);
    expect(q('[data-binding-source="0"]')).not.toBeNull();
    expect(q('[data-binding-selector="0"]')).not.toBeNull();
    expect(document.activeElement?.closest('[data-binding-name="0"]')).not.toBeNull();
    expect(changes).toBe(1);

    q<HTMLButtonElement>('[data-binding-action="add"]')!.click();
    expect(list.map(d => d.name)).toEqual(['binding', 'binding 2']);
  });

  it('shows the source, the selector and a warning tag on the header', async () => {
    await open(drafts());

    const headers = all('[data-binding-header]');
    expect(headers[0].textContent).toContain('netz');
    expect(headers[0].textContent).toContain('Persistent query · stream data');
    expect(headers[0].textContent).toContain('selector: netz');
    expect(headers[0].querySelector('[data-binding-warning]')).toBeNull();
    expect(headers[1].querySelector('[data-binding-warning]')?.textContent?.trim()).toBe('Selector not on this board');
  });

  it('lists every selector of the board plus "None" (and keeps a missing one visible)', async () => {
    const list = drafts();
    await open(list);

    expect(cmp.selectorOptions(list[0]).map(o => o.label)).toEqual(['— None —', 'Netz', 'PV (follower of site)']);
    expect(cmp.selectorOptions(list[1]).at(-1)).toEqual({ label: 'geraete_alt (not on this board)', value: 'geraete_alt' });
  });

  it('rename: inline error for empty and duplicate names; mappings follow only a valid name', async () => {
    const list = drafts();
    list[0].expanded = true;
    await open(list);

    cmp.onNameChange(list[0], 'geraete');
    fixture.detectChanges();
    expect(q('[data-binding-card="0"] .field-error')?.textContent?.trim()).toBe('The name "geraete" is used by another binding.');
    expect(renames).toEqual([]);

    cmp.onNameChange(list[0], '');
    fixture.detectChanges();
    expect(q('[data-binding-card="0"] .field-error')?.textContent?.trim()).toBe('Enter a binding name.');

    cmp.onNameChange(list[0], 'grid');
    fixture.detectChanges();
    expect(q('[data-binding-card="0"] .field-error')).toBeNull();
    expect(renames).toEqual([{ oldName: 'netz', newName: 'grid' }]);
  });

  it('a name made valid by renaming the other card is committed (mappings follow)', async () => {
    const list = drafts();
    await open(list);

    cmp.onNameChange(list[0], 'geraete');    // clash: nothing committed
    expect(renames).toEqual([]);
    cmp.onNameChange(list[1], 'battery');    // clash resolved by the other card
    expect(renames).toEqual([
      { oldName: 'geraete', newName: 'battery' },
      { oldName: 'netz', newName: 'geraete' }
    ]);
  });

  it('a name made valid by deleting the other card is committed', async () => {
    const list = drafts();
    await open(list);

    cmp.onNameChange(list[0], 'geraete');
    cmp.requestDelete(list[1]);
    cmp.confirmDelete(list[1]);

    expect(deleted).toEqual(['geraete']);
    expect(renames).toEqual([{ oldName: 'netz', newName: 'geraete' }]);
  });

  it('duplicate inserts a copy after the card with a free name', async () => {
    const list = drafts();
    await open(list);

    all('[data-binding-action="duplicate"]')[0].click();
    fixture.detectChanges();

    expect(list.map(d => d.name)).toEqual(['netz', 'netz copy', 'geraete']);
    expect(list[1]).toEqual(expect.objectContaining({ queryRtId: 'q1', entitySelectorId: 'netz', expanded: true }));
    expect(list[1].uid).not.toBe(list[0].uid);
  });

  it('delete of a used binding asks first and lists the affected properties; confirm removes it', async () => {
    const list = drafts();
    await open(list, [
      { propertyId: 'gridPower', sourceType: 'column', sourcePath: 'power', bindingName: 'netz' },
      { propertyId: 'flowDirection', sourceType: 'column', sourcePath: 'power', bindingName: 'netz' }
    ]);

    all('[data-binding-action="delete"]')[0].click();
    fixture.detectChanges();
    await settle();

    expect(list).toHaveLength(2);
    expect(q('[data-binding-confirm]')?.textContent).toContain('The mappings of gridPower, flowDirection will be cleared.');
    expect(document.activeElement).toBe(q('[data-binding-action="cancel-delete"]'));

    q<HTMLButtonElement>('[data-binding-action="confirm-delete"]')!.click();
    fixture.detectChanges();
    await settle();

    expect(list.map(d => d.name)).toEqual(['geraete']);
    expect(deleted).toEqual(['netz']);
    expect(document.activeElement).toBe(q('[data-binding-header="0"]'));
  });

  it('cancel keeps the binding and returns the focus to its header', async () => {
    const list = drafts();
    await open(list);

    all('[data-binding-action="delete"]')[1].click();
    fixture.detectChanges();
    q<HTMLButtonElement>('[data-binding-action="cancel-delete"]')!.click();
    fixture.detectChanges();
    await settle();

    expect(list).toHaveLength(2);
    expect(q('[data-binding-confirm]')).toBeNull();
    expect(document.activeElement).toBe(q('[data-binding-header="1"]'));
  });

  it('deleting the last binding moves the focus to "Add binding"', async () => {
    const list = [drafts()[0]];
    await open(list);

    cmp.requestDelete(list[0]);
    fixture.detectChanges();
    q<HTMLButtonElement>('[data-binding-action="confirm-delete"]')!.click();
    fixture.detectChanges();
    await settle();

    expect(q('[data-binding-empty]')).not.toBeNull();
    expect(document.activeElement).toBe(q('[data-binding-action="add"]'));
  });

  it('keyboard: headers are tab stops, Enter toggles, Delete starts the confirmation, keys on header buttons are theirs', async () => {
    const list = drafts();
    await open(list);
    const header = q('[data-binding-header="0"]')!;

    expect(header.getAttribute('tabindex')).toBe('0');
    expect(header.getAttribute('aria-expanded')).toBe('false');

    header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(list[0].expanded).toBe(true);
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(q('[data-binding-name="0"]')).not.toBeNull();

    all('[data-binding-action="duplicate"]')[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    fixture.detectChanges();
    expect(q('[data-binding-confirm]')).toBeNull();

    header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    fixture.detectChanges();
    expect(q('[data-binding-confirm]')).not.toBeNull();
  });

  it('switching the source clears the fields of the other source', async () => {
    const list = drafts();
    list[0].filters = [{ attributePath: 'a', operator: 'EQUALS', comparisonValue: '1' }];
    await open(list);

    cmp.onSourceChange(list[0], 'runtimeEntity');

    expect(list[0]).toEqual(expect.objectContaining({ mode: 'runtimeEntity', queryRtId: undefined, queryFamily: undefined, filters: undefined }));
    expect(list[0].entitySelectorId).toBe('netz');
  });

  it('picking a runtime query drops the stream-data time-filter opt-out', async () => {
    const list = drafts();
    list[0].ignoreTimeFilter = true;
    await open(list);

    cmp.onQuerySelected(list[0], { rtId: 'q9', name: 'Wallboxen', ckTypeId: 'System/SimpleRtQuery', queryCkTypeId: 'Test/Wallbox' });

    expect(list[0]).toEqual(expect.objectContaining({ queryRtId: 'q9', queryName: 'Wallboxen', queryFamily: 'runtime', queryCkTypeId: 'Test/Wallbox', ignoreTimeFilter: undefined }));
  });
  it('delete confirmation uses theme text and surface colours, not the light error-subtle fill (dark theme contrast)', async () => {
    await open(drafts());
    const styles = ((ProcessBindingCardsComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n').replace(/\[_ngcontent-%COMP%\]/g, '').replace(/%NS%/g, '');
    const rule = /\.delete-confirm\s*\{[^}]*\}/.exec(styles)?.[0] ?? '';

    expect(rule).toContain('color: var(--kendo-color-on-app-surface');
    expect(rule).toContain('background: var(--kendo-color-surface-alt');
    expect(rule).not.toContain('error-subtle');
  });
});
