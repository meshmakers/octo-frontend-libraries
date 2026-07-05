/**
 * Helpers for the entity-selector suffix on navigation column paths (AB#4323):
 * `nav.type[rtId=...]->attr`, `nav.type[wellKnownName=...]->attr` or
 * `nav.type[attributeName=value]->attr`.
 *
 * The selector pins the exact target entity of a value navigation across an
 * N-multiplicity association. It always attaches to the FIRST navigation type
 * segment (the hop that crosses the association).
 */

export type EntitySelectorKind = 'rtId' | 'wellKnownName' | 'attribute';

export interface EntitySelector {
  kind: EntitySelectorKind;
  /** Attribute name for kind 'attribute'; undefined otherwise. */
  attributeName?: string;
  value: string;
}

const SELECTOR_PATTERN = /\[([^[\]=]+)=([^[\]]*)\]/;

/** True when the path contains a value navigation (`->`) it could carry a selector on. */
export function isNavigationPath(path: string): boolean {
  return path.includes('->');
}

/** Removes all entity selectors from a path (array indexes like `[0]` are kept). */
export function stripEntitySelector(path: string): string {
  return path.replace(/\[[^[\]=]+=[^[\]]*\]/g, '');
}

/** Parses the entity selector of the first navigation segment, if present. */
export function parseEntitySelector(path: string): EntitySelector | null {
  const arrowIndex = path.indexOf('->');
  if (arrowIndex < 0) {
    return null;
  }

  const match = SELECTOR_PATTERN.exec(path.substring(0, arrowIndex));
  if (!match) {
    return null;
  }

  const key = match[1].trim();
  const value = match[2].trim().replace(/^['"]|['"]$/g, '');
  const lowerKey = key.toLowerCase();
  if (lowerKey === 'rtid') {
    return { kind: 'rtId', value };
  }
  if (lowerKey === 'wellknownname' || lowerKey === 'rtwellknownname') {
    return { kind: 'wellKnownName', value };
  }
  return { kind: 'attribute', attributeName: key, value };
}

/**
 * Applies (or replaces) the entity selector on the first navigation segment of the path.
 * Passing null removes the selector. Values are single-quoted for robustness.
 */
export function applyEntitySelector(path: string, selector: EntitySelector | null): string {
  const arrowIndex = path.indexOf('->');
  if (arrowIndex < 0) {
    return path;
  }

  const head = path.substring(0, arrowIndex).replace(SELECTOR_PATTERN, '');
  const tail = path.substring(arrowIndex);
  if (!selector || !selector.value) {
    return head + tail;
  }

  const key = selector.kind === 'attribute' ? (selector.attributeName ?? '').trim() : selector.kind;
  if (!key) {
    return head + tail;
  }

  return `${head}[${key}='${selector.value}']${tail}`;
}
