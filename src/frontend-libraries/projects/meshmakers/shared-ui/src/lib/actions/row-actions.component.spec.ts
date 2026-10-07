import {Component, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, Router, provideRouter} from '@angular/router';
import {RowActionsComponent} from './row-actions.component';
import {MM_ACTION_ICONS, MmAction, MmActionEvent} from './action.model';
import {expectIconButtonsAccessible} from '../../../testing/src/public-api';

@Component({
  standalone: true,
  imports: [RowActionsComponent],
  template: `<mm-row-actions [actions]="actions()" rowLabel="Mesh Adapter" (triggered)="events.push($event)" />`,
})
class HostComponent {
  readonly actions = signal<MmAction[]>([]);
  readonly events: MmActionEvent[] = [];
}

describe('RowActionsComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  const inlineButtons = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('mm-action-button button'));
  const moreButton = (): HTMLButtonElement | null => fixture.nativeElement.querySelector('kendo-dropdownbutton button');
  const component = (): RowActionsComponent => fixture.debugElement.children[0].componentInstance;

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [HostComponent], providers: [provideRouter([])]}).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
  });

  const set = (actions: MmAction[]): void => {
    host.actions.set(actions);
    fixture.detectChanges();
  };

  it('renders up to three icon buttons inline, named after the row', () => {
    set([
      {id: 'edit', label: 'Edit', icon: MM_ACTION_ICONS.edit},
      {id: 'copy', label: 'Copy id', icon: MM_ACTION_ICONS.copy},
      {id: 'delete', label: 'Delete', icon: MM_ACTION_ICONS.delete, danger: true},
    ]);
    expect(inlineButtons().map((b) => b.getAttribute('aria-label'))).toEqual(['Edit Mesh Adapter', 'Copy id Mesh Adapter', 'Delete Mesh Adapter']);
    expect(moreButton()).toBeNull();
    expect(fixture.nativeElement.querySelector('mm-row-actions').getAttribute('role')).toBe('group');
    expect(fixture.nativeElement.querySelector('mm-row-actions').getAttribute('aria-label')).toBe('Actions for Mesh Adapter');
  });

  it('passes the icon-button accessibility guard inline and with the overflow button (AB#5581)', () => {
    set([
      {id: 'edit', label: 'Edit', icon: MM_ACTION_ICONS.edit},
      {id: 'copy', label: 'Copy id', icon: MM_ACTION_ICONS.copy, disabledReason: 'No id'},
      {id: 'view', label: 'View', icon: MM_ACTION_ICONS.view},
      {id: 'delete', label: 'Delete', icon: MM_ACTION_ICONS.delete, danger: true},
    ]);
    expectIconButtonsAccessible(fixture);
  });

  it('moves the rest into a "More actions" menu when more than three are visible', () => {
    set([
      {id: 'edit', label: 'Edit', icon: MM_ACTION_ICONS.edit},
      {id: 'copy', label: 'Copy id', icon: MM_ACTION_ICONS.copy},
      {id: 'deploy', label: 'Deploy', icon: MM_ACTION_ICONS.deploy},
      {id: 'delete', label: 'Delete', icon: MM_ACTION_ICONS.delete, danger: true, disabledReason: 'Undeploy first'},
    ]);
    expect(inlineButtons().length).toBe(2);
    const more = moreButton()!;
    expect(more.getAttribute('aria-label')).toBe('More actions for Mesh Adapter');
    expect(more.getAttribute('title')).toBe('More actions for Mesh Adapter');
  });

  it('emits inline clicks', () => {
    set([{id: 'edit', label: 'Edit', icon: MM_ACTION_ICONS.edit}]);
    inlineButtons()[0].click();
    expect(host.events.map((e) => e.id)).toEqual(['edit']);
  });

  it('emits enabled menu items and ignores disabled ones', () => {
    const del: MmAction = {id: 'delete', label: 'Delete', icon: MM_ACTION_ICONS.delete, danger: true, overflow: true};
    set([{id: 'edit', label: 'Edit', icon: MM_ACTION_ICONS.edit}, del]);
    const c = component() as unknown as {onMenuItem(i: unknown): void};
    c.onMenuItem({text: 'Delete', disabled: true, action: del});
    expect(host.events).toEqual([]);
    c.onMenuItem({text: 'Delete', disabled: false, action: del});
    expect(host.events.map((e) => e.id)).toEqual(['delete']);
  });

  it('renders nothing for hidden actions', () => {
    set([{id: 'edit', label: 'Edit', icon: MM_ACTION_ICONS.edit, visible: false}]);
    expect(inlineButtons()).toEqual([]);
    expect(moreButton()).toBeNull();
  });

  it('navigates menu items that carry a link', () => {
    const open: MmAction = {id: 'open', label: 'Open', icon: MM_ACTION_ICONS.open, overflow: true, link: {commands: ['/a', 'b'], queryParams: {q: '1'}}};
    set([open]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (component() as unknown as {onMenuItem(i: unknown): void}).onMenuItem({text: 'Open', disabled: false, action: open});
    expect(navigate).toHaveBeenCalledWith(['/a', 'b'], expect.objectContaining({queryParams: {q: '1'}}));
    expect(host.events.map((e) => e.id)).toEqual(['open']);
  });

  it('resolves relative menu links against the hosting route, like the inline routerLink', () => {
    const relative: MmAction = {id: 'open', label: 'Open', overflow: true, link: {commands: ['details', '42']}};
    set([relative]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (component() as unknown as {onMenuItem(i: unknown): void}).onMenuItem({text: 'Open', disabled: false, action: relative});
    const route = fixture.debugElement.children[0].injector.get(ActivatedRoute);
    expect(navigate).toHaveBeenCalledWith(['details', '42'], {queryParams: undefined, relativeTo: route});
  });

  it('shows the menuLabel ("…") in the overflow menu but keeps the label for names', () => {
    set([{id: 'delete', label: 'Delete dump', menuLabel: 'Delete dump…', overflow: true}]);
    const items = (component() as unknown as {menuItems(): {text: string}[]}).menuItems();
    expect(items.map((i) => i.text)).toEqual(['Delete dump…']);
  });

  it('drops the group role and name when no action is rendered', () => {
    set([{id: 'edit', label: 'Edit', visible: false}]);
    const hostEl: HTMLElement = fixture.nativeElement.querySelector('mm-row-actions');
    expect(hostEl.getAttribute('role')).toBeNull();
    expect(hostEl.getAttribute('aria-label')).toBeNull();
  });
});
