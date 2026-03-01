import { AssetRepoGraphQlDataSource, SortOrdersDto } from '@meshmakers/octo-services';
import { MessageService, PagedResultDto } from '@meshmakers/shared-services';
import {
  GetSdkCustomersDtoGQL,
  GetSdkCustomersQueryDto,
  GetSdkCustomersQueryVariablesDto,
  OctoSdkDemoCustomerDto
} from '../graphQL/get-sdk-customers';

export class CustomerGraphQlDataSource extends AssetRepoGraphQlDataSource<
  OctoSdkDemoCustomerDto,
  GetSdkCustomersQueryDto,
  GetSdkCustomersQueryVariablesDto
> {
  constructor(messageService: MessageService, query: GetSdkCustomersDtoGQL) {
    super(messageService, query, [{ attributePath: 'contact.lastName', sortOrder: SortOrdersDto.AscendingDto }]);
  }

  protected override executeLoad(value: unknown, _index: number): PagedResultDto<OctoSdkDemoCustomerDto> {
    const result = new PagedResultDto<OctoSdkDemoCustomerDto>();
    const queryResult = (value as { data?: GetSdkCustomersQueryDto }).data;
    const connection = queryResult?.runtime?.octoSdkDemoCustomer;

    if (connection) {
      result.totalCount = connection.totalCount ?? 0;
      result.list = (connection.items ?? []).filter(
        (item): item is OctoSdkDemoCustomerDto => item !== null
      );
    }

    return result;
  }
}
