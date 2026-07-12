export interface ClientDto {
  /** Runtime ID of the client entity. Read-only; used to identify the client as a group member. */
  rtId?: string;
  isEnabled: boolean;
  clientId: string;
  clientName: string;
  clientUri: string;
  clientSecret: string;
  requireClientSecret: boolean;
  allowedGrantTypes: string[];
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  allowedCorsOrigins: string[];
  allowedScopes: string[];
  isOfflineAccessEnabled: boolean;

  /**
   * When true and this is a ClientCredentials client living in a parent tenant,
   * every new child tenant gets a mirror of this client auto-provisioned.
   * Enables a single ClientCredentials identity (typically a CI/CD agent) to
   * reach every tenant on the instance without per-tenant manual setup.
   * Optional — backend treats absence as "do not modify" on PUT.
   */
  autoProvisionInChildTenants?: boolean;

  /**
   * When set, this client is a mirror provisioned from the named parent tenant.
   * Sub-tenant UIs surface this as a read-only "Provisioned by parent tenant"
   * indicator; the client must not be edited locally because the next sync
   * would overwrite the change. Empty / undefined on locally-owned clients.
   */
  provisionedByParentTenantId?: string;

  /**
   * When true, this client was self-registered via RFC 7591 Dynamic Client
   * Registration (client id prefix `octo-dcr-`). Such clients are server-managed
   * and expire automatically; UIs render them read-only and exclude them from
   * export. Read-only — the backend ignores it on write.
   */
  dynamicRegistration?: boolean;

  /**
   * Expiry of a dynamically-registered client (registration time + TTL) as an
   * ISO 8601 string. After this moment the backend erases the client and its
   * per-tenant mirrors. Undefined on regular clients. Read-only.
   */
  dynamicRegistrationExpiresAt?: string;
}
