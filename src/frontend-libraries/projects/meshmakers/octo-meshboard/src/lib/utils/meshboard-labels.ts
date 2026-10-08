import { InjectionToken } from '@angular/core';

/**
 * What a MeshBoard label belongs to (AB#5622):
 * - `tableCell` — the text of a table widget cell (enum values such as `PAID`);
 * - `chartCategory` — a category of a pie / donut chart. The resolved text is the slice's name
 *   everywhere: data labels, legend items and tooltips.
 */
export type MeshBoardLabelKind = 'tableCell' | 'chartCategory';

/** One label lookup of {@link MeshBoardLabelResolver}. */
export interface MeshBoardLabelRequest {
  kind: MeshBoardLabelKind;
  /** Runtime CK type of the widget's data, when known (table over a runtime entity type); else undefined. */
  ckTypeId?: string;
  /** The attribute (column field / category field) the value belongs to, as configured on the widget. */
  attribute: string;
  /** The raw value as delivered by the query (e.g. the enum value name `PAID`). */
  value: string;
  /** CK value type of the column when the query reports it (`ENUM`, `STRING`, ...). */
  valueType?: string;
  /** The text shown without a resolver (e.g. "Paid" for `PAID` in charts, the raw value in tables). */
  defaultText: string;
}

/**
 * Host hook that translates enum values in MeshBoard tables and chart categories (AB#5622). Same
 * pattern as the entity forms' `ENTITY_FORM_LABEL_RESOLVER`: return `null`, `undefined` or `''`
 * to keep {@link MeshBoardLabelRequest.defaultText}. A resolver that throws is logged once and
 * ignored. Charts call it inside a `computed`, so a resolver that reads a signal (the current
 * language) re-labels the chart when the signal changes.
 *
 * ```ts
 * { provide: MESHBOARD_LABEL_RESOLVER, useValue: (r) => r.attribute === 'paymentState' ? i18n.enumLabel('PaymentState', r.value) : null }
 * ```
 */
export type MeshBoardLabelResolver = (request: MeshBoardLabelRequest) => string | null | undefined;

/** App-wide {@link MeshBoardLabelResolver}. Not provided = today's texts. */
export const MESHBOARD_LABEL_RESOLVER = new InjectionToken<MeshBoardLabelResolver>('MESHBOARD_LABEL_RESOLVER');

const failedResolvers = new WeakSet<MeshBoardLabelResolver>();

/** Resolves one label; the default text when there is no resolver, no translation, or the resolver throws. */
export function resolveMeshBoardLabel(resolver: MeshBoardLabelResolver | null | undefined, request: MeshBoardLabelRequest): string {
  if (!resolver) {
    return request.defaultText;
  }
  let text: string | null | undefined;
  try {
    text = resolver(request);
  } catch (error) {
    if (!failedResolvers.has(resolver)) {
      failedResolvers.add(resolver);
      console.warn('octo-meshboard: the label resolver threw; showing the default texts', error);
    }
    return request.defaultText;
  }
  return typeof text === 'string' && text !== '' ? text : request.defaultText;
}
