import {Observable} from "rxjs";
import {AutoCompleteResult} from "../models/autoCompleteResult";

export interface AutoCompleteDataSource {
  onFilter(filter: string): Observable<AutoCompleteResult>;

  onPreprocessSearchString(search: string): string;
}
