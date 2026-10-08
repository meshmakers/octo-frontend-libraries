import { InjectionToken, Signal, computed, inject, isSignal } from '@angular/core';
import { ListViewMessages } from '@meshmakers/shared-ui';

/**
 * Host translations of the MeshBoard widget texts (AB#5622). Every member is optional; a missing
 * member keeps the English default, so an app sets only what it translates.
 */
export interface MeshBoardMessages {
  /**
   * Texts of the list inside the table widget (`mm-list-view`): "No records available.", the
   * pager texts, the toolbar labels and the row action names. Merged over the list's English
   * defaults (`DEFAULT_LIST_VIEW_MESSAGES`).
   */
  tableList?: Partial<ListViewMessages>;
  /** Placeholder of a table widget without data source / columns. Default: "Table not configured" */
  tableNotConfigured?: string;
}

/** Default texts of {@link MeshBoardMessages} (the list texts default inside `mm-list-view`). */
export const DEFAULT_MESHBOARD_MESSAGES: Required<Omit<MeshBoardMessages, 'tableList'>> = {
  tableNotConfigured: 'Table not configured',
};

/**
 * What a host provides on {@link MESHBOARD_MESSAGES}: a fixed object, or a signal for apps that
 * switch the language at runtime (the widgets follow it).
 */
export type MeshBoardMessagesSource = MeshBoardMessages | Signal<MeshBoardMessages | null | undefined>;

/**
 * Optional: the host's translations of the MeshBoard widget texts (English without it). Set it
 * once app-wide, either directly or via `provideMeshBoard({ messages })` /
 * `provideMeshBoardMessages(messages)`.
 *
 * ```ts
 * providers: [provideMeshBoardMessages({ tableList: { noRecords: 'Keine Einträge vorhanden.', pagerItemsPerPage: 'Einträge pro Seite' } })]
 * ```
 */
export const MESHBOARD_MESSAGES = new InjectionToken<MeshBoardMessagesSource>('MESHBOARD_MESSAGES');

/** Reads a {@link MeshBoardMessagesSource} (fixed or signal) as the current host layer. */
export function readMeshBoardMessagesSource(source: MeshBoardMessagesSource | null | undefined): MeshBoardMessages | null {
  if (!source) {
    return null;
  }
  return isSignal(source) ? source() ?? null : source;
}

/** The resolved MeshBoard texts: defaults with the host layer on top (missing / null members keep the default). */
export function resolveMeshBoardMessages(messages: MeshBoardMessages | null | undefined): MeshBoardMessages & typeof DEFAULT_MESHBOARD_MESSAGES {
  return {
    ...DEFAULT_MESHBOARD_MESSAGES,
    ...(messages?.tableList ? { tableList: messages.tableList } : {}),
    ...(messages?.tableNotConfigured ? { tableNotConfigured: messages.tableNotConfigured } : {}),
  };
}

/** The resolved MeshBoard messages of {@link MESHBOARD_MESSAGES} as a signal. Call in an injection context. */
export function injectMeshBoardMessages(): Signal<MeshBoardMessages & typeof DEFAULT_MESHBOARD_MESSAGES> {
  const source = inject(MESHBOARD_MESSAGES, { optional: true });
  return computed(() => resolveMeshBoardMessages(readMeshBoardMessagesSource(source)));
}
