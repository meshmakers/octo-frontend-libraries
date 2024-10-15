import { PagedResultDto } from '../models/pagedResultDto';

export interface EntitySelectDataSource<T> {
  onFilter: (filter: string) => Promise<PagedResultDto<T>>;

  onDisplayEntity: (entity: T) => string;

  getIdEntity: (entity: T) => any;
}
