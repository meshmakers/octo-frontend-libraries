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
  private readonly removedDtoList: TDto[] = new Array<TDto>();
  private lastPagedResult: PagedResultDto<TDto> | null = null;

  public get totalCount(): Observable<number> {
    return this.totalCount$;
  }

  public reset(): void {
    this.addedDtoList.length = 0;
    this.removedDtoList.length = 0;
  }

  public addTemporaryDto(dto: TDto): void {

    const index = this.removedDtoList.indexOf(dto);
    if (index !== -1) {
      this.removedDtoList.splice(index, 1);
    } else {
      this.addedDtoList.push(dto);
    }

    this.onEndLoad();
  }

  public removeTemporaryDto(dto: TDto): void {

    const index = this.addedDtoList.indexOf(dto);
    if (index !== -1) {
      this.addedDtoList.splice(index, 1);
    } else {
      this.removedDtoList.push(dto);
    }

    this.onEndLoad();
  }

  public get addedTemporaryDtos(): TDto[] {
    return this.addedDtoList;
  }

  public get removedTemporaryDtos(): TDto[] {
    return this.removedDtoList;
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

      const totalCount = this.lastPagedResult?.totalCount + this.addedDtoList.length - this.removedDtoList.length;
      const list = this.lastPagedResult.list.concat(this.addedDtoList).filter((x) => !this.removedDtoList.includes(x));

      this.loadingSubject?.next(false);
      this.dataSubject?.next(list);
      this.totalCountSubject?.next(totalCount);
    }
    else {
      const totalCount = this.addedDtoList.length;
      const list = this.addedDtoList;

      this.loadingSubject?.next(false);
      this.dataSubject?.next(list);
      this.totalCountSubject?.next(totalCount);
    }
  }
}
