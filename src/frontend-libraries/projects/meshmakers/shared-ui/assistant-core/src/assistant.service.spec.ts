import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { BreadCrumbService } from '@meshmakers/shared-services';
import { BehaviorSubject, Subject } from 'rxjs';
import { ASSISTANT_ENABLED, ASSISTANT_PAGE_CONTEXT, ASSISTANT_TRANSPORT, AssistantProposal, AssistantProposalDecision } from './assistant.models';
import { AssistantService, assistantHotkey } from './assistant.service';
import { ASSISTANT_NOT_CONNECTED_MESSAGE, NotConnectedAssistantTransport } from './not-connected.transport';
import { FakeAssistantTransport } from './testing/fake-assistant-transport';

const PROPOSAL: AssistantProposal = {
  id: 'p1', title: 'Redeploy finapi-adapter', toolName: 'deploy_adapter', writes: true,
  parameters: [{ name: 'adapter', value: 'finapi-adapter' }]
};

describe('AssistantService', () => {
  const events$ = new Subject<unknown>();
  const crumbs$ = new BehaviorSubject<{ text?: string }[]>([{ text: 'Adapters' }, { text: 'mesh-adapter' }]);
  let root: ActivatedRouteSnapshot;
  let url: string;

  function setup(enabled: boolean | undefined, transport?: FakeAssistantTransport): AssistantService {
    root = {
      params: {},
      firstChild: { params: { tenantId: 'meshmakers' }, firstChild: { params: { adapterId: 'a1' }, firstChild: null } }
    } as unknown as ActivatedRouteSnapshot;
    url = '/meshmakers/communication/adapters/details/a1';
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { events: events$, get url() { return url; }, get routerState() { return { snapshot: { root } }; } } },
        ...(enabled === undefined ? [] : [{ provide: ASSISTANT_ENABLED, useValue: enabled }]),
        ...(transport ? [{ provide: ASSISTANT_TRANSPORT, useValue: transport }] : []),
        ...(enabled ? [
          { provide: BreadCrumbService, useValue: { breadCrumbItems: crumbs$ } },
          { provide: ASSISTANT_PAGE_CONTEXT, useValue: { areaText: computed(() => 'Integration'), tabText: signal('Adapters') } }
        ] : [])
      ]
    });
    return TestBed.inject(AssistantService);
  }

  afterEach(() => document.body.replaceChildren());

  describe('flag off (default)', () => {
    it('is disabled by default and every entry point is a no-op', () => {
      // No BreadCrumbService / ASSISTANT_PAGE_CONTEXT provided: a disabled assistant must not need them.
      const assistant = setup(undefined);
      expect(assistant.enabled).toBe(false);
      expect(assistant.open({ prompt: 'x' })).toBe(false);
      expect(assistant.toggle()).toBe(false);
      expect(assistant.requestExplain({ label: 'edge-plc-07' })).toBe(false);
      expect(assistant.isOpen()).toBe(false);
      expect(assistant.draft()).toBe('');
      expect(assistant.send('hello')).toBe(false);
      expect(assistant.thread()).toEqual([]);
    });
  });

  describe('flag on', () => {
    it('opens, closes and toggles; every open asks for composer focus', () => {
      const assistant = setup(true);
      expect(assistant.open()).toBe(true);
      expect(assistant.isOpen()).toBe(true);
      const focus = assistant.focusRequest();
      assistant.open({ prompt: 'again' });
      expect(assistant.focusRequest()).toBe(focus + 1);
      assistant.close();
      expect(assistant.isOpen()).toBe(false);
      assistant.toggle();
      expect(assistant.isOpen()).toBe(true);
      assistant.toggle();
      expect(assistant.isOpen()).toBe(false);
    });

    it('returns focus to the element that had it, or to the ✦ toggle when that is gone', () => {
      const assistant = setup(true);
      const origin = document.body.appendChild(document.createElement('button'));
      const toggle = document.body.appendChild(document.createElement('button'));
      toggle.setAttribute('data-assistant-toggle', '');
      origin.focus();
      assistant.open();
      document.body.appendChild(document.createElement('textarea')).focus();
      assistant.close();
      expect(document.activeElement).toBe(origin);

      origin.focus();
      assistant.open();
      origin.remove();
      assistant.close();
      expect(document.activeElement).toBe(toggle);
    });

    it('dismiss closes without moving focus and forgets the return target', () => {
      const assistant = setup(true);
      const origin = document.body.appendChild(document.createElement('button'));
      origin.focus();
      assistant.open();
      const other = document.body.appendChild(document.createElement('input'));
      other.focus();
      assistant.dismiss();
      expect(assistant.isOpen()).toBe(false);
      expect(document.activeElement).toBe(other);
      assistant.open();
      assistant.close();
      expect(document.activeElement).toBe(other);
    });

    it('derives tenant, page and entity chips from the route and breadcrumbs', () => {
      const assistant = setup(true);
      expect(assistant.contextChips().map(chip => [chip.kind, chip.label])).toEqual([
        ['tenant', 'Tenant: meshmakers'],
        ['page', 'Page: Integration › Adapters'],
        ['entity', 'mesh-adapter']
      ]);
    });

    it('removes a chip until its value changes', () => {
      const assistant = setup(true);
      assistant.removeChip('entity:a1');
      expect(assistant.contextChips().some(chip => chip.kind === 'entity')).toBe(false);

      root.firstChild!.firstChild!.params['adapterId'] = 'a2';
      events$.next(new NavigationEnd(2, url, url));
      expect(assistant.contextChips().find(chip => chip.kind === 'entity')?.value).toBe('a2');
    });

    it('Explain opens with /explain <label> and the object as entity chip, dropped on navigation', () => {
      const assistant = setup(true);
      expect(assistant.requestExplain({ label: 'System.Communication/Adapter', ckTypeId: 'System.Communication/Adapter' })).toBe(true);
      expect(assistant.isOpen()).toBe(true);
      expect(assistant.draft()).toBe('/explain System.Communication/Adapter');
      expect(assistant.contextChips().find(chip => chip.kind === 'entity')).toMatchObject({
        label: 'System.Communication/Adapter', ckTypeId: 'System.Communication/Adapter'
      });

      events$.next(new NavigationEnd(3, url, url));
      expect(assistant.contextChips().find(chip => chip.kind === 'entity')?.value).toBe('a1');
    });

    it('a custom Explain prompt replaces the default prefill', () => {
      const assistant = setup(true);
      assistant.requestExplain({ label: 'edge-plc-08', prompt: 'Why is edge-plc-08 offline?' });
      expect(assistant.draft()).toBe('Why is edge-plc-08 offline?');
    });
  });

  describe('default transport (not connected)', () => {
    it('is unavailable, never sends and never adds a turn', () => {
      const assistant = setup(true);
      expect(TestBed.inject(ASSISTANT_TRANSPORT)).toBeInstanceOf(NotConnectedAssistantTransport);
      expect(assistant.transportStatus()).toBe('unavailable');
      expect(assistant.transportMessage()).toBe(ASSISTANT_NOT_CONNECTED_MESSAGE);
      expect(assistant.canSend()).toBe(false);
      assistant.setDraft('why is edge-plc-08 offline?');
      expect(assistant.send('why is edge-plc-08 offline?')).toBe(false);
      expect(assistant.thread()).toEqual([]);
      expect(assistant.draft()).toBe('why is edge-plc-08 offline?');
    });

    it('errors if anything calls send on it directly', () => {
      const transport = TestBed.runInInjectionContext(() => new NotConnectedAssistantTransport());
      const error = vi.fn();
      transport.send({ text: 'x', context: [] }).subscribe({ error });
      expect(error).toHaveBeenCalledWith(new Error(ASSISTANT_NOT_CONNECTED_MESSAGE));
    });
  });

  describe('with a ready transport (test double)', () => {
    it('sends the text with the remaining chips and renders the streamed turn', () => {
      const transport = new FakeAssistantTransport();
      const assistant = setup(true, transport);
      assistant.removeChip('page:/meshmakers/communication/adapters/details/a1');

      expect(assistant.send('  why?  ')).toBe(true);
      expect(transport.requests[0].text).toBe('why?');
      expect(transport.requests[0].context.map(chip => chip.kind)).toEqual(['tenant', 'entity']);
      expect(assistant.sending()).toBe(true);
      expect(assistant.canSend()).toBe(false);
      expect(assistant.draft()).toBe('');

      transport.emit({ type: 'tool-call', call: { sessionId: 's', callId: 'c1', toolName: 'get_adapter_events', arguments: {}, status: 'Pending', startedAt: '' } });
      transport.emit({ type: 'tool-call', call: { sessionId: 's', callId: 'c1', toolName: 'get_adapter_events', arguments: {}, status: 'Succeeded', startedAt: '', durationMs: 200 } });
      transport.emit({ type: 'message-delta', messageId: 'm1', text: 'All three ' });
      transport.emit({ type: 'message-delta', messageId: 'm1', text: 'errors…' });
      transport.emit({ type: 'proposal', proposal: PROPOSAL });
      transport.complete();

      const thread = assistant.thread();
      expect(thread.map(item => item.kind)).toEqual(['user', 'tool-call', 'assistant', 'proposal']);
      expect(thread[1]).toMatchObject({ call: { status: 'Succeeded', durationMs: 200 } });
      expect(thread[2]).toMatchObject({ markdown: 'All three errors…', streaming: false });
      expect(assistant.sending()).toBe(false);
    });

    it('marks a message finished on message-end and shows stream errors', () => {
      const transport = new FakeAssistantTransport();
      const assistant = setup(true, transport);
      assistant.send('x');
      transport.emit({ type: 'message-delta', messageId: 'm1', text: 'a' });
      expect(assistant.thread()[1]).toMatchObject({ streaming: true });
      transport.emit({ type: 'message-end', messageId: 'm1' });
      expect(assistant.thread()[1]).toMatchObject({ streaming: false });
      transport.emit({ type: 'error', message: 'tool failed' });
      transport.fail(new Error('connection lost'));
      expect(assistant.thread().filter(item => item.kind === 'error').map(item => item.kind === 'error' && item.text))
        .toEqual(['tool failed', 'connection lost']);
      expect(assistant.sending()).toBe(false);
    });

    it('stop ends the running turn', () => {
      const transport = new FakeAssistantTransport();
      const assistant = setup(true, transport);
      assistant.send('x');
      assistant.stop();
      expect(assistant.sending()).toBe(false);
      transport.emit({ type: 'message-delta', messageId: 'm1', text: 'late' });
      expect(assistant.thread().map(item => item.kind)).toEqual(['user']);
    });

    it('publishes proposal decisions without executing; run/discard settle, edit does not', () => {
      const transport = new FakeAssistantTransport();
      const assistant = setup(true, transport);
      const decisions: AssistantProposalDecision[] = [];
      assistant.proposalDecisions$.subscribe(decision => decisions.push(decision));
      assistant.send('x');
      transport.emit({ type: 'proposal', proposal: PROPOSAL });

      assistant.decideProposal('edit', PROPOSAL);
      expect(assistant.thread()[1]).toMatchObject({ decision: null });
      assistant.decideProposal('run', PROPOSAL);
      expect(assistant.thread()[1]).toMatchObject({ decision: 'run' });
      expect(decisions.map(decision => decision.kind)).toEqual(['edit', 'run']);
      expect(transport.requests).toHaveLength(1);
    });
  });
});

describe('assistantHotkey', () => {
  const key = (init: KeyboardEventInit): KeyboardEvent => new KeyboardEvent('keydown', { cancelable: true, ...init });

  it('matches Cmd+J and Ctrl+J only', () => {
    expect(assistantHotkey(key({ key: 'j', metaKey: true }))).toBe(true);
    expect(assistantHotkey(key({ key: 'J', ctrlKey: true }))).toBe(true);
    expect(assistantHotkey(key({ key: 'j' }))).toBe(false);
    expect(assistantHotkey(key({ key: 'j', ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(assistantHotkey(key({ key: 'j', ctrlKey: true, altKey: true }))).toBe(false);
    expect(assistantHotkey(key({ key: 'k', ctrlKey: true }))).toBe(false);
  });

  it('ignores consumed events', () => {
    const event = key({ key: 'j', metaKey: true });
    event.preventDefault();
    expect(assistantHotkey(event)).toBe(false);
  });
});
