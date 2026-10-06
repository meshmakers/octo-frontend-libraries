import {Component, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {RowActionsComponent} from './row-actions.component';
import {MM_ACTION_ICONS, MmAction, MmActionEvent} from './action.model';

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
    await TestBed.configureTestingModule({imports: [HostComponent]}).compileComponents();
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
});
