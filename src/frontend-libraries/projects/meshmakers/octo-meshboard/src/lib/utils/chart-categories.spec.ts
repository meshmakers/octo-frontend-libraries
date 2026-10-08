import { categoryStatus, chartSeriesColors, chartThemeColors, FALLBACK_SERIES_COLORS, humanizeCategory, observeThemeChanges, resolveChartColor, responsiveLegendPosition, sameChartItems, statusColor, themeSignature } from './chart-categories';

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

  it('computes the root style once per theme signature', () => {
    const spy = vi.spyOn(window, 'getComputedStyle');
    themeSignature();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('builds the theme signature from data-theme and the resolved colours', () => {
    const before = themeSignature();
    document.documentElement.setAttribute('data-theme', 'light');
    expect(themeSignature()).not.toBe(before);
    document.documentElement.removeAttribute('data-theme');
    expect(themeSignature()).toBe(before);
  });

  it('resolves chart text / grid colours from the theme tokens and puts them in the signature (AB#5568)', () => {
    const root = document.documentElement;
    const before = themeSignature();
    root.style.setProperty('--theme-text-secondary', 'rgb(1, 2, 3)');
    root.style.setProperty('--theme-text-muted', 'rgb(4, 5, 6)');
    root.style.setProperty('--theme-border-subtle', 'rgb(7, 8, 9)');
    expect(chartThemeColors()).toEqual({ text: 'rgb(1, 2, 3)', muted: 'rgb(4, 5, 6)', grid: 'rgb(7, 8, 9)' });
    expect(themeSignature()).not.toBe(before);
    root.style.removeProperty('--theme-text-secondary');
    root.style.removeProperty('--theme-text-muted');
    root.style.removeProperty('--theme-border-subtle');
    expect(themeSignature()).toBe(before);
  });

  it('falls back to neutral chart colours without theme tokens', () => {
    const colors = chartThemeColors(null);
    expect(colors.text).toBeTruthy();
    expect(colors.muted).toBeTruthy();
    expect(colors.grid).toBeTruthy();
  });

  it('compares chart data by category, value and colour, so equal data keeps its array (AB#5568)', () => {
    const a = [{ category: 'Available', value: 3, color: '#0f0' }, { category: 'Importing', value: 1 }];
    expect(sameChartItems(a, a.map(item => ({ ...item })))).toBe(true);
    expect(sameChartItems(a, [{ ...a[0], value: 4 }, a[1]])).toBe(false);
    expect(sameChartItems(a, [{ ...a[0], color: '#f00' }, a[1]])).toBe(false);
    expect(sameChartItems(a, a.slice(0, 1))).toBe(false);
  });

  it('covers the enum states the Studio explorer shows', () => {
    expect(categoryStatus('Enabled')).toBe('success');
    expect(categoryStatus('Hibernated')).toBe('info');
    expect(categoryStatus('Waking')).toBe('warning');
  });
});

describe('chart palette (AB#5622)', () => {
  const root = document.documentElement;
  const props = ['--theme-chart-1', '--theme-chart-2', '--kendo-chart-series-1', '--kendo-chart-series-2', '--brand-paid'];
  afterEach(() => props.forEach(p => root.style.removeProperty(p)));

  it('prefers the host chart tokens', () => {
    root.style.setProperty('--theme-chart-1', 'rgb(100, 206, 185)');
    root.style.setProperty('--theme-chart-2', 'rgb(0, 168, 220)');
    root.style.setProperty('--kendo-chart-series-1', 'rgb(1, 2, 3)');
    expect(chartSeriesColors()).toEqual(['rgb(100, 206, 185)', 'rgb(0, 168, 220)']);
  });

  it('falls back to the Kendo series tokens, then to the fixed palette (never empty, never black)', () => {
    root.style.setProperty('--kendo-chart-series-1', 'rgb(1, 2, 3)');
    expect(chartSeriesColors()).toEqual(['rgb(1, 2, 3)']);
    root.style.removeProperty('--kendo-chart-series-1');
    expect(chartSeriesColors()).toEqual([...FALLBACK_SERIES_COLORS]);
    expect(FALLBACK_SERIES_COLORS).not.toContain('#000000');
  });

  it('is part of the theme signature, so a palette change re-colours the charts', () => {
    const before = themeSignature();
    root.style.setProperty('--theme-chart-1', 'rgb(9, 9, 9)');
    expect(themeSignature()).not.toBe(before);
  });

  it('resolves configured colours: CSS colour, custom property, var() with fallback, status name', () => {
    root.style.setProperty('--brand-paid', 'rgb(47, 179, 122)');
    expect(resolveChartColor('#123456')).toBe('#123456');
    expect(resolveChartColor('--brand-paid')).toBe('rgb(47, 179, 122)');
    expect(resolveChartColor('var(--brand-paid)')).toBe('rgb(47, 179, 122)');
    expect(resolveChartColor('var(--missing, #abcdef)')).toBe('#abcdef');
    expect(resolveChartColor('--missing')).toBeUndefined();
    expect(resolveChartColor('error')).toBe(statusColor('error'));
    expect(resolveChartColor('')).toBeUndefined();
  });
});
