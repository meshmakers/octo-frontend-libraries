import { MeshBoardNavigationConfig } from '../models/meshboard.models';

/**
 * Marker that separates the human-readable MeshBoard description from the
 * JSON blob the MeshBoard persists alongside it (variables, time filter,
 * entity selectors, auto-refresh, navigation).
 *
 * Format: `<description>\n---MESHBOARD_VARIABLES---\n<json>`
 *
 * This is a stop-gap until System.UI/Dashboard gets a first-class config
 * attribute. The backend may trim leading/trailing whitespace, so the marker
 * can sit at the very start of the stored string when the description is empty.
 */
export const MESHBOARD_DESCRIPTION_MARKER = '---MESHBOARD_VARIABLES---';

/** A stored description split into its two halves. */
export interface EncodedDescription {
  /** The part a person wrote, without the marker and without trailing newlines. */
  description: string;
  /**
   * The parsed JSON blob, or `null` when the stored string carries no marker
   * (or the JSON after it is unreadable). A legacy blob that was a bare
   * variables array is normalised to `{ variables: [...] }`.
   */
  data: Record<string, unknown> | null;
}

/**
 * Splits a stored description into the human-readable text and the encoded
 * JSON data. Never throws: unreadable JSON yields `data: null` and the text
 * before the marker is still returned.
 */
export function splitEncodedDescription(raw: string | null | undefined): EncodedDescription {
  const stored = raw ?? '';
  const markerIndex = stored.indexOf(MESHBOARD_DESCRIPTION_MARKER);
  if (markerIndex === -1) {
    return { description: stored, data: null };
  }

  const description = stored.substring(0, markerIndex).replace(/\n+$/, '');
  const jsonPart = stored.substring(markerIndex + MESHBOARD_DESCRIPTION_MARKER.length).replace(/^\n+/, '');

  try {
    const parsed: unknown = JSON.parse(jsonPart);
    if (Array.isArray(parsed)) {
      return { description, data: { variables: parsed } };
    }
    if (parsed !== null && typeof parsed === 'object') {
      return { description, data: parsed as Record<string, unknown> };
    }
    return { description, data: null };
  } catch {
    return { description, data: null };
  }
}

/**
 * Joins a description and its data blob back into the stored form. An empty
 * or `null` blob yields the bare description, so a board without any encoded
 * settings never carries a dangling marker.
 */
export function joinEncodedDescription(description: string, data: Record<string, unknown> | null): string {
  if (!data || Object.keys(data).length === 0) {
    return description;
  }
  return `${description}\n${MESHBOARD_DESCRIPTION_MARKER}\n${JSON.stringify(data)}`;
}

/**
 * Reads the navigation settings of a MeshBoard from its stored description.
 * Returns `undefined` when the board carries none (= not pinned).
 */
export function readMeshBoardNavigation(raw: string | null | undefined): MeshBoardNavigationConfig | undefined {
  const { data } = splitEncodedDescription(raw);
  return normalizeNavigation(data?.['navigation']);
}

/**
 * Returns the stored description with the navigation settings replaced.
 * Passing `undefined` (or `{ pinned: false }`) removes the entry so unpinned
 * boards store nothing. Every other encoded setting is preserved verbatim.
 */
export function withMeshBoardNavigation(
  raw: string | null | undefined,
  navigation: MeshBoardNavigationConfig | undefined
): string {
  const { description, data } = splitEncodedDescription(raw);
  const next: Record<string, unknown> = { ...(data ?? {}) };
  const normalized = normalizeNavigation(navigation);
  if (normalized) {
    next['navigation'] = normalized;
  } else {
    delete next['navigation'];
  }
  return joinEncodedDescription(description, next);
}

/**
 * Validates an untyped navigation entry. Only a pinned board is worth storing,
 * so anything that is not `{ pinned: true }` collapses to `undefined`.
 */
export function normalizeNavigation(value: unknown): MeshBoardNavigationConfig | undefined {
  if (value === null || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as { pinned?: unknown; order?: unknown };
  if (candidate.pinned !== true) {
    return undefined;
  }
  const navigation: MeshBoardNavigationConfig = { pinned: true };
  if (typeof candidate.order === 'number' && Number.isFinite(candidate.order)) {
    navigation.order = candidate.order;
  }
  return navigation;
}

/**
 * Sort comparator for pinned boards: explicit `order` first (ascending),
 * boards without an order afterwards, ties broken by name.
 */
export function compareMeshBoardNavigation(
  a: { name: string; navigation?: MeshBoardNavigationConfig },
  b: { name: string; navigation?: MeshBoardNavigationConfig }
): number {
  const orderA = a.navigation?.order ?? Number.POSITIVE_INFINITY;
  const orderB = b.navigation?.order ?? Number.POSITIVE_INFINITY;
  if (orderA !== orderB) {
    return orderA < orderB ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}
