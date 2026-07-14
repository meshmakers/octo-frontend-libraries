import { Observable, of } from 'rxjs';
import { DataSourceBase, FetchDataOptions } from './data-source-base';
import { FetchResult } from '../models/fetchResult';
import { ListViewComponent } from '../list-view/list-view.component';

// Concrete implementation for testing
class TestDataSource extends DataSourceBase {
  constructor(listViewComponent: ListViewComponent) {
    super(listViewComponent);
  }

  fetchData(_queryOptions: FetchDataOptions): Observable<FetchResult | null> {
    return of({ data: [], totalCount: 0 });
  }
}

describe('DataSourceBase', () => {
  let dataSource: TestDataSource;
  let mockListViewComponent: jasmine.SpyObj<ListViewComponent>;

  beforeEach(() => {
    mockListViewComponent = jasmine.createSpyObj('ListViewComponent', ['refresh']);
    dataSource = new TestDataSource(mockListViewComponent);
  });

  it('should be created', () => {
    expect(dataSource).toBeTruthy();
  });

  describe('isLoading$', () => {
    it('should initially be false', (done) => {
      dataSource.isLoading$.subscribe(loading => {
        expect(loading).toBeFalse();
        done();
      });
    });

    it('should be an observable', () => {
      expect(dataSource.isLoading$).toBeInstanceOf(Observable);
    });
  });

  describe('isLoading', () => {
    it('should return current loading state', () => {
      expect(dataSource.isLoading).toBeFalse();
    });
  });

  describe('setLoading', () => {
    it('should set loading to true', (done) => {
      dataSource.setLoading(true);

      dataSource.isLoading$.subscribe(loading => {
        expect(loading).toBeTrue();
        done();
      });
    });

    it('should set loading to false', (done) => {
      dataSource.setLoading(true);
      dataSource.setLoading(false);

      dataSource.isLoading$.subscribe(loading => {
        expect(loading).toBeFalse();
        done();
      });
    });

    it('should update isLoading getter', () => {
      dataSource.setLoading(true);
      expect(dataSource.isLoading).toBeTrue();

      dataSource.setLoading(false);
      expect(dataSource.isLoading).toBeFalse();
    });
  });

  describe('totalCount', () => {
    it('should initially be null', () => {
      expect(dataSource.totalCount()).toBeNull();
    });

    it('should reflect the value set via setTotalCount', () => {
      dataSource.setTotalCount(42);
      expect(dataSource.totalCount()).toBe(42);
    });

    it('should accept null to reset', () => {
      dataSource.setTotalCount(42);
      dataSource.setTotalCount(null);
      expect(dataSource.totalCount()).toBeNull();
    });
  });

  describe('fetchAgain', () => {
    it('should emit fetchAgainEvent', (done) => {
      dataSource.fetchAgainEvent.subscribe(() => {
        expect(true).toBeTrue();
        done();
      });

      dataSource.fetchAgain();
    });
  });

  describe('listViewComponent', () => {
    it('should store reference to listViewComponent', () => {
      expect(dataSource.listViewComponent).toBe(mockListViewComponent);
    });
  });
});
