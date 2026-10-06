import { PieChartWidgetComponent } from './pie-chart-widget.component';

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
