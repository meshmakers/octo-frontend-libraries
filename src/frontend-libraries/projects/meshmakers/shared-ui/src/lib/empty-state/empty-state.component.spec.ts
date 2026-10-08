import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EmptyStateComponent, EmptyStateVariant } from './empty-state.component';

@Component({
  imports: [EmptyStateComponent],
  template: `<mm-empty-state [variant]="variant()" heading="Nothing here" [text]="text()" [showRetry]="showRetry()" (retry)="retries = retries + 1" />`
})
class HostComponent {
  readonly variant = signal<EmptyStateVariant>('empty');
  readonly text = signal<string | null>('Create one to start.');
  readonly showRetry = signal(false);
  retries = 0;
}

describe('EmptyStateComponent (AB#3444)', () => {
  function setup(variant: EmptyStateVariant, showRetry = false) {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.variant.set(variant);
    fixture.componentInstance.showRetry.set(showRetry);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return { fixture, root };
  }

  it('shows one idle OctoBot, the title and the text for an empty list', () => {
    const { root } = setup('empty');
    const bots = root.querySelectorAll('mm-octobot');
    expect(bots.length).toBe(1);
    expect(bots[0].getAttribute('data-animation')).toBe('idle');
    // The figure is visible right away: no lazy pop-in.
    expect(bots[0].querySelector('img')?.getAttribute('loading')).toBe('eager');
    expect(root.querySelector('.mm-empty-state__title')?.textContent).toBe('Nothing here');
    expect(root.querySelector('.mm-empty-state__text')?.textContent).toBe('Create one to start.');
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows the look OctoBot when a search finds nothing', () => {
    const { root } = setup('no-results');
    expect(root.querySelector('mm-octobot')?.getAttribute('data-animation')).toBe('look');
  });

  it('keeps errors sober: no figure, an alert and an optional "Try again"', () => {
    const { fixture, root } = setup('error', true);
    expect(root.querySelector('mm-octobot')).toBeNull();
    expect(root.querySelector('[role="alert"]')?.textContent).toBe('Nothing here');
    const retry = root.querySelector<HTMLButtonElement>('.mm-empty-state__retry');
    expect(retry?.textContent?.trim()).toBe('Try again');
    retry?.click();
    expect(fixture.componentInstance.retries).toBe(1);
  });

  it('offers "Try again" only for errors that ask for it', () => {
    expect(setup('error', false).root.querySelector('.mm-empty-state__retry')).toBeNull();
  });
});
