export function nameSearchTerm(text: string): string {
  return text
    .replace(/^\*+|\*+$/g, '')
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '\\x2A')
    .replace(/^@/, '\\x40');
}
