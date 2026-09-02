import type { MockedObject } from "vitest";
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StatsGridWidgetComponent } from './stats-grid-widget.component';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { QueryExecutorService } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { StatsGridWidgetConfig, PersistentQueryCellSource } from '../../models/meshboard.models';

/** A canned stream-data row (the SD path collapses every kind into StreamDataQueryRow). */
function sdRow(cells: Record<string, unknown>) {
    return {
        __typename: 'StreamDataQueryRow',
        rtId: 'entity-1',
        cells: Object.entries(cells).map(([attributePath, value]) => ({ attributePath, value }))
    };
}

function execResult(rows: unknown[], total: number) {
    return {
        family: 'streamData', queryRtId: 'q1', associatedCkTypeId: null,
        columns: [], rows, totalCount: total, hasNextPage: false, endCursor: null
    };
}

describe('StatsGridWidgetComponent — stream-data persistent-query stats', () => {
    function create(source: PersistentQueryCellSource, rows: unknown[], total: number, aggregations = new Map<string, number>()): StatsGridWidgetComponent {
        const queryExecutor = {
            execute: vi.fn().mockName("QueryExecutorService.execute")
        };
        queryExecutor.execute.mockReturnValue(of(execResult(rows, total)) as ReturnType<QueryExecutorService['execute']>);

        const dataService = {
            fetchAggregations: vi.fn().mockName("MeshBoardDataService.fetchAggregations")
        };
        dataService.fetchAggregations.mockResolvedValue(aggregations);

        const stateService = {
            resolveStreamDataTimeArgs: vi.fn().mockName("MeshBoardStateService.resolveStreamDataTimeArgs"),
            resolveStreamDataRtIds: vi.fn().mockName("MeshBoardStateService.resolveStreamDataRtIds"),
            getVariables: vi.fn().mockName("MeshBoardStateService.getVariables")
        };
        stateService.resolveStreamDataTimeArgs.mockReturnValue(undefined);
        stateService.resolveStreamDataRtIds.mockReturnValue(undefined);
        stateService.getVariables.mockReturnValue([]);

        const variableService = {
            convertToFieldFilterDto: vi.fn().mockName("MeshBoardVariableService.convertToFieldFilterDto")
        };
        variableService.convertToFieldFilterDto.mockReturnValue(undefined);

        TestBed.configureTestingModule({
            imports: [StatsGridWidgetComponent],
            providers: [
                { provide: MeshBoardDataService, useValue: dataService },
                { provide: QueryExecutorService, useValue: queryExecutor },
                { provide: MeshBoardStateService, useValue: stateService },
                { provide: MeshBoardVariableService, useValue: variableService }
            ]
        });

        const cmp = TestBed.createComponent(StatsGridWidgetComponent).componentInstance;
        cmp.config = {
            id: 'w1', type: 'statsGrid', title: 'Test', col: 1, row: 1, colSpan: 3, rowSpan: 1,
            dataSource: { type: 'aggregation', queries: [] },
            stats: [{ label: 'Metric', queryId: 'query-stat-1', persistentQuerySource: source }],
            columns: 3
        } as StatsGridWidgetConfig;
        return cmp;
    }

    async function load(cmp: StatsGridWidgetComponent): Promise<void> {
        await (cmp as unknown as {
            loadData(): Promise<void>;
        }).loadData();
    }

    it('renders totalCount for a simpleCount SD query', async () => {
        const cmp = create({ queryRtId: 'q1', queryFamily: 'streamData', queryMode: 'simpleCount' }, [sdRow({ 'amount.value': 1 })], 42);
        await load(cmp);
        expect(cmp.statValues()[0].value).toBe(42);
    });

    it('renders the value field for an aggregation SD query', async () => {
        const cmp = create({ queryRtId: 'q1', queryFamily: 'streamData', queryMode: 'aggregation', queryValueField: 'amountvalue_sum' }, [sdRow({ amountvalue_sum: 123 })], 1);
        await load(cmp);
        expect(cmp.statValues()[0].value).toBe(123);
    });

    it('renders the matching category value for a groupedAggregation SD query', async () => {
        const cmp = create({
            queryRtId: 'q1', queryFamily: 'streamData', queryMode: 'groupedAggregation',
            queryCategoryField: 'operatingstatus', queryCategoryValue: 'RUNNING', queryValueField: 'amountvalue_sum'
        }, [
            sdRow({ operatingstatus: 'STOPPED', amountvalue_sum: 5 }),
            sdRow({ operatingstatus: 'RUNNING', amountvalue_sum: 9 })
        ], 2);
        await load(cmp);
        expect(cmp.statValues()[0].value).toBe(9);
    });

    it('passes the resolved time range + asset-scope rtIds as streamDataArgs', async () => {
        const cmp = create({ queryRtId: 'q1', queryFamily: 'streamData', queryMode: 'simpleCount', entitySelectorId: 'mp' }, [], 3);
        const state = TestBed.inject(MeshBoardStateService) as MockedObject<MeshBoardStateService>;
        state.resolveStreamDataTimeArgs.mockReturnValue({ from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-02-01T00:00:00Z') });
        state.resolveStreamDataRtIds.mockReturnValue(['rt-1', 'rt-2']);
        await load(cmp);
        const qe = TestBed.inject(QueryExecutorService) as MockedObject<QueryExecutorService>;
        const opts = vi.mocked(qe.execute).mock.lastCall![2];
        expect(opts?.streamDataArgs?.rtIds).toEqual(['rt-1', 'rt-2']);
        expect(opts?.streamDataArgs?.from).toBeTruthy();
    });

    it('still resolves the runtime aggregation path for non-persistent stats', async () => {
        const cmp = create({ queryRtId: 'q1', queryFamily: 'streamData', queryMode: 'simpleCount' }, [], 1, new Map<string, number>([['query-agg', 77]]));
        // Replace config with a pure aggregation stat.
        cmp.config = {
            id: 'w1', type: 'statsGrid', title: 'Test', col: 1, row: 1, colSpan: 3, rowSpan: 1,
            dataSource: { type: 'aggregation', queries: [{ id: 'query-agg', ckTypeId: 'CK/T', aggregation: 'count' }] },
            stats: [{ label: 'Count', queryId: 'query-agg' }],
            columns: 3
        } as StatsGridWidgetConfig;
        await load(cmp);
        expect(cmp.statValues()[0].value).toBe(77);
    });
});
