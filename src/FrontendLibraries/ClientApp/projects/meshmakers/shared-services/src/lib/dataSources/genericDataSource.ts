import { BehaviorSubject, Observable } from 'rxjs';
import { CollectionViewer, DataSource } from '@angular/cdk/collections';

export class GenericDataSource<TEntity> implements DataSource<TEntity> {
  private readonly dataSubject = new BehaviorSubject<TEntity[]>([]);

  constructor(public data: TEntity[]) {
    this.dataSubject.next(data);
  }

  emitChanged(): void {
    this.dataSubject.next(this.data);
  }

  connect(collectionViewer: CollectionViewer): Observable<TEntity[]> {
    return this.dataSubject.asObservable();
  }

  disconnect(collectionViewer: CollectionViewer): void {
    this.dataSubject.complete();
  }
}
