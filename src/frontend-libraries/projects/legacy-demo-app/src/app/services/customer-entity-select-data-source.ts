import { EntitySelectDataSource, EntitySelectResult } from '@meshmakers/shared-services';
import { SearchFilterTypesDto } from '@meshmakers/octo-services';
import { firstValueFrom } from 'rxjs';
import { GetSdkCustomersDtoGQL, OctoSdkDemoCustomerDto, GetSdkCustomersQueryVariablesDto } from '../graphQL/get-sdk-customers';

export class CustomerEntitySelectDataSource implements EntitySelectDataSource<OctoSdkDemoCustomerDto> {
  constructor(private getSdkCustomersDtoGQL: GetSdkCustomersDtoGQL) {}

  onFilter = async (filter: string, take = 50): Promise<EntitySelectResult<OctoSdkDemoCustomerDto>> => {
    const variables: GetSdkCustomersQueryVariablesDto = {
      first: take,
      searchFilter: {
        type: SearchFilterTypesDto.AttributeFilterDto,
        attributePaths: ['contact.firstName', 'contact.lastName', 'contact.companyName', 'contact.address.cityTown'],
        searchTerm: filter
      }
    };

    const result = await firstValueFrom(this.getSdkCustomersDtoGQL.fetch({ variables }));

    const items = (result.data?.runtime?.octoSdkDemoCustomer?.items ?? [])
      .filter((item): item is OctoSdkDemoCustomerDto => item !== null);

    return {
      totalCount: result.data?.runtime?.octoSdkDemoCustomer?.totalCount ?? 0,
      items
    };
  };

  onDisplayEntity = (entity: OctoSdkDemoCustomerDto | null): string => {
    if (!entity) return '';
    const first = entity.contact?.firstName ?? '';
    const last = entity.contact?.lastName ?? '';
    const city = entity.contact?.address?.cityTown ?? '';
    return `${first} ${last} (${city})`.trim();
  };

  getIdEntity = (entity: OctoSdkDemoCustomerDto): string => {
    return entity.rtId;
  };
}
