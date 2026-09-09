/**
 * Direction a deep-graph export follows one association role (AB#5003/AB#5004).
 * Numeric values mirror the backend `GraphDirections` enum and travel over the REST
 * body as integers (there is no string-enum converter on the asset-repo surface).
 */
export enum DeepGraphDirectionDto {
  Inbound = 1,
  Outbound = 2
}

/**
 * One directed edge-following rule for the role-set deep-graph export: follow the given
 * association role only in the given direction. Directed following keeps hub types as
 * dead-ends, so the export does not over-collect the connected graph.
 */
export interface DeepGraphFollowSpecDto {
  roleId: string;
  direction: DeepGraphDirectionDto;
}
