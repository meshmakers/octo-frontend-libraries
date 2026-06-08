/**
 * Body for `POST /{tenantId}/v1/credentials/github-pat`. The plaintext token is
 * validated against GitHub's `/user` endpoint before encryption — a refused
 * token comes back as HTTP 422 + `error: 'github_refused_token'`.
 */
export interface RegisterAiGitHubPatRequestDto {
  /** Operator-supplied label so PATs are tellable apart in the list view. */
  readonly name: string;

  /** Plaintext token. Never persisted client-side; cleared from the form on submit. */
  readonly token: string;

  /** Free-form scope hint — purely informational. */
  readonly scope?: string;
}

/**
 * Wire shape returned by `GET /{tenantId}/v1/credentials/github-pat`. Carries
 * neither the plaintext token nor the encrypted ciphertext — only enough to
 * render a row + offer Revoke.
 */
export interface AiGitHubPatDto {
  /** Binding rtId — pass to delete. */
  readonly rtId: string;

  /** Operator-supplied label from registration. */
  readonly name: string;

  /** Operator-supplied free-form scope hint. */
  readonly scope: string;

  /** Last four characters of the plaintext token preceded by "…" (e.g. "…ABCD"). */
  readonly maskedTail: string;

  /**
   * GitHub login the token authenticated as during registration. Null when the
   * binding's ciphertext is unreadable (rotation gone wrong) — UI should hint
   * "revoke and re-register" in that case.
   */
  readonly gitHubLogin?: string | null;
}
