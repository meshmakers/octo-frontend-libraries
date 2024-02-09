export enum ButtonTypes {
  Ok,
  Cancel,
  Yes,
  No
}

export enum DialogType {
  YesNo = 0,
  YesNoCancel = 1,
  OkCancel = 2,
  Ok = 3
}

export interface ConfirmationWindowData {
  title: string;
  message: string;
  dialogType: DialogType;
}

export interface ConfirmationWindowResult {
  result: ButtonTypes;
}
