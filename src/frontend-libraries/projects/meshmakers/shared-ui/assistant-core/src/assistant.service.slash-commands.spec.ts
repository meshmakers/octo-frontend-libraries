import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { BreadCrumbService } from '@meshmakers/shared-services';
import { BehaviorSubject, Subject } from 'rxjs';
import { ASSISTANT_MESSAGES } from './assistant.messages';
import { ASSISTANT_ENABLED, ASSISTANT_SLASH_COMMANDS, ASSISTANT_TRANSPORT, AssistantAttachmentOptions, AssistantSlashCommand } from './assistant.models';
import { AssistantService } from './assistant.service';
import { FakeAssistantTransport } from './testing/fake-assistant-transport';

class FileTransport extends FakeAssistantTransport {
  readonly attachments: AssistantAttachmentOptions = { maxFiles: 2 };
}

/** Lets pending promise callbacks run. */
const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve));

describe('AssistantService slash command expansion (AB#5621)', () => {
  let transport: FakeAssistantTransport;

  function setup(commands: readonly AssistantSlashCommand[], options: { transport?: FakeAssistantTransport; messages?: object } = {}): AssistantService {
    transport = options.transport ?? new FakeAssistantTransport();
    const root = { params: {}, firstChild: null } as unknown as ActivatedRouteSnapshot;
    TestBed.configureTestingModule({
      providers: [
        { provide: ASSISTANT_ENABLED, useValue: true },
        { provide: ASSISTANT_TRANSPORT, useValue: transport },
        { provide: ASSISTANT_SLASH_COMMANDS, useValue: commands },
        ...(options.messages ? [{ provide: ASSISTANT_MESSAGES, useValue: options.messages }] : []),
        { provide: Router, useValue: { events: new Subject(), url: '/t/x', routerState: { snapshot: { root } } } },
        { provide: BreadCrumbService, useValue: { breadCrumbItems: new BehaviorSubject([]) } }
      ]
    });
    return TestBed.inject(AssistantService);
  }

  it('sends a command without expand unchanged (default behaviour)', () => {
    const assistant = setup([{ command: '/explain', description: 'Explain' }]);
    expect(assistant.send('/explain edge-plc-07')).toBe(true);
    expect(transport.requests[0].text).toBe('/explain edge-plc-07');
    expect(transport.requests[0].slashCommand).toBeUndefined();
    expect(assistant.thread()[0]).toEqual({ kind: 'user', id: expect.any(String), text: '/explain edge-plc-07' });
  });

  it('sends and shows the synchronous expansion; the typed command is kept as label', () => {
    const calls: [string, string][] = [];
    const assistant = setup([{
      command: '/open', description: 'Open items',
      expand: (command, args) => {
        calls.push([command, args]);
        return args ? `Which items are open for ${args}?` : 'Which items are open?';
      }
    }]);
    assistant.setDraft('/OPEN   March 2026 ');
    expect(assistant.send('/OPEN   March 2026 ')).toBe(true);
    expect(calls).toEqual([['/open', 'March 2026']]);
    expect(transport.requests[0].text).toBe('Which items are open for March 2026?');
    expect(transport.requests[0].slashCommand).toBe('/OPEN   March 2026');
    expect(assistant.thread()[0]).toMatchObject({ kind: 'user', text: 'Which items are open for March 2026?', slashCommand: '/OPEN   March 2026' });
    expect(assistant.draft()).toBe('');
    expect(assistant.sending()).toBe(true);
  });

  it('passes empty args for a bare command and leaves other text alone', () => {
    const expand = vi.fn((_command: string, args: string) => `prompt(${args})`);
    const assistant = setup([{ command: '/open', description: 'Open', expand }]);
    assistant.send('/open');
    expect(transport.requests[0].text).toBe('prompt()');
    transport.complete();
    // Not at the start / unknown command / a longer word: sent unchanged.
    assistant.send('please /open');
    transport.complete();
    assistant.send('/unknown x');
    transport.complete();
    assistant.send('/openings');
    expect(transport.requests.slice(1).map(r => r.text)).toEqual(['please /open', '/unknown x', '/openings']);
    expect(expand).toHaveBeenCalledTimes(1);
  });

  it('waits for an asynchronous expansion: busy meanwhile, then sends the prompt', async () => {
    let resolve!: (prompt: string) => void;
    const assistant = setup([{ command: '/sum', description: 'Summary', expand: () => new Promise<string>(r => (resolve = r)) }]);
    assistant.setDraft('/sum Q3');
    expect(assistant.send('/sum Q3')).toBe(true);
    expect(transport.requests).toEqual([]);
    expect(assistant.sending()).toBe(true);
    expect(assistant.canSend()).toBe(false);
    expect(assistant.draft()).toBe('');
    resolve('Summarise Q3');
    await flush();
    expect(transport.requests.map(r => [r.text, r.slashCommand])).toEqual([['Summarise Q3', '/sum Q3']]);
    expect(assistant.thread()[0]).toMatchObject({ kind: 'user', text: 'Summarise Q3', slashCommand: '/sum Q3' });
    expect(assistant.sending()).toBe(true);
    transport.complete();
    expect(assistant.sending()).toBe(false);
  });

  it('a throwing expand sends nothing, adds a (translated) error row and keeps the draft', () => {
    const assistant = setup(
      [{ command: '/open', description: 'Open', expand: () => { throw new Error('no'); } }],
      { messages: { slashCommandFailed: 'Befehl {command} fehlgeschlagen' } });
    assistant.setDraft('/open x');
    expect(assistant.send('/open x')).toBe(false);
    expect(transport.requests).toEqual([]);
    expect(assistant.thread()).toEqual([{ kind: 'error', id: expect.any(String), text: 'Befehl /open fehlgeschlagen' }]);
    expect(assistant.draft()).toBe('/open x');
    expect(assistant.sending()).toBe(false);
  });

  it('a rejected expansion sends nothing, adds an error row and restores draft and files', async () => {
    let reject!: (error: Error) => void;
    const assistant = setup(
      [{ command: '/doc', description: 'Document', expand: () => new Promise<string>((_r, j) => (reject = j)) }],
      { transport: new FileTransport() });
    const file = new File(['%PDF'], 'invoice.pdf', { type: 'application/pdf' });
    assistant.setDraftFiles([file]);
    assistant.setDraft('/doc 42');
    expect(assistant.send('/doc 42')).toBe(true);
    expect(assistant.draftFiles()).toEqual([]);
    reject(new Error('lookup failed'));
    await flush();
    expect(transport.requests).toEqual([]);
    expect(assistant.thread()).toEqual([{ kind: 'error', id: expect.any(String), text: 'The command /doc could not be run.' }]);
    expect(assistant.draft()).toBe('/doc 42');
    expect(assistant.draftFiles()).toEqual([file]);
    expect(assistant.sending()).toBe(false);
    expect(assistant.canSend()).toBe(true);
  });

  it('an empty expansion is an error, not an empty message', async () => {
    const assistant = setup([
      { command: '/blank', description: '', expand: () => '   ' },
      { command: '/later', description: '', expand: async () => '' }
    ]);
    expect(assistant.send('/blank')).toBe(false);
    expect(assistant.send('/later')).toBe(true);
    await flush();
    expect(transport.requests).toEqual([]);
    expect(assistant.thread().map(item => item.kind)).toEqual(['error', 'error']);
  });

  it('files go along with an expanded prompt', () => {
    const assistant = setup([{ command: '/doc', description: '', expand: () => 'Read this invoice' }], { transport: new FileTransport() });
    const file = new File(['%PDF'], 'invoice.pdf', { type: 'application/pdf' });
    assistant.send('/doc', [file]);
    expect(transport.requests[0]).toMatchObject({ text: 'Read this invoice', files: [file], slashCommand: '/doc' });
    expect(assistant.thread()[0]).toMatchObject({ text: 'Read this invoice', slashCommand: '/doc', attachments: [{ name: 'invoice.pdf' }] });
  });

  it('Stop during an asynchronous expansion drops it', async () => {
    let resolve!: (prompt: string) => void;
    const assistant = setup([{ command: '/sum', description: '', expand: () => new Promise<string>(r => (resolve = r)) }]);
    assistant.send('/sum');
    assistant.stop();
    expect(assistant.sending()).toBe(false);
    resolve('Summarise');
    await flush();
    expect(transport.requests).toEqual([]);
    expect(assistant.thread()).toEqual([]);
  });
});
