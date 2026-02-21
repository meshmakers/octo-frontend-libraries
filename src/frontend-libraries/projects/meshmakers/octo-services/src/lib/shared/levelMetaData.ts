import {RtAssociationMetaData} from './rtAssociationMetaData';

export class LevelMetaData {
  constructor(ckTypeId: string, directRoles: RtAssociationMetaData[], indirectRoles: RtAssociationMetaData[]) {
    this._ckTypeId = ckTypeId;
    this._directRoles = directRoles;
    this._indirectRoles = indirectRoles;
  }

  private readonly _ckTypeId: string;
  private readonly _directRoles: RtAssociationMetaData[];
  private readonly _indirectRoles: RtAssociationMetaData[];

  public get ckTypeId(): string {
    return this._ckTypeId;
  }

  public get directRoles(): RtAssociationMetaData[] {
    return this._directRoles;
  }

  public get indirectRoles(): RtAssociationMetaData[] {
    return this._indirectRoles;
  }
}
