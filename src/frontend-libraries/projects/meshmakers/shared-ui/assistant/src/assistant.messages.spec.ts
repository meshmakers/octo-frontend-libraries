import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot } from '@angular/router';
import { ASSISTANT_MESSAGES, DEFAULT_ASSISTANT_MESSAGES, resolveAssistantMessages, deriveAssistantContext, NotConnectedAssistantTransport, ASSISTANT_SLASH_COMMANDS } from '@meshmakers/shared-ui/assistant-core';
import { AssistantProposalCardComponent } from './proposal-card/assistant-proposal-card.component';
import { AssistantComposerComponent } from './composer/assistant-composer.component';

describe('assistant messages', () => {
  it('defaults to English and ignores null members', () => {
    expect(resolveAssistantMessages()).toEqual(DEFAULT_ASSISTANT_MESSAGES);
    expect(resolveAssistantMessages({ send: 'Senden', stop: null as unknown as string }).stop).toBe('Stop');
  });

  it('translates the context chip labels', () => {
    const root = { params: {}, firstChild: { params: { tenantId: 'meshmakers' }, firstChild: null } } as unknown as ActivatedRouteSnapshot;
    const chips = deriveAssistantContext(
      { root, url: '/meshmakers/x', breadcrumbs: ['Adapters'] },
      { contextTenant: 'Mandant: {tenant}', contextPage: 'Seite: {page}' }
    );
    expect(chips.map(chip => chip.label)).toEqual(['Mandant: meshmakers', 'Seite: Adapters']);
  });

  it('lets the default transport report the translated "not connected" message', () => {
    TestBed.configureTestingModule({ providers: [{ provide: ASSISTANT_MESSAGES, useValue: { notConnected: 'Kein Assistent verbunden' } }] });
    expect(TestBed.inject(NotConnectedAssistantTransport).statusMessage()).toBe('Kein Assistent verbunden');
  });

  it('translates the proposal card through the token and the input', () => {
    TestBed.configureTestingModule({
      imports: [AssistantProposalCardComponent],
      providers: [{ provide: ASSISTANT_MESSAGES, useValue: { run: 'Ausführen', proposal: 'Vorschlag' } }]
    });
    const fixture = TestBed.createComponent(AssistantProposalCardComponent);
    fixture.componentRef.setInput('proposal', { id: 'p', title: 'Wake', toolName: 'wake', writes: false, parameters: [] });
    fixture.componentRef.setInput('messages', { discard: 'Verwerfen' });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.proposal-head')?.textContent?.trim()).toBe('✦ Vorschlag');
    expect(Array.from(element.querySelectorAll('button')).map(b => b.textContent?.trim())).toEqual(['Ausführen', 'Edit', 'Verwerfen']);
  });

  it('takes the slash commands from ASSISTANT_SLASH_COMMANDS', () => {
    TestBed.configureTestingModule({
      imports: [AssistantComposerComponent],
      providers: [{ provide: ASSISTANT_SLASH_COMMANDS, useValue: [{ command: '/help', description: 'Hilfe' }] }]
    });
    const fixture = TestBed.createComponent(AssistantComposerComponent);
    fixture.componentRef.setInput('text', '/');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(Array.from(element.querySelectorAll('[role="option"] .cmd')).map(c => c.textContent)).toEqual(['/help']);
    expect(Array.from(element.querySelectorAll('.hint kbd')).map(c => c.textContent)).toEqual(['/help']);
  });
});
