export interface CkTypeSelectorInputMessages {
  placeholder: string;
  /** `{0}` is replaced with the current search value. */
  noTypesFound: string;
  /** `{0}` is replaced with the minimum search length. */
  minCharactersHint: string;
  advancedSearchLabel: string;
  defaultDialogTitle: string;
}

export const DEFAULT_CK_TYPE_SELECTOR_INPUT_MESSAGES: CkTypeSelectorInputMessages = {
  placeholder: 'Select a CK type...',
  noTypesFound: 'No types found for "{0}"',
  minCharactersHint: 'Type at least {0} characters to search...',
  advancedSearchLabel: 'Advanced Search...',
  defaultDialogTitle: 'Select Construction Kit Type',
};
