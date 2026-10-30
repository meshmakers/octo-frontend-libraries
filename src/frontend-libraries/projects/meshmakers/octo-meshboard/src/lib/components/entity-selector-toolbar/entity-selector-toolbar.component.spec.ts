import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { firstValueFrom, of } from 'rxjs';
import { FieldFilterOperatorsDto } from '@meshmakers/octo-services';
import { EntitySelectorToolbarComponent } from './entity-selector-toolbar.component';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import type { EntitySelectorConfig, MeshBoardVariable } from '../../models/meshboard.models';
import { FILTERED_SYSTEMS } from '../../testing/entity-selector-filter.fixtures';

/**
 * Toolbar pickers with a selector filter (AB#7724): both data sources (dropdown
 * and search dialog) send the filter as GraphQL field filter, AND-combined with
 * the text search; an unfiltered selector sends the query it always sent.
 * Neutral fixtures only (Test/Site, Test/System).
 */
describe('EntitySelectorToolbarComponent — picker filter (AB#7724)', () => {
  const SITE: EntitySelectorConfig = { id: 'site', label: 'Site', ckTypeId: 'Test/Site', attributeMappings: [], showInToolbar: true };
  const region: MeshBoardVariable = { name: 'region', type: 'string', source: 'static', value: 'North' };
  const search = { attributePath: 'rtDisplayName', operator: FieldFilterOperatorsDto.LikeDto, comparisonValue: 'mai' };

  let fetch: ReturnType<typeof vi.fn>;

  function create(selectors: EntitySelectorConfig[], variables: MeshBoardVariable[] = []) {
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
    fixture.detectChanges();
    return fixture;
  }

  function lastFilters(): unknown {
    return fetch.mock.calls[fetch.mock.calls.length - 1][0].variables.fieldFilters;
  }

  it('dropdown: lists only matching entities — the query carries all rows (AND) plus the search', async () => {
    const toolbar = create([FILTERED_SYSTEMS], [region]).componentInstance;

    await toolbar.getDataSource(FILTERED_SYSTEMS).onFilter('mai', 10);

    expect(lastFilters()).toEqual([
      { attributePath: 'systemType', operator: 'EQUALS', comparisonValue: 'Electrical' },
      { attributePath: 'region', operator: 'LIKE', comparisonValue: 'North' },
      search
    ]);
  });

  it('search dialog: lists only matching entities, with and without search text', async () => {
    const toolbar = create([FILTERED_SYSTEMS], [region]).componentInstance;
    const dialog = toolbar.getDialogDataSource(FILTERED_SYSTEMS);

    await firstValueFrom(dialog.fetchData({ skip: 0, take: 20, textSearch: null }));
    expect(lastFilters()).toEqual([
      { attributePath: 'systemType', operator: 'EQUALS', comparisonValue: 'Electrical' },
      { attributePath: 'region', operator: 'LIKE', comparisonValue: 'North' }
    ]);

    await firstValueFrom(dialog.fetchData({ skip: 0, take: 20, textSearch: 'mai' }));
    expect(lastFilters()).toEqual([
      { attributePath: 'systemType', operator: 'EQUALS', comparisonValue: 'Electrical' },
      { attributePath: 'region', operator: 'LIKE', comparisonValue: 'North' },
      search
    ]);
  });

  it('substitutes the current value of a board variable and follows its changes', async () => {
    const fixture = create([FILTERED_SYSTEMS], [region]);
    fixture.componentRef.setInput('variables', [{ ...region, value: 'South' }]);
    fixture.detectChanges();

    await fixture.componentInstance.getDataSource(FILTERED_SYSTEMS).onFilter('mai', 10);

    expect((lastFilters() as { comparisonValue: string }[])[1].comparisonValue).toBe('South');
  });

  it('without filter: sends exactly the query of an unfiltered picker', async () => {
    const toolbar = create([SITE]).componentInstance;

    await toolbar.getDataSource(SITE).onFilter('mai', 10);
    await firstValueFrom(toolbar.getDialogDataSource(SITE).fetchData({ skip: 0, take: 20, textSearch: null }));

    expect(fetch.mock.calls[0][0]).toEqual({
      variables: { ckTypeId: 'Test/Site', attributeNames: [], first: 10, fieldFilters: [search] }
    });
    expect(fetch.mock.calls[1][0].variables.fieldFilters).toBeUndefined();
    expect(toolbar.getMessages(SITE)).toEqual({});
    expect(toolbar.getDialogTitle(SITE)).toBe('Select Site');
  });

  it('explains an empty list of a filtered picker and marks its dialog', () => {
    const fixture = create([FILTERED_SYSTEMS, SITE], [region]);
    const toolbar = fixture.componentInstance;

    expect(toolbar.getMessages(FILTERED_SYSTEMS)).toEqual({
      noEntitiesFound: 'No System found. This board only lists System that match its filter.'
    });
    expect(toolbar.getDialogTitle(FILTERED_SYSTEMS)).toBe('Select System (filtered)');
  });

  it('names a filter variable that has no value yet in the empty-list text', () => {
    const toolbar = create([FILTERED_SYSTEMS], []).componentInstance;

    expect(toolbar.getMessages(FILTERED_SYSTEMS).noEntitiesFound).toContain('The filter uses $region, which has no value yet.');
  });

  it('drops cached data sources no selector uses after a filter variable changed', () => {
    const fixture = create([FILTERED_SYSTEMS, SITE], [region]);
    for (const value of ['South', 'East', 'West']) {
      fixture.componentRef.setInput('variables', [{ ...region, value }]);
      fixture.detectChanges();
    }

    expect(fixture.componentInstance.cachedDataSourceCount).toBe(2);
  });

  it('does not share the data source of an unfiltered selector of the same CK type', () => {
    const unfiltered = { ...FILTERED_SYSTEMS, id: 'all', filters: undefined };
    const toolbar = create([FILTERED_SYSTEMS, unfiltered], [region]).componentInstance;

    expect(toolbar.getDataSource(FILTERED_SYSTEMS)).not.toBe(toolbar.getDataSource(unfiltered));
  });
});
