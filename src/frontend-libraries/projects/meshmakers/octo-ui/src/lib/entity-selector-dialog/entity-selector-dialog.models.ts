export interface EntitySelectorDialogData {
  title?: string;
  currentTargetRtId?: string;
  currentTargetCkTypeId?: string;
}

export interface EntitySelectorDialogResult {
  rtId: string;
  ckTypeId: string;
  name?: string;
}
