export interface SaveAsDialogMessages {
  nameLabel: string;
  placeholder: string;
  save: string;
  cancel: string;
  patternError: string;
  nameRequired: string;
  /** `{0}` is replaced with the minimum length. */
  nameTooShort: string;
  /** `{0}` is replaced with the maximum length. */
  nameTooLong: string;
  checkingAvailability: string;
  nameAvailable: string;
  nameAlreadyTaken: string;
}

export const DEFAULT_SAVE_AS_DIALOG_MESSAGES: SaveAsDialogMessages = {
  nameLabel: 'Name',
  placeholder: 'Enter name...',
  save: 'Save',
  cancel: 'Cancel',
  patternError: 'Invalid name format',
  nameRequired: 'Name is required',
  nameTooShort: 'Name must be at least {0} characters',
  nameTooLong: 'Name must be at most {0} characters',
  checkingAvailability: 'Checking availability...',
  nameAvailable: 'Name is available',
  nameAlreadyTaken: 'Name is already taken',
};
