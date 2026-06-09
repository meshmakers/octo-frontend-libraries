import { AiJobKind } from './ai-session';

/**
 * Wire shape returned by `GET /{tenantId}/v1/app-templates` (#4145). Each entry
 * is one option in the Studio's "New App from Template" wizard. The wizard
 * fills the goal placeholders and uses `jobKind` when it POSTs `/sessions`.
 *
 * Mirrors `AppTemplateResponse` in the adapter
 * (`src/AiServices/TenantApi/v1/Models/AppTemplateResponse.cs`). The JSON is
 * camel-cased on the wire; the C# DTO is PascalCased server-side.
 */
export interface AiAppTemplateDto {
  /** Stable identifier the wizard echoes on submit (`crud-list`, `dashboard`, `form-only`). */
  readonly id: string;
  /** Display name for the template picker. */
  readonly name: string;
  /** One-paragraph description shown next to the picker entry. */
  readonly description: string;
  /**
   * JobKind enum key the adapter expects when the wizard POSTs the session.
   * The wire is the CK enum key as string — see `AiJobKind` for the values
   * the adapter currently emits. Today every Phase-1 template uses
   * `Application`.
   */
  readonly jobKind: AiJobKind;
  /**
   * Handlebars-style template the wizard interpolates with operator inputs
   * (e.g. `{{projectName}}`, `{{primaryEntity}}`). The rendered text is what
   * goes onto `CreateSessionRequestDto.goal` — the adapter never interpolates,
   * so the operator sees the final Goal in the wizard before submit.
   */
  readonly goalTemplate: string;
  /**
   * Names of the placeholders the wizard must collect before enabling Submit.
   * Drives the form's required-field gate without the wizard having to parse
   * `goalTemplate`.
   */
  readonly requiredPlaceholders: readonly string[];
}

/**
 * The shape the wizard emits on Submit. The host page is expected to render
 * `goal` (interpolated from the picked template) into a
 * `CreateSessionRequestDto` and call `createSession` on the adapter client.
 */
export interface AiNewAppSubmission {
  readonly templateId: string;
  readonly jobKind: AiJobKind;
  readonly projectName: string;
  readonly primaryEntity: string;
  /** The fully interpolated Goal string — what the wizard would POST on submit. */
  readonly goal: string;
}
