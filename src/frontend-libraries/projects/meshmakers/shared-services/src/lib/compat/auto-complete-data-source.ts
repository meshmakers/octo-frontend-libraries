/**
 * Legacy AutoCompleteDataSource interface and AutoCompleteResult class
 * for backward compatibility.
 */
import {Observable} from 'rxjs';

export class AutoCompleteResult {
  searchTerm?: string;
  list?: string[];
}

export interface AutoCompleteDataSource {
  onFilter: (filter: string) => Observable<AutoCompleteResult>;
  onPreprocessSearchString: (search: string) => string;
}
