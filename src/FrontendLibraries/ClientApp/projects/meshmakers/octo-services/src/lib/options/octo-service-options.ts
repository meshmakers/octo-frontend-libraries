export class OctoServiceOptions {
  assetServices: string | null;
  defaultDataSourceId?: string;

  constructor() {
    this.assetServices = null;
    this.defaultDataSourceId = undefined;
  }
}
