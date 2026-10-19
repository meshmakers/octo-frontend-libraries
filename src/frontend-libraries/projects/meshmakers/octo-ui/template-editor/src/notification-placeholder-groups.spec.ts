import { notificationPlaceholderGroup } from './notification-placeholder-groups';

const CUSTOMER = 'relatesTo.basicEnergyMeteringPoint->parent.basicEnergyOperatingFacility->customer.energyCommunityCustomer->';
const COLUMNS = ['name', 'meteringPointNumber', CUSTOMER + 'contact.firstName', CUSTOMER + 'customerNumber'];
const t = (key: string): string => key.split('.').pop() ?? key;

describe('notificationPlaceholderGroup', () => {
  it('puts ${count} and every column, navigating or not, into one group', () => {
    const group = notificationPlaceholderGroup(COLUMNS, null, t);

    expect(group.label).toBe('queryRow');
    expect(group.placeholders.map(placeholder => placeholder.token))
      .toEqual(['${count}', ...COLUMNS.map(column => '${' + column + '}')]);
  });

  it('labels a navigating column with the entity it reaches and the attribute', () => {
    const group = notificationPlaceholderGroup(COLUMNS, null, t);

    expect(group.placeholders[2].label).toBe('Metering point number');
    expect(group.placeholders[3].label).toBe('Energy community customer · Contact › First name');
    expect(group.placeholders[3].note).toBe('Basic energy metering point › Basic energy operating facility › Energy community customer');
  });

  it('takes the group and type names from the host', () => {
    const group = notificationPlaceholderGroup(COLUMNS, null, t, {
      id: 'eda',
      label: 'EDA-Prozess',
      typeLabel: type => type === 'energyCommunityCustomer' ? 'Kunde' : undefined
    });

    expect(group.id).toBe('eda');
    expect(group.label).toBe('EDA-Prozess');
    expect(group.placeholders[3].label).toBe('Kunde · Contact › First name');
  });

  it('takes the samples from the first query row, matching the column without case', () => {
    const group = notificationPlaceholderGroup(COLUMNS, {
      totalCount: 7,
      rows: [{ NAME: 'EC_REQ_ONL', [CUSTOMER + 'contact.firstName']: 'Erika', meteringPointNumber: null }]
    }, t);

    expect(group.placeholders.map(placeholder => placeholder.sample)).toEqual(['7', 'EC_REQ_ONL', undefined, 'Erika', undefined]);
  });

  it('offers the host examples without a query row, and one as the count', () => {
    const group = notificationPlaceholderGroup(COLUMNS, null, t, { exampleOf: column => column === 'name' ? 'EC_REQ_ONL' : undefined });

    expect(group.placeholders.map(placeholder => placeholder.sample)).toEqual(['1', 'EC_REQ_ONL', undefined, undefined, undefined]);
  });

  it('prefers a real query value over the host example', () => {
    const group = notificationPlaceholderGroup(COLUMNS, { totalCount: 1, rows: [{ name: 'CM_REV_SP' }] }, t, { exampleOf: () => 'example' });

    expect(group.placeholders[1].sample).toBe('CM_REV_SP');
  });
});
