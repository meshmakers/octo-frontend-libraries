import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  OCTOBOT_ASSET_BASE_URL,
  OCTOBOT_FORCE_STILL,
  OCTOBOT_LOOP_MS,
  OctoBotAnimation,
  OctoBotComponent,
  OctoBotSize
} from './octobot.component';

@Component({
  imports: [OctoBotComponent],
  template: `<mm-octobot [animation]="animation()" [size]="size()" [label]="label()" [still]="still()" />`
})
class HostComponent {
  readonly animation = signal<OctoBotAnimation>('idle');
  readonly size = signal<OctoBotSize>('md');
  readonly label = signal<string | null>(null);
  readonly still = signal(false);
}

interface FakeMediaQueryList {
  matches: boolean;
  addEventListener: (type: string, listener: (event: { matches: boolean }) => void) => void;
  removeEventListener: (type: string, listener: (event: { matches: boolean }) => void) => void;
}

describe('OctoBotComponent (AB#3444)', () => {
  let listeners: ((event: { matches: boolean }) => void)[];
  let mediaQuery: FakeMediaQueryList;
  let originalMatchMedia: typeof window.matchMedia | undefined;

  function setup(reducedMotion = false, providers: unknown[] = []): ComponentFixture<HostComponent> {
    listeners = [];
    mediaQuery = {
      matches: reducedMotion,
      addEventListener: (_type, listener) => listeners.push(listener),
      removeEventListener: (_type, listener) => { listeners = listeners.filter(l => l !== listener); }
    };
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(mediaQuery)
    });
    TestBed.configureTestingModule({ imports: [HostComponent], providers: providers as never[] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  const host = (fixture: ComponentFixture<HostComponent>): HTMLElement =>
    (fixture.nativeElement as HTMLElement).querySelector('mm-octobot') as HTMLElement;
  const img = (fixture: ComponentFixture<HostComponent>): HTMLImageElement =>
    host(fixture).querySelector('img') as HTMLImageElement;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: originalMatchMedia });
  });

  it('renders the animated WebP from the default base URL with lazy, async loading', () => {
    const fixture = setup();
    const image = img(fixture);
    expect(image.getAttribute('src')).toBe('assets/octobot/md/octo_idle.webp');
    expect(image.getAttribute('loading')).toBe('lazy');
    expect(image.getAttribute('decoding')).toBe('async');
  });

  it.each<[OctoBotSize, string]>([['sm', '60'], ['md', '120'], ['lg', '240']])(
    'gives size %s a fixed %s px box', (size, px) => {
      const fixture = setup();
      fixture.componentInstance.size.set(size);
      fixture.componentInstance.animation.set('wave');
      fixture.detectChanges();
      expect(img(fixture).getAttribute('width')).toBe(px);
      expect(img(fixture).getAttribute('height')).toBe(px);
      expect(img(fixture).getAttribute('src')).toBe(`assets/octobot/${size}/octo_wave.webp`);
    });

  it('is decorative without a label', () => {
    const fixture = setup();
    expect(img(fixture).getAttribute('alt')).toBe('');
    expect(host(fixture).getAttribute('aria-hidden')).toBe('true');
    expect(host(fixture).getAttribute('role')).toBeNull();
    expect(host(fixture).getAttribute('aria-label')).toBeNull();
  });

  it('is an image with an accessible name when labelled', () => {
    const fixture = setup();
    fixture.componentInstance.label.set('The assistant is thinking');
    fixture.detectChanges();
    expect(host(fixture).getAttribute('role')).toBe('img');
    expect(host(fixture).getAttribute('aria-label')).toBe('The assistant is thinking');
    expect(host(fixture).getAttribute('aria-hidden')).toBeNull();
  });

  it('shows the still frame while the user prefers reduced motion and follows changes live', () => {
    const fixture = setup(true);
    expect(img(fixture).getAttribute('src')).toBe('assets/octobot/md/octo_idle_still.png');

    listeners.forEach(listener => listener({ matches: false }));
    fixture.detectChanges();
    expect(img(fixture).getAttribute('src')).toBe('assets/octobot/md/octo_idle.webp');
  });

  it('removes the media query listener when destroyed', () => {
    const fixture = setup();
    expect(listeners.length).toBe(1);
    fixture.destroy();
    expect(listeners.length).toBe(0);
  });

  it('shows the still frame when the still input is set', () => {
    const fixture = setup();
    fixture.componentInstance.still.set(true);
    fixture.componentInstance.animation.set('thinking');
    fixture.detectChanges();
    expect(img(fixture).getAttribute('src')).toBe('assets/octobot/md/octo_thinking_still.png');
    expect(host(fixture).getAttribute('data-still')).toBe('true');
  });

  it('plays once and then rests on the still frame with playOnce', () => {
    vi.useFakeTimers();
    try {
      listeners = [];
      Object.defineProperty(window, 'matchMedia', {
        configurable: true, writable: true,
        value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
      });
      @Component({ imports: [OctoBotComponent], template: `<mm-octobot animation="wave" playOnce />` })
      class OnceHost {}
      TestBed.configureTestingModule({ imports: [OnceHost] });
      const fixture = TestBed.createComponent(OnceHost);
      fixture.detectChanges();
      const image = (): HTMLImageElement => (fixture.nativeElement as HTMLElement).querySelector('img') as HTMLImageElement;
      expect(image().getAttribute('src')).toBe('assets/octobot/md/octo_wave.webp');
      vi.advanceTimersByTime(OCTOBOT_LOOP_MS.wave + 1);
      fixture.detectChanges();
      expect(image().getAttribute('src')).toBe('assets/octobot/md/octo_wave_still.png');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the still frame when OCTOBOT_FORCE_STILL is set', () => {
    const fixture = setup(false, [{ provide: OCTOBOT_FORCE_STILL, useValue: true }]);
    expect(img(fixture).getAttribute('src')).toBe('assets/octobot/md/octo_idle_still.png');
  });

  it('resolves the URL against OCTOBOT_ASSET_BASE_URL, adding a missing trailing slash', () => {
    const fixture = setup(false, [{ provide: OCTOBOT_ASSET_BASE_URL, useValue: '/cdn/octo' }]);
    expect(img(fixture).getAttribute('src')).toBe('/cdn/octo/md/octo_idle.webp');
  });
});
