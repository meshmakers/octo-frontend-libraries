/**
 * Pipeline reassignment DTOs.
 *
 * Mirrors `Meshmakers.Octo.Communication.Contracts.DataTransferObjects.MovePipeline*`
 * on the backend (octo-sdk). Studio's "move pipeline to another adapter"
 * flow PATCHes the controller with one of these and renders the per-pipeline
 * outcome list.
 */

/**
 * Body for PATCH `{tenantId}/v1/pipeline/move-to-adapter`.
 *
 * Each pipeline is moved atomically on the server (Executes-association
 * swap in one transaction). The bulk wrapper collects per-pipeline
 * outcomes so a single failure does not abort the batch. When `redeploy`
 * is set, the server re-fires `DeployPipeline` on the target adapter for
 * every successfully moved pipeline; a redeploy failure does NOT roll
 * the move back.
 */
export interface MovePipelinesToAdapterRequestDto {
  pipelineRtIds: string[];
  targetAdapterRtId: string;
  redeploy: boolean;
}

/**
 * Outcome of a single pipeline inside a bulk move. `success` is `true` iff
 * the assoc swap committed cleanly. The old / new adapter ids are filled in
 * even on success so the caller can render "moved from X to Y" toasts
 * without an extra round-trip. When `redeploy=true` is set on the request
 * and the move succeeded but the follow-up redeploy failed, `success`
 * stays `true` and `errorMessage` carries the redeploy warning.
 */
export interface MovePipelineResultDto {
  pipelineRtId: string;
  success: boolean;
  oldAdapterRtId: string | null;
  newAdapterRtId: string | null;
  errorMessage: string | null;
}

/**
 * Response of `MovePipelinesToAdapterRequestDto`. The server always returns
 * 200 with the per-pipeline result list — even when every pipeline failed —
 * so the client can inspect each outcome without parsing different HTTP-
 * status shapes.
 */
export interface MovePipelinesToAdapterResponseDto {
  results: MovePipelineResultDto[];
}
