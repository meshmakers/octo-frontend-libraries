import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { BreadCrumbService } from '@meshmakers/shared-services';
import { BehaviorSubject, Subject } from 'rxjs';
import {
  ASSISTANT_ENABLED,
  ASSISTANT_MESSAGES,
  ASSISTANT_PANEL_OPTIONS,
  ASSISTANT_TRANSPORT,
  AssistantPanelOptions,
  AssistantService,
  AssistantSessionSummary,
  AssistantThreadItem,
  DEFAULT_ASSISTANT_PANEL_STORAGE_KEY,
  FakeAssistantTransport
} from '@meshmakers/shared-ui/assistant-core';
import { AssistantPanelComponent } from './assistant-panel.component';

class SessionFileTransport extends FakeAssistantTransport {
  readonly sessions = signal<AssistantSessionSummary[]>([{ id: 's1', title: 'Invoices' }]);
  readonly activeSessionId = signal<string | null>(null);
  readonly attachments = { maxFiles: 2 };

  async loadSession(): Promise<AssistantThreadItem[]> {
    return [];
  }

  async deleteSession(): Promise<void> {
    // Nothing to do.
  }
}

describe('AssistantPanelComponent layout (AB#5621)', () => {
  let fixture: ComponentFixture<AssistantPanelComponent>;
  let element: HTMLElement;
  const originalInnerWidth = window.innerWidth;

  async function setup(options: {
    panelOptions?: AssistantPanelOptions;
    inputs?: Record<string, unknown>;
    messages?: object;
    transport?: FakeAssistantTransport;
  } = {}): Promise<void> {
    const root = { params: {}, firstChild: null } as unknown as ActivatedRouteSnapshot;
    await TestBed.configureTestingModule({
      imports: [AssistantPanelComponent],
      providers: [
        { provide: ASSISTANT_ENABLED, useValue: true },
        { provide: ASSISTANT_TRANSPORT, useValue: options.transport ?? new SessionFileTransport() },
        ...(options.panelOptions ? [{ provide: ASSISTANT_PANEL_OPTIONS, useValue: options.panelOptions }] : []),
        ...(options.messages ? [{ provide: ASSISTANT_MESSAGES, useValue: options.messages }] : []),
        { provide: Router, useValue: { events: new Subject(), url: '/t/x', routerState: { snapshot: { root } } } },
        { provide: BreadCrumbService, useValue: { breadCrumbItems: new BehaviorSubject([]) } }
      ]
    }).compileComponents();
    TestBed.inject(AssistantService).open();
    fixture = TestBed.createComponent(AssistantPanelComponent);
    for (const [name, value] of Object.entries(options.inputs ?? {})) {
      fixture.componentRef.setInput(name, value);
    }
    element = fixture.nativeElement as HTMLElement;
    document.body.appendChild(element);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    document.body.replaceChildren();
  });

  const handle = (): HTMLElement | null => element.querySelector<HTMLElement>('.resize-handle');
  const key = (target: HTMLElement, name: string, shiftKey = false): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };
  const pointer = (target: EventTarget, type: string, clientX: number): void => {
    const event = new MouseEvent(type, { clientX, button: 0, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    fixture.detectChanges();
  };

  describe('G11 header actions', () => {
    it('are icon buttons with tooltip and aria-label from the messages', async () => {
      await setup({ messages: { newChat: 'Neuer Chat', sessions: 'Chats', closeAssistant: 'Schließen' } });
      for (const [selector, label] of [['.new-chat', 'Neuer Chat'], ['.sessions-toggle', 'Chats'], ['.close', 'Schließen']]) {
        const button = element.querySelector<HTMLButtonElement>(`.head ${selector}`)!;
        expect(button.classList).toContain('icon-btn');
        expect(button.getAttribute('aria-label')).toBe(label);
        expect(button.title).toBe(label);
        expect(button.textContent?.trim()).toBe('');
        expect(button.querySelector('kendo-svg-icon svg')).not.toBeNull();
      }
    });
  });

  describe('G15 icons instead of ✕', () => {
    it('panel and composer contain no ✕ glyph; remove buttons carry an xIcon and a label', async () => {
      const transport = new SessionFileTransport();
      await setup({ transport });
      TestBed.inject(AssistantService).setDraftFiles([new File(['a'], 'a.pdf')]);
      fixture.detectChanges();
      expect(element.textContent).not.toContain('✕');
      const chipRemove = element.querySelector<HTMLButtonElement>('.ctx-chip button');
      if (chipRemove) {
        expect(chipRemove.getAttribute('aria-label')).toMatch(/^Remove context /);
        expect(chipRemove.querySelector('kendo-svg-icon')).not.toBeNull();
      }
      const fileRemove = element.querySelector<HTMLButtonElement>('.file button')!;
      expect(fileRemove.getAttribute('aria-label')).toBe('Remove attachment a.pdf');
      expect(fileRemove.querySelector('kendo-svg-icon svg')).not.toBeNull();
      expect(element.querySelector('.attach kendo-svg-icon')).not.toBeNull();
    });
  });

  describe('G14 resizing', () => {
    it('keeps the CSS width until resized and exposes an accessible separator', async () => {
      await setup();
      expect(element.style.width).toBe('');
      expect(element.getAttribute('data-mode')).toBe('docked');
      expect(element.classList).not.toContain('mm-assistant-overlay');
      const separator = handle()!;
      expect(separator.getAttribute('role')).toBe('separator');
      expect(separator.getAttribute('aria-orientation')).toBe('vertical');
      expect(separator.getAttribute('aria-controls')).toBe('assistant-panel');
      expect(separator.getAttribute('aria-label')).toBe('Resize assistant panel');
      expect(separator.tabIndex).toBe(0);
      expect(separator.getAttribute('aria-valuemin')).toBe('320');
      expect(separator.getAttribute('aria-valuemax')).toBe('720');
      expect(separator.getAttribute('aria-valuenow')).toBe('400');
    });

    it('resizes with the keyboard and keeps the width in localStorage', async () => {
      await setup();
      expect(key(handle()!, 'ArrowLeft').defaultPrevented).toBe(true);
      expect(element.style.width).toBe('416px');
      expect(handle()!.getAttribute('aria-valuenow')).toBe('416');
      expect(localStorage.getItem(DEFAULT_ASSISTANT_PANEL_STORAGE_KEY)).toBe('416');
      key(handle()!, 'ArrowRight', true);
      expect(element.style.width).toBe('352px');
      key(handle()!, 'End');
      expect(element.style.width).toBe('720px');
      key(handle()!, 'ArrowLeft');
      expect(element.style.width).toBe('720px');
      key(handle()!, 'Home');
      expect(element.style.width).toBe('320px');
      expect(key(handle()!, 'a').defaultPrevented).toBe(false);
    });

    it('resizes by dragging the handle (left widens) and stores the width on release', async () => {
      await setup();
      pointer(handle()!, 'pointerdown', 1000);
      expect(element.classList).toContain('mm-assistant-resizing');
      pointer(document, 'pointermove', 900);
      expect(element.style.width).toBe('500px');
      expect(localStorage.getItem(DEFAULT_ASSISTANT_PANEL_STORAGE_KEY)).toBeNull();
      pointer(document, 'pointermove', 100);
      expect(element.style.width).toBe('720px');
      pointer(document, 'pointerup', 100);
      expect(element.classList).not.toContain('mm-assistant-resizing');
      expect(localStorage.getItem(DEFAULT_ASSISTANT_PANEL_STORAGE_KEY)).toBe('720');
      pointer(document, 'pointermove', 1200);
      expect(element.style.width).toBe('720px');
    });

    it('restores the stored width (clamped) and forgets it on double click', async () => {
      localStorage.setItem(DEFAULT_ASSISTANT_PANEL_STORAGE_KEY, '9999');
      await setup();
      expect(element.style.width).toBe('720px');
      handle()!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      fixture.detectChanges();
      expect(element.style.width).toBe('');
      expect(localStorage.getItem(DEFAULT_ASSISTANT_PANEL_STORAGE_KEY)).toBeNull();
    });

    it('ignores an invalid stored width', async () => {
      localStorage.setItem(DEFAULT_ASSISTANT_PANEL_STORAGE_KEY, 'wide');
      await setup();
      expect(element.style.width).toBe('');
    });

    it('takes min, max and the storage key from the inputs over the options token', async () => {
      localStorage.setItem('host-key', '600');
      await setup({
        panelOptions: { minWidth: 100, maxWidth: 1000, storageKey: 'token-key' },
        inputs: { minWidth: 360, maxWidth: 560, storageKey: 'host-key' }
      });
      expect(element.style.width).toBe('560px');
      expect(handle()!.getAttribute('aria-valuemin')).toBe('360');
      key(handle()!, 'Home');
      expect(localStorage.getItem('host-key')).toBe('360');
      expect(localStorage.getItem('token-key')).toBeNull();
    });

    it('leaves at least 240 px of the window to the content', async () => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
      await setup();
      expect(handle()!.getAttribute('aria-valuemax')).toBe('560');
      key(handle()!, 'End');
      expect(element.style.width).toBe('560px');
    });

    it('does not persist with storageKey null', async () => {
      await setup({ panelOptions: { storageKey: null } });
      key(handle()!, 'ArrowLeft');
      expect(element.style.width).toBe('416px');
      expect(localStorage.length).toBe(0);
    });

    it('still resizes when storage is unavailable', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('SecurityError'); });
      await setup();
      expect(element.style.width).toBe('');
      key(handle()!, 'ArrowLeft');
      expect(element.style.width).toBe('416px');
      handle()!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      fixture.detectChanges();
      expect(element.style.width).toBe('');
    });

    it('has no handle when resizable is off (input wins over the token)', async () => {
      localStorage.setItem(DEFAULT_ASSISTANT_PANEL_STORAGE_KEY, '600');
      await setup({ panelOptions: { resizable: true }, inputs: { resizable: false } });
      expect(handle()).toBeNull();
      expect(element.style.width).toBe('');
    });

    describe('on phones', () => {
      const original = window.matchMedia;
      beforeEach(() => {
        window.matchMedia = ((query: string) => ({
          matches: query === '(max-width: 640px)', media: query,
          addEventListener: vi.fn(), removeEventListener: vi.fn()
        })) as unknown as typeof window.matchMedia;
      });
      afterEach(() => window.matchMedia = original);

      it('neither resizes nor overlays: the panel stays the full-screen dialog', async () => {
        localStorage.setItem(DEFAULT_ASSISTANT_PANEL_STORAGE_KEY, '600');
        await setup({ panelOptions: { mode: 'overlay' } });
        expect(handle()).toBeNull();
        expect(element.style.width).toBe('');
        expect(element.classList).not.toContain('mm-assistant-overlay');
      });
    });
  });

  describe('G14 overlay mode', () => {
    it('comes from the options token', async () => {
      await setup({ panelOptions: { mode: 'overlay' } });
      expect(element.classList).toContain('mm-assistant-overlay');
      expect(element.getAttribute('data-mode')).toBe('overlay');
    });

    it('the input wins over the token', async () => {
      await setup({ panelOptions: { mode: 'overlay' }, inputs: { mode: 'docked' } });
      expect(element.classList).not.toContain('mm-assistant-overlay');
    });
  });
});
