/**
 * Number input parsing of the entity form's number editor (AB#8734).
 *
 * The Kendo numeric text box parses with the locale's symbols only: in a German locale "77.5" became 775 (the "."
 * was read as a group separator and dropped) and the user saw no warning. A typed number must never change its
 * magnitude unseen, so the editor parses the text itself, by these rules:
 *
 * - Both "." and "," are accepted as the decimal separator. When the text holds only one of them, exactly once,
 *   it is the decimal separator ("77.5" and "77,5" are both 77.5, in every locale).
 * - When the text holds both, the last one is the decimal separator and the other one groups the digits
 *   ("1.234,5" and "1,234.5" are both 1234.5).
 * - One separator that occurs several times groups the digits ("1.234.567" is 1234567).
 * - Spaces (also non-breaking ones) and apostrophes ("'", "’") group the digits, never separate decimals.
 * - Grouping must be valid: the first group has one to three digits, every further group exactly three, and only
 *   one grouping character is used. Anything else ("1.23,4", "12.34.5", "1,2.345") is refused, never guessed.
 * - A single separator followed by exactly three digits ("1.234", "1,234") can be a decimal or a thousands
 *   separator. With the locale's symbols given: when it is the locale's decimal symbol it is the decimal separator;
 *   when it is the locale's group symbol the text is refused as ambiguous (reason `ambiguous`; "1.234" in de-DE,
 *   "1,234" in en-US), and the user types "1234" or the decimal symbol; otherwise (or without symbols) it is read as
 *   the decimal separator and flagged as {@link LocaleNumberParse.ambiguous}, so the editor names the reading.
 *
 * The editor always shows the parsed value in the user's locale ({@link formatLocaleNumber}).
 */

/** Decimal and group symbol of a locale, as Kendo's `IntlService.numberSymbols()` returns them. */
export interface LocaleNumberSymbols {
  decimal: string;
  group: string;
}

/** Result of {@link parseLocaleNumber}. */
export type LocaleNumberParse =
  | { kind: 'empty' }
  | { kind: 'number'; value: number; ambiguous: boolean }
  | { kind: 'invalid'; reason: 'format' | 'grouping' | 'integer' | 'ambiguous' };

/** Characters that only ever group digits. */
const GROUP_ONLY = /[\s\u00a0\u202f'\u2019]/;
const ALLOWED = /^[0-9.,\s\u00a0\u202f'\u2019]+$/;

/**
 * Parses a typed number by the rules of this file. `integer` refuses a non-zero fraction ("5,0" is still 5);
 * `symbols` (the user's locale) decide a single separator before three digits.
 */
export function parseLocaleNumber(
  text: string | null | undefined,
  options: { integer?: boolean; symbols?: LocaleNumberSymbols } = {},
): LocaleNumberParse {
  const trimmed = (text ?? '').trim();
  if (trimmed.length === 0) {
    return { kind: 'empty' };
  }
  let body = trimmed;
  let negative = false;
  const sign = body.charAt(0);
  if (sign === '-' || sign === '\u2212' || sign === '+') {
    negative = sign !== '+';
    body = body.slice(1).trimStart();
  }
  if (!ALLOWED.test(body) || !/[0-9]/.test(body)) {
    return { kind: 'invalid', reason: 'format' };
  }

  const dots = count(body, '.');
  const commas = count(body, ',');
  let decimal: '.' | ',' | null = null;
  if (dots > 0 && commas > 0) {
    decimal = body.lastIndexOf('.') > body.lastIndexOf(',') ? '.' : ',';
    if (count(body, decimal) > 1) {
      return { kind: 'invalid', reason: 'grouping' };
    }
  } else if (dots === 1) {
    decimal = '.';
  } else if (commas === 1) {
    decimal = ',';
  }

  const at = decimal ? body.lastIndexOf(decimal) : -1;
  const integerPart = at >= 0 ? body.slice(0, at) : body;
  const fraction = at >= 0 ? body.slice(at + 1) : '';
  if (!/^[0-9]*$/.test(fraction)) {
    return { kind: 'invalid', reason: 'grouping' };
  }
  const digits = ungroup(integerPart);
  if (digits === null) {
    return { kind: 'invalid', reason: 'grouping' };
  }
  if (digits.length === 0 && fraction.length === 0) {
    return { kind: 'invalid', reason: 'format' };
  }
  const minus = negative ? '-' : '';
  // A single separator before exactly three digits: decimal or thousands separator?
  let ambiguous = decimal !== null && dots + commas === 1 && fraction.length === 3 && /^[1-9][0-9]{0,2}$/.test(integerPart);
  if (ambiguous && options.symbols) {
    if (decimal === options.symbols.group) {
      // The locale's group symbol: a whole-number field means the thousands; otherwise ask.
      return options.integer ? finite(Number(`${minus}${digits}${fraction}`), false) : { kind: 'invalid', reason: 'ambiguous' };
    }
    ambiguous = decimal !== options.symbols.decimal;
  }
  if (options.integer && /[1-9]/.test(fraction)) {
    return { kind: 'invalid', reason: 'integer' };
  }
  return finite(Number(`${minus}${digits || '0'}.${fraction || '0'}`), ambiguous);
}

function finite(value: number, ambiguous: boolean): LocaleNumberParse {
  if (!Number.isFinite(value)) {
    return { kind: 'invalid', reason: 'format' };
  }
  return { kind: 'number', value: Object.is(value, -0) ? 0 : value, ambiguous };
}

/**
 * The value as edit text in the locale: decimal symbol of the locale, no grouping, no exponent
 * (77.5 → "77,5" in German, "77.5" in English). {@link parseLocaleNumber} reads it back to the same value.
 */
export function formatLocaleNumberInput(value: number, symbols: LocaleNumberSymbols): string {
  const { sign, integer, fraction } = digitsOf(value);
  return `${sign}${integer}${fraction ? (symbols.decimal === ',' ? ',' : '.') + fraction : ''}`;
}

/**
 * The value as the user reads it in the locale: grouped digits, the locale's symbols
 * (1234.5 → "1.234,5" in de-DE, "1,234.5" in en-US, "1 234,5" in de-AT).
 */
export function formatLocaleNumber(value: number, symbols: LocaleNumberSymbols): string {
  const { sign, integer, fraction } = digitsOf(value);
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, symbols.group);
  return `${sign}${grouped}${fraction ? symbols.decimal + fraction : ''}`;
}

/**
 * Sign, integer digits and fraction digits of a finite number, from its shortest round-trip form
 * (`String(value)`) with any exponent expanded: 1e-25 keeps all its digits, 0.1 stays "0.1".
 */
function digitsOf(value: number): { sign: string; integer: string; fraction: string } {
  const text = String(Math.abs(value));
  const [mantissa, exponentText] = text.toLowerCase().split('e');
  const exponent = exponentText ? Number(exponentText) : 0;
  const [intDigits, fracDigits = ''] = mantissa.split('.');
  let digits = intDigits + fracDigits;
  let point = intDigits.length + exponent;
  if (point <= 0) {
    digits = '0'.repeat(1 - point) + digits;
    point = 1;
  } else if (point > digits.length) {
    digits = digits + '0'.repeat(point - digits.length);
  }
  const integer = digits.slice(0, point).replace(/^0+(?=\d)/, '');
  const fraction = digits.slice(point).replace(/0+$/, '');
  return { sign: value < 0 ? '-' : '', integer, fraction };
}

function count(text: string, ch: string): number {
  return text.split(ch).length - 1;
}

/**
 * The digits of an integer part without its grouping characters, or `null` when the grouping is invalid: one
 * grouping character only, first group 1–3 digits, every further group exactly 3.
 */
function ungroup(integerPart: string): string | null {
  const separators = new Set([...integerPart].filter(ch => ch === '.' || ch === ',' || GROUP_ONLY.test(ch)));
  if (separators.size === 0) {
    return integerPart;
  }
  if (separators.size > 1) {
    return null;
  }
  const [separator] = [...separators];
  const groups = integerPart.split(separator);
  const valid = /^[0-9]{1,3}$/.test(groups[0]) && groups.slice(1).every(group => /^[0-9]{3}$/.test(group));
  return valid ? groups.join('') : null;
}
