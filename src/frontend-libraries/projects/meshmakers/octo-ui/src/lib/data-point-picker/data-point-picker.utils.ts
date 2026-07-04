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
 * One data point of a source entity: its name plus — when the record or the
 * entity carries one — its last known value. `currentValue` is `undefined`
 * when unknown (never `null`-normalised, so a real null value stays visible).
 */
export interface DataPointInfo {
  name: string;
  currentValue?: unknown;
}

/**
 * Extracts the available data points (name + last known value) from an
 * entity's attribute list. Always includes {@link DEFAULT_DATA_POINT} first
 * (carrying the entity's own `CurrentValue` attribute when present); named
 * state entries follow in alphabetical order.
 *
 * Tolerates the three record shapes the platform produces for a RecordArray:
 *
 * 1. GraphQL: each record is `{ ckRecordId, attributes: [{attributeName, value}, …] }`.
 * 2. Pipeline / MongoDB: each record is `{ attributes: { Name: "…", ExternalId: "…" } }`.
 * 3. Flat: each record is `{ Name: "…", ExternalId: "…" }` (older dumps / sample data).
 *
 * Returns `[{ name: DEFAULT_DATA_POINT }]` for null/undefined input, attributes
 * without a States/DataPoints entry, or malformed RecordArrays.
 */
export function extractDataPoints(
  attributes: readonly (AttributeItemLike | null | undefined)[] | null | undefined,
): DataPointInfo[] {
  if (!attributes) return [{ name: DEFAULT_DATA_POINT }];

  // The default data point maps to the entity's own CurrentValue attribute.
  const entityCurrentValue = attributes.find(
    a => a?.attributeName?.toLowerCase() === 'currentvalue',
  )?.value;
  const defaultInfo: DataPointInfo = { name: DEFAULT_DATA_POINT, currentValue: entityCurrentValue };

  const statesAttr = attributes.find(a => {
    const name = a?.attributeName?.toLowerCase();
    return name === 'states' || name === 'datapoints';
  });

  if (!statesAttr?.value) return [defaultInfo];

  const records = coerceToRecordArray(statesAttr.value);
  if (!records) return [defaultInfo];

  const infos: DataPointInfo[] = [];
  for (const record of records) {
    const name = extractRecordName(record);
    if (name) infos.push({ name, currentValue: extractRecordCurrentValue(record) });
  }

  if (infos.length === 0) return [defaultInfo];
  return [defaultInfo, ...[...infos].sort((a, b) => a.name.localeCompare(b.name))];
}

/**
 * Extracts the list of available data point names from an entity's attribute
 * list — the name-only view of {@link extractDataPoints}.
 */
export function extractDataPointNames(
  attributes: readonly (AttributeItemLike | null | undefined)[] | null | undefined,
): string[] {
  return extractDataPoints(attributes).map(info => info.name);
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

/**
 * Walks the same three record shapes as {@link extractRecordName} and returns
 * the record's CurrentValue, or undefined when the record doesn't carry one.
 */
function extractRecordCurrentValue(record: unknown): unknown {
  if (!record || typeof record !== 'object') return undefined;
  const r = record as Record<string, unknown>;

  // 1. GraphQL shape: attributes = [{attributeName, value}, …]
  const attrsAny = r['attributes'];
  if (Array.isArray(attrsAny)) {
    const valueEntry = (attrsAny as AttributeItemLike[]).find(
      a => a?.attributeName?.toLowerCase() === 'currentvalue',
    );
    if (valueEntry) return valueEntry.value;
  }

  // 2. Pipeline / MongoDB shape: attributes = { Name, CurrentValue, … }
  if (attrsAny && typeof attrsAny === 'object' && !Array.isArray(attrsAny)) {
    const attrObj = attrsAny as Record<string, unknown>;
    if ('CurrentValue' in attrObj) return attrObj['CurrentValue'];
    if ('currentValue' in attrObj) return attrObj['currentValue'];
  }

  // 3. Flat shape: { Name, CurrentValue, … } at the record root
  if ('CurrentValue' in r) return r['CurrentValue'];
  if ('currentValue' in r) return r['currentValue'];

  return undefined;
}
