import { DEFAULT_ASSISTANT_MESSAGES } from './assistant.messages';
import { assistantFileAccepted, formatAssistantFileSize, selectAssistantAttachments } from './assistant-attachments';

const file = (name: string, type: string, size = 10): File => new File([new Uint8Array(size)], name, { type });

describe('assistant attachments', () => {
  it('matches MIME types, wildcards and extensions; empty accept takes everything', () => {
    expect(assistantFileAccepted(file('a.pdf', 'application/pdf'), 'application/pdf')).toBe(true);
    expect(assistantFileAccepted(file('a.PDF', ''), '.pdf')).toBe(true);
    expect(assistantFileAccepted(file('a.png', 'image/png'), 'image/*, .pdf')).toBe(true);
    expect(assistantFileAccepted(file('a.txt', 'text/plain'), 'application/pdf,.pdf')).toBe(false);
    expect(assistantFileAccepted(file('a.txt', 'text/plain'), '')).toBe(true);
    expect(assistantFileAccepted(file('a.txt', 'text/plain'), undefined)).toBe(true);
  });

  it('formats sizes', () => {
    expect(formatAssistantFileSize(512)).toBe('512 B');
    expect(formatAssistantFileSize(1536)).toBe('1.5 KB');
    expect(formatAssistantFileSize(10 * 1024 * 1024)).toBe('10 MB');
  });

  it('rejects wrong types and too large files with a message each', () => {
    const result = selectAssistantAttachments([], [file('a.txt', 'text/plain'), file('big.pdf', 'application/pdf', 2048)],
      { accept: 'application/pdf', maxFiles: 3, maxFileSizeBytes: 1024 }, DEFAULT_ASSISTANT_MESSAGES);
    expect(result.files).toEqual([]);
    expect(result.errors).toEqual(['a.txt is not an accepted file type.', 'big.pdf is larger than 1 KB.']);
  });

  it('keeps at most maxFiles and reports the overflow once', () => {
    const a = file('a.pdf', 'application/pdf');
    const b = file('b.pdf', 'application/pdf');
    const c = file('c.pdf', 'application/pdf');
    const result = selectAssistantAttachments([a], [b, c], { maxFiles: 2 }, DEFAULT_ASSISTANT_MESSAGES);
    expect(result.files).toEqual([a, b]);
    expect(result.errors).toEqual(['At most 2 file(s) per message.']);
  });

  it('replaces the single file when maxFiles is 1 (default) and keeps it when the new one is rejected', () => {
    const a = file('a.pdf', 'application/pdf');
    const b = file('b.pdf', 'application/pdf');
    expect(selectAssistantAttachments([a], [b], { accept: '.pdf' }, DEFAULT_ASSISTANT_MESSAGES).files).toEqual([b]);
    const rejected = selectAssistantAttachments([a], [file('x.txt', 'text/plain')], { accept: '.pdf' }, DEFAULT_ASSISTANT_MESSAGES);
    expect(rejected.files).toEqual([a]);
    expect(rejected.errors.length).toBe(1);
  });
});
