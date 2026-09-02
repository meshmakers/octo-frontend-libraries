import type { MockedObject } from "vitest";
import { TestBed } from '@angular/core/testing';
import { HeatmapWidgetComponent } from './heatmap-widget.component';
import { QueryExecutorService } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { HeatmapWidgetConfig } from '../../models/meshboard.models';

interface HeatmapCell {
    date: string;
    hour: string;
    value: number;
    color: string;
}

// Band colors mirrored from THRESHOLD_COLORS in the component.
const OK = '#2e7d32';
const WARN = '#ffb300';
const HIGH = '#c62828';

describe('HeatmapWidgetComponent — threshold coloring', () => {
    let component: HeatmapWidgetComponent;
    let stateService: MockedObject<MeshBoardStateService>;

    function configWith(partial: Partial<HeatmapWidgetConfig>): HeatmapWidgetConfig {
        return {
            type: 'heatmap',
            dateField: 'window_start',
            aggregation: 'count',
            colorScheme: 'green',
            dataSource: { type: 'persistentQuery', queryRtId: 'q1' },
            ...partial
        } as unknown as HeatmapWidgetConfig;
    }

    beforeEach(() => {
        stateService = {
            resolveStreamDataRtIds: vi.fn().mockName("MeshBoardStateService.resolveStreamDataRtIds"),
            resolveStreamDataTimeArgs: vi.fn().mockName("MeshBoardStateService.resolveStreamDataTimeArgs"),
            timeZoneMode: vi.fn().mockName("MeshBoardStateService.timeZoneMode")
        };

        TestBed.configureTestingModule({
            imports: [HeatmapWidgetComponent],
            providers: [
                { provide: MeshBoardStateService, useValue: stateService },
                { provide: QueryExecutorService, useValue: {
                        execute: vi.fn().mockName("QueryExecutorService.execute")
                    } },
                { provide: MeshBoardVariableService, useValue: {
                        resolveVariables: vi.fn().mockName("MeshBoardVariableService.resolveVariables")
                    } }
            ]
        });

        component = TestBed.createComponent(HeatmapWidgetComponent).componentInstance;
    });

    describe('getThresholdColor', () => {
        it('greens a cell equal to the target', () => {
            expect((component as unknown as {
                getThresholdColor(v: number, t: number): string;
            }).getThresholdColor(2, 2)).toBe(OK);
        });

        it('ambers a cell below the target, including empty 0-cells', () => {
            const c = component as unknown as {
                getThresholdColor(v: number, t: number): string;
            };
            expect(c.getThresholdColor(1, 2)).toBe(WARN);
            expect(c.getThresholdColor(0, 2)).toBe(WARN);
        });

        it('reds a cell above the target', () => {
            expect((component as unknown as {
                getThresholdColor(v: number, t: number): string;
            }).getThresholdColor(8, 2)).toBe(HIGH);
        });
    });

    describe('resolveThresholdTarget', () => {
        function resolve(): number | null {
            return (component as unknown as {
                resolveThresholdTarget(): number | null;
            }).resolveThresholdTarget();
        }

        it('uses the explicit thresholdTarget when set', () => {
            component.config = configWith({ thresholdTarget: 5, dataSource: { type: 'persistentQuery', queryRtId: 'q1', entitySelectorId: 'es1' } as never });
            stateService.resolveStreamDataRtIds.mockReturnValue(['a', 'b']);
            expect(resolve()).toBe(5);
        });

        it('auto-derives the target from the number of scoped source rtIds', () => {
            component.config = configWith({ dataSource: { type: 'persistentQuery', queryRtId: 'q1', entitySelectorId: 'es1' } as never });
            stateService.resolveStreamDataRtIds.mockReturnValue(['a', 'b']);
            expect(resolve()).toBe(2);
        });

        it('returns null when there is neither a manual target nor a resolvable scope', () => {
            component.config = configWith({});
            stateService.resolveStreamDataRtIds.mockReturnValue(undefined);
            expect(resolve()).toBeNull();
        });
    });

    describe('assignColors', () => {
        function assign(data: HeatmapCell[]): void {
            (component as unknown as {
                assignColors(d: HeatmapCell[]): void;
            }).assignColors(data);
        }

        it('bands cells around the target in threshold mode (0 → warn, target → ok, above → high)', () => {
            component.config = configWith({ colorMode: 'threshold', thresholdTarget: 2 });
            const data: HeatmapCell[] = [
                { date: 'd', hour: '00:00', value: 0, color: '' },
                { date: 'd', hour: '01:00', value: 1, color: '' },
                { date: 'd', hour: '02:00', value: 2, color: '' },
                { date: 'd', hour: '03:00', value: 8, color: '' }
            ];
            assign(data);
            expect(data.map(d => d.color)).toEqual([WARN, WARN, OK, HIGH]);
        });

        it('falls back to gradient when threshold mode has no resolvable target', () => {
            component.config = configWith({ colorMode: 'threshold' });
            stateService.resolveStreamDataRtIds.mockReturnValue(undefined);
            const data: HeatmapCell[] = [
                { date: 'd', hour: '00:00', value: 0, color: '' },
                { date: 'd', hour: '01:00', value: 5, color: '' }
            ];
            assign(data);
            // No threshold target → gradient path: zero cell stays transparent, non-zero gets a scheme color.
            expect(data[0].color).toBe('transparent');
            expect(data[1].color).not.toBe('transparent');
        });

        it('uses gradient coloring (transparent zeros) when colorMode is gradient', () => {
            component.config = configWith({ colorMode: 'gradient' });
            const data: HeatmapCell[] = [
                { date: 'd', hour: '00:00', value: 0, color: '' },
                { date: 'd', hour: '01:00', value: 3, color: '' }
            ];
            assign(data);
            expect(data[0].color).toBe('transparent');
            expect(data[1].color).not.toBe('transparent');
        });
    });
});
