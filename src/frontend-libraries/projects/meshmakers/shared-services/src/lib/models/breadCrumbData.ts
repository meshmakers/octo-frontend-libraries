import {BreadCrumbItem} from '@progress/kendo-angular-navigation';
import {SVGIcon} from '@progress/kendo-svg-icons';

export class BreadCrumbData implements BreadCrumbItem {

  constructor(label: string, labelTemplate: string, url: string) {
    this.text = label;
    this.labelTemplate = labelTemplate;
    this.url = url;
  }

  text?: string;
  title?: string;
  disabled?: boolean;
  icon?: string;
  svgIcon?: SVGIcon;
  iconClass?: string;
  imageUrl?: string;

  labelTemplate: string;
  urlTemplate?: string;
  url: string;
}
