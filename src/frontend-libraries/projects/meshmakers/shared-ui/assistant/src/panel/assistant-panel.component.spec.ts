import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { BreadCrumbService } from '@meshmakers/shared-services';
import { BehaviorSubject, Subject } from 'rxjs';
import { ASSISTANT_ENABLED, ASSISTANT_PAGE_CONTEXT, ASSISTANT_TRANSPORT, AssistantProposalDecision } from '../assistant.models';
import { AssistantService } from '../assistant.service';
import { FakeAssistantTransport } from '../testing/fake-assistant-transport';
import { AssistantPanelComponent } from './assistant-panel.component';

describe('AssistantPanelComponent', () => {
  let fixture: ComponentFixture<AssistantPanelComponent>;
  let element: HTMLElement;
  let assistant: AssistantService;

  async function setup(transport?: FakeAssistantTransport): Promise<void> {
    const root = { params: {}, firstChild: { params: { tenantId: 'meshmakers' }, firstChild: null } } as unknown as ActivatedRouteSnapshot;
    await TestBed.configureTestingModule({
      imports: [AssistantPanelComponent],
      providers: [
        { provide: ASSISTANT_ENABLED, useValue: true },
        ...(transport ? [{ provide: ASSISTANT_TRANSPORT, useValue: transport }] : []),
        { provide: Router, useValue: { events: new Subject(), url: '/meshmakers/communication/adapters', routerState: { snapshot: { root } } } },
        { provide: BreadCrumbService, useValue: { breadCrumbItems: new BehaviorSubject([{ text: 'Adapters' }]) } },
        { provide: ASSISTANT_PAGE_CONTEXT, useValue: { areaText: signal('Integration'), tabText: signal('Adapters') } }
      ]
    })
      .compileComponents();
    assistant = TestBed.inject(AssistantService);
    const origin = document.body.appendChild(document.createElement('button'));
    origin.id = 'origin';
    origin.focus();
    assistant.open({ prompt: '/explain edge-plc-07' });
    fixture = TestBed.createComponent(AssistantPanelComponent);
    element = fixture.nativeElement as HTMLElement;
    document.body.appendChild(element);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => document.body.replaceChildren());

  const textarea = (): HTMLTextAreaElement => element.querySelector('textarea')!;

  it('is a labelled complementary region and focuses the prefilled composer on open', async () => {
    await setup();
    expect(element.getAttribute('role')).toBe('complementary');
    expect(element.id).toBe('assistant-panel');
    expect(element.querySelector('#assistant-panel-title')?.textContent).toBe('Assistant');
    expect(document.activeElement).toBe(textarea());
    expect(textarea().value).toBe('/explain edge-plc-07');
  });

  it('re-focuses the composer when an entry point opens it again', async () => {
    await setup();
    (element.querySelector('.close') as HTMLElement).focus();
    assistant.open({ prompt: 'again' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(textarea());
    expect(textarea().value).toBe('again');
  });

  it('Esc closes the panel and returns focus to where it was', async () => {
    await setup();
    textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(assistant.isOpen()).toBe(false);
    expect(document.activeElement?.id).toBe('origin');
  });

  it('Esc first closes the slash-command list only', async () => {
    await setup();
    textarea().value = '/';
    textarea().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(assistant.isOpen()).toBe(true);
  });

  it('the close button closes', async () => {
    await setup();
    (element.querySelector('.close') as HTMLButtonElement).click();
    expect(assistant.isOpen()).toBe(false);
  });

  it('shows removable context chips', async () => {
    await setup();
    const labels = (): string[] => Array.from(element.querySelectorAll('.ctx-label')).map(label => label.textContent!.trim());
    expect(labels()).toEqual(['Tenant: meshmakers', 'Page: Integration › Adapters']);
    (element.querySelector('[aria-label="Remove context Tenant: meshmakers"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(labels()).toEqual(['Page: Integration › Adapters']);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove context Page: Integration › Adapters');

    (document.activeElement as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(labels()).toEqual([]);
    expect(document.activeElement).toBe(textarea());
  });

  it('is a non-modal region on wide screens', async () => {
    await setup();
    expect(element.hasAttribute('aria-modal')).toBe(false);
    const close = element.querySelector<HTMLButtonElement>('.close')!;
    close.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    close.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
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

    it('is a modal dialog that keeps Tab inside', async () => {
      await setup();
      expect(element.getAttribute('role')).toBe('dialog');
      expect(element.getAttribute('aria-modal')).toBe('true');
      const close = element.querySelector<HTMLButtonElement>('.close')!;
      const send = element.querySelector<HTMLButtonElement>('.send')!;
      expect(send.disabled).toBe(true);

      close.focus();
      const back = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
      close.dispatchEvent(back);
      expect(back.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(textarea());

      const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      textarea().dispatchEvent(forward);
      expect(forward.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(close);
    });
  });

  it('says honestly that there is no backend: status message, send disabled, no permissions claim', async () => {
    await setup();
    expect(element.querySelector('.unavailable[role="status"]')?.textContent).toContain('Assistant backend not available yet');
    expect((element.querySelector('.send') as HTMLButtonElement).disabled).toBe(true);
    expect(element.querySelector('.chip-neutral')).toBeNull();
    textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(assistant.thread()).toEqual([]);
  });

  it('sends through a ready transport and forwards proposal decisions to the service', async () => {
    const transport = new FakeAssistantTransport();
    await setup(transport);
    expect(element.querySelector('.unavailable')).toBeNull();
    expect(element.querySelector('.chip-neutral')?.textContent).toContain('Reads with your permissions');
    textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(transport.requests[0].text).toBe('/explain edge-plc-07');

    transport.emit({ type: 'proposal', proposal: { id: 'p1', title: 'Wake adapter', toolName: 'wake_adapter', writes: true, parameters: [] } });
    fixture.detectChanges();
    const decisions: AssistantProposalDecision[] = [];
    assistant.proposalDecisions$.subscribe(decision => decisions.push(decision));
    (element.querySelector('mm-assistant-proposal-card .primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(decisions.map(decision => decision.kind)).toEqual(['run']);
    expect(element.querySelector('mm-assistant-proposal-card [role="status"]')?.textContent).toBe('Run requested');
  });
});
