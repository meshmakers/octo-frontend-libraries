import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { firstValueFrom, of } from 'rxjs';
import { FieldFilterOperatorsDto } from '@meshmakers/octo-services';
import { EntitySelectorToolbarComponent } from './entity-selector-toolbar.component';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import type { EntitySelectorConfig, MeshBoardVariable } from '../../models/meshboard.models';
import type { EntitySelectorScopeState } from '../../utils/stream-data-scope';
import { BUILDING, ROOM, SITE, TO_ROOM } from '../../testing/entity-selector-scope-source.fixtures';

/**
 * Dependent pickers in the toolbar (AB#7915): the dropdown and the search
 * dialog send the picker scope as `rtId IN (…)`, AND-combined with the filter
 * rows (AB#7724) and the text search; pending, empty and failed scopes send no
 * listing query. Neutral fixtures only (Test/Site, Test/Building, Test/Room).
 */
describe('EntitySelectorToolbarComponent — dependent picker (AB#7915)', () => {
  const PICKED_SITE: EntitySelectorConfig = { ...SITE, selectedRtId: 'site-1', selectedDisplayName: 'North Campus' };
  const S1_ROOMS = ['room-1', 'room-2', 'room-3', 'room-4'];
  const search = { attributePath: 'rtDisplayName', operator: FieldFilterOperatorsDto.LikeDto, comparisonValue: 'off' };
  const rtIdIn = (rtIds: string[]) => ({ attributePath: 'rtId', operator: FieldFilterOperatorsDto.InDto, comparisonValue: rtIds });

  let fetch: ReturnType<typeof vi.fn>;

  function create(
    selectors: EntitySelectorConfig[],
    pickerScopes: Record<string, EntitySelectorScopeState> = {},
    variables: MeshBoardVariable[] = []
  ) {
    fetch = vi.fn().mockReturnValue(of({ data: { runtime: { runtimeEntities: { totalCount: 0, items: [] } } } }));
    TestBed.configureTestingModule({
      imports: [EntitySelectorToolbarComponent],
      providers: [
        MeshBoardVariableService,
        provideNoopAnimations(),
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: { fetch } }
      ]
    });
    const fixture = TestBed.createComponent(EntitySelectorToolbarComponent);
    fixture.componentRef.setInput('entitySelectors', selectors);
    fixture.componentRef.setInput('variables', variables);
    fixture.componentRef.setInput('pickerScopes', pickerScopes);
    fixture.detectChanges();
    return fixture;
  }

  function lastVariables(): { ckTypeId: string; fieldFilters?: unknown } {
    return fetch.mock.calls[fetch.mock.calls.length - 1][0].variables;
  }

  it('dropdown: the query carries rtId IN the distinct rooms of the picked site, plus the search', async () => {
    const toolbar = create([PICKED_SITE, ROOM], { room: { status: 'resolved', rtIds: S1_ROOMS } }).componentInstance;

    await toolbar.getDataSource(ROOM).onFilter('off', 10);

    expect(lastVariables().ckTypeId).toBe('Test/Room');
    expect(lastVariables().fieldFilters).toEqual([rtIdIn(S1_ROOMS), search]);
  });

  it('search dialog: the query carries rtId IN, with and without search text, and keeps paging', async () => {
    const toolbar = create([PICKED_SITE, ROOM], { room: { status: 'resolved', rtIds: S1_ROOMS } }).componentInstance;
    const dialog = toolbar.getDialogDataSource(ROOM);

    await firstValueFrom(dialog.fetchData({ skip: 20, take: 20, textSearch: null }));
    expect(lastVariables().fieldFilters).toEqual([rtIdIn(S1_ROOMS)]);
    expect(fetch.mock.calls[0][0].variables.first).toBe(20);
    expect(fetch.mock.calls[0][0].variables.after).toBeDefined();

    await firstValueFrom(dialog.fetchData({ skip: 0, take: 20, textSearch: 'off' }));
    expect(lastVariables().fieldFilters).toEqual([rtIdIn(S1_ROOMS), search]);
  });

  it('AND-combines the filter rows, the scope and the search in one query', async () => {
    const filtered: EntitySelectorConfig = {
      ...ROOM,
      filters: [{ attributePath: 'usage', operator: 'EQUALS', comparisonValue: 'Office' }]
    };
    const toolbar = create([PICKED_SITE, filtered], { room: { status: 'resolved', rtIds: S1_ROOMS } }).componentInstance;

    await toolbar.getDataSource(filtered).onFilter('off', 10);
    await firstValueFrom(toolbar.getDialogDataSource(filtered).fetchData({ skip: 0, take: 20, textSearch: 'off' }));

    const expected = [{ attributePath: 'usage', operator: 'EQUALS', comparisonValue: 'Office' }, rtIdIn(S1_ROOMS), search];
    expect(fetch.mock.calls[0][0].variables.fieldFilters).toEqual(expected);
    expect(fetch.mock.calls[1][0].variables.fieldFilters).toEqual(expected);
  });

  it('a one-hop dependent is scoped the same way', async () => {
    const toolbar = create([PICKED_SITE, BUILDING], { building: { status: 'resolved', rtIds: ['bld-1', 'bld-2'] } }).componentInstance;

    await toolbar.getDataSource(BUILDING).onFilter('off', 10);

    expect(lastVariables().fieldFilters).toEqual([rtIdIn(['bld-1', 'bld-2']), search]);
  });

  it('leader without pick: lists without the scope, exactly as an unscoped picker', async () => {
    const toolbar = create([SITE, ROOM]).componentInstance;

    await toolbar.getDataSource(ROOM).onFilter('off', 10);
    await firstValueFrom(toolbar.getDialogDataSource(ROOM).fetchData({ skip: 0, take: 20, textSearch: null }));

    expect(fetch.mock.calls[0][0]).toEqual({
      variables: { ckTypeId: 'Test/Room', attributeNames: [], first: 10, fieldFilters: [search] }
    });
    expect(fetch.mock.calls[1][0].variables.fieldFilters).toBeUndefined();
    expect(toolbar.getMessages(ROOM)).toEqual({});
  });

  it('pending: stays loading and sends no listing query until the scope resolved', async () => {
    const fixture = create([PICKED_SITE, ROOM], { room: { status: 'pending' } });
    const toolbar = fixture.componentInstance;
    let settled = false;

    const result = toolbar.getDataSource(ROOM).onFilter('off', 10).then(r => { settled = true; return r; });
    const dialog = firstValueFrom(toolbar.getDialogDataSource(ROOM).fetchData({ skip: 0, take: 20, textSearch: null }));
    await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();
    expect(settled).toBe(false);

    fixture.componentRef.setInput('pickerScopes', { room: { status: 'resolved', rtIds: ['room-5'] } });
    fixture.detectChanges();
    await result;
    await dialog;

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0].variables.fieldFilters).toEqual([rtIdIn(['room-5']), search]);
    expect(fetch.mock.calls[1][0].variables.fieldFilters).toEqual([rtIdIn(['room-5'])]);
  });

  it('pending that settles empty or failed lists nothing and sends no query', async () => {
    const fixture = create([PICKED_SITE, ROOM], { room: { status: 'pending' } });
    const result = fixture.componentInstance.getDataSource(ROOM).onFilter('off', 10);

    fixture.componentRef.setInput('pickerScopes', { room: { status: 'failed' } });
    fixture.detectChanges();

    expect((await result).items).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('pending that settles unscoped (leader cleared) keeps the filter rows', async () => {
    const filtered: EntitySelectorConfig = { ...ROOM, filters: [{ attributePath: 'usage', operator: 'EQUALS', comparisonValue: 'Office' }] };
    const fixture = create([PICKED_SITE, filtered], { room: { status: 'pending' } });
    const result = fixture.componentInstance.getDataSource(filtered).onFilter('off', 10);

    fixture.componentRef.setInput('entitySelectors', [SITE, filtered]);
    fixture.componentRef.setInput('pickerScopes', {});
    fixture.detectChanges();
    await result;

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(lastVariables().fieldFilters).toEqual([{ attributePath: 'usage', operator: 'EQUALS', comparisonValue: 'Office' }, search]);
  });

  it('resolved empty: shows "No <label> in <leader>." and sends no query', async () => {
    const toolbar = create([PICKED_SITE, ROOM], { room: { status: 'resolved', rtIds: [] } }).componentInstance;

    const result = await toolbar.getDataSource(ROOM).onFilter('off', 10);
    await firstValueFrom(toolbar.getDialogDataSource(ROOM).fetchData({ skip: 0, take: 20, textSearch: null }));

    expect(result.items).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    expect(toolbar.getMessages(ROOM)).toEqual({
      noEntitiesFound: 'No Room in North Campus.',
      minCharactersHint: 'No Room in North Campus.'
    });
  });

  it('resolved empty with a filter: adds the filter sentence', () => {
    const filtered: EntitySelectorConfig = { ...ROOM, filters: [{ attributePath: 'usage', operator: 'EQUALS', comparisonValue: 'Office' }] };
    const toolbar = create([PICKED_SITE, filtered], { room: { status: 'resolved', rtIds: [] } }).componentInstance;

    expect(toolbar.getMessages(filtered).noEntitiesFound)
      .toBe('No Room in North Campus. This board only lists Room that match its filter.');
    expect(toolbar.getDialogTitle(filtered)).toBe('Select Room (filtered)');
  });

  it('failed: lists nothing, sends no query and shows "Could not load the <label> of <leader>."', async () => {
    const toolbar = create([PICKED_SITE, ROOM], { room: { status: 'failed' } }).componentInstance;

    const result = await toolbar.getDataSource(ROOM).onFilter('off', 10);

    expect(result.items).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    expect(toolbar.getMessages(ROOM).noEntitiesFound).toBe('Could not load the Room of North Campus.');
  });

  it.each([
    ['unknown leader', { ...ROOM, scopeSource: { selectorId: 'nope', path: [TO_ROOM] } }, 'nope'],
    ['more than 5 hops', { ...ROOM, scopeSource: { selectorId: 'site', path: [TO_ROOM, TO_ROOM, TO_ROOM, TO_ROOM, TO_ROOM, TO_ROOM] } }, 'North Campus']
  ])('invalid configuration (%s): fails and never lists unscoped, even without picker scope state', async (_name, selector, leaderName) => {
    const toolbar = create([PICKED_SITE, selector as EntitySelectorConfig]).componentInstance;

    const result = await toolbar.getDataSource(selector as EntitySelectorConfig).onFilter('off', 10);

    expect(result.items).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    expect(toolbar.getMessages(selector as EntitySelectorConfig).noEntitiesFound).toBe(`Could not load the Room of ${leaderName}.`);
  });

  it('leader pick S1 → S2: the dependent gets a fresh data source that lists the S2 rooms', async () => {
    const fixture = create([PICKED_SITE, ROOM], { room: { status: 'resolved', rtIds: S1_ROOMS } });
    const s1Source = fixture.componentInstance.getDataSource(ROOM);

    fixture.componentRef.setInput('entitySelectors', [{ ...PICKED_SITE, selectedRtId: 'site-4', selectedDisplayName: 'South Campus' }, ROOM]);
    fixture.componentRef.setInput('pickerScopes', { room: { status: 'resolved', rtIds: ['room-5'] } });
    fixture.detectChanges();
    const s2Source = fixture.componentInstance.getDataSource(ROOM);
    await s2Source.onFilter('off', 10);

    expect(s2Source).not.toBe(s1Source);
    expect(lastVariables().fieldFilters).toEqual([rtIdIn(['room-5']), search]);
    expect(fixture.componentInstance.cachedDataSourceCount).toBe(2);
  });

  it('a selector without scope source keeps its data source and query when a dependent changes', async () => {
    const fixture = create([PICKED_SITE, ROOM], { room: { status: 'pending' } });
    const siteSource = fixture.componentInstance.getDataSource(PICKED_SITE);

    fixture.componentRef.setInput('pickerScopes', { room: { status: 'resolved', rtIds: S1_ROOMS } });
    fixture.detectChanges();
    await fixture.componentInstance.getDataSource(PICKED_SITE).onFilter('off', 10);

    expect(fixture.componentInstance.getDataSource(PICKED_SITE)).toBe(siteSource);
    expect(fetch.mock.calls[0][0]).toEqual({
      variables: { ckTypeId: 'Test/Site', attributeNames: [], first: 10, fieldFilters: [search] }
    });
  });
});
