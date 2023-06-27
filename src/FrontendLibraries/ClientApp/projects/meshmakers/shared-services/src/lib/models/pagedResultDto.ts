export class PagedResultDto<T> {
  skip: number;
  take: number;
  totalCount: number;
  list: T[];

  constructor() {
    this.skip = 0;
    this.take = 0;
    this.totalCount = 0;
    this.list = new Array<T>();
  }
}
