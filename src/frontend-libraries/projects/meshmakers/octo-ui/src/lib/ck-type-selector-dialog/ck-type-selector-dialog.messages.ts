export interface CkTypeSelectorDialogMessages {
  modelFilterLabel: string;
  modelFilterPlaceholder: string;
  typeSearchLabel: string;
  typeSearchPlaceholder: string;
  clearFiltersTitle: string;
  columnTypeTitle: string;
  columnBaseTypeTitle: string;
  columnDescriptionTitle: string;
  badgeAbstract: string;
  badgeFinal: string;
  selectedLabel: string;
  cancel: string;
  ok: string;
  defaultDialogTitle: string;
  pagerItemsPerPage: string;
  pagerOf: string;
  pagerItems: string;
  pagerPage: string;
  pagerFirstPage: string;
  pagerLastPage: string;
  pagerPreviousPage: string;
  pagerNextPage: string;
  noRecords: string;
  /** Tooltip on the dialog window close (X) button. */
  closeTitle?: string;
  /** Tooltip on the dialog window minimize button. */
  minimizeTitle?: string;
  /** Tooltip on the dialog window maximize button. */
  maximizeTitle?: string;
  /** Tooltip on the dialog window restore button. */
  restoreTitle?: string;
}

export const DEFAULT_CK_TYPE_SELECTOR_DIALOG_MESSAGES: CkTypeSelectorDialogMessages = {
  modelFilterLabel: 'Model Filter',
  modelFilterPlaceholder: 'All Models',
  typeSearchLabel: 'Type Search',
  typeSearchPlaceholder: 'Search types...',
  clearFiltersTitle: 'Clear filters',
  columnTypeTitle: 'Type',
  columnBaseTypeTitle: 'Base Type',
  columnDescriptionTitle: 'Description',
  badgeAbstract: 'abstract',
  badgeFinal: 'final',
  selectedLabel: 'Selected:',
  cancel: 'Cancel',
  ok: 'OK',
  defaultDialogTitle: 'Select Construction Kit Type',
  pagerItemsPerPage: 'items per page',
  pagerOf: 'of',
  pagerItems: 'items',
  pagerPage: 'Page',
  pagerFirstPage: 'Go to the first page',
  pagerLastPage: 'Go to the last page',
  pagerPreviousPage: 'Go to the previous page',
  pagerNextPage: 'Go to the next page',
  noRecords: 'No records available.',
  closeTitle: 'Close',
  minimizeTitle: 'Minimize',
  maximizeTitle: 'Maximize',
  restoreTitle: 'Restore',
};
