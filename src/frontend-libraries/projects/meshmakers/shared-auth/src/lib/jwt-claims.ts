/**
 * Minimal JWT payload access for the claims this library routes on: `tenant_id` and
 * `allowed_tenants`.
 *
 * Decoding only, no signature validation. The token was issued to this client by identity and
 * is used for client-side decisions the backend enforces again on every request.
 */
export function decodeJwtPayload(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) {
    return null;
  }
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** The `tenant_id` claim: the tenant the token was issued for, or null. */
export function tenantIdFromToken(token: string | null | undefined): string | null {
  const tenantId = decodeJwtPayload(token)?.['tenant_id'];
  return typeof tenantId === 'string' && tenantId.length > 0 ? tenantId : null;
}

/** The `allowed_tenants` claim as a list. A single-valued claim arrives as a plain string. */
export function allowedTenantsFromToken(token: string | null | undefined): string[] {
  const allowed = decodeJwtPayload(token)?.['allowed_tenants'];
  if (Array.isArray(allowed)) {
    return allowed.filter((tenantId): tenantId is string => typeof tenantId === 'string');
  }
  if (typeof allowed === 'string') {
    return [allowed];
  }
  return [];
}
