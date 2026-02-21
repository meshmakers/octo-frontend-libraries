import {SVGIcon} from '@progress/kendo-svg-icons/dist/svg-icon.interface';

export class CkTypeMetaData {

  constructor(ckTypeId: string, name: string, description: string, svgIcon: SVGIcon) {
    this._ckTypeId = ckTypeId;
    this._name = name;
    this._description = description;
    this._svgIcon = svgIcon;
  }

  private readonly _ckTypeId: string;
  private readonly _name: string;
  private readonly _description: string;
  private readonly _svgIcon: SVGIcon;

  public get ckTypeId(): string {
    return this._ckTypeId;
  }

  public get name(): string {
    return this._name;
  }

  public get description(): string {
    return this._description;
  }

  public get svgIcon(): SVGIcon {
    return this._svgIcon;
  }
}
