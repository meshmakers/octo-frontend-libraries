import {SVGIcon} from '@progress/kendo-svg-icons/dist/svg-icon.interface';

export interface TreeItemData {

  get id(): string;

  get text(): string;

  get tooltip(): string;

  get item(): unknown;

  get svgIcon(): SVGIcon | null;

  get expandable(): boolean;
  set expandable(value: boolean);

  get isExpanded(): boolean;
  set isExpanded(value: boolean);
}

export class TreeItemDataTyped<TDto> implements TreeItemData {
  private _isExpandable: boolean;
  private _isExpanded: boolean;

  constructor(private readonly _id: string, private readonly _text: string, private readonly _tooltip: string,
              private readonly _item: TDto, private readonly _svgIcon: SVGIcon,
              expandable = false, isExpanded = false) {
    this._isExpandable = expandable;
    this._isExpanded = expandable && isExpanded;
  }

  public get id(): string {
    return this._id;
  }

  public get text(): string {
    return this._text;
  }

  public get tooltip(): string {
    return this._tooltip;
  }

  public get item(): TDto {
    return this._item;
  }

  public get svgIcon(): SVGIcon | null {
    return this._svgIcon;
  }

  public get expandable(): boolean {
    return this._isExpandable;
  }

  public set expandable(value: boolean) {
    this._isExpandable = value;
  }

  public get isExpanded(): boolean{
    return this._isExpanded;
  }
  public set isExpanded(value: boolean) {
    this._isExpanded = value;
  }
}
