import {Component, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {ActionButtonComponent, MmActionContext, MmActionDisplay} from './action-button.component';
import {MM_ACTION_ICONS, MmAction, MmActionEvent} from './action.model';

@Component({
  standalone: true,
  imports: [ActionButtonComponent],
  template: `<mm-action-button [action]="action()" [targetLabel]="target()" [context]="context()" [display]="display()"
                               [primary]="primary()" (triggered)="events.push($event)" />`,
})
class HostComponent {
  readonly action = signal<MmAction>({id: 'delete', label: 'Delete dump', icon: MM_ACTION_ICONS.delete, danger: true});
  readonly target = signal<string | undefined>('Encrypt run 17:09');
  readonly context = signal<MmActionContext>('row');
  readonly display = signal<MmActionDisplay>('icon');
  readonly primary = signal(false);
  readonly events: MmActionEvent[] = [];
}

describe('ActionButtonComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  const button = (): HTMLButtonElement => fixture.nativeElement.querySelector('button');

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [HostComponent], providers: [provideRouter([])]}).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders an icon-only button with tooltip and a target-specific accessible name', () => {
    const b = button();
    expect(b.textContent?.trim()).toBe('');
    expect(b.getAttribute('title')).toBe('Delete dump');
    expect(b.getAttribute('aria-label')).toBe('Delete dump Encrypt run 17:09');
    expect(b.getAttribute('data-action')).toBe('delete');
    expect(b.querySelector('svg')).not.toBeNull();
  });

  it('styles destructive actions as danger', () => {
    expect(button().classList).toContain('k-button-error');
    expect(button().classList).toContain('mm-action-button--danger');
  });

  it('emits on click', () => {
    button().click();
    expect(host.events.map((e) => e.id)).toEqual(['delete']);
  });

  it('keeps a disabled action focusable, announces the reason and swallows clicks', () => {
    host.action.set({id: 'delete', label: 'Delete dump', icon: MM_ACTION_ICONS.delete, disabledReason: 'A sweep is running'});
    fixture.detectChanges();
    const b = button();
    expect(b.disabled).toBe(false);
    expect(b.getAttribute('aria-disabled')).toBe('true');
    const reasonId = b.getAttribute('aria-describedby')!;
    expect(fixture.nativeElement.querySelector(`#${reasonId}`).textContent).toBe('A sweep is running');
    expect(b.getAttribute('title')).toBe('Delete dump — A sweep is running');
    b.click();
    expect(host.events).toEqual([]);
  });

  it('renders text buttons without a tooltip and without aria-label when there is no target', () => {
    host.display.set('text');
    host.target.set(undefined);
    host.action.set({id: 'verify', label: 'Verify sweep', icon: MM_ACTION_ICONS.run});
    fixture.detectChanges();
    const b = button();
    expect(b.textContent?.trim()).toBe('Verify sweep');
    expect(b.getAttribute('title')).toBeNull();
    expect(b.getAttribute('aria-label')).toBeNull();
    expect(b.querySelector('svg')).toBeNull();
  });

  it('falls back to text when an icon-only action has no icon', () => {
    host.action.set({id: 'x', label: 'Retry'});
    fixture.detectChanges();
    expect(button().textContent?.trim()).toBe('Retry');
  });

  it('renders the primary page action solid and medium-sized', () => {
    host.action.set({id: 'new', label: 'New adapter', icon: MM_ACTION_ICONS.add});
    host.context.set('page');
    host.display.set('icon-text');
    host.primary.set(true);
    fixture.detectChanges();
    const b = button();
    expect(b.classList).toContain('k-button-solid');
    expect(b.classList).toContain('k-button-primary');
    expect(b.classList).toContain('k-button-md');
    expect(b.textContent?.trim()).toBe('New adapter');
  });

  it('renders a navigating action as a real link', () => {
    host.action.set({id: 'edit', label: 'Edit', icon: MM_ACTION_ICONS.edit, link: {commands: ['/t', 'settings', 'x'], queryParams: {tab: 'secrets'}}});
    fixture.detectChanges();
    const a: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    expect(a.getAttribute('href')).toBe('/t/settings/x?tab=secrets');
    expect(a.getAttribute('aria-label')).toBe('Edit Encrypt run 17:09');
    expect(a.classList).toContain('mm-action-button');
    expect(a.classList).toContain('k-button');
    expect(a.classList).toContain('k-icon-button');
    expect(a.querySelector('svg')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('renders a disabled navigating action as a disabled button, not a link', () => {
    host.action.set({id: 'edit', label: 'Edit', icon: MM_ACTION_ICONS.edit, link: {commands: ['/x']}, disabledReason: 'No key ring'});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
    expect(button().getAttribute('aria-disabled')).toBe('true');
  });
});
