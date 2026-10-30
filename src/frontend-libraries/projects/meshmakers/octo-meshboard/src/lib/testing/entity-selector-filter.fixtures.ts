import type { EntitySelectorConfig } from '../models/meshboard.models';

/**
 * Board fixtures for the selector picker filter (AB#7724). Neutral types only
 * (Test/Site, Test/System, Test/Device).
 */

/**
 * A Dashboard description exactly as the library encodes it before AB#7724
 * (after AB#7721–7723): a visible leader, a follower with a one-hop scope, a
 * visible selector with a multi-hop path and a fixed selector with a default.
 * Boards exported today look like this; they must decode unchanged, carry no
 * filter and re-encode byte-identically.
 */
export const PRE_7724_DESCRIPTION = 'Site overview\n---MESHBOARD_VARIABLES---\n'
  + '{"variables":[{"name":"region","label":"Region","type":"string","source":"static","value":"North"}],'
  + '"entitySelectors":[{"id":"site","label":"Site","ckTypeId":"Test/System","attributeMappings":[{"attributePath":"name","variableName":"siteName","attributeValueType":"STRING"}],"showInToolbar":true,"defaultRtId":"sys-1"},'
  + '{"id":"devices","label":"Devices","ckTypeId":"Test/System","attributeMappings":[],"showInToolbar":false,'
  + '"childScope":{"targetCkTypeId":"Test/Device","roleId":"System/ParentChild","direction":"in"},"followsSelectorId":"site"},'
  + '{"id":"area","label":"Area","ckTypeId":"Test/Site","attributeMappings":[],"showInToolbar":true,'
  + '"childScope":{"path":[{"roleId":"System/ParentChild","direction":"in","targetCkTypeId":"Test/System"},{"roleId":"System/ParentChild","direction":"in","targetCkTypeId":"Test/Device"}]}}]}';

/** A visible selector that lists only the electrical systems of a region. */
export const FILTERED_SYSTEMS: EntitySelectorConfig = {
  id: 'system',
  label: 'System',
  ckTypeId: 'Test/System',
  attributeMappings: [{ attributePath: 'name', variableName: 'systemName', attributeValueType: 'STRING' }],
  showInToolbar: true,
  defaultRtId: 'sys-1',
  filters: [
    { attributePath: 'systemType', operator: 'EQUALS', comparisonValue: 'Electrical' },
    { attributePath: 'region', operator: 'LIKE', comparisonValue: '$region' }
  ]
};
