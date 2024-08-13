import { BehaviorSubject, Observable } from "rxjs";
import { CollectionViewer, DataSource } from "@angular/cdk/collections";
import { PagedResultDto } from "../models/pagedResultDto";

export class DataSourceBase<TDto> implements DataSource<TDto> {
  private readonly dataSubject = new BehaviorSubject<TDto[]>([]);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private readonly totalCountSubject = new BehaviorSubject<number>(0);

  public readonly loading$ = this.loadingSubject.asObservable();
  public readonly totalCount$ = this.totalCountSubject.asObservable();

  private readonly addedDtoList: TDto[] = new Array<TDto>();
  private lastPagedResult: PagedResultDto<TDto> | null = null;

  public get totalCount(): Observable<number> {
    return this.totalCount$;
  }

  public addTemporaryDto(dto: TDto): void {

    this.addedDtoList.push(dto);
    this.onEndLoad();
  }

  public get temporaryDtos(): TDto[] {
    return this.addedDtoList;
  }

  connect(collectionViewer: CollectionViewer): Observable<readonly TDto[]> {
    return this.dataSubject.asObservable();
  }

  disconnect(collectionViewer: CollectionViewer): void {
    this.clear();
  }

  clear(): void {
    this.loadingSubject?.next(false);
    this.dataSubject?.next([]);
    this.totalCountSubject?.next(0);
  }

  protected onBeginLoad(): void {
    this.loadingSubject?.next(true);
  }

  protected onCompleteLoad(pagedResult: PagedResultDto<TDto>): void {

    this.lastPagedResult = pagedResult;

    this.onEndLoad();
  }

  private onEndLoad(): void {

    if (this.lastPagedResult !== null) {

      const totalCount = this.lastPagedResult?.totalCount + this.addedDtoList.length;
      const list = this.lastPagedResult.list.concat(this.addedDtoList);

      this.loadingSubject?.next(false);
      this.dataSubject?.next(list);
      this.totalCountSubject?.next(totalCount);
    }
  }
}
