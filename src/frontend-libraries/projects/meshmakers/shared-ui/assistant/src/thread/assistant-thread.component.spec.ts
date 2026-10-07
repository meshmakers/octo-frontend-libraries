import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ASSISTANT_TOOL_CALL_COMPONENT, AssistantProposalDecision, AssistantThreadItem } from '../assistant.models';
import { StubAiToolCallComponent } from '../testing/stub-tool-call.component';
import { AssistantThreadComponent } from './assistant-thread.component';

// Demo data for the spec only — the app never creates assistant turns itself.
const ITEMS: AssistantThreadItem[] = [
  { kind: 'user', id: 'u1', text: 'Why did finapi-sync fail 3 times today?' },
  { kind: 'tool-call', id: 't1', call: { sessionId: 's', callId: 'c1', toolName: 'get_pipeline_executions', arguments: {}, status: 'Succeeded', startedAt: '' } },
  { kind: 'assistant', id: 'a1', markdown: 'All three failures share **one** cause.', streaming: false },
  {
    kind: 'proposal', id: 'p1', decision: null,
    proposal: { id: 'p1', title: 'Redeploy', toolName: 'deploy_adapter', writes: true, parameters: [] }
  },
  { kind: 'error', id: 'e1', text: 'Tool failed' }
];

describe('AssistantThreadComponent', () => {
  let fixture: ComponentFixture<AssistantThreadComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssistantThreadComponent],
      providers: [{ provide: ASSISTANT_TOOL_CALL_COMPONENT, useValue: StubAiToolCallComponent }]
    }).compileComponents();
    fixture = TestBed.createComponent(AssistantThreadComponent);
    fixture.componentRef.setInput('items', ITEMS);
    fixture.detectChanges();
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  });

  it('is a polite live log', () => {
    const log = element.querySelector('[role="log"]')!;
    expect(log.getAttribute('aria-live')).toBe('polite');
    expect(log.getAttribute('aria-busy')).toBe('false');
  });

  it('renders user, tool-call, assistant, proposal and error items in order', () => {
    const items = Array.from(element.querySelectorAll('.thread > li'));
    expect(items).toHaveLength(5);
    expect(items[0].classList).toContain('user');
    expect(items[1].querySelector('mm-ai-tool-call')?.textContent).toContain('get_pipeline_executions Succeeded');
    expect(items[2].classList).toContain('bot');
    expect(items[2].querySelector('.md strong')?.textContent).toBe('one');
    expect(items[3].querySelector('mm-assistant-proposal-card')).not.toBeNull();
    expect(items[4].classList).toContain('error');
    expect(items[4].textContent).toContain('Error: Tool failed');
  });

  it('has no live region inside the log, so each addition is announced once', () => {
    expect(element.querySelectorAll('[role="log"] [role="alert"], [role="log"] [role="status"], [role="log"] [aria-live]')).toHaveLength(0);
  });

  it('renders untrusted markdown safely through the sanitizer', () => {
    fixture.componentRef.setInput('items', [{
      kind: 'assistant', id: 'x', streaming: false,
      markdown: '<script>window.__pwned = 1</script>\n\nSee <img src="x" onerror="window.__pwned = 1"> and [click](javascript:alert(1)) ' +
        '![logo](https://evil.example/t.png) [docs](https://docs.example)'
    }]);
    fixture.detectChanges();
    const md = element.querySelector('.md')!;
    expect(md.querySelector('script, img, [onerror]')).toBeNull();
    expect(md.querySelector('[href^="javascript"], [src]')).toBeNull();
    expect(md.textContent).toContain('click');
    const links = Array.from(md.querySelectorAll('a')).map(a => [a.textContent, a.getAttribute('href'), a.getAttribute('rel'), a.getAttribute('target')]);
    expect(links).toEqual([
      ['logo', 'https://evil.example/t.png', 'noopener noreferrer', '_blank'],
      ['docs', 'https://docs.example', 'noopener noreferrer', '_blank']
    ]);
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it('is busy while a turn streams', () => {
    fixture.componentRef.setInput('items', [{ kind: 'assistant', id: 'a2', markdown: 'Thinking', streaming: true }]);
    fixture.detectChanges();
    expect(element.querySelector('[role="log"]')?.getAttribute('aria-busy')).toBe('true');
    expect(element.querySelector('.streaming')).not.toBeNull();
  });

  it('forwards proposal buttons as decisions', () => {
    const decisions: AssistantProposalDecision[] = [];
    fixture.componentInstance.proposalDecision.subscribe(decision => decisions.push(decision));
    element.querySelectorAll<HTMLButtonElement>('mm-assistant-proposal-card button').forEach(button => button.click());
    expect(decisions.map(decision => `${decision.kind}:${decision.proposal.id}`)).toEqual(['run:p1', 'edit:p1', 'discard:p1']);
  });
});

describe('AssistantThreadComponent default tool-call row', () => {
  it('renders tool name and status without an ASSISTANT_TOOL_CALL_COMPONENT', async () => {
    await TestBed.configureTestingModule({ imports: [AssistantThreadComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AssistantThreadComponent);
    fixture.componentRef.setInput('items', [ITEMS[1]]);
    fixture.detectChanges();
    const row = (fixture.nativeElement as HTMLElement).querySelector('mm-assistant-tool-call-row');
    expect(row?.querySelector('.tool-name')?.textContent).toBe('get_pipeline_executions');
    expect(row?.querySelector('.tool-status')?.textContent).toBe('Succeeded');
  });
});
