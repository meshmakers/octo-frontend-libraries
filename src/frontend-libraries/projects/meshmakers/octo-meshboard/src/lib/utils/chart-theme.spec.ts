import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectChartTheme } from './chart-theme';

@Component({ selector: 'mm-chart-theme-host', template: '' })
class HostComponent {
  readonly theme = injectChartTheme();
}

describe('injectChartTheme (AB#5568)', () => {
  const root = document.documentElement;
  const tick = () => new Promise(r => setTimeout(r));

  afterEach(() => {
    root.removeAttribute('data-theme');
    root.style.removeProperty('--theme-text-secondary');
    root.classList.remove('k-overflow-hidden');
  });

  it('re-resolves the colours on a live theme switch', async () => {
    root.style.setProperty('--theme-text-secondary', 'rgb(230, 237, 245)');
    const host = TestBed.createComponent(HostComponent).componentInstance;
    expect(host.theme().text).toBe('rgb(230, 237, 245)');

    // What the Studio ThemeService does on Dark → Light: new tokens + data-theme.
    root.style.setProperty('--theme-text-secondary', 'rgb(75, 90, 110)');
    root.setAttribute('data-theme', 'light');
    await tick();
    expect(host.theme().text).toBe('rgb(75, 90, 110)');
  });

  it('keeps the same object while the theme does not change (no chart redraw loop)', async () => {
    const host = TestBed.createComponent(HostComponent).componentInstance;
    const first = host.theme();
    for (let i = 0; i < 3; i++) {
      root.classList.toggle('k-overflow-hidden');
      await tick();
    }
    expect(host.theme()).toBe(first);
  });

  it('stops observing when the component is destroyed', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    const first = host.theme();
    fixture.destroy();
    root.setAttribute('data-theme', 'light');
    await tick();
    expect(host.theme()).toBe(first);
  });
});
