import { of, firstValueFrom } from 'rxjs';
import { GetSystemPersistentQueriesDtoGQL } from '../../graphQL/getSystemPersistentQueries';
import { PersistentQueryAutocompleteDataSource, PersistentQueryDialogDataSource } from './persistent-query-data-sources';

/**
 * Query picker data sources (AB#7951 reopen, gap A): the dialog ("Browse Queries") must keep the
 * query entity's CK type so the family filter can classify it. Before the fix a stream-data-only
 * dialog (series row of the line chart) listed nothing although the pager counted the queries.
 */
describe('persistent query data sources', () => {
  const ITEMS = [
    { rtId: 'q-sd', name: 'Charging stations (archive)', description: null, ckTypeId: 'System/SimpleSdQuery', queryCkTypeId: 'System/Entity' },
    { rtId: 'q-rt', name: 'Meters', description: null, ckTypeId: 'System/SimpleRtQuery', queryCkTypeId: 'System/Entity' }
  ];

  function gql(): GetSystemPersistentQueriesDtoGQL {
    return {
      fetch: vi.fn(() => of({ data: { runtime: { systemPersistentQuery: { totalCount: ITEMS.length, items: ITEMS } } } }))
    } as unknown as GetSystemPersistentQueriesDtoGQL;
  }

  it('the dialog source with ["streamData"] returns the stream-data query (with its CK type)', async () => {
    const result = await firstValueFrom(new PersistentQueryDialogDataSource(gql(), ['streamData']).fetchData({ skip: 0, take: 10, textSearch: null }));

    expect(result.data.map(i => i?.rtId)).toEqual(['q-sd']);
    expect(result.data[0]?.ckTypeId).toBe('System/SimpleSdQuery');
  });

  it('the dialog source with ["runtime"] returns only the runtime query', async () => {
    const result = await firstValueFrom(new PersistentQueryDialogDataSource(gql(), ['runtime']).fetchData({ skip: 0, take: 10, textSearch: null }));
    expect(result.data.map(i => i?.rtId)).toEqual(['q-rt']);
  });

  it('dialog and autocomplete agree for every family filter', async () => {
    for (const accept of [['streamData'], ['runtime'], ['runtime', 'streamData']] as const) {
      const dialog = await firstValueFrom(new PersistentQueryDialogDataSource(gql(), accept).fetchData({ skip: 0, take: 10, textSearch: null }));
      const autocomplete = await new PersistentQueryAutocompleteDataSource(gql(), accept).onFilter('');
      expect(dialog.data.map(i => i?.rtId)).toEqual(autocomplete.items.map(i => i.rtId));
    }
  });
});
