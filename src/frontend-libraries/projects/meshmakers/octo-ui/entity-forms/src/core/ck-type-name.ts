/**
 * Human-readable names of CK types (AB#5524): `System.Communication/EMailReceiverConfiguration-1`
 * → `E-mail receiver configuration`, `…/FinApiConfiguration` → `finAPI configuration`.
 *
 * CK types carry no display name, so a name is derived from the type name: PascalCase is split
 * into words in sentence case, and known acronyms / brand names keep their spelling.
 */

/** How a known word (or word sequence) is written. */
interface KnownTerm {
  /** Lower-case words of the split type name, e.g. `['e', 'mail']` for `EMail`. */
  words: string[];
  text: string;
  /**
   * `acronym`: always as written (SAP, SFTP); `brand`: always as written, even at the start
   * (finAPI, weclapp); `word`: sentence case — capitalised only at the start (E-mail / e-mail).
   */
  kind: 'acronym' | 'brand' | 'word';
}

const KNOWN_TERMS: readonly KnownTerm[] = [
  { words: ['e', 'mail'], text: 'E-mail', kind: 'word' },
  { words: ['email'], text: 'E-mail', kind: 'word' },
  { words: ['fin', 'api'], text: 'finAPI', kind: 'brand' },
  { words: ['finapi'], text: 'finAPI', kind: 'brand' },
  { words: ['we', 'clapp'], text: 'weclapp', kind: 'brand' },
  { words: ['weclapp'], text: 'weclapp', kind: 'brand' },
  { words: ['open', 'ai'], text: 'OpenAI', kind: 'brand' },
  { words: ['openai'], text: 'OpenAI', kind: 'brand' },
  { words: ['mongo', 'db'], text: 'MongoDB', kind: 'brand' },
  { words: ['crate', 'db'], text: 'CrateDB', kind: 'brand' },
  { words: ['opc', 'ua'], text: 'OPC UA', kind: 'acronym' },
  ...['ai', 'api', 'ck', 'csv', 'eda', 'ftp', 'http', 'https', 'id', 'imap', 'json', 'llm', 'mcp', 'mqtt', 'ocr', 'opc',
    'pdf', 'rest', 'sap', 'sftp', 'smtp', 'sql', 'ssh', 'tls', 'ui', 'uri', 'url', 'xml']
    .map((a): KnownTerm => ({ words: [a], text: a.toUpperCase(), kind: 'acronym' })),
];

/** Longest sequences first, so `Fin Api` wins over `Api`. */
const TERMS_BY_LENGTH = [...KNOWN_TERMS].sort((a, b) => b.words.length - a.words.length);

/** `System.Communication/SftpConfiguration-1` → `SftpConfiguration` (no model, no version). */
export function ckTypeShortName(ckTypeId: string): string {
  const name = (ckTypeId ?? '').trim();
  return name.substring(name.lastIndexOf('/') + 1).replace(/-\d+(\.\d+)*$/, '');
}

/** Splits `EMailReceiverConfiguration` / `SAPConnection` / `sftp_config` into words. */
function splitWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Human-readable name of a CK type id or type name, in sentence case with known acronyms and
 * brand names (`SAP`, `SFTP`, `AI`, `EDA`, `E-mail`, `finAPI`, `weclapp`, …). Returns the input
 * when it holds no name.
 */
export function humanizeCkTypeName(ckTypeIdOrName: string): string {
  const words = splitWords(ckTypeShortName(ckTypeIdOrName));
  if (words.length === 0) {
    return ckTypeIdOrName ?? '';
  }
  const lower = words.map((w) => w.toLowerCase());
  const out: string[] = [];
  for (let i = 0; i < lower.length;) {
    const term = TERMS_BY_LENGTH.find((t) => t.words.every((w, k) => lower[i + k] === w));
    if (term) {
      const first = out.length === 0;
      out.push(term.kind === 'word' && !first ? term.text.toLowerCase() : term.text);
      i += term.words.length;
      continue;
    }
    // An all-caps word of the type name (SAPConnection → SAP) stays an acronym.
    const original = words[i];
    const acronym = original.length > 1 && original === original.toUpperCase() && /[A-Z]/.test(original);
    out.push(acronym ? original : out.length === 0 ? capitalise(lower[i]) : lower[i]);
    i += 1;
  }
  return out.join(' ');
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
