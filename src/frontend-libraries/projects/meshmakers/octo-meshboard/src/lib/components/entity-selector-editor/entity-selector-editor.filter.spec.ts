import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Observable, of, throwError } from 'rxjs';
import { AttributeSelectorDialogService, CkTypeSelectorInputComponent, FieldFilterEditorComponent, FieldFilterItem } from '@meshmakers/octo-ui';
import { FieldFilterOperatorsDto } from '@meshmakers/octo-services';
import { EntitySelectorEditorComponent, DefaultFilterCheck } from './entity-selector-editor.component';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { GetCkTypeAssociationRolesDtoGQL } from '../../graphQL/getCkTypeAssociationRoles';
import { EntitySelectorConfig, MeshBoardVariable } from '../../models/meshboard.models';
import { EntitySelectorScopePathEditorComponent } from '../entity-selector-scope-path-editor/entity-selector-scope-path-editor.component';
import { FILTERED_SYSTEMS } from '../../testing/entity-selector-filter.fixtures';

/** Stand-in for octo-ui's CK type picker (the real one needs Apollo). */
@Component({
  selector: 'mm-ck-type-selector-input',
  standalone: true,
  template: '',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CkTypeStubComponent), multi: true }]
})
class CkTypeStubComponent implements ControlValueAccessor {
  @Input() placeholder = '';
  @Output() ckTypeSelected = new EventEmitter<unknown>();
  @Output() ckTypeCleared = new EventEmitter<void>();
  writeValue(): void { /* stub */ }
  registerOnChange(): void { /* stub */ }
  registerOnTouched(): void { /* stub */ }
}

/** Stand-in for octo-ui's field filter editor (the real one loads CK attributes). */
@Component({ selector: 'mm-field-filter-editor', standalone: true, template: '' })
class FieldFilterEditorStubComponent {
  @Input() ckTypeId?: string;
  @Input() filters: FieldFilterItem[] = [];
  @Input() enableVariables = false;
  @Input() availableVariables: unknown[] = [];
  @Output() filtersChange = new EventEmitter<FieldFilterItem[]>();
}

/**
 * Picker filter section of the selector editor (AB#7724, wireframe approved by
 * Freya with changes, see the story comments). Neutral fixtures only.
 */
describe('EntitySelectorEditorComponent — picker filter (AB#7724)', () => {
  interface EditorForm {
    editFilters: FieldFilterItem[];
    followerFilterCount: number;
    defaultFilterCheck: DefaultFilterCheck;
    filterVariables: { name: string }[];
  }

  const region: MeshBoardVariable = { name: 'region', type: 'string', source: 'static', value: 'North' };
  const site: EntitySelectorConfig = {
    id: 'site', label: 'Site', ckTypeId: 'Test/Site', attributeMappings: [{ attributePath: 'name', variableName: 'siteName' }], showInToolbar: true
  };

  let fetch: ReturnType<typeof vi.fn>;

  function create(selectors: EntitySelectorConfig[], answer: () => Observable<unknown> = () => of(found(1))) {
    fetch = vi.fn(() => answer());
    TestBed.configureTestingModule({
      imports: [EntitySelectorEditorComponent],
      providers: [
        { provide: AttributeSelectorDialogService, useValue: {} },
        MeshBoardVariableService,
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: { fetch } },
        { provide: GetCkTypeAssociationRolesDtoGQL, useValue: { fetch: () => of({ data: null }) } },
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
    fixture.componentInstance.variables = [region];
    const emitted: EntitySelectorConfig[][] = [];
    fixture.componentInstance.entitySelectorsChange.subscribe(v => emitted.push(v));
    return { fixture, editor: fixture.componentInstance, form: fixture.componentInstance as unknown as EditorForm, emitted };
  }

  function found(totalCount: number) {
    return { data: { runtime: { runtimeEntities: { totalCount, items: [] } } } };
  }

  function el(fixture: { nativeElement: unknown }): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => vi.useRealTimers());

  it('shows the filter editor under the CK type once a CK type is chosen', () => {
    const { fixture, editor } = create([FILTERED_SYSTEMS]);
    editor.addSelector();
    fixture.detectChanges();
    expect(el(fixture).querySelector('mm-field-filter-editor')).toBeNull();

    editor.editSelector(0);
    fixture.detectChanges();

    const filterEditor = fixture.debugElement.query(d => d.componentInstance instanceof FieldFilterEditorStubComponent).componentInstance as FieldFilterEditorStubComponent;
    expect(filterEditor.ckTypeId).toBe('Test/System');
    expect(filterEditor.filters.map(f => f.comparisonValue)).toEqual(['Electrical', '$region']);
    expect(filterEditor.enableVariables).toBe(true);
  });

  it('offers static variables and other selectors\' variables, not its own', () => {
    const { editor, form } = create([site, FILTERED_SYSTEMS]);
    editor.editSelector(1);

    expect(form.filterVariables.map(v => v.name)).toEqual(['region', 'siteName']);
  });

  it('saves the rows as filter configs and omits an empty filter', () => {
    const { editor, emitted } = create([site]);
    editor.editSelector(0);
    editor.onFiltersChange([{ id: 1, attributePath: 'kind', operator: FieldFilterOperatorsDto.InDto, comparisonValue: 'A' }]);
    editor.saveEdit();
    expect(emitted[0][0].filters).toEqual([{ attributePath: 'kind', operator: 'IN', comparisonValue: 'A' }]);

    editor.editSelector(0);
    editor.onFiltersChange([]);
    editor.saveEdit();
    expect(emitted[1][0]).not.toHaveProperty('filters', expect.anything());
    expect(emitted[1][0].filters).toBeUndefined();
  });

  it('follower: hides the filter editor, says why and drops hand-edited filters on save', () => {
    const follower: EntitySelectorConfig = { ...FILTERED_SYSTEMS, id: 'f', label: 'F', followsSelectorId: 'site', showInToolbar: false, ckTypeId: 'Test/Site' };
    const { fixture, editor, form, emitted } = create([site, follower]);
    editor.editSelector(1);
    fixture.detectChanges();

    expect(el(fixture).querySelector('mm-field-filter-editor')).toBeNull();
    const text = el(fixture).querySelector('.picker-filter-field')?.textContent ?? '';
    expect(text).toContain('A follower takes the leader\'s pick. Set the filter on Site.');
    expect(text).toContain('Filters on a follower are ignored and are removed when you save.');
    expect(form.followerFilterCount).toBe(2);

    editor.saveEdit();
    expect(emitted[0][1].filters).toBeUndefined();
  });

  it('shows "N filters" next to the mode in the list (never for followers)', () => {
    const one = { ...site, filters: [FILTERED_SYSTEMS.filters![0]] };
    const follower = { ...FILTERED_SYSTEMS, id: 'f', followsSelectorId: 'site' };
    const { fixture, editor } = create([FILTERED_SYSTEMS, one, follower]);
    fixture.detectChanges();

    expect(editor.getFilterSummary(FILTERED_SYSTEMS)).toBe('2 filters');
    expect(editor.getFilterSummary(one)).toBe('1 filter');
    expect(editor.getFilterSummary(follower)).toBe('');
    expect(Array.from(el(fixture).querySelectorAll('.selector-filter-chip')).map(c => c.textContent?.trim())).toEqual(['2 filters', '1 filter']);
  });

  it('the default-entity picker lists only matching entities', async () => {
    const { editor } = create([FILTERED_SYSTEMS]);
    editor.editSelector(0);

    await (editor as unknown as { defaultEntityDataSource: { onFilter(f: string, t: number): Promise<unknown> } })
      .defaultEntityDataSource.onFilter('mai', 10);

    const call = fetch.mock.calls.find(c => (c[0] as { variables: { first: number } }).variables.first === 10)!;
    expect((call[0] as { variables: { fieldFilters: unknown[] } }).variables.fieldFilters).toEqual([
      { attributePath: 'systemType', operator: 'EQUALS', comparisonValue: 'Electrical' },
      { attributePath: 'region', operator: 'LIKE', comparisonValue: 'North' },
      { attributePath: 'rtDisplayName', operator: 'LIKE', comparisonValue: 'mai' }
    ]);
  });

  describe('default entity check', () => {
    function checkCalls() {
      return fetch.mock.calls.filter(c => (c[0] as { variables: { rtId?: string } }).variables.rtId);
    }

    it('warns (without blocking save) when the default entity does not match — debounced, one server request', () => {
      vi.useFakeTimers();
      const { fixture, editor, form } = create([FILTERED_SYSTEMS], () => of(found(0)));
      editor.editSelector(0);
      editor.onFiltersChange([...form.editFilters]);
      editor.onFiltersChange([...form.editFilters]);
      expect(checkCalls()).toHaveLength(0);

      vi.advanceTimersByTime(500);
      fixture.detectChanges();

      expect(checkCalls()).toHaveLength(1);
      expect(checkCalls()[0][0]).toEqual(expect.objectContaining({
        variables: expect.objectContaining({
          ckTypeId: 'Test/System',
          rtId: 'sys-1',
          first: 1,
          fieldFilters: [
            { attributePath: 'systemType', operator: 'EQUALS', comparisonValue: 'Electrical' },
            { attributePath: 'region', operator: 'LIKE', comparisonValue: 'North' }
          ]
        })
      }));
      expect(form.defaultFilterCheck).toEqual({ state: 'mismatch' });
      expect(el(fixture).querySelector('.default-filter-warning')?.textContent)
        .toContain('The default entity does not match the picker filter. It still loads, but users cannot pick it again.');
      expect(editor.isEditValid()).toBe(true);
    });

    it('shows nothing when the default entity matches', () => {
      vi.useFakeTimers();
      const { fixture, editor, form } = create([FILTERED_SYSTEMS], () => of(found(1)));
      editor.editSelector(0);
      vi.advanceTimersByTime(500);
      fixture.detectChanges();

      expect(form.defaultFilterCheck).toEqual({ state: 'match' });
      expect(el(fixture).querySelector('.default-filter-warning')).toBeNull();
    });

    it('says the check failed instead of claiming a mismatch', () => {
      vi.useFakeTimers();
      const { fixture, editor, form } = create([FILTERED_SYSTEMS], () => throwError(() => new Error('offline')));
      editor.editSelector(0);
      vi.advanceTimersByTime(500);
      fixture.detectChanges();

      expect(form.defaultFilterCheck).toEqual({ state: 'error' });
      expect(el(fixture).querySelector('.default-filter-warning')?.textContent).toContain('Could not check the default entity.');
    });

    it('skips the check when the filter uses a variable filled at view time', () => {
      vi.useFakeTimers();
      const { fixture, editor, form } = create([site, { ...FILTERED_SYSTEMS, filters: [{ attributePath: 'name', operator: 'EQUALS', comparisonValue: '$siteName' }] }]);
      editor.editSelector(1);
      vi.advanceTimersByTime(500);
      fixture.detectChanges();

      expect(checkCalls()).toHaveLength(0);
      expect(form.defaultFilterCheck).toEqual({ state: 'unchecked', variables: ['siteName'] });
      expect(el(fixture).querySelector('.default-filter-warning')?.textContent)
        .toContain('Cannot check the default entity: the filter uses $siteName, which is filled at view time.');
    });

    it('does not check without filter or without default entity', () => {
      vi.useFakeTimers();
      const { editor, form } = create([site, { ...FILTERED_SYSTEMS, defaultRtId: undefined }]);
      editor.editSelector(0);
      vi.advanceTimersByTime(500);
      editor.editSelector(1);
      vi.advanceTimersByTime(500);

      expect(checkCalls()).toHaveLength(0);
      expect(form.defaultFilterCheck).toEqual({ state: 'none' });
    });
  });
});
