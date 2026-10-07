import { Directive, TemplateRef, ViewContainerRef, inject, input } from '@angular/core';
import { AssistantService } from './assistant.service';
import { AssistantExplainTarget } from './assistant.models';

/**
 * Renders its template only while the assistant is enabled — with the flag off
 * the element is not in the DOM at all. Use it on every AI affordance:
 *
 * ```html
 * <button *mmIfAssistant type="button" class="ai-action"
 *         [mmAssistantExplain]="{ label: adapter.name, rtId: adapter.rtId, ckTypeId: 'System.Communication/Adapter' }">
 *   ✦ Explain
 * </button>
 * ```
 */
@Directive({ selector: '[mmIfAssistant]' })
export class IfAssistantDirective {
  constructor() {
    if (inject(AssistantService).enabled) {
      inject(ViewContainerRef).createEmbeddedView(inject(TemplateRef));
    }
  }
}

/**
 * "✦ Explain <object>" entry point (ui-concept §5.4): a click opens the assistant
 * panel with `/explain <label>` in the composer and the object as context chip.
 * Nothing is sent. Pair it with {@link IfAssistantDirective} so the trigger does
 * not exist while the assistant is disabled; code without a template (a
 * `CommandItem.onClick`) calls `AssistantService.requestExplain()` instead.
 */
@Directive({
  selector: '[mmAssistantExplain]',
  host: {
    '(click)': 'explain()',
    '[attr.aria-controls]': 'assistant.isOpen() ? "assistant-panel" : null'
  }
})
export class AssistantExplainDirective {
  protected readonly assistant = inject(AssistantService);

  readonly target = input.required<AssistantExplainTarget>({ alias: 'mmAssistantExplain' });

  protected explain(): void {
    this.assistant.requestExplain(this.target());
  }
}
