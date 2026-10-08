import { TestBed } from '@angular/core/testing';
import { PieChartWidgetComponent } from './pie-chart-widget.component';
import { QueryExecutorService } from '../../services/query-executor.service';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { MESHBOARD_LABEL_RESOLVER } from '../../utils/meshboard-labels';

describe('PieChartWidgetComponent plot area (AB#5568)', () => {
  it('gives the pie a stable plot area object across change detections', () => {
    const plotArea = PieChartWidgetComponent.prototype.plotArea;
    const withLabels = { config: { showLabels: true } };
    const without = { config: { showLabels: false } };
    expect(plotArea.call(withLabels as never)).toBe(plotArea.call(withLabels as never));
    expect(plotArea.call(without as never)).toBe(plotArea.call(without as never));
    expect(plotArea.call(withLabels as never).margin.top).toBe(30);
    expect(plotArea.call(without as never).margin.top).toBe(4);
  });
});

describe('PieChartWidgetComponent theme colours (AB#5568)', () => {
  const root = document.documentElement;
  const tick = () => new Promise(r => setTimeout(r));

  function create(): PieChartWidgetComponent {
    TestBed.configureTestingModule({
      providers: [
        { provide: QueryExecutorService, useValue: {} },
        { provide: MeshBoardDataService, useValue: {} },
        { provide: MeshBoardStateService, useValue: {} },
        { provide: MeshBoardVariableService, useValue: {} },
      ],
    });
    const component = TestBed.createComponent(PieChartWidgetComponent).componentInstance;
    component.config = { showLabels: true } as never;
    return component;
  }

  afterEach(() => {
    root.removeAttribute('data-theme');
    root.style.removeProperty('--theme-text-secondary');
    root.style.removeProperty('--theme-status-error');
  });

  it('re-resolves label and status colours after a live theme switch, stable otherwise', async () => {
    root.style.setProperty('--theme-text-secondary', 'rgb(230, 237, 245)');
    root.style.setProperty('--theme-status-error', 'rgb(229, 72, 77)');
    const component = create();
    const labels = component.labelSettings();
    expect(labels.color).toBe('rgb(230, 237, 245)');
    expect(component.labelSettings()).toBe(labels);
    expect(component.toItem('RESOLVE_FAILED', 1).color).toBe('rgb(229, 72, 77)');

    root.style.setProperty('--theme-text-secondary', 'rgb(75, 90, 110)');
    root.style.setProperty('--theme-status-error', 'rgb(200, 30, 40)');
    root.setAttribute('data-theme', 'light');
    await tick();
    expect(component.labelSettings().color).toBe('rgb(75, 90, 110)');
    expect(component.toItem('RESOLVE_FAILED', 1).color).toBe('rgb(200, 30, 40)');
  });
});

describe('PieChartWidgetComponent category labels (AB#5622)', () => {
  function create(resolver?: (r: { value: string }) => string | null): PieChartWidgetComponent {
    TestBed.configureTestingModule({
      providers: [
        { provide: QueryExecutorService, useValue: {} },
        { provide: MeshBoardDataService, useValue: {} },
        { provide: MeshBoardStateService, useValue: {} },
        { provide: MeshBoardVariableService, useValue: {} },
        ...(resolver ? [{ provide: MESHBOARD_LABEL_RESOLVER, useValue: resolver }] : []),
      ],
    });
    const component = TestBed.createComponent(PieChartWidgetComponent).componentInstance;
    component.config = { categoryField: 'paymentState', dataSource: { type: 'persistentQuery', queryRtId: 'q' } } as never;
    return component;
  }

  it('humanizes categories without a resolver (unchanged)', () => {
    expect(create().toItem('NOT_PAID', 1).category).toBe('Not paid');
  });

  it('uses the resolver text for slices (legend and tooltip read the same category)', () => {
    const resolver = vi.fn((r: { value: string }) => (r.value === 'NOT_PAID' ? 'Offen' : null));
    const component = create(resolver);
    expect(component.toItem('NOT_PAID', 1).category).toBe('Offen');
    expect(component.toItem('PAID', 1).category).toBe('Paid');
    expect(resolver).toHaveBeenCalledWith({ kind: 'chartCategory', attribute: 'paymentState', value: 'NOT_PAID', defaultText: 'Not paid' });
  });

  it('keeps the status colour of the raw value under a translated label', () => {
    const component = create(() => 'Fehlgeschlagen');
    const item = component.toItem('RESOLVE_FAILED', 1);
    expect(item.category).toBe('Fehlgeschlagen');
    expect(item.color).toBeTruthy();
  });
});
