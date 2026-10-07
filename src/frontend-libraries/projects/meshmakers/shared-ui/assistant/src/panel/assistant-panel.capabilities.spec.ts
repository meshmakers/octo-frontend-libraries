import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { BreadCrumbService } from '@meshmakers/shared-services';
import { BehaviorSubject, Subject } from 'rxjs';
import {
  ASSISTANT_ENABLED,
  ASSISTANT_MESSAGES,
  ASSISTANT_TRANSPORT,
  AssistantSessionSummary,
  AssistantService,
  AssistantThreadItem,
  FakeAssistantTransport
} from '@meshmakers/shared-ui/assistant-core';
import { AssistantPanelComponent } from './assistant-panel.component';

class SessionTransport extends FakeAssistantTransport {
  readonly sessions = signal<AssistantSessionSummary[]>([
    { id: 's1', title: 'Invoices', createdAt: '2026-10-01T10:00:00Z' },
    { id: 's2', title: 'VAT' }
  ]);
  readonly activeSessionId = signal<string | null>('s2');
  refreshCalls = 0;
  deleted: string[] = [];
  newSessions = 0;

  async refreshSessions(): Promise<void> {
    this.refreshCalls += 1;
  }

  async loadSession(id: string): Promise<AssistantThreadItem[]> {
    this.activeSessionId.set(id);
    return [{ kind: 'user', id: `${id}:0`, text: `restored ${id}` }];
  }

  async deleteSession(id: string): Promise<void> {
    this.deleted.push(id);
    this.sessions.update(list => list.filter(s => s.id !== id));
  }

  newSession(): void {
    this.newSessions += 1;
    this.activeSessionId.set(null);
  }
}

class StarterTransport extends FakeAssistantTransport {
  readonly attachments = { accept: 'application/pdf', maxFiles: 1 };
  starterCalls = 0;
  starterQuestions(): string[] {
    this.starterCalls += 1;
    return ['What is open?', 'Show the VAT summary'];
  }
}

describe('AssistantPanelComponent optional capabilities (AB#5621)', () => {
  let fixture: ComponentFixture<AssistantPanelComponent>;
  let element: HTMLElement;
  let assistant: AssistantService;

  async function setup(transport: FakeAssistantTransport, messages?: object): Promise<void> {
    const root = { params: {}, firstChild: null } as unknown as ActivatedRouteSnapshot;
    await TestBed.configureTestingModule({
      imports: [AssistantPanelComponent],
      providers: [
        { provide: ASSISTANT_ENABLED, useValue: true },
        { provide: ASSISTANT_TRANSPORT, useValue: transport },
        ...(messages ? [{ provide: ASSISTANT_MESSAGES, useValue: messages }] : []),
        { provide: Router, useValue: { events: new Subject(), url: '/t/x', routerState: { snapshot: { root } } } },
        { provide: BreadCrumbService, useValue: { breadCrumbItems: new BehaviorSubject([]) } }
      ]
    }).compileComponents();
    assistant = TestBed.inject(AssistantService);
    assistant.open();
    fixture = TestBed.createComponent(AssistantPanelComponent);
    element = fixture.nativeElement as HTMLElement;
    document.body.appendChild(element);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => document.body.replaceChildren());

  const button = (selector: string): HTMLButtonElement | null => element.querySelector<HTMLButtonElement>(selector);

  it('a transport without the optional members shows no session, starter or attachment UI', async () => {
    await setup(new FakeAssistantTransport());
    expect(button('.new-chat')).toBeNull();
    expect(button('.sessions-toggle')).toBeNull();
    expect(element.querySelector('.sessions')).toBeNull();
    expect(element.querySelector('.starters')).toBeNull();
    expect(button('.attach')).toBeNull();
    expect(element.querySelector('input[type="file"]')).toBeNull();
  });

  describe('sessions', () => {
    it('lists the saved chats, marks the active one and opens a chat into the thread', async () => {
      const transport = new SessionTransport();
      await setup(transport);
      const toggle = button('.sessions-toggle')!;
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(toggle.getAttribute('aria-controls')).toBe('assistant-sessions');
      toggle.click();
      await settle();
      expect(transport.refreshCalls).toBe(1);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(element.querySelector('mm-assistant-thread')).toBeNull();
      const rows = Array.from(element.querySelectorAll('.session-row'));
      expect(rows.map(r => r.querySelector('.session-title')!.textContent)).toEqual(['Invoices', 'VAT']);
      expect(rows[1].querySelector('.session-open')!.getAttribute('aria-current')).toBe('true');
      expect(rows[0].querySelector('.session-open')!.getAttribute('aria-current')).toBeNull();
      expect(rows[0].querySelector('.session-date')).not.toBeNull();
      expect(rows[1].querySelector('.session-date')).toBeNull();
      expect(document.activeElement?.classList.contains('session-open')).toBe(true);

      rows[0].querySelector<HTMLButtonElement>('.session-open')!.click();
      await settle();
      expect(element.querySelector('.sessions')).toBeNull();
      expect(assistant.thread()).toEqual([{ kind: 'user', id: 's1:0', text: 'restored s1' }]);
      expect(document.activeElement).toBe(element.querySelector('textarea'));
    });

    it('deletes a chat only after the inline confirmation', async () => {
      const transport = new SessionTransport();
      await setup(transport);
      button('.sessions-toggle')!.click();
      await settle();
      const del = element.querySelector<HTMLButtonElement>('.session-row .session-delete')!;
      expect(del.getAttribute('aria-label')).toBe('Delete chat Invoices');
      del.click();
      await settle();
      expect(transport.deleted).toEqual([]);
      const confirm = element.querySelector('.session-confirm')!;
      expect(confirm.getAttribute('role')).toBe('group');
      expect(confirm.textContent).toContain('Delete “Invoices”?');
      expect(document.activeElement).toBe(confirm.querySelector('.confirm-delete'));
      confirm.querySelector<HTMLButtonElement>('.confirm-delete')!.click();
      await settle();
      expect(transport.deleted).toEqual(['s1']);
      expect(Array.from(element.querySelectorAll('.session-title')).map(t => t.textContent)).toEqual(['VAT']);
    });

    it('Esc cancels the confirmation, then returns to the chat, then closes', async () => {
      await setup(new SessionTransport());
      button('.sessions-toggle')!.click();
      await settle();
      element.querySelector<HTMLButtonElement>('.session-delete')!.click();
      await settle();
      const esc = (): void => {
        (document.activeElement ?? element).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        fixture.detectChanges();
      };
      esc();
      await settle();
      expect(element.querySelector('.session-confirm')).toBeNull();
      expect(element.querySelector('.sessions')).not.toBeNull();
      esc();
      await settle();
      expect(element.querySelector('.sessions')).toBeNull();
      expect(assistant.isOpen()).toBe(true);
      esc();
      expect(assistant.isOpen()).toBe(false);
    });

    it('New chat empties the thread and tells the transport', async () => {
      const transport = new SessionTransport();
      await setup(transport);
      assistant.loadThread([{ kind: 'user', id: 'u', text: 'old' }]);
      button('.new-chat')!.click();
      await settle();
      expect(transport.newSessions).toBe(1);
      expect(assistant.thread()).toEqual([]);
    });

    it('has no delete buttons when the transport cannot delete', async () => {
      const transport = new SessionTransport() as SessionTransport & { deleteSession?: unknown };
      Object.defineProperty(transport, 'deleteSession', { value: undefined });
      await setup(transport);
      button('.sessions-toggle')!.click();
      await settle();
      expect(element.querySelectorAll('.session-row').length).toBe(2);
      expect(element.querySelector('.session-delete')).toBeNull();
    });

    it('says when there are no saved chats (translated)', async () => {
      const transport = new SessionTransport();
      transport.sessions.set([]);
      await setup(transport, { noSessions: 'Noch keine Chats', sessions: 'Verlauf' });
      expect(button('.sessions-toggle')!.textContent?.trim()).toBe('Verlauf');
      button('.sessions-toggle')!.click();
      await settle();
      expect(element.querySelector('.session-empty')!.textContent).toBe('Noch keine Chats');
    });
  });

  describe('starter questions', () => {
    it('shows them on an empty thread and sends the clicked one', async () => {
      const transport = new StarterTransport();
      await setup(transport);
      const starters = Array.from(element.querySelectorAll<HTMLButtonElement>('.starter'));
      expect(starters.map(s => s.textContent)).toEqual(['What is open?', 'Show the VAT summary']);
      expect(element.querySelector('.starters-title')!.textContent).toBe('Try asking');
      starters[1].click();
      fixture.detectChanges();
      expect(transport.requests.map(r => r.text)).toEqual(['Show the VAT summary']);
      expect(element.querySelector('.starters')).toBeNull();
    });

    it('asks the transport once per opening, not again when an entry point re-focuses the open panel', async () => {
      const transport = new StarterTransport();
      await setup(transport);
      expect(transport.starterCalls).toBe(1);
      assistant.open({ prompt: 'again' });
      await settle();
      expect(transport.starterCalls).toBe(1);
      // The host renders the panel only while open: closing and reopening creates it anew.
      fixture.destroy();
      assistant.close();
      assistant.open();
      const reopened = TestBed.createComponent(AssistantPanelComponent);
      reopened.detectChanges();
      await reopened.whenStable();
      expect(transport.starterCalls).toBe(2);
      reopened.destroy();
    });

    it('disables them while the transport is not ready', async () => {
      const transport = new StarterTransport();
      transport.status.set('unavailable');
      await setup(transport);
      expect(Array.from(element.querySelectorAll<HTMLButtonElement>('.starter')).every(s => s.disabled)).toBe(true);
    });
  });

  describe('attachments', () => {
    it('sends the attached file with the turn through the transport', async () => {
      const transport = new StarterTransport();
      await setup(transport);
      const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
      const pdf = new File(['%PDF'], 'invoice.pdf', { type: 'application/pdf' });
      Object.defineProperty(input, 'files', { value: [pdf], configurable: true });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(assistant.draftFiles()).toEqual([pdf]);
      element.querySelector<HTMLButtonElement>('.send')!.click();
      fixture.detectChanges();
      expect(transport.requests[0].files).toEqual([pdf]);
      expect(assistant.draftFiles()).toEqual([]);
      expect(element.querySelector('mm-assistant-thread .attachment')!.textContent).toBe('invoice.pdf');
    });
  });
});
