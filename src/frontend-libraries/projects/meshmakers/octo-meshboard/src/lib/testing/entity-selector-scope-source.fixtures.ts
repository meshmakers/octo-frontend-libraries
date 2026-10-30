import type { EntitySelectorConfig, EntitySelectorScopeHop } from '../models/meshboard.models';

/**
 * Board fixtures for dependent selectors (AB#7915). Neutral types only
 * (Test/Site → Test/Building → Test/Storey → Test/Room).
 */

export const TO_BUILDING: EntitySelectorScopeHop = { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Building' };
export const TO_STOREY: EntitySelectorScopeHop = { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Storey' };
export const TO_ROOM: EntitySelectorScopeHop = { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Room' };

/**
 * Association graph: sourceRtId → target rtIds, per target type. Room
 * `room-2` is reached from both storeys of `bld-1` (duplicate across
 * branches); `site-2` has a building without storeys; `site-3` has none.
 */
export const SITE_GRAPH: Record<string, Record<string, string[]>> = {
  'Test/Building': { 'site-1': ['bld-1', 'bld-2'], 'site-2': ['bld-3'], 'site-3': [], 'site-4': ['bld-4'] },
  'Test/Storey': { 'bld-1': ['st-1', 'st-2'], 'bld-2': ['st-3'], 'bld-3': [], 'bld-4': ['st-4'] },
  'Test/Room': { 'st-1': ['room-1', 'room-2'], 'st-2': ['room-2', 'room-3'], 'st-3': ['room-4'], 'st-4': ['room-5'] }
};

/** The leader: a visible site picker. */
export const SITE: EntitySelectorConfig = {
  id: 'site',
  label: 'Site',
  ckTypeId: 'Test/Site',
  attributeMappings: [],
  showInToolbar: true
};

/** A dependent room picker: lists only the rooms of the picked site (three hops). */
export const ROOM: EntitySelectorConfig = {
  id: 'room',
  label: 'Room',
  ckTypeId: 'Test/Room',
  attributeMappings: [],
  showInToolbar: true,
  scopeSource: { selectorId: 'site', path: [TO_BUILDING, TO_STOREY, TO_ROOM] }
};

/** A dependent building picker with a one-hop path (still stored as `path`). */
export const BUILDING: EntitySelectorConfig = {
  id: 'building',
  label: 'Building',
  ckTypeId: 'Test/Building',
  attributeMappings: [],
  showInToolbar: true,
  scopeSource: { selectorId: 'site', path: [TO_BUILDING] }
};

/**
 * A Dashboard description exactly as the library encodes it before AB#7915
 * (after AB#7721–7725): a visible leader with a default, a follower with a
 * one-hop child scope, a visible selector with a multi-hop path and a filtered
 * selector. Boards exported today look like this; they must decode unchanged,
 * carry no scope source and re-encode byte-identically.
 */
export const PRE_7915_DESCRIPTION = 'Site overview\n---MESHBOARD_VARIABLES---\n'
  + '{"variables":[{"name":"region","label":"Region","type":"string","source":"static","value":"North"}],'
  + '"entitySelectors":[{"id":"site","label":"Site","ckTypeId":"Test/Site","attributeMappings":[{"attributePath":"name","variableName":"siteName","attributeValueType":"STRING"}],"showInToolbar":true,"defaultRtId":"site-1"},'
  + '{"id":"buildings","label":"Buildings","ckTypeId":"Test/Site","attributeMappings":[],"showInToolbar":false,'
  + '"childScope":{"targetCkTypeId":"Test/Building","roleId":"System/ParentChild","direction":"in"},"followsSelectorId":"site"},'
  + '{"id":"area","label":"Area","ckTypeId":"Test/Site","attributeMappings":[],"showInToolbar":true,'
  + '"childScope":{"path":[{"roleId":"System/ParentChild","direction":"in","targetCkTypeId":"Test/Building"},{"roleId":"System/ParentChild","direction":"in","targetCkTypeId":"Test/Storey"}]}},'
  + '{"id":"room","label":"Room","ckTypeId":"Test/Room","attributeMappings":[],"showInToolbar":true,'
  + '"filters":[{"attributePath":"usage","operator":"EQUALS","comparisonValue":"Office"},{"attributePath":"region","operator":"LIKE","comparisonValue":"$region"}]}]}';
