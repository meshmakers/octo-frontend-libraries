export interface FetchResult {
  get data(): any;

  get totalCount(): number;
}

export class FetchResultBase implements FetchResult {
  public constructor(
    private readonly _data: any,
    private readonly _totalCount: number,
  ) {
  }

  public get data(): any {
    return this._data;
  }

  public get totalCount(): number {
    return this._totalCount;
  }
}

export class FetchResultTyped<TDto> implements FetchResult {
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
