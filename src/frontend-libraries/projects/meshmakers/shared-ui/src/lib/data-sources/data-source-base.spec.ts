import type { MockedObject } from "vitest";
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
    let mockListViewComponent: MockedObject<ListViewComponent>;

    beforeEach(() => {
        mockListViewComponent = {
            refresh: vi.fn().mockName("ListViewComponent.refresh")
        } as unknown as MockedObject<ListViewComponent>;
        dataSource = new TestDataSource(mockListViewComponent);
    });

    it('should be created', () => {
        expect(dataSource).toBeTruthy();
    });

    describe('isLoading$', () => {
        it('should initially be false', () => new Promise<void>((done) => {
            dataSource.isLoading$.subscribe(loading => {
                expect(loading).toBe(false);
                done();
            });
        }));

        it('should be an observable', () => {
            expect(dataSource.isLoading$).toBeInstanceOf(Observable);
        });
    });

    describe('isLoading', () => {
        it('should return current loading state', () => {
            expect(dataSource.isLoading).toBe(false);
        });
    });

    describe('setLoading', () => {
        it('should set loading to true', () => new Promise<void>((done) => {
            dataSource.setLoading(true);

            dataSource.isLoading$.subscribe(loading => {
                expect(loading).toBe(true);
                done();
            });
        }));

        it('should set loading to false', () => new Promise<void>((done) => {
            dataSource.setLoading(true);
            dataSource.setLoading(false);

            dataSource.isLoading$.subscribe(loading => {
                expect(loading).toBe(false);
                done();
            });
        }));

        it('should update isLoading getter', () => {
            dataSource.setLoading(true);
            expect(dataSource.isLoading).toBe(true);

            dataSource.setLoading(false);
            expect(dataSource.isLoading).toBe(false);
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
        it('should emit fetchAgainEvent', () => new Promise<void>((done) => {
            dataSource.fetchAgainEvent.subscribe(() => {
                expect(true).toBe(true);
                done();
            });

            dataSource.fetchAgain();
        }));

        it('should pass the options through to the event', () => new Promise<void>((done) => {
            dataSource.fetchAgainEvent.subscribe((options) => {
                expect(options).toEqual({ resetSkip: true });
                done();
            });

            dataSource.fetchAgain({ resetSkip: true });
        }));
    });

    describe('isPageOutOfRangeError', () => {
        it('should default to false (base class cannot tell)', () => {
            expect(dataSource.isPageOutOfRangeError(new Error('anything'))).toBe(false);
        });
    });

    describe('listViewComponent', () => {
        it('should store reference to listViewComponent', () => {
            expect(dataSource.listViewComponent).toBe(mockListViewComponent);
        });
    });
});
