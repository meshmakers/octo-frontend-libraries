/**
 * Pure helpers for extracting runtime data point names from a CK entity. Kept
 * Angular-free so unit tests can exercise the record-shape branches without
 * spinning up a TestBed, and so the same logic can be called both from the
 * service (which fetches the entity via GraphQL) and from any caller that
 * already has the entity in hand (e.g. the runtime-browser detail pane).
 *
 * A "data point" here is one entry of an entity's `States` or `DataPoints`
 * RecordArray attribute — for Loxone Controls these are the state names
 * (`tempActual`, `co2`, `humidityActual`, …); for adapters that don't model
 * sub-states the array is absent and the only available data point is the
 * default `currentValue` constant the runtime adapter exposes for
 * single-state polling.
 */

/**
 * Default data-point name for entities without a States/DataPoints RecordArray.
 * Matches the constant the runtime adapters (Loxone, MQTT, OPC-UA) use as the
 * `sourceAttributePath` fallback when no specific state is configured.
 */
export const DEFAULT_DATA_POINT = 'currentValue';

/** Minimal shape we accept for an attribute item. */
export interface AttributeItemLike {
  attributeName?: string | null;
  value?: unknown;
}

/**
 * Extracts the list of available data point names from an entity's attribute
 * list. Always includes {@link DEFAULT_DATA_POINT} first; named state entries
 * follow in alphabetical order.
 *
 * Tolerates the three record shapes the platform produces for a RecordArray:
 *
 * 1. GraphQL: each record is `{ ckRecordId, attributes: [{attributeName, value}, …] }`.
 * 2. Pipeline / MongoDB: each record is `{ attributes: { Name: "…", ExternalId: "…" } }`.
 * 3. Flat: each record is `{ Name: "…", ExternalId: "…" }` (older dumps / sample data).
 *
 * Returns `[DEFAULT_DATA_POINT]` for null/undefined input, attributes without a
 * States/DataPoints entry, or malformed RecordArrays.
 */
export function extractDataPointNames(
  attributes: readonly (AttributeItemLike | null | undefined)[] | null | undefined,
): string[] {
  if (!attributes) return [DEFAULT_DATA_POINT];

  const statesAttr = attributes.find(a => {
    const name = a?.attributeName?.toLowerCase();
    return name === 'states' || name === 'datapoints';
  });

  if (!statesAttr?.value) return [DEFAULT_DATA_POINT];

  const records = coerceToRecordArray(statesAttr.value);
  if (!records) return [DEFAULT_DATA_POINT];

  const names: string[] = [];
  for (const record of records) {
    const name = extractRecordName(record);
    if (name) names.push(name);
  }

  if (names.length === 0) return [DEFAULT_DATA_POINT];
  return [DEFAULT_DATA_POINT, ...[...names].sort((a, b) => a.localeCompare(b))];
}

/**
 * Accepts either an array (GraphQL or in-memory) or a JSON-stringified array
 * (the wire format some pipelines emit). Returns the parsed array or null
 * when the value can't be coerced.
 */
function coerceToRecordArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Walks the known record shapes and returns the first non-empty name found. */
function extractRecordName(record: unknown): string | null {
  if (!record || typeof record !== 'object') return null;
  const r = record as Record<string, unknown>;

  // 1. GraphQL shape: attributes = [{attributeName, value}, …]
  const attrsAny = r['attributes'];
  if (Array.isArray(attrsAny)) {
    const nameEntry = (attrsAny as AttributeItemLike[]).find(
      a => a?.attributeName === 'name' || a?.attributeName === 'Name',
    );
    const value = nameEntry?.value;
    if (typeof value === 'string' && value.length > 0) return value;
  }

  // 2. Pipeline / MongoDB shape: attributes = { Name, ExternalId, … }
  if (attrsAny && typeof attrsAny === 'object' && !Array.isArray(attrsAny)) {
    const attrObj = attrsAny as Record<string, unknown>;
    const value = attrObj['Name'] ?? attrObj['name'] ?? attrObj['stateName'];
    if (typeof value === 'string' && value.length > 0) return value;
  }

  // 3. Flat shape: { Name, ExternalId, … } at the record root
  const flatName = r['Name'] ?? r['name'];
  if (typeof flatName === 'string' && flatName.length > 0) return flatName;

  return null;
}
