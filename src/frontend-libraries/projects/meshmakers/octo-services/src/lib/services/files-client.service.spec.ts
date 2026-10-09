import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { MM_CALLER_HANDLED_STATUSES } from '@meshmakers/shared-services';
import { lastValueFrom, toArray } from 'rxjs';
import { FilesClientService } from './files-client.service';
import { FileDownloadService } from './file-download.service';
import { CONFIGURATION_SERVICE } from './configuration.service';
import { TENANT_ID_PROVIDER } from './tenant-provider';

/** Pins the PLANNED bytes contract of the file API (AB#6178). */
describe('FilesClientService', () => {
  const base = 'https://asset.example.com/t1/v1/files';
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

  it('detects the file API once per tenant, silently answering "not available" on 404', async () => {
    const first = client.detectCapabilities();
    const req = await expectOne(`${base}/capabilities`);
    expect(req.request.context.get(MM_CALLER_HANDLED_STATUSES)).toContain(404);
    req.flush('', { status: 404, statusText: 'Not Found' });
    expect(await first).toEqual({ available: false });
    expect(await client.detectCapabilities()).toEqual({ available: false });
    http.expectNone(`${base}/capabilities`);
  });

  it('reports limits when the file API exists', async () => {
    const result = client.detectCapabilities('t1');
    (await expectOne(`${base}/capabilities`)).flush({ maxUploadBytes: 1024, zipDownload: true });
    expect(await result).toEqual({ available: true, maxUploadBytes: 1024, zipDownload: true });
  });

  it('does not cache transient failures', async () => {
    const result = client.detectCapabilities();
    (await expectOne(`${base}/capabilities`)).flush('', { status: 503, statusText: 'Unavailable' });
    expect(await result).toEqual({ available: false });
    const again = client.detectCapabilities();
    (await expectOne(`${base}/capabilities`)).flush({});
    expect((await again).available).toBe(true);
  });

  it('uploads with PUT to the path-addressed URL, conflict mode and progress', async () => {
    const file = new File(['abc'], 'a b.pdf', { type: 'application/pdf' });
    const events = lastValueFrom(client.upload('Files', 'Receipts 2026/', file, 'keepBoth').pipe(toArray()));
    const req = await expectOne(`${base}/Files/Receipts%202026/a%20b.pdf`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.params.get('conflict')).toBe('keepBoth');
    expect(req.request.headers.get('Content-Type')).toBe('application/pdf');
    expect(req.request.reportProgress).toBe(true);
    expect(req.request.context.get(MM_CALLER_HANDLED_STATUSES)).toEqual(expect.arrayContaining([409, 413, 403]));
    req.flush({ rtId: 'x', name: 'a b.pdf' });
    const all = await events;
    expect(all[all.length - 1]).toEqual({ type: 'done', item: { rtId: 'x', name: 'a b.pdf' } });
  });

  it('downloads through FileDownloadService under the real name (D9)', async () => {
    await client.download('Files', 'Q4/r 1.pdf', 'r 1.pdf', 'application/pdf');
    expect(downloads.downloadUrl).toHaveBeenCalledWith(`${base}/Files/Q4/r%201.pdf`, 'r 1.pdf', 'application/pdf');
  });

  it('posts the zip request and saves the blob', async () => {
    const done = client.downloadZip([{ root: 'Files', path: 'Q4' }], 'Q4.zip');
    const req = await expectOne(`${base}/zip`);
    expect(req.request.body).toEqual({ items: [{ root: 'Files', path: 'Q4' }] });
    req.flush(new Blob(['zip']));
    await done;
    expect(downloads.saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'Q4.zip');
  });
});
