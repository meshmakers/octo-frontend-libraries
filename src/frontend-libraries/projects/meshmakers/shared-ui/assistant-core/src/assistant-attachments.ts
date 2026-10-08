import type { AssistantAttachmentOptions } from './assistant.models';
import { AssistantMessages, formatAssistantMessage } from './assistant.messages';

/** Result of {@link selectAssistantAttachments}. */
export interface AssistantAttachmentSelection {
  /** The files that stay attached (previous ones first). */
  files: File[];
  /** One translated message per rejected file (or one for "too many"). */
  errors: string[];
}

/** "512 B", "1.5 KB", "10 MB" — for the size-limit message. */
export function formatAssistantFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${units[unit]}`;
}

/**
 * Whether a file matches an `accept` list (`<input accept>` syntax: MIME types, `type/*`
 * wildcards and `.ext` extensions, comma separated). An empty list accepts everything.
 */
export function assistantFileAccepted(file: Pick<File, 'name' | 'type'>, accept: string | undefined): boolean {
  const patterns = (accept ?? '').split(',').map(p => p.trim().toLowerCase()).filter(p => p.length > 0);
  if (!patterns.length) {
    return true;
  }
  const name = file.name.toLowerCase();
  const type = (file.type ?? '').toLowerCase();
  return patterns.some(pattern => {
    if (pattern.startsWith('.')) {
      return name.endsWith(pattern);
    }
    if (pattern.endsWith('/*')) {
      return type.startsWith(pattern.slice(0, -1));
    }
    return type === pattern;
  });
}

/**
 * Adds newly picked files to the already attached ones, enforcing the transport's
 * {@link AssistantAttachmentOptions}: wrong type and too large files are rejected individually,
 * files beyond `maxFiles` (default 1) are dropped with one "too many" message. With
 * `maxFiles: 1` a newly picked valid file replaces the attached one. Pure.
 */
export function selectAssistantAttachments(
  current: readonly File[],
  added: readonly File[],
  options: AssistantAttachmentOptions,
  messages: AssistantMessages
): AssistantAttachmentSelection {
  const maxFiles = Math.max(1, options.maxFiles ?? 1);
  let files = [...current];
  if (maxFiles === 1 && added.length === 1) {
    files = [];
  }
  const errors: string[] = [];
  let tooMany = false;
  for (const file of added) {
    if (!assistantFileAccepted(file, options.accept)) {
      errors.push(formatAssistantMessage(messages.attachmentWrongType, { name: file.name }));
    } else if (options.maxFileSizeBytes !== undefined && file.size > options.maxFileSizeBytes) {
      errors.push(formatAssistantMessage(messages.attachmentTooLarge,
        { name: file.name, max: formatAssistantFileSize(options.maxFileSizeBytes) }));
    } else if (files.length >= maxFiles) {
      tooMany = true;
    } else {
      files.push(file);
    }
  }
  if (maxFiles === 1 && added.length === 1 && !files.length) {
    files = [...current];
  }
  if (tooMany) {
    errors.push(formatAssistantMessage(messages.attachmentTooMany, { max: maxFiles }));
  }
  return { files, errors };
}
