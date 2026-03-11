import { EntitySelectDataSource, EntitySelectResult } from '@meshmakers/shared-services';

export class MockEntitySelectDataSource<T> implements EntitySelectDataSource<T> {
  constructor(
    private items: T[],
    private displayFn: (entity: T) => string,
    private idFn: (entity: T) => string
  ) {}

  onFilter = async (filter: string, take: number = 50): Promise<EntitySelectResult<T>> => {
    const lowerFilter = filter.toLowerCase();
    const filtered = this.items.filter(item =>
      this.displayFn(item).toLowerCase().includes(lowerFilter)
    );
    return {
      totalCount: filtered.length,
      items: filtered.slice(0, take),
    };
  };

  onDisplayEntity = (entity: T): string => {
    return this.displayFn(entity);
  };

  getIdEntity = (entity: T): string => {
    return this.idFn(entity);
  };
}
