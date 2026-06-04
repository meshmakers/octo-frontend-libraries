/**
 * One named public base domain configured on the Communication Controller
 * instance. The Studio displays these in the workload edit form so users can
 * insert `{{domain.NAME}}` placeholders into a workload's `hostname` instead of
 * typing the full FQDN. The controller resolves the placeholder at deploy
 * time against the same map, so the runtime entity stays cluster-portable.
 *
 * Returned by `GET {tenantId}/v1/communication/domains` (see
 * `CommunicationService.getDomains`). Kept for backward compatibility with
 * older clients that only need domains — new editors should use
 * `WorkloadVariableDto` via `getWorkloadVariables()`, which covers all three
 * placeholder families.
 */
export interface DomainConfigurationDto {
  /** Lookup key referenced by templates, e.g. `default` in `adapter.{{domain.default}}`. */
  name: string;
  /** Resolved base domain (no scheme, no leading dot), e.g. `staging.octo-mesh.com`. */
  baseDomain: string;
}

/**
 * One template placeholder available to workloads' `hostname`, non-secret
 * `valueOverride.value` and `valuesYaml`. Returned by
 * `GET {tenantId}/v1/communication/workload-variables` (see
 * `CommunicationService.getWorkloadVariables`).
 *
 * The endpoint surfaces three families in one list so the Studio's workload
 * editor can offer a single suggestion / preview source:
 * - `{{context.tenantId}}` — per-deploy, `sampleValue` is `null`.
 * - `{{domain.NAME}}` — one entry per configured named domain; `sampleValue`
 *   holds the configured base domain.
 * - `{{service.NAME}}` — one entry per configured public service URL;
 *   `sampleValue` holds the configured URL.
 */
export interface WorkloadVariableDto {
  /** Full template token including braces, e.g. `{{service.authority}}`. */
  placeholder: string;
  /** Human-readable description of what the placeholder resolves to. */
  description: string;
  /**
   * Configured value snapshot for cluster-config-driven placeholders.
   * `null` for per-deploy values like `{{context.tenantId}}` that the
   * controller substitutes at deploy time.
   */
  sampleValue: string | null;
}
