export class BreadcrumbData {

  constructor(label: string, labelTemplate: string, url: string) {
    this.label = label;
    this.labelTemplate = labelTemplate;
    this.url = url;
  }

  label: string;
  labelTemplate: string
  url: string;
}
