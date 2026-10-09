import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse, HttpEvent, HttpEventType, HttpParams } from '@angular/common/http';
import { MM_CALLER_HANDLED_STATUSES } from '@meshmakers/shared-services';
import { filter, firstValueFrom, from, map, Observable, switchMap, throwError } from 'rxjs';
import { CONFIGURATION_SERVICE } from './configuration.service';
import { TENANT_ID_PROVIDER } from './tenant-provider';
import { FileDownloadService, parseContentDispositionFileName } from './file-download.service';

/*
 * Asset-repo file bytes API (epic AB#6171: S2 AB#6174, zip AB#6225; client S13 AB#6230).
 *
 * Only the BYTES of files go through REST (`{assetServices}{tenant}/v1/files`); metadata — roots, folder
 * listings, create folder, rename, move, delete (recursive on the server), linked entities — goes through
 * the generic tenant GraphQL API against `System.Files` (decision Q1, 2026-10-09).
 *
 * | Method | Path | Notes |
 * |---|---|---|
 * | GET  | `capabilities` | {@link FilesCapabilities} |
 * | PUT  | `{root}/{path…}` | raw body upload, `?conflict=fail\|replace\|keepBoth&createFolders=true`; 201 new / 200 replaced |
 * | GET  | `{root}/{path…}` | download, `?inline=true` for previews |
 * | POST | `items/{rtId}/content?name=&conflict=` | upload into the folder or root `rtId` |
 * | PUT  | `items/{rtId}/content` | new content for the existing file `rtId` (rtId and links stay) |
 * | GET  | `items/{rtId}/content` | download by rtId, `?inline=true` for previews |
 * | GET  | `stats?root=&path=`, `items/{rtId}/stats` | {@link FolderStats} |
 * | POST | `zip` | `{ items, rtIds?, fileName? }` → streamed `application/zip` |
 *
 * Path segments are URL-encoded one by one; `root` is the folder root's well-known name. Errors are
 * problem details `{ status, title, detail, code }` (see {@link parseFilesProblem}).
 */

/** Well-known names a folder root cannot use because they are routes of the file API. */
export const FILES_RESERVED_ROOT_NAMES: readonly string[] = ['capabilities', 'items', 'stats', 'zip'];

/** What the server reports about the file API (`GET /capabilities`). */
export interface FilesCapabilities {
  /** The file bytes API is deployed for the tenant. */
  available: boolean;
  /** Version of the file API contract (1). */
  apiVersion?: number;
  /** Largest file one upload may carry (bytes). */
  maxUploadBytes?: number;
  /** The streamed zip endpoint exists (AB#6225). */
  zipDownload?: boolean;
  /** Largest number of files in one zip. */
  zipMaxFiles?: number;
  /** Largest sum of source sizes of one zip (bytes). */
  zipMaxBytes?: number;
  /** Largest file clients should preview inline (bytes, advisory). */
  previewMaxBytes?: number;
  /** A GraphQL delete of a folder or root removes everything below it on the server. */
  recursiveDelete?: boolean;
  /** {@link FilesClientService.folderStats} is available. */
  folderStats?: boolean;
  /** Well-known names a new folder root cannot use (lower case). */
  reservedRootNames?: string[];
  /**
   * Most entries one delete of a folder or root may remove (server `MaxDeleteEntries`, default 2,000).
   * Announced by the backend; absent until the server sends it.
   */
  maxDeleteEntries?: number;
  /**
   * Why the file API is not available for this tenant (tenant-aware capabilities answer
   * `available: false` + `reason`, e.g. System.Files not imported). Announced by the backend.
   */
  reason?: string;
}

/** How an upload treats an existing file with the same name. Skipping is a client decision, not a mode. */
export type FilesConflictMode = 'fail' | 'replace' | 'keepBoth';

/** Options of a path-addressed upload. */
export interface FilesUploadOptions {
  /** Default `fail` (409 NAME_CONFLICT). */
  conflict?: FilesConflictMode;
  /** Create missing folders on the way (default false: 404 PATH_NOT_FOUND). */
  createFolders?: boolean;
  /** Stored file name; defaults to `file.name`. */
  name?: string;
}

/** Options of an upload into a folder addressed by rtId. */
export interface FilesUploadToFolderOptions {
  /** Default `fail` (409 NAME_CONFLICT). */
  conflict?: FilesConflictMode;
  /** Stored file name; defaults to `file.name`. */
  name?: string;
  tenantId?: string | null;
}

/** Kind of a file system entry. */
export type FileEntryKind = 'file' | 'folder' | 'root';

/** A file or folder as answered by the REST file API (result of every upload). */
export interface FileEntry {
  rtId: string;
  /** `System.Files/FileSystemItem`, `System.Files/Folder` or `System.Files/FolderRoot`. */
  ckTypeId: string;
  kind: FileEntryKind;
  name: string;
  /** Root well-known name, when the entry was addressed by path. */
  root?: string | null;
  /** Path below the root incl. the name, when the entry was addressed by path. */
  path?: string | null;
  parentRtId?: string | null;
  size?: number | null;
  contentType?: string | null;
  binaryId?: string | null;
  /** ISO 8601 (UTC). */
  createdAt?: string | null;
  /** ISO 8601 (UTC). */
  changedAt?: string | null;
  createdBy?: string | null;
  /** True when the upload replaced the content of an existing file (HTTP 200 instead of 201). */
  replaced: boolean;
}

/** Progress of one upload, then the stored entry the server returns. */
export type FilesUploadEvent<TItem = FileEntry> =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'done'; item: TItem };

/** Addresses a file or folder by root well-known name and path (empty path = the root itself). */
export interface FilesItemRef {
  root: string;
  path: string;
}

/** Selection of a zip download: entries by path and/or by rtId; folders are included recursively. */
export interface FilesZipSelection {
  items?: FilesItemRef[];
  rtIds?: string[];
}

/** An entity a file is linked to (any association other than the folder tree). */
export interface FilesLinkedEntity {
  rtId: string;
  ckTypeId: string;
  displayName: string;
}

/** A linked file found by {@link FilesClientService.folderStats}. */
export interface FilesLinkedSample {
  rtId: string;
  name: string;
  /** Path below the folder the statistics were asked for. */
  path: string;
  /** Up to three linked entities visible to the caller. */
  entities: FilesLinkedEntity[];
}

/** Deep statistics of a root or folder (all levels, as visible to the caller). */
export interface FolderStats {
  folders: number;
  files: number;
  bytes: number;
  /** Visible files linked to another entity. */
  linkedFiles: number;
  /** Entries below the folder the caller cannot see; a delete includes them and fails if the caller may not delete them. */
  hiddenEntries: number;
  /** False when the server walk hit its limit (counts are lower bounds). */
  complete: boolean;
  /** Up to five linked files. */
  linkedSamples: FilesLinkedSample[];
}

/**
 * Stable error codes of the file system. REST answers carry them as problem-details `code`; the GraphQL
 * guards (create/rename/move/delete of `System.Files` entities) as `extensions.code`.
 */
export type FilesErrorCode =
  /** REST: the folder root does not exist or is not visible. */
  | 'ROOT_NOT_FOUND'
  /** REST: the path or rtId does not exist or is hidden by data permissions. */
  | 'PATH_NOT_FOUND'
  /** REST: a segment matches several legacy entries with the same name; address it by rtId. */
  | 'AMBIGUOUS_PATH'
  /** REST + GraphQL: the name is taken in the target folder (case-insensitive). */
  | 'NAME_CONFLICT'
  /** REST: the rtId is no folder or root. */
  | 'NOT_A_FOLDER'
  /** REST: the entry is no file. */
  | 'NOT_A_FILE'
  /** REST: upload or zip limit. GraphQL: a delete would remove more than `MaxDeleteEntries` (default 2,000) entries in one mutation. */
  | 'LIMIT_EXCEEDED'
  /** REST: data-permission write denial. GraphQL: also root creation without the `FileManagement` role. */
  | 'FORBIDDEN'
  /** REST + GraphQL: empty, too long, slash or backslash, control characters, `.` / `..`, leading/trailing whitespace. */
  | 'INVALID_NAME'
  /** REST: malformed request. GraphQL: e.g. a move that CREATEs a new parent without DELETEing the current one (single-parent rule). */
  | 'INVALID_REQUEST'
  /** GraphQL only: root well-known name reserved (`capabilities`, `items`, `stats`, `zip`, `ReportingAssets_*`). */
  | 'RESERVED_NAME'
  /** GraphQL only: rename/delete of `Files`, `ReportingAssets_*` or a blueprint root. */
  | 'PROTECTED_ROOT'
  /** GraphQL only: a folder moved into itself or below. */
  | 'MOVE_INTO_ITSELF';

/** A file API error, read from an `HttpErrorResponse`. */
export interface FilesProblem {
  status: number;
  /** Server code; for a bare 403 / 413 (e.g. the ingress body limit) `FORBIDDEN` / `LIMIT_EXCEEDED`; else `null`. */
  code: FilesErrorCode | (string & NonNullable<unknown>) | null;
  /** Human-readable detail from the server, if any. */
  detail: string | null;
}

/** Statuses the callers of this client handle themselves (no global error toast). */
const CALLER_HANDLED = [400, 403, 404, 409, 413];

/**
 * Bytes client of the platform file system (AB#6178, AB#6230): upload with progress (by path, into a
 * folder by rtId, new content by rtId), download and preview content (by path or rtId) with the user's
 * bearer under the real file name (decision D9, via {@link FileDownloadService}), the server-side zip,
 * deep folder statistics and capability detection.
 *
 * - The bearer is attached by the host's `authorizeInterceptor` (all URLs under `assetServices`).
 * - Statuses the caller handles (400, 403, 404, 409, 413) are excluded from the global HTTP error toast
 *   via `MM_CALLER_HANDLED_STATUSES`; read the reason with {@link parseFilesProblem} and show it where it
 *   belongs. Blob requests (download, preview, zip) rethrow their error with the parsed problem as body.
 * - {@link detectCapabilities} asks `GET /capabilities` once per tenant; a 404/405/501 (file API not
 *   deployed) or 403 (token without the API scope) answers `{ available: false }` silently, so hosts can
 *   probe safely.
 * - Downloads, previews and zips are in-memory blobs (D9); respect `previewMaxBytes` / `zipMaxBytes`.
 *
 * @example
 * ```typescript
 * const files = inject(FilesClientService);
 * if ((await files.detectCapabilities()).available) {
 *   files.upload('Files', 'Receipts 2026', file, { conflict: 'keepBoth', createFolders: true }).subscribe(e => …);
 *   await files.download('Files', 'Receipts 2026/a.pdf');
 *   const stats = await files.folderStats('Files', 'Receipts 2026');
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

  // ---------------------------------------------------------------------------------- capabilities

  /**
   * Whether the file API exists for the tenant, plus the server's limits and features. Cached per tenant;
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

  // ---------------------------------------------------------------------------------- uploads

  /**
   * Uploads one file into a folder addressed by path: `PUT {root}/{folderPath…}/{name}` with progress
   * events (`reportProgress`). Unsubscribing cancels the request. `conflict` may be a mode (legacy form)
   * or {@link FilesUploadOptions}. Errors are `HttpErrorResponse` (404 PATH_NOT_FOUND without
   * `createFolders`, 409 NAME_CONFLICT / AMBIGUOUS_PATH, 413 LIMIT_EXCEEDED, 403 FORBIDDEN).
   */
  upload<TItem = FileEntry>(root: string, folderPath: string, file: File, conflict: FilesConflictMode | FilesUploadOptions = {}, tenantId?: string | null): Observable<FilesUploadEvent<TItem>> {
    const options: FilesUploadOptions = typeof conflict === 'string' ? { conflict } : conflict;
    if (options.name !== undefined && (!options.name || options.name.includes('/'))) {
      return throwError(() => new FilesPathError(`Invalid file name: ${options.name}`));
    }
    let params = new HttpParams().set('conflict', options.conflict ?? 'fail');
    if (options.createFolders) {
      params = params.set('createFolders', 'true');
    }
    return from(this.itemUrl(root, joinSegments(folderPath, options.name ?? file.name), tenantId)).pipe(
      switchMap((url) => this.sendUpload<TItem>('PUT', url, file, params)),
    );
  }

  /**
   * Uploads one file into the folder or root `folderRtId`: `POST items/{rtId}/content?name=&conflict=`.
   * Same events, cancellation and errors as {@link upload} (409 NOT_A_FOLDER for a file rtId).
   */
  uploadToFolder<TItem = FileEntry>(folderRtId: string, file: File, options: FilesUploadToFolderOptions = {}): Observable<FilesUploadEvent<TItem>> {
    const params = new HttpParams().set('name', options.name ?? file.name).set('conflict', options.conflict ?? 'fail');
    return from(this.itemContentUrl(folderRtId, options.tenantId)).pipe(
      switchMap((url) => this.sendUpload<TItem>('POST', url, file, params)),
    );
  }

  /**
   * Replaces the content of the existing file `fileRtId`: `PUT items/{rtId}/content`. The rtId, the name
   * and all links stay. Same events and cancellation as {@link upload} (409 NOT_A_FILE for a folder).
   */
  replaceContent<TItem = FileEntry>(fileRtId: string, file: Blob, tenantId?: string | null): Observable<FilesUploadEvent<TItem>> {
    return from(this.itemContentUrl(fileRtId, tenantId)).pipe(
      switchMap((url) => this.sendUpload<TItem>('PUT', url, file, new HttpParams())),
    );
  }

  // ---------------------------------------------------------------------------------- downloads

  /** Downloads a file by path with the user's bearer and saves it under its real name (D9). */
  async download(root: string, path: string, fileName?: string | null, contentType?: string | null, tenantId?: string | null): Promise<void> {
    const url = await this.itemUrl(root, path, tenantId);
    await withProblemBody(this.downloads.downloadUrl(url, fileName, contentType, callerHandled()));
  }

  /** Downloads a file by rtId (`GET items/{rtId}/content`) and saves it under its real name. */
  async downloadById(rtId: string, fileName?: string | null, contentType?: string | null, tenantId?: string | null): Promise<void> {
    const url = await this.itemContentUrl(rtId, tenantId);
    await withProblemBody(this.downloads.downloadUrl(url, fileName, contentType, callerHandled()));
  }

  /**
   * Fetches a file's content by path as a blob for an inline preview (`?inline=true`). Inline delivery is
   * an allow-list on the server (images except SVG, audio, video, PDF, text/plain, CSV, JSON); everything
   * else stays an attachment with a sandbox CSP. The whole file is held in memory — check
   * `previewMaxBytes` before previewing large files.
   */
  async fetchContent(root: string, path: string, tenantId?: string | null): Promise<Blob> {
    return this.fetchBlob(`${await this.itemUrl(root, path, tenantId)}?inline=true`);
  }

  /** Fetches a file's content by rtId as a blob for an inline preview (`?inline=true`). */
  async fetchContentById(rtId: string, tenantId?: string | null): Promise<Blob> {
    return this.fetchBlob(`${await this.itemContentUrl(rtId, tenantId)}?inline=true`);
  }

  /**
   * Server-side streamed zip (AB#6225) of entries by path and/or rtId; folders are included recursively.
   * Body `{ items, rtIds?, fileName? }`. Saved under the server's `Content-Disposition` name, else
   * `fileName`, else `files.zip`. Limits are checked before the first byte (413 LIMIT_EXCEEDED); a
   * selected entry that is missing or hidden answers 404. The zip is received as an in-memory blob before
   * it is saved (D9: bearer download, no `window.open`), so the UI must respect `zipMaxBytes`.
   */
  async downloadZip(selection: FilesItemRef[] | FilesZipSelection, fileName?: string | null, tenantId?: string | null): Promise<void> {
    const { items = [], rtIds = [] } = Array.isArray(selection) ? { items: selection } : selection;
    const body: { items: FilesItemRef[]; rtIds?: string[]; fileName?: string } = { items };
    if (rtIds.length > 0) {
      body.rtIds = rtIds;
    }
    if (fileName) {
      body.fileName = fileName;
    }
    const url = await this.url(tenantId, 'zip');
    const response = await withProblemBody(firstValueFrom(this.http.post(url, body, { responseType: 'blob', observe: 'response', context: callerHandled() })));
    const name = parseContentDispositionFileName(response.headers.get('Content-Disposition')) || fileName || 'files.zip';
    this.downloads.saveBlob(response.body ?? new Blob(), name);
  }

  // ---------------------------------------------------------------------------------- statistics

  /**
   * Deep statistics of a root (`path` empty) or folder by path: `GET stats?root=&path=`. Use it instead of
   * walking the tree on the client (delete confirmation, folder info).
   */
  async folderStats(root: string, path?: string | null, tenantId?: string | null): Promise<FolderStats> {
    if (!root) {
      throw new FilesPathError('Invalid folder: empty root');
    }
    let params = new HttpParams().set('root', root);
    const folderPath = joinSegments(path ?? '');
    if (folderPath) {
      params = params.set('path', folderPath);
    }
    const url = await this.url(tenantId, 'stats');
    return normalizeStats(await firstValueFrom(this.http.get<Partial<FolderStats>>(url, { params, context: callerHandled() })));
  }

  /** Deep statistics of a root or folder by rtId: `GET items/{rtId}/stats`. */
  async folderStatsById(rtId: string, tenantId?: string | null): Promise<FolderStats> {
    const url = await this.url(tenantId, 'items', checkRtId(rtId), 'stats');
    return normalizeStats(await firstValueFrom(this.http.get<Partial<FolderStats>>(url, { context: callerHandled() })));
  }

  // ---------------------------------------------------------------------------------- URLs

  /**
   * `{assetServices}{tenant}/v1/files/{root}/{seg}/…` with every segment URL-encoded.
   *
   * @throws FilesPathError for an empty root or a `.` / `..` segment (browsers and proxies resolve
   *   dot segments even when percent-encoded, so such a URL would address a different resource), and for
   *   a root named like a route of the file API (`capabilities`, `items`, `stats`, `zip`, case-insensitive).
   */
  async itemUrl(root: string, path: string, tenantId?: string | null): Promise<string> {
    const segments = path.split('/').filter((s) => s.length > 0);
    if (!root || [root, ...segments].some(isDotSegment)) {
      throw new FilesPathError(`Invalid file path: ${root}/${path}`);
    }
    if (FILES_RESERVED_ROOT_NAMES.includes(root.toLowerCase())) {
      throw new FilesPathError(`Reserved root name: ${root}`);
    }
    return this.url(tenantId, root, ...segments);
  }

  /** `{assetServices}{tenant}/v1/files/items/{rtId}/content`. */
  async itemContentUrl(rtId: string, tenantId?: string | null): Promise<string> {
    return this.url(tenantId, 'items', checkRtId(rtId), 'content');
  }

  // ---------------------------------------------------------------------------------- internals

  private sendUpload<TItem>(method: 'PUT' | 'POST', url: string, file: Blob, params: HttpParams): Observable<FilesUploadEvent<TItem>> {
    return this.http.request<TItem>(method, url, {
      body: file,
      params,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      reportProgress: true,
      observe: 'events',
      context: callerHandled(),
    }).pipe(
      filter((event: HttpEvent<TItem>) => event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response),
      map((event): FilesUploadEvent<TItem> => {
        if (event.type === HttpEventType.UploadProgress) {
          return { type: 'progress', loaded: event.loaded, total: event.total ?? file.size };
        }
        return { type: 'done', item: (event as { body: TItem }).body };
      }),
    );
  }

  private async fetchBlob(url: string): Promise<Blob> {
    const response = await withProblemBody(this.downloads.fetchBlob(url, callerHandled()));
    return response.body ?? new Blob();
  }

  private async fetchCapabilities(tenant: string): Promise<FilesCapabilities> {
    const url = await this.url(tenant, 'capabilities');
    try {
      const body = await firstValueFrom(this.http.get<Omit<FilesCapabilities, 'available'>>(url, { context: callerHandled([403, 404, 405, 501]) }));
      return normalizeCapabilities(body);
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 403 || status === 404 || status === 405 || status === 501) {
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

/** Thrown for a path or rtId the bytes API cannot address (empty root, `.` or `..` segments, empty rtId). */
export class FilesPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FilesPathError';
  }
}

/**
 * Reads the file API problem details from an error of {@link FilesClientService} (`HttpErrorResponse`
 * with a JSON object or JSON string body). Returns `null` for anything that is no HTTP error.
 * A bare 403 / 413 without a code (e.g. nginx's body limit) maps to `FORBIDDEN` / `LIMIT_EXCEEDED`.
 */
export function parseFilesProblem(error: unknown): FilesProblem | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  let body: unknown = error.error;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  const problem = body && typeof body === 'object' ? body as { code?: unknown; title?: unknown; detail?: unknown } : {};
  let code = typeof problem.code === 'string' && problem.code ? problem.code : null;
  if (!code && typeof problem.title === 'string' && /^[A-Z][A-Z_]+$/.test(problem.title)) {
    code = problem.title;
  }
  if (!code && error.status === 403) {
    code = 'FORBIDDEN';
  }
  if (!code && error.status === 413) {
    code = 'LIMIT_EXCEEDED';
  }
  return { status: error.status, code, detail: typeof problem.detail === 'string' ? problem.detail : null };
}

/**
 * Reads the file system code (`extensions.code`, e.g. NAME_CONFLICT, PROTECTED_ROOT, RESERVED_NAME,
 * MOVE_INTO_ITSELF, FORBIDDEN) from a GraphQL error of a `System.Files` mutation (Apollo 4
 * `CombinedGraphQLErrors.errors`, or a raw `graphQLErrors` / `errors` array). `null` when none is found.
 */
export function filesGraphQlErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const candidate = error as { errors?: unknown; graphQLErrors?: unknown };
  const list = Array.isArray(candidate.errors) ? candidate.errors : Array.isArray(candidate.graphQLErrors) ? candidate.graphQLErrors : [];
  for (const entry of list as { extensions?: { code?: unknown } }[]) {
    const code = entry?.extensions?.code;
    if (typeof code === 'string' && code) {
      return code;
    }
  }
  return null;
}

function normalizeCapabilities(body: Partial<Omit<FilesCapabilities, 'available'>> | null): FilesCapabilities {
  const b = body ?? {};
  return {
    ...b,
    // A tenant-aware server may answer available:false (+ reason) with 200; keep it.
    available: (b as { available?: unknown }).available !== false,
    apiVersion: typeof b.apiVersion === 'number' ? b.apiVersion : 1,
    zipDownload: b.zipDownload === true,
    recursiveDelete: b.recursiveDelete === true,
    folderStats: b.folderStats === true,
    reservedRootNames: (Array.isArray(b.reservedRootNames) && b.reservedRootNames.length > 0 ? b.reservedRootNames : FILES_RESERVED_ROOT_NAMES)
      .map((n) => n.toLowerCase()),
  };
}

function normalizeStats(body: Partial<FolderStats> | null): FolderStats {
  const b = body ?? {};
  return {
    folders: b.folders ?? 0,
    files: b.files ?? 0,
    bytes: b.bytes ?? 0,
    linkedFiles: b.linkedFiles ?? 0,
    hiddenEntries: b.hiddenEntries ?? 0,
    complete: b.complete !== false,
    linkedSamples: (b.linkedSamples ?? []).map((s) => ({ ...s, entities: s.entities ?? [] })),
  };
}

/**
 * Blob requests deliver their error body as a `Blob`; this rethrows the error with the parsed problem
 * details (or the text) as body, so {@link parseFilesProblem} works for downloads as well.
 */
async function withProblemBody<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof HttpErrorResponse && error.error instanceof Blob) {
      const body = await readBlobBody(error.error);
      throw new HttpErrorResponse({
        error: body,
        headers: error.headers,
        status: error.status,
        statusText: error.statusText,
        url: error.url ?? undefined,
      });
    }
    throw error;
  }
}

async function readBlobBody(blob: Blob): Promise<unknown> {
  let text: string;
  try {
    text = await blob.text();
  } catch {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function checkRtId(rtId: string): string {
  if (!rtId || isDotSegment(rtId) || rtId.includes('/')) {
    throw new FilesPathError(`Invalid rtId: ${rtId}`);
  }
  return rtId;
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
