import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { BreadCrumbService } from '@meshmakers/shared-services';
import { BehaviorSubject, EMPTY, Subject, of, throwError } from 'rxjs';
import { ASSISTANT_ENABLED, ASSISTANT_TRANSPORT, AssistantAttachmentOptions, AssistantSessionSummary, AssistantThreadItem } from './assistant.models';
import { AssistantService } from './assistant.service';
import { FakeAssistantTransport } from './testing/fake-assistant-transport';

/** A transport with every optional capability (AB#5621). */
class CapableTransport extends FakeAssistantTransport {
  readonly sessions = signal<AssistantSessionSummary[]>([]);
  readonly activeSessionId = signal<string | null>(null);
  readonly attachments: AssistantAttachmentOptions = { accept: 'application/pdf', maxFiles: 1 };
  starters: readonly string[] | Promise<readonly string[]> = ['What is open?', 'Show the VAT summary'];
  refreshCalls = 0;
  newSessionCalls = 0;
  deleted: string[] = [];
  failLoad = false;
  failDelete = false;

  starterQuestions(): readonly string[] | Promise<readonly string[]> {
    return this.starters;
  }

  async refreshSessions(): Promise<void> {
    this.refreshCalls += 1;
    this.sessions.set([{ id: 's1', title: 'Invoices', createdAt: '2026-10-01T10:00:00Z' }, { id: 's2', title: 'VAT' }]);
  }

  loadSession(id: string) {
    if (this.failLoad) {
      return throwError(() => new Error('boom'));
    }
    this.activeSessionId.set(id);
    const items: AssistantThreadItem[] = [
      { kind: 'user', id: `${id}:0`, text: 'Hi' },
      { kind: 'assistant', id: `${id}:1`, markdown: 'Hello', streaming: false }
    ];
    return of(items);
  }

  async deleteSession(id: string): Promise<void> {
    if (this.failDelete) {
      throw new Error('nope');
    }
    this.deleted.push(id);
    if (this.activeSessionId() === id) {
      this.activeSessionId.set(null);
    }
  }

  newSession(): void {
    this.newSessionCalls += 1;
    this.activeSessionId.set(null);
  }
}

describe('AssistantService optional transport capabilities (AB#5621)', () => {
  function setup(transport: FakeAssistantTransport, enabled = true): AssistantService {
    const root = { params: {}, firstChild: null } as unknown as ActivatedRouteSnapshot;
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { events: new Subject(), url: '/t/x', routerState: { snapshot: { root } } } },
        { provide: ASSISTANT_ENABLED, useValue: enabled },
        { provide: ASSISTANT_TRANSPORT, useValue: transport },
        { provide: BreadCrumbService, useValue: { breadCrumbItems: new BehaviorSubject([]) } }
      ]
    });
    return TestBed.inject(AssistantService);
  }

  describe('a transport without the optional members', () => {
    it('reports no capabilities and the new entry points are inert', async () => {
      const transport = new FakeAssistantTransport();
      const assistant = setup(transport);
      expect(assistant.sessionsSupported).toBe(false);
      expect(assistant.sessionDeleteSupported).toBe(false);
      expect(assistant.sessions()).toEqual([]);
      expect(assistant.activeSessionId()).toBeNull();
      expect(assistant.attachments).toBeNull();
      assistant.loadStarterQuestions();
      expect(assistant.starterQuestions()).toEqual([]);
      expect(await assistant.refreshSessions()).toBe(false);
      expect(await assistant.openSession('s1')).toBe(false);
      expect(await assistant.deleteSession('s1')).toBe(false);
    });

    it('ignores files: they are neither kept nor sent', () => {
      const transport = new FakeAssistantTransport();
      const assistant = setup(transport);
      const pdf = new File(['x'], 'a.pdf', { type: 'application/pdf' });
      assistant.setDraftFiles([pdf]);
      expect(assistant.draftFiles()).toEqual([]);
      expect(assistant.send('', [pdf])).toBe(false);
      expect(assistant.send('Hi', [pdf])).toBe(true);
      expect(transport.requests[0]).toEqual({ text: 'Hi', context: [] });
      expect('files' in transport.requests[0]).toBe(false);
    });

    it('newThread still empties the thread', () => {
      const transport = new FakeAssistantTransport();
      const assistant = setup(transport);
      assistant.send('Hi');
      transport.complete();
      expect(assistant.thread().length).toBe(1);
      assistant.newThread();
      expect(assistant.thread()).toEqual([]);
    });
  });

  describe('sessions', () => {
    it('lists, opens and replaces the thread with the loaded session', async () => {
      const transport = new CapableTransport();
      const assistant = setup(transport);
      expect(assistant.sessionsSupported).toBe(true);
      expect(assistant.sessionDeleteSupported).toBe(true);
      expect(await assistant.refreshSessions()).toBe(true);
      expect(assistant.sessions().map(s => s.id)).toEqual(['s1', 's2']);
      assistant.send('pending');
      expect(await assistant.openSession('s1')).toBe(true);
      expect(assistant.sending()).toBe(false);
      expect(assistant.thread().map(i => i.id)).toEqual(['s1:0', 's1:1']);
      expect(assistant.activeSessionId()).toBe('s1');
    });

    it('adds an error row and keeps the thread when a session cannot be opened', async () => {
      const transport = new CapableTransport();
      transport.failLoad = true;
      const assistant = setup(transport);
      expect(await assistant.openSession('s1')).toBe(false);
      expect(assistant.thread()).toEqual([expect.objectContaining({ kind: 'error', text: 'The chat could not be opened.' })]);
    });

    it('deleting the active session empties the thread; deleting another keeps it', async () => {
      const transport = new CapableTransport();
      const assistant = setup(transport);
      await assistant.openSession('s1');
      expect(await assistant.deleteSession('s2')).toBe(true);
      expect(assistant.thread().length).toBe(2);
      expect(await assistant.deleteSession('s1')).toBe(true);
      expect(assistant.thread()).toEqual([]);
      expect(transport.deleted).toEqual(['s2', 's1']);
    });

    it('reports a failed delete as an error row', async () => {
      const transport = new CapableTransport();
      transport.failDelete = true;
      const assistant = setup(transport);
      expect(await assistant.deleteSession('s1')).toBe(false);
      expect(assistant.thread()).toEqual([expect.objectContaining({ kind: 'error', text: 'The chat could not be deleted.' })]);
    });

    it('newThread tells the transport and clears thread and files', async () => {
      const transport = new CapableTransport();
      const assistant = setup(transport);
      await assistant.openSession('s1');
      assistant.setDraftFiles([new File(['x'], 'a.pdf', { type: 'application/pdf' })]);
      assistant.newThread();
      expect(transport.newSessionCalls).toBe(1);
      expect(assistant.thread()).toEqual([]);
      expect(assistant.draftFiles()).toEqual([]);
      expect(assistant.activeSessionId()).toBeNull();
    });

    it('a slower earlier session load does not overwrite a later one', async () => {
      const transport = new CapableTransport();
      const slow = new Subject<AssistantThreadItem[]>();
      const original = transport.loadSession.bind(transport);
      transport.loadSession = (id: string) => (id === 's1' ? slow.asObservable() : original(id));
      const assistant = setup(transport);
      const first = assistant.openSession('s1');
      expect(await assistant.openSession('s2')).toBe(true);
      slow.next([{ kind: 'user', id: 'stale', text: 'old' }]);
      slow.complete();
      expect(await first).toBe(false);
      expect(assistant.thread().map(i => i.id)).toEqual(['s2:0', 's2:1']);
    });

    it('a stale failing session load adds no error row', async () => {
      const transport = new CapableTransport();
      const slow = new Subject<AssistantThreadItem[]>();
      const original = transport.loadSession.bind(transport);
      transport.loadSession = (id: string) => (id === 's1' ? slow.asObservable() : original(id));
      const assistant = setup(transport);
      const first = assistant.openSession('s1');
      assistant.newThread();
      slow.error(new Error('late'));
      expect(await first).toBe(false);
      expect(assistant.thread()).toEqual([]);
    });

    it('deleting the active session keeps a thread that was switched to meanwhile', async () => {
      const transport = new CapableTransport();
      let finishDelete: () => void = () => undefined;
      transport.deleteSession = (id: string) => new Promise<void>(resolve => {
        finishDelete = () => {
          transport.deleted.push(id);
          resolve();
        };
      });
      const assistant = setup(transport);
      await assistant.openSession('s1');
      const deletion = assistant.deleteSession('s1');
      await assistant.openSession('s2');
      finishDelete();
      expect(await deletion).toBe(true);
      expect(assistant.thread().map(i => i.id)).toEqual(['s2:0', 's2:1']);
    });

    it('treats an observable that completes without a value (EMPTY) as success for void results', async () => {
      const transport = new CapableTransport();
      transport.refreshSessions = () => EMPTY as never;
      transport.deleteSession = () => EMPTY as never;
      const assistant = setup(transport);
      expect(await assistant.refreshSessions()).toBe(true);
      expect(await assistant.deleteSession('s1')).toBe(true);
      expect(assistant.thread()).toEqual([]);
    });

    it('loadThread replaces the thread', () => {
      const assistant = setup(new FakeAssistantTransport());
      assistant.loadThread([{ kind: 'user', id: 'u', text: 'restored' }]);
      expect(assistant.thread()).toEqual([{ kind: 'user', id: 'u', text: 'restored' }]);
    });

    it('stays inert while the assistant is disabled', async () => {
      const assistant = setup(new CapableTransport(), false);
      expect(await assistant.openSession('s1')).toBe(false);
      expect(await assistant.refreshSessions()).toBe(false);
      assistant.loadStarterQuestions();
      expect(assistant.starterQuestions()).toEqual([]);
    });
  });

  describe('attachments', () => {
    it('sends the draft files with the turn (text may be empty) and clears them', () => {
      const transport = new CapableTransport();
      const assistant = setup(transport);
      const pdf = new File(['%PDF'], 'invoice.pdf', { type: 'application/pdf' });
      assistant.setDraftFiles([pdf]);
      expect(assistant.send('')).toBe(true);
      expect(transport.requests[0].files).toEqual([pdf]);
      expect(transport.requests[0].text).toBe('');
      expect(assistant.draftFiles()).toEqual([]);
      expect(assistant.thread()[0]).toEqual({ kind: 'user', id: expect.any(String), text: '', attachments: [{ name: 'invoice.pdf', size: 4 }] });
    });

    it('sends no files property when nothing is attached', () => {
      const transport = new CapableTransport();
      const assistant = setup(transport);
      assistant.send('Hi');
      expect('files' in transport.requests[0]).toBe(false);
      expect(assistant.send('')).toBe(false);
    });
  });

  describe('starter questions', () => {
    it('takes an array', () => {
      const assistant = setup(new CapableTransport());
      assistant.loadStarterQuestions();
      expect(assistant.starterQuestions()).toEqual(['What is open?', 'Show the VAT summary']);
    });

    it('takes a promise and drops blank entries', async () => {
      const transport = new CapableTransport();
      transport.starters = Promise.resolve(['One', ' ', 'Two']);
      const assistant = setup(transport);
      assistant.loadStarterQuestions();
      await new Promise(resolve => setTimeout(resolve));
      expect(assistant.starterQuestions()).toEqual(['One', 'Two']);
    });

    it('takes an observable; a failing source leaves the list empty', async () => {
      const ok = new FakeAssistantTransport() as FakeAssistantTransport & { starterQuestions: () => unknown };
      ok.starterQuestions = () => of(['Obs']);
      const assistant = setup(ok);
      assistant.loadStarterQuestions();
      await new Promise(resolve => setTimeout(resolve));
      expect(assistant.starterQuestions()).toEqual(['Obs']);
      ok.starterQuestions = () => { throw new Error('x'); };
      assistant.loadStarterQuestions();
      expect(assistant.starterQuestions()).toEqual([]);
    });

    it('takes the first value of an observable that never completes', async () => {
      const transport = new FakeAssistantTransport() as FakeAssistantTransport & { starterQuestions: () => unknown };
      const source = new BehaviorSubject<readonly string[]>(['First']);
      transport.starterQuestions = () => source.asObservable();
      const assistant = setup(transport);
      assistant.loadStarterQuestions();
      await new Promise(resolve => setTimeout(resolve));
      expect(assistant.starterQuestions()).toEqual(['First']);
      source.next(['Later']);
      await new Promise(resolve => setTimeout(resolve));
      expect(assistant.starterQuestions()).toEqual(['First']);
      expect(source.observed).toBe(false);
    });

    it('shows none for an observable that completes without a value', async () => {
      const transport = new FakeAssistantTransport() as FakeAssistantTransport & { starterQuestions: () => unknown };
      transport.starterQuestions = () => EMPTY;
      const assistant = setup(transport);
      assistant.loadStarterQuestions();
      await new Promise(resolve => setTimeout(resolve));
      expect(assistant.starterQuestions()).toEqual([]);
    });
  });
});
