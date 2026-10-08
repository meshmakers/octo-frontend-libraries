import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CONFIGURATION_SERVICE } from './configuration.service';
import { TENANT_ID_PROVIDER } from './tenant-provider';

/**
 * A reference to a stored binary, as found in a `BINARY_LINKED` attribute value or a
 * `LargeBinaryInfo` GraphQL object. Every field is optional because the two shapes differ:
 *
 * - typed GraphQL fields (`content { binaryId filename contentType size downloadUri }`) carry
 *   `downloadUri`;
 * - the generic `attributes { value }` projection (runtime browser, property grid) carries only
 *   `{ binaryId, filename, contentType, size }` — the server serialises the stored
 *   `EntityBinaryInfo` as-is and adds no link.
 */
export interface BinaryReference {
  /** Id of the large binary (GridFS file id). Used to build the download URL when no `downloadUri` is given. */
  binaryId?: string | null;
  /** Ready-made download URL (`{assetServices}{tenant}/v1/largeBinaries?largeBinaryId=…`). Wins over `binaryId`. */
  downloadUri?: string | null;
  /** File name stored with the binary; the save-as name when the response sends no `Content-Disposition`. */
  filename?: string | null;
  /** MIME type stored with the binary; applied when the response carries no specific type. */
  contentType?: string | null;
}

/** Options for {@link FileDownloadService.downloadBinary}. */
export interface BinaryDownloadOptions {
  /** Tenant that owns the binary. Defaults to the ambient `TENANT_ID_PROVIDER`. */
  tenantId?: string | null;
  /** Save-as name when neither `Content-Disposition` nor the reference names the file. */
  fallbackFileName?: string;
}

/** Thrown when a reference can be turned into no download URL (no `downloadUri`, no `binaryId`, or no tenant). */
export class BinaryDownloadUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BinaryDownloadUnavailableError';
  }
}

const DEFAULT_FILE_NAME = 'download';

/**
 * Reads the file name from a `Content-Disposition` header (RFC 6266). The RFC 5987 form
 * `filename*=UTF-8''…` wins over the plain `filename=` parameter, as browsers do.
 * Returns `null` when the header is absent or names no file.
 *
 * Note: a cross-origin response exposes `Content-Disposition` to script only when the server lists
 * it in `Access-Control-Expose-Headers`; otherwise this sees `null` and the caller's fallback applies.
 */
export function parseContentDispositionFileName(header: string | null | undefined): string | null {
  if (!header) {
    return null;
  }

  const extended = /filename\*\s*=\s*([^;]+)/i.exec(header);
  if (extended) {
    const raw = extended[1].trim().replace(/^"(.*)"$/, '$1');
    // charset'language'percent-encoded-value
    const parts = /^([^']*)'[^']*'(.*)$/.exec(raw);
    const encoded = parts ? parts[2] : raw;
    try {
      const decoded = decodeURIComponent(encoded);
      if (decoded) {
        return sanitizeFileName(decoded);
      }
    } catch {
      // Malformed percent-encoding: fall through to the plain parameter.
    }
  }

  const plain = /(?:^|;)\s*filename\s*=\s*("((?:[^"\\]|\\.)*)"|[^;]+)/i.exec(header);
  if (plain) {
    const value = plain[2] !== undefined ? plain[2].replace(/\\(.)/g, '$1') : plain[1].trim();
    if (value) {
      return sanitizeFileName(value);
    }
  }

  return null;
}

/** Strips any path a server might send along with the name; the browser would refuse it anyway. */
function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  return base.trim();
}

/**
 * Authenticated file downloads for the browser (AB#6171 decision D9).
 *
 * Binaries live behind the asset repository's `GET {tenant}/v1/largeBinaries`, which needs a bearer
 * token with an API scope. Opening the URL in a new tab (`window.open`) sends no token — the service
 * then signs the tab in through its own login without that scope and answers 403 (AB#5268), and a
 * popup blocker may swallow the tab anyway because the click is over by the time a URL is known.
 *
 * This service therefore fetches the file through `HttpClient`, so the host's `authorizeInterceptor`
 * attaches the bearer (it covers every URL under the configured service URIs, i.e.
 * `config.assetServices`), receives a `Blob`, and saves it through a temporary anchor under the real
 * file name — from `Content-Disposition` when the server sends one, else from the binary's stored
 * file name. It is owner-agnostic: any `BINARY_LINKED` value works, whichever CK type holds it.
 *
 * @example
 * ```typescript
 * const downloads = inject(FileDownloadService);
 * // generic attribute value { binaryId, filename, contentType, size }
 * await downloads.downloadBinary(attributeValue);
 * // any authenticated URL
 * await downloads.downloadUrl(`${assetServices}${tenantId}/v1/files/content?path=…`, 'report.pdf');
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class FileDownloadService {
  private readonly httpClient = inject(HttpClient);
  private readonly configurationService = inject(CONFIGURATION_SERVICE, { optional: true });
  private readonly tenantIdProvider = inject(TENANT_ID_PROVIDER, { optional: true });

  /**
   * Builds the asset repository download URL for a large binary:
   * `{assetServices}{tenantId}/v1/largeBinaries?largeBinaryId={binaryId}`.
   * Returns `null` when the asset service URL or the tenant is unknown.
   */
  async buildLargeBinaryUri(binaryId: string, tenantId?: string | null): Promise<string | null> {
    const assetServices = this.configurationService?.config?.assetServices;
    const tenant = tenantId ?? (this.tenantIdProvider ? await this.tenantIdProvider() : null);
    if (!assetServices || !tenant) {
      return null;
    }

    const base = assetServices.endsWith('/') ? assetServices : `${assetServices}/`;
    return `${base}${encodeURIComponent(tenant)}/v1/largeBinaries?largeBinaryId=${encodeURIComponent(binaryId)}`;
  }

  /**
   * Downloads a binary reference (a `BINARY_LINKED` value or `LargeBinaryInfo`) with the user's
   * bearer token and saves it. Uses `downloadUri` when present, else builds the URL from `binaryId`.
   *
   * @throws BinaryDownloadUnavailableError when no download URL can be determined.
   * @throws HttpErrorResponse when the server refuses or fails the download.
   */
  async downloadBinary(reference: BinaryReference, options?: BinaryDownloadOptions): Promise<void> {
    let url = reference.downloadUri || null;
    if (!url && reference.binaryId) {
      url = await this.buildLargeBinaryUri(reference.binaryId, options?.tenantId);
    }
    if (!url) {
      throw new BinaryDownloadUnavailableError(
        reference.binaryId
          ? 'Cannot build a download URL: asset service URL or tenant unknown'
          : 'The binary reference carries neither downloadUri nor binaryId');
    }

    await this.downloadUrl(url, reference.filename || options?.fallbackFileName, reference.contentType);
  }

  /**
   * Fetches any authenticated URL as a blob and saves it. The file name comes from
   * `Content-Disposition` when exposed, else from `fallbackFileName`, else `download`.
   */
  async downloadUrl(url: string, fallbackFileName?: string | null, contentType?: string | null): Promise<void> {
    const response = await this.fetchBlob(url);
    const blob = this.withContentType(response.body ?? new Blob(), contentType);
    const fileName = parseContentDispositionFileName(response.headers.get('Content-Disposition'))
      || fallbackFileName
      || DEFAULT_FILE_NAME;
    this.saveBlob(blob, fileName);
  }

  /**
   * Fetches an authenticated URL as a blob response, e.g. for an inline preview.
   * The bearer is attached by the host's `authorizeInterceptor`.
   */
  fetchBlob(url: string): Promise<HttpResponse<Blob>> {
    return firstValueFrom(this.httpClient.get(url, { responseType: 'blob', observe: 'response' }));
  }

  /**
   * Hands a blob to the browser as a file download through a temporary anchor — not `window.open`,
   * which a popup blocker would swallow once the click is over.
   */
  saveBlob(blob: Blob, fileName: string): void {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.rel = 'noopener';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      // Safari needs the URL to outlive the click, so it is released on the next macrotask.
      setTimeout(() => URL.revokeObjectURL(objectUrl));
    }
  }

  /** Re-types a blob the server sent as generic octet-stream when the stored type is more specific. */
  private withContentType(blob: Blob, contentType?: string | null): Blob {
    if (contentType && (!blob.type || blob.type === 'application/octet-stream') && contentType !== blob.type) {
      return new Blob([blob], { type: contentType });
    }
    return blob;
  }
}
