import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, model, output, signal, viewChild } from '@angular/core';
import { ASSISTANT_SLASH_COMMANDS, AssistantSlashCommand } from '../assistant.models';
import { AssistantMessages, assistantMessages } from '../assistant.messages';

let nextComposerId = 0;

/**
 * Composer (ui-concept §5.3): multi-line, Enter sends, Shift+Enter is a newline,
 * typing `/` at the start lists the slash commands (`ASSISTANT_SLASH_COMMANDS`, by default
 * `/explain`, `/query`, `/summarise`, `/draft-pipeline`). The suggestion list follows the combobox
 * pattern: focus stays in the textarea, ↑/↓ move, Enter/Tab pick, Esc closes the
 * list (and only then lets Esc reach the panel).
 */
@Component({
  selector: 'mm-assistant-composer',
  templateUrl: './assistant-composer.component.html',
  styleUrl: './assistant-composer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssistantComposerComponent {
  /** The composer text (two-way). */
  readonly text = model('');
  /** Whether Enter may send; false while the transport is not ready. */
  readonly canSend = input(false);
  /** A turn is running: the send button becomes a stop button. */
  readonly sending = input(false);

  readonly send = output<string>();
  readonly stop = output<void>();
  /** Translations; members left out fall back to {@link ASSISTANT_MESSAGES}, then English. */
  readonly messages = input<Partial<AssistantMessages> | null>(null);
  protected readonly m = assistantMessages(this.messages);

  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('input');
  protected readonly commands: readonly AssistantSlashCommand[] = inject(ASSISTANT_SLASH_COMMANDS);

  protected readonly listId = `assistant-slash-${nextComposerId++}`;
  protected readonly activeIndex = signal(0);
  private readonly dismissedFor = signal<string | null>(null);

  /** Slash commands matching what was typed, while the text is a bare `/word`. */
  protected readonly suggestions = computed<readonly AssistantSlashCommand[]>(() => {
    const text = this.text();
    if (!/^\/[\w-]*$/.test(text) || this.dismissedFor() === text) {
      return [];
    }
    return this.commands.filter(command => command.command.startsWith(text.toLowerCase()));
  });

  protected readonly activeOptionId = computed(() =>
    this.suggestions().length ? `${this.listId}-${Math.min(this.activeIndex(), this.suggestions().length - 1)}` : null);

  /** Focuses the textarea with the caret at the end (entry points prefill it). */
  focus(): void {
    const element = this.textarea().nativeElement;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }

  protected onInput(value: string): void {
    this.text.set(value);
    this.activeIndex.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.isComposing) {
      return;
    }
    const suggestions = this.suggestions();
    if (suggestions.length) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.activeIndex.update(index => (index + 1) % suggestions.length);
          return;
        case 'ArrowUp':
          event.preventDefault();
          this.activeIndex.update(index => (index - 1 + suggestions.length) % suggestions.length);
          return;
        case 'Enter':
        case 'Tab':
          if (!event.shiftKey) {
            event.preventDefault();
            this.pick(suggestions[Math.min(this.activeIndex(), suggestions.length - 1)]);
            return;
          }
          break;
        case 'Escape':
          event.preventDefault();
          event.stopPropagation();
          this.dismissedFor.set(this.text());
          return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submit();
    }
  }

  protected pick(command: AssistantSlashCommand): void {
    this.text.set(`${command.command} `);
    this.activeIndex.set(0);
    this.focus();
  }

  protected submit(): void {
    if (this.canSend() && this.text().trim()) {
      this.send.emit(this.text());
    }
  }
}
