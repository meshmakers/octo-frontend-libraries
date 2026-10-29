import type { MockedObject } from 'vitest';
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
      resolveStreamDataRtIds: vi.fn().mockName('MeshBoardStateService.resolveStreamDataRtIds'),
      resolveStreamDataTimeArgs: vi.fn().mockName('MeshBoardStateService.resolveStreamDataTimeArgs'),
      timeZoneMode: vi.fn().mockName('MeshBoardStateService.timeZoneMode')
    } as unknown as MockedObject<MeshBoardStateService>;

    TestBed.configureTestingModule({
      imports: [HeatmapWidgetComponent],
      providers: [
        { provide: MeshBoardStateService, useValue: stateService },
        { provide: QueryExecutorService, useValue: {
          execute: vi.fn().mockName('QueryExecutorService.execute')
        } },
        { provide: MeshBoardVariableService, useValue: {
          resolveVariables: vi.fn().mockName('MeshBoardVariableService.resolveVariables')
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

describe('HeatmapWidgetComponent — value formatting through the shared formatter (AB#7686)', () => {
  function legacyFormatSI(value: number, decimals: number): string {
    const abs = Math.abs(value);
    const siPrefixes: [number, string][] = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k']];
    for (const [threshold, prefix] of siPrefixes) {
      if (abs >= threshold) {
        return (value / threshold).toLocaleString('de-AT', { minimumFractionDigits: 0, maximumFractionDigits: decimals }) + prefix;
      }
    }
    return value.toLocaleString('de-AT', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  }

  function legacyFormatValue(config: Partial<HeatmapWidgetConfig>, value: number): string {
    const decimals = config.decimalPlaces ?? 2;
    const displayValue = value * (config.valueMultiplier ?? 1);
    if (config.compactNumbers) {
      return legacyFormatSI(displayValue, decimals);
    }
    return displayValue.toLocaleString('de-AT', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  }

  it('produces exactly the previous output over a grid of values, digits and options', () => {
    TestBed.configureTestingModule({
      imports: [HeatmapWidgetComponent],
      providers: [
        { provide: MeshBoardStateService, useValue: {} },
        { provide: QueryExecutorService, useValue: {} },
        { provide: MeshBoardVariableService, useValue: {} }
      ]
    });
    const component = TestBed.createComponent(HeatmapWidgetComponent).componentInstance;
    const values = [0, -0, 1, -1, 0.5, 0.004, 0.005, -0.005, 2.675, 38.9, 46, 999.995, 1234.5678, -1234.5678, 13600, 999999.5, 1e6, 2.5e9, -7.25e12, 1e21, 1e-7, Number.MAX_SAFE_INTEGER, Infinity, -Infinity];
    const decimals = [undefined, 0, 1, 2, 3, 4, 5, 6];
    let compared = 0;
    for (const compactNumbers of [false, true]) {
      for (const valueMultiplier of [undefined, 1, 0.001, 10 / 3600]) {
        for (const decimalPlaces of decimals) {
          const config = { type: 'heatmap', decimalPlaces, compactNumbers, valueMultiplier } as unknown as HeatmapWidgetConfig;
          component.config = config;
          for (const value of values) {
            expect(component.formatValue(value)).toBe(legacyFormatValue(config, value));
            compared++;
          }
        }
      }
    }
    expect(compared).toBe(1536);
  });
});
