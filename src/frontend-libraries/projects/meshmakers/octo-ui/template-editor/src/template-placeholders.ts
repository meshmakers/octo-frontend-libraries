export interface TemplatePlaceholder {
  token: string;
  label: string;
  sample?: string;
  note?: string;
}

export interface TemplatePlaceholderGroup {
  id: string;
  label: string;
  placeholders: readonly TemplatePlaceholder[];
  unavailable?: string;
}

export function shortPlaceholderToken(token: string): string {
  const navigation = token.lastIndexOf('->');
  return navigation < 0 ? token : '${…' + token.slice(navigation + 2);
}

export type TemplateSegmentKind = 'text' | 'known' | 'unknown';

export interface TemplateSegment {
  text: string;
  kind: TemplateSegmentKind;
}

const PLACEHOLDER_PATTERN = /\$\{[^{}]*\}/g;

export function splitTemplateSegments(text: string | null | undefined,
  isKnown: (token: string) => boolean): TemplateSegment[] {
  const source = text ?? '';
  const segments: TemplateSegment[] = [];
  let last = 0;
  for (const match of source.matchAll(PLACEHOLDER_PATTERN)) {
    const at = match.index ?? 0;
    if (at > last) {
      segments.push({ text: source.slice(last, at), kind: 'text' });
    }
    segments.push({ text: match[0], kind: isKnown(match[0]) ? 'known' : 'unknown' });
    last = at + match[0].length;
  }
  if (last < source.length) {
    segments.push({ text: source.slice(last), kind: 'text' });
  }
  return segments;
}
