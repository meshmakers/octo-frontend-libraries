/**
 * One named public base domain configured on the Communication Controller
 * instance. The Studio displays these in the workload edit form so users can
 * insert `{{domain.NAME}}` placeholders into a workload's `hostname` instead of
 * typing the full FQDN. The controller resolves the placeholder at deploy
 * time against the same map, so the runtime entity stays cluster-portable.
 *
 * Returned by `GET {tenantId}/v1/communication/domains` (see
 * `CommunicationService.getDomains`).
 */
export interface DomainConfigurationDto {
  /** Lookup key referenced by templates, e.g. `default` in `adapter.{{domain.default}}`. */
  name: string;
  /** Resolved base domain (no scheme, no leading dot), e.g. `staging.octo-mesh.com`. */
  baseDomain: string;
}
