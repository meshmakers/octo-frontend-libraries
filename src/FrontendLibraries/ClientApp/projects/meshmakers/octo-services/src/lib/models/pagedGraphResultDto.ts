import {PagedResultDto} from "@meshmakers/shared-services";

export class PagedGraphResultDto<P, C> extends PagedResultDto<C> {

  document: P | null;

  constructor() {
    super();

    this.document = null;
  }
}
