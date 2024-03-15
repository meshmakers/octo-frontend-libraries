import { BehaviorSubject, Observable } from 'rxjs';
import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { PagedResultDto } from '../models/pagedResultDto';

export class DataSourceBase<TDto> implements DataSource<TDto> {
  private readonly dataSubject = new BehaviorSubject<TDto[]>([]);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private readonly totalCountSubject = new BehaviorSubject<number>(0);

  public readonly loading$ = this.loadingSubject.asObservable();
  public readonly totalCount$ = this.totalCountSubject.asObservable();

  public get totalCount(): Observable<number> {
    return this.totalCount$;
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
    this.loadingSubject?.next(false);
    this.dataSubject?.next(pagedResult.list);
    this.totalCountSubject?.next(pagedResult.totalCount);
  }
}
