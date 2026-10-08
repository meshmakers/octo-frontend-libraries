import { TestBed } from '@angular/core/testing';
import { CommandPaletteService, paletteHotkeyAction } from './command-palette.service';

describe('CommandPaletteService', () => {
  let service: CommandPaletteService;

  beforeEach(() => {
    service = TestBed.inject(CommandPaletteService);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('opens with an initial query and closes', () => {
    expect(service.isOpen()).toBe(false);
    service.open('>');
    expect(service.isOpen()).toBe(true);
    expect(service.request().query).toBe('>');
    service.close();
    expect(service.isOpen()).toBe(false);
  });

  it('replaces the query when opened again while open', () => {
    service.open();
    const first = service.request();
    service.open('/');
    expect(service.request()).not.toBe(first);
    expect(service.request().query).toBe('/');
  });

  it('toggles', () => {
    service.toggle('#');
    expect(service.isOpen()).toBe(true);
    expect(service.request().query).toBe('#');
    service.toggle();
    expect(service.isOpen()).toBe(false);
  });

  it('returns focus to the element that had it', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    service.open();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    service.close();
    expect(document.activeElement).toBe(trigger);
  });

  it('does not fail when the invoking element is gone', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    service.open();
    trigger.remove();
    expect(() => service.close()).not.toThrow();
  });
});

describe('paletteHotkeyAction', () => {
  function keydown(init: KeyboardEventInit, target: Element = document.body): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    Object.defineProperty(event, 'target', { value: target });
    return event;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('toggles on Cmd+K and Ctrl+K', () => {
    expect(paletteHotkeyAction(keydown({ key: 'k', metaKey: true }), false)).toBe('toggle');
    expect(paletteHotkeyAction(keydown({ key: 'K', ctrlKey: true }), true)).toBe('toggle');
  });

  it('ignores K with other modifier combinations or without one', () => {
    expect(paletteHotkeyAction(keydown({ key: 'k' }), false)).toBeNull();
    expect(paletteHotkeyAction(keydown({ key: 'k', metaKey: true, shiftKey: true }), false)).toBeNull();
    expect(paletteHotkeyAction(keydown({ key: 'k', ctrlKey: true, altKey: true }), false)).toBeNull();
  });

  it('leaves Cmd+K to a Monaco editor', () => {
    const editor = document.createElement('div');
    editor.className = 'monaco-editor';
    const textarea = document.createElement('textarea');
    editor.appendChild(textarea);
    document.body.appendChild(editor);
    expect(paletteHotkeyAction(keydown({ key: 'k', metaKey: true }, textarea), false)).toBeNull();
  });

  it('works from a plain input (e.g. a grid filter)', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    expect(paletteHotkeyAction(keydown({ key: 'k', ctrlKey: true }, input), false)).toBe('toggle');
  });

  it('opens on / only outside text fields and only when closed', () => {
    expect(paletteHotkeyAction(keydown({ key: '/' }), false)).toBe('open');
    expect(paletteHotkeyAction(keydown({ key: '/' }), true)).toBeNull();
    const input = document.createElement('input');
    document.body.appendChild(input);
    expect(paletteHotkeyAction(keydown({ key: '/' }, input), false)).toBeNull();
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.appendChild(editable);
    expect(paletteHotkeyAction(keydown({ key: '/' }, editable), false)).toBeNull();
  });

  it('does not open on / from text roles, grids or Kendo widgets', () => {
    const targets = ['combobox', 'searchbox', 'spinbutton', 'textbox'].map(role => {
      const element = document.createElement('div');
      element.setAttribute('role', role);
      return element;
    });
    const grid = document.createElement('div');
    grid.setAttribute('role', 'grid');
    const cell = document.createElement('td');
    cell.setAttribute('role', 'gridcell');
    grid.appendChild(cell);
    const kendoGrid = document.createElement('div');
    kendoGrid.className = 'k-grid';
    const kendoInner = document.createElement('span');
    kendoGrid.appendChild(kendoInner);
    const widget = document.createElement('span');
    widget.className = 'k-widget k-dropdownlist';
    document.body.append(...targets, grid, kendoGrid, widget);
    for (const target of [...targets, cell, kendoInner, widget]) {
      expect(paletteHotkeyAction(keydown({ key: '/' }, target), false)).toBeNull();
    }
    // Cmd+K still works from a grid
    expect(paletteHotkeyAction(keydown({ key: 'k', metaKey: true }, cell), false)).toBe('toggle');
  });

  it('ignores events another handler consumed', () => {
    const event = keydown({ key: 'k', metaKey: true });
    event.preventDefault();
    expect(paletteHotkeyAction(event, false)).toBeNull();
  });
});
