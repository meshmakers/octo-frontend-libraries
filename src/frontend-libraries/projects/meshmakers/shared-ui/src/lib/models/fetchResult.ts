export interface FetchResult<T = unknown> {
  get data(): T;

  get totalCount(): number;
}

export class FetchResultBase<T = unknown> implements FetchResult<T> {
  public constructor(
    private readonly _data: T,
    private readonly _totalCount: number,
  ) {
  }

  public get data(): T {
    return this._data;
  }

  public get totalCount(): number {
    return this._totalCount;
  }
}

export class FetchResultTyped<TDto> implements FetchResult<(TDto | null)[]> {
  public constructor(
    private readonly _data: (TDto | null)[],
    private readonly _totalCount: number,
  ) {
  }

  public get data(): (TDto | null)[] {
    return this._data;
  }

  public get totalCount(): number {
    return this._totalCount;
  }
}
