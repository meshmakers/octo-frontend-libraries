import { categoryStatus, humanizeCategory, observeThemeChanges, responsiveLegendPosition, statusColor } from './chart-categories';

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

  it('covers the enum states the Studio explorer shows', () => {
    expect(categoryStatus('Enabled')).toBe('success');
    expect(categoryStatus('Hibernated')).toBe('info');
    expect(categoryStatus('Waking')).toBe('warning');
  });
});
