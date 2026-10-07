import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, model, output, signal, viewChild } from '@angular/core';
import {
  ASSISTANT_SLASH_COMMANDS,
  AssistantAttachmentOptions,
  AssistantSlashCommand,
  AssistantMessages,
  assistantMessages,
  formatAssistantMessage,
  selectAssistantAttachments
} from '@meshmakers/shared-ui/assistant-core';

let nextComposerId = 0;

/**
 * Composer (ui-concept §5.3): multi-line, Enter sends, Shift+Enter is a newline,
 * typing `/` at the start lists the slash commands (`ASSISTANT_SLASH_COMMANDS`, by default
 * `/explain`, `/query`, `/summarise`, `/draft-pipeline`). The suggestion list follows the combobox
 * pattern: focus stays in the textarea, ↑/↓ move, Enter/Tab pick, Esc closes the
 * list (and only then lets Esc reach the panel).
 *
 * With {@link attachments} set (the transport accepts files, AB#5621) an "Attach file" button opens
 * a file picker limited to `accept`; files are checked against `maxFiles` / `maxFileSizeBytes`,
 * rejected ones are announced in an alert, attached ones are listed with a remove button, and a
 * message may then be sent without text. Without it there is no attachment UI.
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

  /** Accepted attachments; `null` (default) = no attachment UI. */
  readonly attachments = input<AssistantAttachmentOptions | null>(null);
  /** The attached files (two-way); sent with the next message by the host. */
  readonly files = model<readonly File[]>([]);

  readonly send = output<string>();
  readonly stop = output<void>();
  /** Translations; members left out fall back to {@link ASSISTANT_MESSAGES}, then English. */
  readonly messages = input<Partial<AssistantMessages> | null>(null);
  protected readonly m = assistantMessages(this.messages);

  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('input');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  /** Messages about rejected files of the last pick. */
  protected readonly attachmentErrors = signal<readonly string[]>([]);
  /** Something to send: text, or (with attachments) at least one file. */
  protected readonly hasContent = computed(() => this.text().trim().length > 0 || (!!this.attachments() && this.files().length > 0));
  protected readonly multiple = computed(() => (this.attachments()?.maxFiles ?? 1) > 1);
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
    if (this.canSend() && this.hasContent()) {
      this.attachmentErrors.set([]);
      this.send.emit(this.text());
    }
  }

  protected openFilePicker(): void {
    this.fileInput()?.nativeElement.click();
  }

  protected onFilesPicked(input: HTMLInputElement): void {
    const options = this.attachments();
    const picked = Array.from(input.files ?? []);
    // Reset so picking the same file again fires `change`.
    input.value = '';
    if (!options || !picked.length) {
      return;
    }
    const selection = selectAssistantAttachments(this.files(), picked, options, this.m());
    this.files.set(selection.files);
    this.attachmentErrors.set(selection.errors);
  }

  protected removeFile(index: number): void {
    this.files.update(files => files.filter((_, i) => i !== index));
    this.attachmentErrors.set([]);
    this.focus();
  }

  protected format(message: string, values: Record<string, string>): string {
    return formatAssistantMessage(message, values);
  }
}
