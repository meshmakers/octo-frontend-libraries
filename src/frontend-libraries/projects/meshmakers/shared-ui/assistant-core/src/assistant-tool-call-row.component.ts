import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { AssistantToolCall } from './assistant.models';

/**
 * Default renderer of a tool call in the thread: tool name in mono plus its status.
 * Replace it through `ASSISTANT_TOOL_CALL_COMPONENT`.
 */
@Component({
  selector: 'mm-assistant-tool-call-row',
  template: '<span class="tool-name">{{ call().toolName }}</span> <span class="tool-status">{{ call().status }}</span>',
  styles: [`
    :host { display: inline-flex; gap: var(--theme-space-2, 8px); align-items: baseline; }
    .tool-name { font-family: var(--theme-font-mono, monospace); }
    .tool-status { color: var(--theme-text-secondary); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssistantToolCallRowComponent {
  readonly call = input.required<AssistantToolCall>();
}
