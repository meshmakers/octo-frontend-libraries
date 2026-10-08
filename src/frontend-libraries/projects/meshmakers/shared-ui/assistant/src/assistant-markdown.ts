import { Pipe, PipeTransform } from '@angular/core';
import { Marked, Tokens } from 'marked';

/** Protocols an assistant link may use; everything else (javascript:, data:, vbscript: …) renders as text. */
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Classifies a link target: external (http/https/mailto), relative (same origin) or unsafe. */
export function classifyAssistantHref(href: string | null | undefined): 'external' | 'relative' | 'unsafe' {
  const value = (href ?? '').trim();
  if (!value) {
    return 'unsafe';
  }
  // Strip control characters and whitespace browsers ignore inside a scheme ("java\nscript:").
  // eslint-disable-next-line no-control-regex
  const compact = value.replace(/[\u0000- \u007f]/g, '');
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact);
  if (scheme) {
    return SAFE_PROTOCOLS.has(`${scheme[1].toLowerCase()}:`) ? 'external' : 'unsafe';
  }
  // Protocol-relative URLs leave the origin. Browsers treat a backslash like "/" in http(s)
  // URLs, so "/\evil.example" and "\\evil.example" leave it as well.
  if (compact.replace(/\\/g, '/').startsWith('//')) {
    return 'unsafe';
  }
  return 'relative';
}

function safeLink(href: string, labelHtml: string, title?: string | null): string {
  const kind = classifyAssistantHref(href);
  if (kind === 'unsafe') {
    return labelHtml;
  }
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  const external = kind === 'external' ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a href="${escapeHtml(href.trim())}"${titleAttr}${external}>${labelHtml}</a>`;
}

/**
 * Markdown renderer for assistant turns. Model output is untrusted, so:
 * raw HTML is shown as text, images never load (they become their alt text,
 * linked when the source is a safe URL), links only keep http(s)/mailto and
 * relative targets — external ones open in a new tab with
 * `rel="noopener noreferrer"` — and anything else renders as its label.
 * The result is bound with `[innerHTML]`, so Angular's sanitizer runs as a
 * second layer.
 */
const assistantMarked = new Marked({
  async: false,
  gfm: true,
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag): string {
      return escapeHtml(text);
    },
    link(token: Tokens.Link): string {
      return safeLink(token.href, this.parser.parseInline(token.tokens), token.title);
    },
    image({ href, text }: Tokens.Image): string {
      const label = escapeHtml(text || 'image');
      return classifyAssistantHref(href) === 'unsafe' ? label : safeLink(href, label);
    }
  }
});

/** Renders untrusted assistant markdown to HTML with the rules above. */
export function renderAssistantMarkdown(markdown: string): string {
  return assistantMarked.parse(markdown ?? '', { async: false });
}

/** `{{ text | assistantMarkdown }}` for `[innerHTML]` bindings. */
@Pipe({ name: 'assistantMarkdown' })
export class AssistantMarkdownPipe implements PipeTransform {
  transform(markdown: string): string {
    return renderAssistantMarkdown(markdown);
  }
}
