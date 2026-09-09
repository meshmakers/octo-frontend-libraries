// AB#5125: an admin-managed e-mail→user binding (verified whitelist) for a tenant. Backed by the
// identity TenantApi controller EmailIdentifierBindings ({tenantId}/v1/emailidentifierbindings).
export interface EmailIdentifierBindingDto {
  rtId?: string;
  // The bound e-mail address (normalized, lower-case).
  email?: string;
  // RtId of the user the address maps to; null/absent when the binding is dangling.
  userId?: string;
  userName?: string;
  userEmail?: string;
  // Stored ENROLLMENT trust ("Strong" for an admin whitelist entry). NOT per-message trust: an
  // inbound mail is only as trusted as its DKIM/DMARC verdict, evaluated on ingest.
  enrollmentTrust?: string;
  source?: string;
  enrolledAt?: string;
  lastVerifiedAt?: string;
  isValid?: boolean;
}

// Request to bind an e-mail address to a user (admin verified whitelist).
export interface CreateEmailIdentifierBindingDto {
  userId?: string;
  email?: string;
}
