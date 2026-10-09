import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpEventType } from '@angular/common/http';
import { MM_CALLER_HANDLED_STATUSES } from '@meshmakers/shared-services';
import { filter, firstValueFrom, from, map, Observable, switchMap } from 'rxjs';
import { CONFIGURATION_SERVICE } from './configuration.service';
import { TENANT_ID_PROVIDER } from './tenant-provider';
import { FileDownloadService } from './file-download.service';

/**
 * ===============================================================================================
 *  PLANNED CONTRACT — asset-repo file bytes API (epic AB#6171, backend S2 AB#6174, zip AB#6225).
 *  Verify against the backend before go-live.
 * ===============================================================================================
 *
 * Only the BYTES of files go through REST (`{assetServices}{tenant}/v1/files`); metadata, folders,
 * roots, linked entities, rename, move and delete go through GraphQL against `System.Files`
 * (decision of the Studio PO, 2026-10-09). Endpoints:
 *
 * | Method | Path | Body / query | Result |
 * |---|---|---|---|
 * | GET  | `/capabilities` | — | {@link FilesCapabilities}; 404 = file API not deployed |
 * | PUT  | `/{root}/{folderPath…}/{name}` | raw body, `Content-Type`, `?conflict=fail\|replace\|keepBoth` | stored item (JSON); 409 name taken, 413 too large, 403 denied |
 * | GET  | `/{root}/{path…}` | — | content with `Content-Disposition: attachment; filename*=…` |
 * | POST | `/zip` | `{ items: [{ root, path }] }` | streamed zip (AB#6225) |
 *
 * Path segments are URL-encoded one by one; `root` is the folder root's well-known name.
 */

/** What the server reports about the file API (`GET /capabilities`). */
export interface FilesCapabilities {
  /** The file bytes API is deployed for the tenant. */
  available: boolean;
  /** Largest file one upload may carry (bytes). */
  maxUploadBytes?: number;
  /** The streamed zip endpoint exists (AB#6225). */
  zipDownload?: boolean;
  zipMaxFiles?: number;
  zipMaxBytes?: number;
}

/** How an upload treats an existing file with the same name. */
export type FilesConflictMode = 'fail' | 'replace' | 'keepBoth';

/** Progress of one upload, then the stored item the server returns. */
export type FilesUploadEvent<TItem = unknown> =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'done'; item: TItem };

/** Addresses a file or folder for the zip endpoint. */
export interface FilesItemRef {
  root: string;
  path: string;
}

/** Statuses the callers of this client handle themselves (no global error toast). */
const CALLER_HANDLED = [404, 409, 413, 403];

/**
 * Bytes client of the platform file system (AB#6178): upload with progress, download with the
 * user's bearer as a blob under the real file name (decision D9, via {@link FileDownloadService}),
 * the server-side zip, and capability detection.
 *
 * - The bearer is attached by the host's `authorizeInterceptor` (all URLs under `assetServices`).
 * - Statuses the caller handles (403, 404, 409, 413) are excluded from the global HTTP error toast
 *   via `MM_CALLER_HANDLED_STATUSES`; the caller shows them where they belong (inline, panel row).
 * - {@link detectCapabilities} asks `GET /capabilities` once per tenant; a 404 (file API not
 *   deployed yet) answers `{ available: false }` silently, so hosts can probe safely.
 *
 * @example
 * ```typescript
 * const files = inject(FilesClientService);
 * if ((await files.detectCapabilities()).available) {
 *   files.upload('Files', 'Receipts 2026', file, 'keepBoth').subscribe(e => …);
 *   await files.download('Files', 'Receipts 2026/a.pdf', 'a.pdf');
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class FilesClientService {
  private readonly http = inject(HttpClient);
  private readonly configuration = inject(CONFIGURATION_SERVICE, { optional: true });
  private readonly tenantIdProvider = inject(TENANT_ID_PROVIDER, { optional: true });
  private readonly downloads = inject(FileDownloadService);
  private readonly capabilityCache = new Map<string, Promise<FilesCapabilities>>();

  /**
   * Whether the file API exists for the tenant, plus the server's limits. Cached per tenant;
   * transient failures (network, 5xx) are not cached, so a later call asks again.
   */
  async detectCapabilities(tenantId?: string | null): Promise<FilesCapabilities> {
    const tenant = await this.tenant(tenantId);
    if (!tenant || !this.configuration?.config?.assetServices) {
      return { available: false };
    }
    let cached = this.capabilityCache.get(tenant);
    if (!cached) {
      cached = this.fetchCapabilities(tenant);
      this.capabilityCache.set(tenant, cached);
      cached.catch(() => this.capabilityCache.delete(tenant));
    }
    try {
      return await cached;
    } catch {
      return { available: false };
    }
  }

  /** Forgets the detected capabilities (tests, tenant switch). */
  resetCapabilities(): void {
    this.capabilityCache.clear();
  }

  /**
   * Uploads one file into a folder with progress events (`HttpClient` `reportProgress`).
   * Unsubscribing cancels the request. Errors are `HttpErrorResponse` (409 conflict, 413 too large).
   */
  upload<TItem = unknown>(root: string, folderPath: string, file: File, conflict: FilesConflictMode, tenantId?: string | null): Observable<FilesUploadEvent<TItem>> {
    return from(this.itemUrl(root, joinSegments(folderPath, file.name), tenantId)).pipe(
      switchMap((url) =>
        this.http.put<TItem>(url, file, {
          params: { conflict },
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          reportProgress: true,
          observe: 'events',
          context: callerHandled(),
        })),
      filter((event) => event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response),
      map((event): FilesUploadEvent<TItem> => {
        if (event.type === HttpEventType.UploadProgress) {
          return { type: 'progress', loaded: event.loaded, total: event.total ?? file.size };
        }
        return { type: 'done', item: (event as { body: TItem }).body };
      }),
    );
  }

  /** Downloads a file with the user's bearer and saves it under its real name (D9). */
  async download(root: string, path: string, fileName?: string | null, contentType?: string | null, tenantId?: string | null): Promise<void> {
    await this.downloads.downloadUrl(await this.itemUrl(root, path, tenantId), fileName, contentType, callerHandled());
  }

  /** Fetches a file's content as a blob (inline preview). */
  async fetchContent(root: string, path: string, tenantId?: string | null): Promise<Blob> {
    const response = await this.downloads.fetchBlob(await this.itemUrl(root, path, tenantId), callerHandled());
    return response.body ?? new Blob();
  }

  /** Server-side streamed zip of several items (AB#6225); saved under `fileName`. */
  async downloadZip(items: FilesItemRef[], fileName: string, tenantId?: string | null): Promise<void> {
    const url = await this.url(tenantId, 'zip');
    const response = await firstValueFrom(this.http.post(url, { items }, { responseType: 'blob', observe: 'response', context: callerHandled() }));
    this.downloads.saveBlob(response.body ?? new Blob(), fileName);
  }

  /**
   * `{assetServices}{tenant}/v1/files/{root}/{seg}/…` with every segment URL-encoded.
   *
   * @throws FilesPathError for an empty root or a `.` / `..` segment: browsers and proxies resolve
   *   dot segments even when percent-encoded, so such a URL would address a different resource.
   */
  async itemUrl(root: string, path: string, tenantId?: string | null): Promise<string> {
    const segments = path.split('/').filter((s) => s.length > 0);
    if (!root || [root, ...segments].some(isDotSegment)) {
      throw new FilesPathError(`Invalid file path: ${root}/${path}`);
    }
    return this.url(tenantId, root, ...segments);
  }

  private async fetchCapabilities(tenant: string): Promise<FilesCapabilities> {
    const url = await this.url(tenant, 'capabilities');
    try {
      const body = await firstValueFrom(this.http.get<Omit<FilesCapabilities, 'available'>>(url, { context: callerHandled([404, 405, 501]) }));
      return { ...body, available: true };
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 404 || status === 405 || status === 501) {
        return { available: false };
      }
      throw error;
    }
  }

  private async url(tenantId: string | null | undefined, ...segments: string[]): Promise<string> {
    const assetServices = this.configuration?.config?.assetServices ?? '';
    const base = assetServices.endsWith('/') ? assetServices : `${assetServices}/`;
    const tenant = (await this.tenant(tenantId)) ?? '';
    return `${base}${encodeURIComponent(tenant)}/v1/files/${segments.map(encodeURIComponent).join('/')}`;
  }

  private async tenant(tenantId?: string | null): Promise<string | null> {
    return tenantId ?? (this.tenantIdProvider ? await this.tenantIdProvider() : null);
  }
}

/** Thrown for a path the bytes API cannot address (empty root, `.` or `..` segments). */
export class FilesPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FilesPathError';
  }
}

function isDotSegment(segment: string): boolean {
  return segment === '.' || segment === '..';
}

function callerHandled(statuses: readonly number[] = CALLER_HANDLED): HttpContext {
  return new HttpContext().set(MM_CALLER_HANDLED_STATUSES, statuses);
}

function joinSegments(...parts: string[]): string {
  return parts.flatMap((p) => p.split('/')).filter((p) => p.length > 0).join('/');
}
