import { TestBed } from '@angular/core/testing';
import { CompositeFilterDescriptor } from '@progress/kendo-data-query';
import { ListStateService } from './list-state.service';

describe('ListStateService', () => {
  let service: ListStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ListStateService);
  });

  afterEach(() => localStorage.clear());

  it('returns null for an unknown key', () => {
    expect(service.load('unknown')).toBeNull();
  });

  it('round-trips sort, filter and skip', () => {
    const filter: CompositeFilterDescriptor = {
      logic: 'and',
      filters: [{ field: 'name', operator: 'contains', value: 'abc' }],
    };
    service.save('documents', {
      sort: [{ field: 'name', dir: 'asc' }],
      filter,
      skip: 40,
      take: 20,
    });

    const loaded = service.load('documents');
    expect(loaded?.sort).toEqual([{ field: 'name', dir: 'asc' }]);
    expect(loaded?.skip).toBe(40);
    expect(loaded?.filter).toEqual(filter);
  });

  it('does not persist take/pageSize', () => {
    service.save('documents', { skip: 0, take: 55 });
    const loaded = service.load('documents') as Record<string, unknown>;
    expect('take' in loaded).toBe(false);
  });

  it('round-trips the free-text search value', () => {
    service.save('documents', { skip: 0 }, 'acme corp');
    expect(service.load('documents')?.textSearch).toBe('acme corp');
  });

  it('re-hydrates ISO date filter values back to Date objects', () => {
    const filter: CompositeFilterDescriptor = {
      logic: 'and',
      filters: [
        { field: 'bookingDate', operator: 'gte', value: new Date('2026-01-15T00:00:00.000Z') },
        { field: 'name', operator: 'contains', value: 'not-a-date' },
      ],
    };
    service.save('transactions', { filter });

    const loaded = service.load('transactions');
    const dateLeaf = (loaded?.filter?.filters[0] ?? {}) as { value: unknown };
    const textLeaf = (loaded?.filter?.filters[1] ?? {}) as { value: unknown };
    expect(dateLeaf.value instanceof Date).toBe(true);
    expect((dateLeaf.value as Date).toISOString()).toBe('2026-01-15T00:00:00.000Z');
    expect(textLeaf.value).toBe('not-a-date');
  });

  it('revives dates inside nested composite filters', () => {
    const filter: CompositeFilterDescriptor = {
      logic: 'and',
      filters: [
        {
          logic: 'and',
          filters: [
            { field: 'bookingDate', operator: 'gte', value: new Date('2026-02-01T00:00:00.000Z') },
          ],
        },
      ],
    };
    service.save('nested', { filter });
    const nested = service.load('nested')?.filter?.filters[0] as CompositeFilterDescriptor;
    const leaf = nested.filters[0] as { value: unknown };
    expect(leaf.value instanceof Date).toBe(true);
  });

  it('keeps separate state per key', () => {
    service.save('a', { skip: 10 });
    service.save('b', { skip: 20 });
    expect(service.load('a')?.skip).toBe(10);
    expect(service.load('b')?.skip).toBe(20);
  });

  it('clear() removes only the given key', () => {
    service.save('a', { skip: 10 });
    service.save('b', { skip: 20 });
    service.clear('a');
    expect(service.load('a')).toBeNull();
    expect(service.load('b')?.skip).toBe(20);
  });

  it('falls back to no state when storage holds corrupt JSON', () => {
    localStorage.setItem('mm-list-view-state', '{not valid json');
    expect(service.load('documents')).toBeNull();
  });
});
