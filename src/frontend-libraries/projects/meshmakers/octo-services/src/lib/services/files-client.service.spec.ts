import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpContext, HttpErrorResponse, HttpEventType, HttpHeaders, provideHttpClient } from '@angular/common/http';
import { MM_CALLER_HANDLED_STATUSES } from '@meshmakers/shared-services';
import { lastValueFrom, toArray } from 'rxjs';
import {
  FileEntry,
  FILES_LINKED_COUNTS_MAX,
  FILES_UNAVAILABLE_TTL_MS,
  FILES_RESERVED_ROOT_NAMES,
  FilesClientService,
  filesGraphQlErrorCode,
  FilesPathError,
  parseFilesProblem,
} from './files-client.service';
import { FileDownloadService } from './file-download.service';
import { CONFIGURATION_SERVICE } from './configuration.service';
import { TENANT_ID_PROVIDER } from './tenant-provider';

/** Pins the asset-repo file bytes contract as built (AB#6174 / AB#6225, client AB#6230). */
describe('FilesClientService', () => {
  const base = 'https://asset.example.com/t1/v1/files';
  const rtId = '65f0a1b2c3d4e5f6a7b8c9d0';
  const entry: FileEntry = {
    rtId,
    ckTypeId: 'System.Files/FileSystemItem',
    kind: 'file',
    name: 'a b.pdf',
    root: 'Files',
    path: 'Receipts 2026/a b.pdf',
    parentRtId: '65f0a1b2c3d4e5f6a7b8c9d1',
    size: 3,
    contentType: 'application/pdf',
    binaryId: '65f0a1b2c3d4e5f6a7b8c9d2',
    replaced: false,
  };
  let client: FilesClientService;
  let http: HttpTestingController;
  let downloads: { downloadUrl: ReturnType<typeof vi.fn>; fetchBlob: ReturnType<typeof vi.fn>; saveBlob: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    downloads = { downloadUrl: vi.fn().mockResolvedValue(undefined), fetchBlob: vi.fn(), saveBlob: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CONFIGURATION_SERVICE, useValue: { config: { assetServices: 'https://asset.example.com' } } },
        { provide: TENANT_ID_PROVIDER, useValue: () => Promise.resolve('t1') },
        { provide: FileDownloadService, useValue: downloads },
      ],
    });
    client = TestBed.inject(FilesClientService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function expectOne(url: string) {
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne((r) => r.url === url);
    });
    return req;
  }

  function handled(context: HttpContext): readonly number[] {
    return context.get(MM_CALLER_HANDLED_STATUSES);
  }

  function blobError(status: number, body: unknown): HttpErrorResponse {
    return new HttpErrorResponse({
      status,
      statusText: 'x',
      error: new Blob([typeof body === 'string' ? body : JSON.stringify(body)], { type: 'application/problem+json' }),
    });
  }

  describe('capabilities', () => {
    it('keeps a tenant-aware available:false with its reason and the delete limit', async () => {
      const result = client.detectCapabilities();
      (await expectOne(`${base}/capabilities`)).flush({ available: false, reason: 'System.Files is not imported', maxDeleteEntries: 2000 });
      expect(await result).toEqual(expect.objectContaining({ available: false, reason: 'System.Files is not imported', maxDeleteEntries: 2000 }));
    });

    it('detects the file API once per tenant, silently answering "not available" on 404', async () => {
      const first = client.detectCapabilities();
      const req = await expectOne(`${base}/capabilities`);
      expect(req.request.method).toBe('GET');
      expect(handled(req.request.context)).toEqual(expect.arrayContaining([404, 405, 501]));
      req.flush('', { status: 404, statusText: 'Not Found' });
      expect(await first).toEqual({ available: false });
      expect(await client.detectCapabilities()).toEqual({ available: false });
      http.expectNone(`${base}/capabilities`);
    });

    it.each([403, 405, 501])('treats %s as "not available" without a toast', async (status) => {
      const result = client.detectCapabilities();
      const req = await expectOne(`${base}/capabilities`);
      expect(handled(req.request.context)).toContain(status);
      req.flush('', { status, statusText: 'x' });
      expect(await result).toEqual({ available: false });
    });

    it('parses the full capability shape', async () => {
      const result = client.detectCapabilities('t1');
      (await expectOne(`${base}/capabilities`)).flush({
        apiVersion: 1,
        maxUploadBytes: 104857600,
        zipDownload: true,
        zipMaxFiles: 1000,
        zipMaxBytes: 524288000,
        previewMaxBytes: 20971520,
        recursiveDelete: true,
        folderStats: true,
        reservedRootNames: ['capabilities', 'items', 'stats', 'zip'],
      });
      expect(await result).toEqual({
        available: true,
        apiVersion: 1,
        maxUploadBytes: 104857600,
        zipDownload: true,
        zipMaxFiles: 1000,
        zipMaxBytes: 524288000,
        previewMaxBytes: 20971520,
        recursiveDelete: true,
        folderStats: true,
        linkedCounts: false,
        reservedRootNames: ['capabilities', 'items', 'stats', 'zip'],
      });
    });

    it('fills safe defaults for a sparse answer (features off, known reserved names)', async () => {
      const result = client.detectCapabilities();
      (await expectOne(`${base}/capabilities`)).flush({ maxUploadBytes: 1024 });
      expect(await result).toEqual({
        available: true,
        apiVersion: 1,
        maxUploadBytes: 1024,
        zipDownload: false,
        recursiveDelete: false,
        folderStats: false,
        linkedCounts: false,
        reservedRootNames: [...FILES_RESERVED_ROOT_NAMES],
      });
    });

    it('caches per tenant', async () => {
      const a = client.detectCapabilities('t1');
      (await expectOne(`${base}/capabilities`)).flush({});
      await a;
      const b = client.detectCapabilities('t2');
      (await expectOne('https://asset.example.com/t2/v1/files/capabilities')).flush('', { status: 404, statusText: 'x' });
      expect((await b).available).toBe(false);
      expect((await client.detectCapabilities('t1')).available).toBe(true);
      client.resetCapabilities();
      const c = client.detectCapabilities('t1');
      (await expectOne(`${base}/capabilities`)).flush({});
      expect((await c).available).toBe(true);
    });

    it('does not cache transient failures', async () => {
      const result = client.detectCapabilities();
      (await expectOne(`${base}/capabilities`)).flush('', { status: 503, statusText: 'Unavailable' });
      expect(await result).toEqual({ available: false });
      const again = client.detectCapabilities();
      (await expectOne(`${base}/capabilities`)).flush({});
      expect((await again).available).toBe(true);
    });
  });

  describe('upload by path', () => {
    it('PUTs the raw file to the segment-encoded path with conflict mode and progress (legacy signature)', async () => {
      const file = new File(['abc'], 'a b.pdf', { type: 'application/pdf' });
      const events = lastValueFrom(client.upload('Files', 'Receipts 2026/', file, 'keepBoth').pipe(toArray()));
      const req = await expectOne(`${base}/Files/Receipts%202026/a%20b.pdf`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toBe(file);
      expect(req.request.params.get('conflict')).toBe('keepBoth');
      expect(req.request.params.has('createFolders')).toBe(false);
      expect(req.request.headers.get('Content-Type')).toBe('application/pdf');
      expect(req.request.reportProgress).toBe(true);
      expect(handled(req.request.context)).toEqual(expect.arrayContaining([400, 403, 404, 409, 413]));
      req.event({ type: HttpEventType.UploadProgress, loaded: 1, total: 3 });
      req.event({ type: HttpEventType.UploadProgress, loaded: 3 });
      req.flush(entry, { status: 201, statusText: 'Created' });
      expect(await events).toEqual([
        { type: 'progress', loaded: 1, total: 3 },
        { type: 'progress', loaded: 3, total: 3 },
        { type: 'done', item: entry },
      ]);
    });

    it('sends createFolders, a custom name and defaults conflict to fail', async () => {
      const file = new File(['x'], 'orig.bin');
      const done = lastValueFrom(client.upload('Files', 'A/B', file, { createFolders: true, name: 'ä#?.bin' }));
      const req = await expectOne(`${base}/Files/A/B/%C3%A4%23%3F.bin`);
      expect(req.request.params.get('conflict')).toBe('fail');
      expect(req.request.params.get('createFolders')).toBe('true');
      expect(req.request.headers.get('Content-Type')).toBe('application/octet-stream');
      req.flush({ ...entry, replaced: true });
      expect(await done).toEqual({ type: 'done', item: { ...entry, replaced: true } });
    });

    it('uploads into the root when the folder path is empty', async () => {
      const subscription = client.upload('Files', '', new File(['abc'], 'a.pdf'), 'fail').subscribe();
      const req = await expectOne(`${base}/Files/a.pdf`);
      subscription.unsubscribe();
      expect(req.cancelled).toBe(true);
    });

    it('refuses a name with a slash or an empty name without a request', async () => {
      for (const name of ['a/b.pdf', '']) {
        const error = await lastValueFrom(client.upload('Files', 'A', new File(['x'], 'a.pdf'), { name })).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(FilesPathError);
      }
      http.expectNone(() => true);
    });

    it('surfaces 409 NAME_CONFLICT as problem details', async () => {
      const result = lastValueFrom(client.upload('Files', 'A', new File(['x'], 'a.pdf'), 'fail')).catch((e: unknown) => e);
      (await expectOne(`${base}/Files/A/a.pdf`)).flush(
        { status: 409, title: 'NAME_CONFLICT', detail: "'a.pdf' already exists.", code: 'NAME_CONFLICT' },
        { status: 409, statusText: 'Conflict' });
      expect(parseFilesProblem(await result)).toEqual({ status: 409, code: 'NAME_CONFLICT', detail: "'a.pdf' already exists." });
    });
  });

  describe('upload by rtId', () => {
    it('POSTs into a folder by rtId with name and conflict', async () => {
      const file = new File(['abc'], 'r 1.pdf', { type: 'application/pdf' });
      const done = lastValueFrom(client.uploadToFolder(rtId, file, { conflict: 'replace' }));
      const req = await expectOne(`${base}/items/${rtId}/content`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBe(file);
      expect(req.request.params.get('name')).toBe('r 1.pdf');
      expect(req.request.params.get('conflict')).toBe('replace');
      expect(req.request.headers.get('Content-Type')).toBe('application/pdf');
      expect(req.request.reportProgress).toBe(true);
      expect(handled(req.request.context)).toEqual(expect.arrayContaining([403, 404, 409, 413]));
      req.flush(entry, { status: 201, statusText: 'Created' });
      expect(await done).toEqual({ type: 'done', item: entry });
    });

    it('defaults conflict to fail and honours a custom name and tenant', async () => {
      const done = lastValueFrom(client.uploadToFolder(rtId, new File(['x'], 'a.pdf'), { name: 'b.pdf', tenantId: 't2' }));
      const req = await expectOne(`https://asset.example.com/t2/v1/files/items/${rtId}/content`);
      expect(req.request.params.get('name')).toBe('b.pdf');
      expect(req.request.params.get('conflict')).toBe('fail');
      req.flush(entry);
      await done;
    });

    it('PUTs new content for a file by rtId without query parameters', async () => {
      const blob = new Blob(['new'], { type: 'text/plain' });
      const done = lastValueFrom(client.replaceContent(rtId, blob));
      const req = await expectOne(`${base}/items/${rtId}/content`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toBe(blob);
      expect(req.request.params.keys()).toEqual([]);
      expect(req.request.headers.get('Content-Type')).toBe('text/plain');
      req.flush({ ...entry, replaced: true });
      expect(await done).toEqual({ type: 'done', item: { ...entry, replaced: true } });
    });

    it('refuses an empty or path-like rtId', async () => {
      const error = await lastValueFrom(client.replaceContent('', new Blob())).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(FilesPathError);
      await expect(client.itemContentUrl('..')).rejects.toThrow(FilesPathError);
      await expect(client.itemContentUrl('a/b')).rejects.toThrow(FilesPathError);
      await expect(client.folderStatsById('')).rejects.toThrow(FilesPathError);
    });
  });

  describe('downloads', () => {
    it('downloads by path through FileDownloadService under the real name (D9), caller-handled statuses', async () => {
      await client.download('Files', 'Q4/r 1.pdf', 'r 1.pdf', 'application/pdf');
      expect(downloads.downloadUrl).toHaveBeenCalledWith(`${base}/Files/Q4/r%201.pdf`, 'r 1.pdf', 'application/pdf', expect.anything());
      const context = downloads.downloadUrl.mock.calls[0][3] as HttpContext;
      expect(handled(context)).toEqual(expect.arrayContaining([403, 404, 409]));
    });

    it('downloads by rtId', async () => {
      await client.downloadById(rtId, 'a.pdf');
      expect(downloads.downloadUrl).toHaveBeenCalledWith(`${base}/items/${rtId}/content`, 'a.pdf', undefined, expect.anything());
    });

    it('fetches preview content by path with inline=true', async () => {
      const blob = new Blob(['%PDF'], { type: 'application/pdf' });
      downloads.fetchBlob.mockResolvedValue({ body: blob });
      expect(await client.fetchContent('Files', 'Q4/a b.pdf')).toBe(blob);
      const [url, context] = downloads.fetchBlob.mock.calls[0] as [string, HttpContext];
      expect(url).toBe(`${base}/Files/Q4/a%20b.pdf?inline=true`);
      expect(handled(context)).toEqual(expect.arrayContaining([403, 404]));
    });

    it('fetches preview content by rtId with inline=true', async () => {
      downloads.fetchBlob.mockResolvedValue({ body: new Blob(['x']) });
      await client.fetchContentById(rtId);
      expect(downloads.fetchBlob.mock.calls[0][0]).toBe(`${base}/items/${rtId}/content?inline=true`);
    });

    it('answers an empty blob when the response has no body', async () => {
      downloads.fetchBlob.mockResolvedValue({ body: null });
      expect((await client.fetchContent('Files', 'a.pdf')).size).toBe(0);
    });

    it('rethrows a blob error body as parsed problem details', async () => {
      downloads.fetchBlob.mockRejectedValue(blobError(404, { status: 404, title: 'PATH_NOT_FOUND', detail: 'gone', code: 'PATH_NOT_FOUND' }));
      const error = await client.fetchContent('Files', 'a.pdf').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect(parseFilesProblem(error)).toEqual({ status: 404, code: 'PATH_NOT_FOUND', detail: 'gone' });

      downloads.downloadUrl.mockRejectedValue(blobError(409, { code: 'AMBIGUOUS_PATH' }));
      expect(parseFilesProblem(await client.download('Files', 'a.pdf').catch((e: unknown) => e))?.code).toBe('AMBIGUOUS_PATH');
    });

    it('keeps non-HTTP errors as they are', async () => {
      const boom = new Error('boom');
      downloads.downloadUrl.mockRejectedValue(boom);
      await expect(client.downloadById(rtId)).rejects.toBe(boom);
    });

    it('refuses dot segments and an empty root instead of building a URL', async () => {
      await expect(client.itemUrl('Files', 'Q4/../secret.pdf')).rejects.toThrow(FilesPathError);
      await expect(client.itemUrl('..', 'a.pdf')).rejects.toThrow(FilesPathError);
      await expect(client.itemUrl('', 'a.pdf')).rejects.toThrow(FilesPathError);
      await expect(client.fetchContent('Files', './a.pdf')).rejects.toThrow(FilesPathError);
      expect(downloads.fetchBlob).not.toHaveBeenCalled();
      const error = await lastValueFrom(client.upload('Files', '..', new File(['x'], 'a.pdf'), 'fail').pipe(toArray())).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(FilesPathError);
      expect(await client.itemUrl('Files', 'a..b/c.pdf')).toBe(`${base}/Files/a..b/c.pdf`);
    });

    it('refuses root names that are routes of the file API (case-insensitive)', async () => {
      for (const root of ['capabilities', 'Items', 'STATS', 'zip']) {
        await expect(client.itemUrl(root, 'a.pdf')).rejects.toThrow(FilesPathError);
      }
      await expect(client.download('Zip', 'a.pdf')).rejects.toThrow(FilesPathError);
      expect(downloads.downloadUrl).not.toHaveBeenCalled();
      expect(await client.itemUrl('ReportingAssets_Q4', 'a.pdf')).toBe(`${base}/ReportingAssets_Q4/a.pdf`);
    });
  });

  describe('zip', () => {
    it('posts the legacy item list with the file name and saves under it when no header names the file', async () => {
      const done = client.downloadZip([{ root: 'Files', path: 'Q4' }], 'Q4.zip');
      const req = await expectOne(`${base}/zip`);
      expect(req.request.method).toBe('POST');
      expect(req.request.responseType).toBe('blob');
      expect(req.request.body).toEqual({ items: [{ root: 'Files', path: 'Q4' }], fileName: 'Q4.zip' });
      expect(handled(req.request.context)).toEqual(expect.arrayContaining([400, 404, 413]));
      req.flush(new Blob(['zip']));
      await done;
      expect(downloads.saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'Q4.zip');
    });

    it('sends rtIds alongside items and prefers the Content-Disposition name', async () => {
      const done = client.downloadZip({ rtIds: [rtId] }, 'Selection');
      const req = await expectOne(`${base}/zip`);
      expect(req.request.body).toEqual({ items: [], rtIds: [rtId], fileName: 'Selection' });
      req.flush(new Blob(['zip']), { headers: new HttpHeaders({ 'Content-Disposition': "attachment; filename=\"Selection.zip\"; filename*=UTF-8''Selection.zip" }) });
      await done;
      expect(downloads.saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'Selection.zip');
    });

    it('falls back to files.zip and omits fileName when none is given', async () => {
      const done = client.downloadZip({ items: [{ root: 'Files', path: '' }] });
      const req = await expectOne(`${base}/zip`);
      expect(req.request.body).toEqual({ items: [{ root: 'Files', path: '' }] });
      req.flush(new Blob(['zip']));
      await done;
      expect(downloads.saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'files.zip');
    });

    it('maps 413 LIMIT_EXCEEDED from the blob error body and saves nothing', async () => {
      const done = client.downloadZip([{ root: 'Files', path: 'Big' }], 'big.zip').catch((e: unknown) => e);
      (await expectOne(`${base}/zip`)).flush(
        new Blob([JSON.stringify({ status: 413, title: 'LIMIT_EXCEEDED', detail: 'More than 1000 files.', code: 'LIMIT_EXCEEDED' })]),
        { status: 413, statusText: 'Payload Too Large' });
      expect(parseFilesProblem(await done)).toEqual({ status: 413, code: 'LIMIT_EXCEEDED', detail: 'More than 1000 files.' });
      expect(downloads.saveBlob).not.toHaveBeenCalled();
    });
  });

  describe('folder statistics', () => {
    const stats = {
      folders: 2,
      files: 5,
      bytes: 1234,
      linkedFiles: 1,
      hiddenEntries: 3,
      complete: true,
      linkedSamples: [{ rtId, name: 'a.pdf', path: 'Q4/a.pdf', entities: [{ rtId: '65f0a1b2c3d4e5f6a7b8c9d9', ckTypeId: 'System/Entity', displayName: 'Order 7' }] }],
    };

    it('asks stats by root and path as query parameters', async () => {
      const result = client.folderStats('Files', '/Q4/Sub folder/');
      const req = await expectOne(`${base}/stats`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('root')).toBe('Files');
      expect(req.request.params.get('path')).toBe('Q4/Sub folder');
      expect(handled(req.request.context)).toEqual(expect.arrayContaining([403, 404, 409]));
      req.flush(stats);
      expect(await result).toEqual(stats);
    });

    it('omits path for the root itself', async () => {
      const result = client.folderStats('My Root');
      const req = await expectOne(`${base}/stats`);
      expect(req.request.params.get('root')).toBe('My Root');
      expect(req.request.params.has('path')).toBe(false);
      req.flush({});
      expect(await result).toEqual({ folders: 0, files: 0, bytes: 0, linkedFiles: 0, hiddenEntries: 0, complete: true, linkedSamples: [] });
    });

    it('asks stats by rtId and keeps an incomplete walk', async () => {
      const result = client.folderStatsById(rtId);
      const req = await expectOne(`${base}/items/${rtId}/stats`);
      req.flush({ ...stats, complete: false, linkedSamples: [{ rtId, name: 'a', path: 'a' }] });
      const answer = await result;
      expect(answer.complete).toBe(false);
      expect(answer.linkedSamples[0].entities).toEqual([]);
    });

    it('refuses an empty root', async () => {
      await expect(client.folderStats('')).rejects.toThrow(FilesPathError);
    });
  });

  describe('capability TTL and stats cancellation', () => {
    afterEach(() => vi.useRealTimers());

    it('asks again after the TTL when the answer was "not available"', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const first = client.detectCapabilities();
      (await expectOne(`${base}/capabilities`)).flush('', { status: 404, statusText: 'x' });
      expect((await first).available).toBe(false);
      expect((await client.detectCapabilities()).available).toBe(false);
      http.expectNone(`${base}/capabilities`);
      vi.setSystemTime(Date.now() + FILES_UNAVAILABLE_TTL_MS + 1);
      const again = client.detectCapabilities();
      (await expectOne(`${base}/capabilities`)).flush({});
      expect((await again).available).toBe(true);
    });

    it('cancels the stats request when the signal aborts', async () => {
      const controller = new AbortController();
      const result = client.folderStatsById('6a0000000000000000000001', null, controller.signal);
      const req = await expectOne(`${base}/items/6a0000000000000000000001/stats`);
      controller.abort();
      await expect(result).rejects.toSatisfy((e: unknown) => (e as Error).name === 'AbortError');
      expect(req.cancelled).toBe(true);
    });
  });

  describe('linked counts', () => {
    it('asks POST linked-counts in chunks of at most 500 unique rtIds and merges the answers', async () => {
      const ids = Array.from({ length: 501 }, (_, i) => `6a${String(i).padStart(22, '0')}`);
      const result = client.linkedCounts([...ids, ids[0], '']);
      const first = await expectOne(`${base}/linked-counts`);
      expect(first.request.method).toBe('POST');
      expect(first.request.body.rtIds.length).toBe(FILES_LINKED_COUNTS_MAX);
      expect(first.request.context.get(MM_CALLER_HANDLED_STATUSES)).toContain(403);
      first.flush({ counts: { [ids[0]]: 2 } });
      const second = await expectOne(`${base}/linked-counts`);
      expect(second.request.body).toEqual({ rtIds: [ids[500]] });
      second.flush({ counts: { [ids[500]]: 1 } });
      expect(await result).toEqual({ [ids[0]]: 2, [ids[500]]: 1 });
    });

    it('sends nothing for an empty list', async () => {
      expect(await client.linkedCounts([])).toEqual({});
    });

    it('reads the linkedCounts capability', async () => {
      const result = client.detectCapabilities();
      (await expectOne(`${base}/capabilities`)).flush({ linkedCounts: true });
      expect((await result).linkedCounts).toBe(true);
    });
  });

  describe('parseFilesProblem', () => {
    it('reads code, detail and status from problem details (object or JSON string)', () => {
      expect(parseFilesProblem(new HttpErrorResponse({ status: 404, error: { code: 'ROOT_NOT_FOUND', detail: 'x' } })))
        .toEqual({ status: 404, code: 'ROOT_NOT_FOUND', detail: 'x' });
      expect(parseFilesProblem(new HttpErrorResponse({ status: 400, error: JSON.stringify({ title: 'INVALID_NAME', detail: 'bad' }) })))
        .toEqual({ status: 400, code: 'INVALID_NAME', detail: 'bad' });
    });

    it('maps a bare 403 / 413 (e.g. ingress body limit) and leaves others without code', () => {
      expect(parseFilesProblem(new HttpErrorResponse({ status: 413, error: '<html>413</html>' }))?.code).toBe('LIMIT_EXCEEDED');
      expect(parseFilesProblem(new HttpErrorResponse({ status: 403, error: null }))?.code).toBe('FORBIDDEN');
      expect(parseFilesProblem(new HttpErrorResponse({ status: 500, error: { title: 'Internal Server Error' } })))
        .toEqual({ status: 500, code: null, detail: null });
    });

    it('answers null for non-HTTP errors', () => {
      expect(parseFilesProblem(new Error('x'))).toBeNull();
      expect(parseFilesProblem(undefined)).toBeNull();
    });
  });

  describe('filesGraphQlErrorCode', () => {
    it('reads extensions.code from Apollo 4 errors or raw arrays', () => {
      expect(filesGraphQlErrorCode({ errors: [{ message: 'm', extensions: { code: 'PROTECTED_ROOT' } }] })).toBe('PROTECTED_ROOT');
      expect(filesGraphQlErrorCode({ graphQLErrors: [{ extensions: {} }, { extensions: { code: 'NAME_CONFLICT' } }] })).toBe('NAME_CONFLICT');
      expect(filesGraphQlErrorCode({ errors: [{ message: 'm' }] })).toBeNull();
      expect(filesGraphQlErrorCode(null)).toBeNull();
    });
  });
});
