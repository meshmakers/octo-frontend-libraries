import { GetSdkCustomersQueryDto } from '../../graphQL/getSdkCustomers';

type SdkCustomerItems = NonNullable<
  NonNullable<
    NonNullable<GetSdkCustomersQueryDto['runtime']>['octoSdkDemoCustomer']
  >['items']
>;

/**
 * One customer row as selected by the `getSdkCustomers` query. The generated result types are
 * narrow selections, not the full schema `OctoSdkDemoCustomerDto`, so the demos use this type.
 */
export type SdkCustomer = NonNullable<SdkCustomerItems[number]>;
