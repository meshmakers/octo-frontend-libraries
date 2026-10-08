import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AssistantExplainDirective, IfAssistantDirective } from './assistant-explain.directive';
import { AssistantService } from './assistant.service';

@Component({
  imports: [IfAssistantDirective, AssistantExplainDirective],
  template: `<button *mmIfAssistant type="button" class="explain"
                     [mmAssistantExplain]="{ label: 'edge-plc-07', rtId: 'a1', ckTypeId: 'System.Communication/Adapter' }">✦ Explain</button>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
class HostComponent {
}

describe('IfAssistantDirective + AssistantExplainDirective', () => {
  function render(enabled: boolean) {
    const requestExplain = vi.fn(() => true);
    const isOpen = signal(false);
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: AssistantService, useValue: { enabled, requestExplain, isOpen } }]
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, requestExplain, isOpen };
  }

  it('renders nothing while the assistant is disabled', () => {
    const { element } = render(false);
    expect(element.querySelector('button')).toBeNull();
    expect(element.textContent?.trim()).toBe('');
  });

  it('renders the trigger when enabled and requests an explanation on click', () => {
    const { fixture, element, requestExplain, isOpen } = render(true);
    const button = element.querySelector<HTMLButtonElement>('button.explain')!;
    expect(button.hasAttribute('aria-controls')).toBe(false);
    button.click();
    isOpen.set(true);
    fixture.detectChanges();
    expect(button.getAttribute('aria-controls')).toBe('assistant-panel');
    expect(requestExplain).toHaveBeenCalledWith({ label: 'edge-plc-07', rtId: 'a1', ckTypeId: 'System.Communication/Adapter' });
  });
});
