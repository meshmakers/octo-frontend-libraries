
export enum HealthStatus{

  /*
   * Indicates that the health check determined that the component was unhealthy, or an unhandled
   */
  Unhealthy = "Unhealthy",

  /*
   * Indicates that the health check determined that the component was in a degraded state.
   */
  Degraded = "Degraded",

  /*
   * Indicates that the health check determined that the component was healthy.
   */
  Healthy = "Healthy"
}

export interface HealthCheckResult{
  title: string;
  data: Map<string, unknown> | null;
  description: string | null;
  status: HealthStatus;
}

export interface HealthCheck {
  status: HealthStatus;
  results: HealthCheckResult[];
}
