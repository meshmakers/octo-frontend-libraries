import {Observable} from "rxjs";
import {PagedResultDto} from "../models/pagedResultDto";

export interface EntitySelectDataSource<T> {

  onFilter(filter: string): Observable<PagedResultDto<T>>;

  onDisplayEntity(entity: T): string;

  getIdEntity(entity: T): any;
}
