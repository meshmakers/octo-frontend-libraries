export class RtAssociationMetaData {

  private readonly _roleId: string;
  private readonly _ckTypeId: string;

  constructor(roleId: string, ckTypeId: string) {
    this._roleId = roleId;
    this._ckTypeId = ckTypeId;
  }

  public get ckTypeId(): string {
    return this._ckTypeId;
  }

  public get roleId(): string {
    return this._roleId;
  }

}
