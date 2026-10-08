import { Component, Directive, forwardRef, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { CommandItem, CommandSettingsService } from '@meshmakers/shared-services';
import { copyIcon, eyeIcon, pencilIcon, trashIcon } from '@progress/kendo-svg-icons';
import { Observable, of } from 'rxjs';

import { ListViewComponent, RowActionsView } from './list-view.component';
import { MmListRowAction, MmListRowActionEvent, resolveListRowAction, resolveListRowLabel, sameAction } from './list-view-row-actions';
import { TableColumn } from './list-view.model';
import { DataSourceBase, FetchDataOptions } from '../data-sources/data-source-base';
import { FetchResult, FetchResultBase } from '../models/fetchResult';
import { expectIconButtonsAccessible, findInaccessibleIconButtons } from '../../../testing/src/public-api';

interface Row { name: string; deployed: boolean }
const ROWS: Row[] = [
  { name: 'alpha', deployed: false },
  { name: 'beta', deployed: true },
];

@Directive({
  selector: '[mmTestRowActionsDs]',
  standalone: true,
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => StaticDataSourceDirective) }],
})
class StaticDataSourceDirective extends DataSourceBase {
  constructor() {
    super(inject(ListViewComponent));
  }

  public fetchData(_options: FetchDataOptions): Observable<FetchResult | null> {
    return of(new FetchResultBase(ROWS, ROWS.length));
  }
}

@Component({
  standalone: true,
  imports: [ListViewComponent, StaticDataSourceDirective],
  template: `
    <div style="height: 600px; display: flex;">
      <mm-list-view mmTestRowActionsDs [columns]="columns" [actionCommandItems]="commandItems"
                    [contextMenuCommandItems]="contextItems" [rowActions]="rowActions"
                    (rowAction)="events.push($event)" style="flex: 1"></mm-list-view>
    </div>
  `,
})
class HostComponent {
  columns: TableColumn[] = [{ field: 'name', displayName: 'Name', dataType: 'text' }];
  commandItems: CommandItem[] = [];
  contextItems: CommandItem[] = [];
  rowActions: MmListRowAction<Row>[] = [];
  events: MmListRowActionEvent[] = [];
}

/**
 * Row actions of mm-list-view on the shared action model (AB#5572): CommandItem adapter, max 3 slots,
 * neutral icons (danger only for destructive actions), focusable disabled actions with reason, and the
 * MmAction-based `rowActions` input with `(rowAction)`.
 */
describe('ListViewComponent row actions (AB#5572)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let clicked: string[];

  async function render(configure: (host: HostComponent) => void): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: CommandSettingsService, useValue: { navigateRelativeToRoute: {}, commandItems: [] } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    configure(fixture.componentInstance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const firstRow = (): HTMLElement => el().querySelector<HTMLElement>('tr.k-master-row')!;
  const rowButtons = (row: HTMLElement = firstRow()): HTMLElement[] =>
    Array.from(row.querySelectorAll<HTMLElement>('.mm-list-view-row-actions button, .mm-list-view-row-actions a'));
  const listView = (): ListViewComponent => fixture.debugElement.children[0].children[0].componentInstance as ListViewComponent;
  const item = (id: string, extra: Partial<CommandItem> = {}): CommandItem => ({
    id, type: 'link', text: id[0].toUpperCase() + id.slice(1), svgIcon: pencilIcon,
    onClick: async () => { clicked.push(id); }, ...extra,
  });

  beforeEach(() => {
    clicked = [];
  });

  it('renders CommandItems as neutral icon buttons named after the row; danger only for destructive ones', async () => {
    await render((host) => {
      host.commandItems = [item('edit'), item('delete', { svgIcon: trashIcon, danger: true })];
    });
    const [edit, del] = rowButtons();
    expect(edit.getAttribute('aria-label')).toBe('Edit alpha');
    expect(edit.getAttribute('title')).toBe('Edit');
    expect(edit.className).toContain('k-button-base');
    expect(edit.className).not.toContain('k-button-primary');
    expect(del.className).toContain('k-button-error');
    expect(firstRow().querySelector('.mm-list-view-row-actions')?.getAttribute('aria-label')).toBe('Actions for alpha');
    edit.click();
    await fixture.whenStable();
    expect(clicked).toEqual(['edit']);
  });

  it('shows at most 3 slots: 2 inline actions + "…" holding the rest', async () => {
    await render((host) => {
      host.commandItems = [item('edit'), item('view', { svgIcon: eyeIcon }), item('copy', { svgIcon: copyIcon }), item('delete', { danger: true })];
    });
    const buttons = rowButtons();
    expect(buttons.length).toBe(3);
    expect(buttons.map((b) => b.getAttribute('data-action'))).toEqual(['edit', 'view', 'more']);
    expect(buttons[2].getAttribute('aria-label')).toBe('Actions for alpha');

    const view = (listView() as unknown as { rowActionsView(r: unknown): RowActionsView }).rowActionsView(ROWS[0]);
    expect(view.menu.map((e) => e.action.id)).toEqual(['copy', 'delete']);
  });

  it('keeps 3 inline actions without a menu, and adds "…" for context menu items', async () => {
    await render((host) => {
      host.commandItems = [item('edit'), item('view'), item('copy')];
    });
    expect(rowButtons().map((b) => b.getAttribute('data-action'))).toEqual(['edit', 'view', 'copy']);
  });

  it('puts overflowing actions first in the "…" menu, then the context menu items; selecting one runs it', async () => {
    await render((host) => {
      host.commandItems = [item('edit'), item('view'), item('copy')];
      host.contextItems = [item('export')];
    });
    const lv = listView() as unknown as {
      onContextMenu(row: unknown, e: unknown): void;
      _contextMenuItems: { text?: string; separator?: boolean; data?: unknown }[];
      onContextMenuSelect(e: unknown): Promise<void>;
    };
    lv.onContextMenu(ROWS[0], { pageX: 0, pageY: 0 });
    expect(lv._contextMenuItems.map((i) => i.separator ? '---' : i.text)).toEqual(['Copy', '---', 'Export']);
    await lv.onContextMenuSelect({ item: { data: lv._contextMenuItems[0] } });
    expect(clicked).toEqual(['copy']);
  });

  it('keeps disabled actions focusable, announces the reason and swallows clicks', async () => {
    await render((host) => {
      host.commandItems = [item('delete', {
        danger: true, isDisabled: (row) => (row as Row).deployed,
        disabledReason: (row) => `${(row as Row).name} is deployed`,
      })];
    });
    const secondRow = el().querySelectorAll<HTMLElement>('tr.k-master-row')[1];
    const [del] = rowButtons(secondRow);
    expect(del.hasAttribute('disabled')).toBe(false);
    expect(del.getAttribute('aria-disabled')).toBe('true');
    expect(del.getAttribute('title')).toBe('Delete — beta is deployed');
    const reason = secondRow.querySelector(`#${del.getAttribute('aria-describedby')}`);
    expect(reason?.textContent?.trim()).toBe('beta is deployed');
    del.click();
    await fixture.whenStable();
    expect(clicked).toEqual([]);
    // Row alpha is not deployed: enabled.
    expect(rowButtons()[0].getAttribute('aria-disabled')).toBeNull();
  });

  it('uses a generic reason for CommandItems disabled without disabledReason', async () => {
    await render((host) => {
      host.commandItems = [item('edit', { isDisabled: true })];
    });
    expect(rowButtons()[0].getAttribute('title')).toBe('Edit — Not available for this row');
  });

  it('renders MmAction-based rowActions with per-row state and emits (rowAction) + run', async () => {
    const run = vi.fn();
    await render((host) => {
      host.rowActions = [
        { id: 'delete', label: 'Delete adapter', menuLabel: 'Delete adapter…', icon: trashIcon, danger: true, run,
          disabledReason: (row) => row.deployed ? 'Undeploy first' : null },
        { id: 'hidden', label: 'Hidden', icon: eyeIcon, visible: (row) => row.deployed },
      ];
    });
    const [del, ...rest] = rowButtons();
    expect(rest.length).toBe(0);
    expect(del.getAttribute('aria-label')).toBe('Delete adapter alpha');
    del.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.events.map((e) => [e.id, (e.row as Row).name])).toEqual([['delete', 'alpha']]);
    expect(run).toHaveBeenCalledWith(ROWS[0]);
    const secondRow = el().querySelectorAll<HTMLElement>('tr.k-master-row')[1];
    expect(rowButtons(secondRow).map((b) => b.getAttribute('data-action'))).toEqual(['delete', 'hidden']);
  });

  it('keeps the resolved row actions stable across change detection (no NG0100)', async () => {
    await render((host) => {
      host.rowActions = [{ id: 'edit', label: 'Edit', icon: pencilIcon, disabledReason: () => null }];
    });
    const lv = listView() as unknown as { rowActionsView(r: unknown): RowActionsView };
    expect(lv.rowActionsView(ROWS[0])).toBe(lv.rowActionsView(ROWS[0]));
  });

  it('sizes the actions column for the slots, not for every action', async () => {
    await render((host) => {
      host.commandItems = [item('a'), item('b'), item('c'), item('d'), item('e')];
    });
    const lv = listView() as unknown as { maxActionButtons: number };
    expect(lv.maxActionButtons).toBe(3);
  });

  it('passes the icon-button accessibility guard (AB#5581)', async () => {
    await render((host) => {
      host.commandItems = [item('edit'), item('view'), item('copy'), item('delete', { danger: true })];
    });
    expectIconButtonsAccessible(fixture);
  });
});

describe('list-view row action model (AB#5572)', () => {
  it('resolves per-row callbacks and drops run', () => {
    const resolved = resolveListRowAction(
      { id: 'x', label: 'X', disabledReason: (r: { a: number }) => (r.a ? 'busy' : null), visible: () => false, run: () => undefined },
      { a: 1 });
    expect(resolved).toEqual({ id: 'x', label: 'X', disabledReason: 'busy', visible: false, link: undefined });
  });

  it('compares actions structurally', () => {
    expect(sameAction({ id: 'a', label: 'A', link: { commands: ['x'] } }, { id: 'a', label: 'A', link: { commands: ['x'] } })).toBe(true);
    expect(sameAction({ id: 'a', label: 'A' }, { id: 'a', label: 'A', disabledReason: 'r' })).toBe(false);
  });
});

describe('expectIconButtonsAccessible (AB#5581)', () => {
  function dom(html: string): HTMLElement {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
  }

  it('fails for icon-only buttons without aria-label or tooltip', () => {
    const root = dom(`
      <button title="Edit"><svg></svg></button>
      <button aria-label="Delete x"><svg></svg></button>
      <button><span class="k-svg-icon"></span></button>`);
    expect(findInaccessibleIconButtons(root).length).toBe(3);
    expect(() => expectIconButtonsAccessible(root)).toThrow(/3 inaccessible icon-only button/);
  });

  it('accepts named icon buttons, text buttons and the tooltip opt-out', () => {
    expect(() => expectIconButtonsAccessible(dom(`
      <button title="Edit" aria-label="Edit alpha"><svg></svg></button>
      <button><svg></svg> Save</button>
      <a class="k-button" title="Open" aria-labelledby="l1"><svg></svg></a><span id="l1">Open alpha</span>`))).not.toThrow();
    expect(findInaccessibleIconButtons(dom('<button aria-label="Edit"><svg></svg></button>'), { requireTooltip: false })).toEqual([]);
  });
});

describe('resolveListRowLabel (AB#5623)', () => {
  it('reads the field, then rtWellKnownName, then rtId', () => {
    expect(resolveListRowLabel({ title: 'T', rtId: 'x' }, 'title')).toBe('T');
    expect(resolveListRowLabel({ title: ' ', rtWellKnownName: 'wk', rtId: 'x' }, 'title')).toBe('wk');
    expect(resolveListRowLabel({ rtId: 'x' }, 'title')).toBe('x');
    expect(resolveListRowLabel(null, 'title')).toBe('');
  });

  it('reads dotted paths; a flat key with dots wins', () => {
    expect(resolveListRowLabel({ contact: { displayName: 'Sebastian' } }, 'contact.displayName')).toBe('Sebastian');
    expect(resolveListRowLabel({ 'contact.displayName': 'flat', contact: { displayName: 'nested' } }, 'contact.displayName')).toBe('flat');
  });

  it('skips object values and honours explicit fallbacks', () => {
    expect(resolveListRowLabel({ name: { a: 1 }, rtId: 'x' }, 'name')).toBe('x');
    expect(resolveListRowLabel({ rtId: 'x' }, 'name', [])).toBe('');
  });
});
