import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Stand-in for `mm-ai-tool-call` of octo-ai-console (specs only): passed as
 * `ASSISTANT_TOOL_CALL_COMPONENT` to check that a host renderer replaces the default row.
 */
@Component({
  selector: 'mm-ai-tool-call',
  template: '<span class="stub-tool">{{ call().toolName }} {{ call().status }}</span>',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StubAiToolCallComponent {
  readonly call = input.required<{ toolName: string; status: string }>();
}
