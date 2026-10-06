import { categoryStatus, humanizeCategory, observeThemeChanges, responsiveLegendPosition, sameChartItems, statusColor, themeSignature } from './chart-categories';
import { PieChartWidgetComponent } from '../widgets/pie-chart-widget/pie-chart-widget.component';

describe('chart categories', () => {
  it('humanizes enum-style categories only', () => {
    expect(humanizeCategory('RESOLVE_FAILED')).toBe('Resolve failed');
    expect(humanizeCategory('AVAILABLE')).toBe('Available');
    expect(humanizeCategory('ResolveFailed')).toBe('Resolve failed');
    expect(humanizeCategory('Vienna')).toBe('Vienna');
    expect(humanizeCategory('Line 3 – Press')).toBe('Line 3 – Press');
    expect(humanizeCategory('A')).toBe('A');
  });

  it('maps well-known states to statuses', () => {
    expect(categoryStatus('RESOLVE_FAILED')).toBe('error');
    expect(categoryStatus('Available')).toBe('success');
    expect(categoryStatus('pending')).toBe('warning');
    expect(categoryStatus('Vienna')).toBeNull();
  });

  it('reads the status colour from the theme, with a fixed fallback', () => {
    document.documentElement.style.setProperty('--theme-status-error', '#ff0000');
    expect(statusColor('error')).toBe('#ff0000');
    document.documentElement.style.removeProperty('--theme-status-error');
    expect(statusColor('error', null)).toMatch(/^#/);
  });

  it('moves a side legend below a narrow chart', () => {
    expect(responsiveLegendPosition('right', 300)).toBe('bottom');
    expect(responsiveLegendPosition(undefined, 300)).toBe('bottom');
    expect(responsiveLegendPosition('right', 800)).toBe('right');
    expect(responsiveLegendPosition('top', 300)).toBe('top');
    expect(responsiveLegendPosition('right', 0)).toBe('right');
  });

  it('signals a theme switch on <html data-theme> and stops after unsubscribe', async () => {
    const onChange = vi.fn();
    const stop = observeThemeChanges(onChange);
    document.documentElement.setAttribute('data-theme', 'light');
    await new Promise(r => setTimeout(r));
    expect(onChange).toHaveBeenCalled();
    stop();
    onChange.mockClear();
    document.documentElement.setAttribute('data-theme', 'dark');
    await new Promise(r => setTimeout(r));
    expect(onChange).not.toHaveBeenCalled();
    document.documentElement.removeAttribute('data-theme');
  });

  it('ignores <html> class / style mutations that do not change the theme (AB#5568)', async () => {
    const onChange = vi.fn();
    const stop = observeThemeChanges(onChange);
    for (let i = 0; i < 5; i++) {
      // What hover tooltips, popups and scroll locks do to <html>.
      document.documentElement.classList.toggle('k-overflow-hidden');
      document.documentElement.style.setProperty('padding-right', `${i}px`);
      await new Promise(r => setTimeout(r));
    }
    expect(onChange).not.toHaveBeenCalled();
    document.documentElement.setAttribute('data-theme', 'light');
    await new Promise(r => setTimeout(r));
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.classList.add('another');
    await new Promise(r => setTimeout(r));
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('another', 'k-overflow-hidden');
    document.documentElement.style.removeProperty('padding-right');
  });

  it('builds the theme signature from data-theme and the resolved colours', () => {
    const before = themeSignature();
    document.documentElement.setAttribute('data-theme', 'light');
    expect(themeSignature()).not.toBe(before);
    document.documentElement.removeAttribute('data-theme');
    expect(themeSignature()).toBe(before);
  });

  it('compares chart data by category, value and colour, so equal data keeps its array (AB#5568)', () => {
    const a = [{ category: 'Available', value: 3, color: '#0f0' }, { category: 'Importing', value: 1 }];
    expect(sameChartItems(a, a.map(item => ({ ...item })))).toBe(true);
    expect(sameChartItems(a, [{ ...a[0], value: 4 }, a[1]])).toBe(false);
    expect(sameChartItems(a, [{ ...a[0], color: '#f00' }, a[1]])).toBe(false);
    expect(sameChartItems(a, a.slice(0, 1))).toBe(false);
  });

  it('gives the pie a stable plot area object across change detections (AB#5568)', () => {
    const plotArea = PieChartWidgetComponent.prototype.plotArea;
    const withLabels = { config: { showLabels: true } };
    const without = { config: { showLabels: false } };
    expect(plotArea.call(withLabels as never)).toBe(plotArea.call(withLabels as never));
    expect(plotArea.call(without as never)).toBe(plotArea.call(without as never));
    expect(plotArea.call(withLabels as never).margin.top).toBe(30);
    expect(plotArea.call(without as never).margin.top).toBe(4);
  });

  it('covers the enum states the Studio explorer shows', () => {
    expect(categoryStatus('Enabled')).toBe('success');
    expect(categoryStatus('Hibernated')).toBe('info');
    expect(categoryStatus('Waking')).toBe('warning');
  });
});
