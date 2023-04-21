import {BehaviorSubject, Observable} from "rxjs";
import {CollectionViewer, DataSource} from "@angular/cdk/collections";

export class GenericDataSource<TEntity> implements DataSource<TEntity> {
  private dataSubject = new BehaviorSubject<Array<TEntity>>([]);

  constructor(public data: Array<TEntity>) {

    this.dataSubject.next(data);

  }

  emitChanged() {
    this.dataSubject.next(this.data);
  }


  connect(collectionViewer: CollectionViewer): Observable<TEntity[]> {
    return this.dataSubject.asObservable();
  }

  disconnect(collectionViewer: CollectionViewer): void {
    this.dataSubject.complete();
  }
}
