export const KPI_MAX_DECIMAL_PLACES = 3;

export function normalizeKpiDecimalPlaces(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return undefined;
  }
  return value >= 0 && value <= KPI_MAX_DECIMAL_PLACES ? value : undefined;
}
