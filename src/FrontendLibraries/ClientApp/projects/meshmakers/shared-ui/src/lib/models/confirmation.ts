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
  okButtonText?: string
  cancelButtonText?: string;
  yesButtonText?: string;
  noButtonText?: string;
}

export interface ConfirmationWindowResult {
  result: ButtonTypes;
}

export interface FileUploadData{
  title: string;
  message: string;
  mimeTypes: string;
  fileExtensions: string | null;
}

export interface FileUploadResult {
  success: boolean;
  selectedFile: File | null;
}
