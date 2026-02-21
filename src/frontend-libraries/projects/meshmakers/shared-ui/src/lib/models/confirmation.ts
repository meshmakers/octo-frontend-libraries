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

export class ConfirmationWindowResult {
  result: ButtonTypes;

  constructor(result: ButtonTypes) {
    this.result = result;
  }
}

export interface FileUploadData{
  title: string;
  message: string;
  mimeTypes: string;
  fileExtensions: string | null;
}

export class FileUploadResult {
  public selectedFile: File | null;

  constructor(selectedFile: File) {
    this.selectedFile = selectedFile;
  }
}
