import type { EntitySelectorConfig } from '../models/meshboard.models';

/**
 * Board fixtures for the multi-hop child scope (AB#7723). Neutral types only
 * (Test/Site → Test/System → Test/Device → Test/Sensor).
 */

/**
 * A Dashboard description exactly as the current library (after AB#7722, before
 * AB#7723) encodes it: a visible site selector, a hidden follower with a one-hop
 * child scope and a fixed selector with a one-hop scope. Boards exported today
 * look like this; they must decode, resolve and re-encode unchanged.
 */
export const PRE_7723_DESCRIPTION = 'Site overview\n---MESHBOARD_VARIABLES---\n'
  + '{"entitySelectors":[{"id":"site","label":"Site","ckTypeId":"Test/Site","attributeMappings":[{"attributePath":"name","variableName":"siteName","attributeValueType":"STRING"}],"showInToolbar":true},'
  + '{"id":"systems","label":"Systems","ckTypeId":"Test/Site","attributeMappings":[],"showInToolbar":false,'
  + '"childScope":{"targetCkTypeId":"Test/System","roleId":"System/ParentChild","direction":"in"},"followsSelectorId":"site"},'
  + '{"id":"devices","label":"Devices","ckTypeId":"Test/System","attributeMappings":[],"showInToolbar":false,"defaultRtId":"sys-1",'
  + '"childScope":{"targetCkTypeId":"Test/Device","roleId":"System/ParentChild","direction":"in"}}]}';

/** The selectors {@link PRE_7723_DESCRIPTION} decodes to. */
export const PRE_7723_SELECTORS: EntitySelectorConfig[] = [
  {
    id: 'site',
    label: 'Site',
    ckTypeId: 'Test/Site',
    attributeMappings: [{ attributePath: 'name', variableName: 'siteName', attributeValueType: 'STRING' }],
    showInToolbar: true
  },
  {
    id: 'systems',
    label: 'Systems',
    ckTypeId: 'Test/Site',
    attributeMappings: [],
    showInToolbar: false,
    childScope: { targetCkTypeId: 'Test/System', roleId: 'System/ParentChild', direction: 'in' },
    followsSelectorId: 'site'
  },
  {
    id: 'devices',
    label: 'Devices',
    ckTypeId: 'Test/System',
    attributeMappings: [],
    showInToolbar: false,
    defaultRtId: 'sys-1',
    childScope: { targetCkTypeId: 'Test/Device', roleId: 'System/ParentChild', direction: 'in' }
  }
];

/** A visible site selector whose two-hop path reaches the devices of the site's systems. */
export const SITE_TO_DEVICES: EntitySelectorConfig = {
  id: 'site',
  label: 'Site',
  ckTypeId: 'Test/Site',
  attributeMappings: [],
  showInToolbar: true,
  childScope: {
    path: [
      { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/System' },
      { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Device' }
    ]
  }
};
