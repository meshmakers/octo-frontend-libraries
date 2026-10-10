import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpContext, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { MM_CALLER_HANDLED_STATUSES } from '@meshmakers/shared-services';
import { AuthorizeService, authorizeInterceptor } from '@meshmakers/shared-auth';
import {
  BinaryDownloadUnavailableError,
  FileDownloadService,
  parseContentDispositionFileName
} from './file-download.service';
import { CONFIGURATION_SERVICE } from './configuration.service';
import { TENANT_ID_PROVIDER } from './tenant-provider';

describe('parseContentDispositionFileName', () => {
  it('returns null for a missing header', () => {
    expect(parseContentDispositionFileName(null)).toBeNull();
    expect(parseContentDispositionFileName('')).toBeNull();
  });

  it('returns null when the header names no file', () => {
    expect(parseContentDispositionFileName('inline')).toBeNull();
  });

  it('reads a quoted filename', () => {
    expect(parseContentDispositionFileName('attachment; filename="Rechnung 2026.pdf"')).toBe('Rechnung 2026.pdf');
  });

  it('reads an unquoted filename', () => {
    expect(parseContentDispositionFileName('attachment; filename=report.csv')).toBe('report.csv');
  });

  it('prefers the RFC 5987 filename* over filename', () => {
    expect(parseContentDispositionFileName(
      'attachment; filename="Gruesse.txt"; filename*=UTF-8\'\'Gr%C3%BC%C3%9Fe.txt')).toBe('Grüße.txt');
  });

  it('returns null for an empty, "." or ".." name so the caller falls back', () => {
    expect(parseContentDispositionFileName('attachment; filename=".."')).toBeNull();
    expect(parseContentDispositionFileName('attachment; filename="."')).toBeNull();
    expect(parseContentDispositionFileName('attachment; filename="foo/"')).toBeNull();
    expect(parseContentDispositionFileName('attachment; filename*=UTF-8\'\'..; filename="ok.bin"')).toBe('ok.bin');
  });

  it('falls back to filename when filename* is malformed', () => {
    expect(parseContentDispositionFileName('attachment; filename*=UTF-8\'\'%E0%A4%A; filename="ok.bin"')).toBe('ok.bin');
  });

  it('strips a path from the name', () => {
    expect(parseContentDispositionFileName('attachment; filename="../../etc/passwd"')).toBe('passwd');
  });
});

describe('FileDownloadService', () => {
  const assetServices = 'https://asset.example.com/';
  const token = 'access-token-123';

  let service: FileDownloadService;
  let httpMock: HttpTestingController;
  let tenantId: string | null;
  let saveSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tenantId = 'meshtest';

    TestBed.configureTestingModule({
      providers: [
        // The real interceptor: proves the download goes out with the user's bearer.
        provideHttpClient(withInterceptors([authorizeInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthorizeService,
          useValue: {
            getAccessTokenSync: () => token,
            getServiceUris: () => [assetServices]
          }
        },
        { provide: CONFIGURATION_SERVICE, useValue: { config: { assetServices } } },
        { provide: TENANT_ID_PROVIDER, useValue: () => Promise.resolve(tenantId) }
      ]
    });

    service = TestBed.inject(FileDownloadService);
    httpMock = TestBed.inject(HttpTestingController);
    saveSpy = vi.spyOn(service, 'saveBlob').mockImplementation(() => undefined);
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Lets the awaited tenant lookup settle so the request is issued. */
  const flushMicrotasks = () => new Promise<void>(resolve => setTimeout(resolve));

  describe('buildLargeBinaryUri', () => {
    it('builds the asset repository URL from the ambient tenant', async () => {
      await expect(service.buildLargeBinaryUri('69a1b2c3d4e5f6a7b8c9d0e1'))
        .resolves.toBe('https://asset.example.com/meshtest/v1/largeBinaries?largeBinaryId=69a1b2c3d4e5f6a7b8c9d0e1');
    });

    it('prefers an explicit tenant', async () => {
      await expect(service.buildLargeBinaryUri('b1', 'other'))
        .resolves.toBe('https://asset.example.com/other/v1/largeBinaries?largeBinaryId=b1');
    });

    it('returns null without a tenant', async () => {
      tenantId = null;
      await expect(service.buildLargeBinaryUri('b1')).resolves.toBeNull();
    });
  });

  describe('downloadBinary', () => {
    it('downloads a generic attribute value (binaryId only) with the bearer and its stored file name', async () => {
      // Shape of a BINARY_LINKED value in the generic `attributes { value }` projection:
      // the stored EntityBinaryInfo, no downloadUri — whatever CK type owns it.
      const done = service.downloadBinary({
        binaryId: 'b1', filename: 'config.json', contentType: 'application/json'
      });
      await flushMicrotasks();

      const req = httpMock.expectOne('https://asset.example.com/meshtest/v1/largeBinaries?largeBinaryId=b1');
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
      req.flush(new Blob(['{}'], { type: 'application/octet-stream' }));
      await done;

      expect(saveSpy).toHaveBeenCalledTimes(1);
      const [blob, name] = saveSpy.mock.calls[0] as [Blob, string];
      expect(name).toBe('config.json');
      // octet-stream is re-typed with the stored content type
      expect(blob.type).toBe('application/json');
    });

    it('uses downloadUri when present and never queries any owner type', async () => {
      const done = service.downloadBinary({
        binaryId: 'ignored',
        downloadUri: 'https://asset.example.com/meshtest/v1/largeBinaries?largeBinaryId=b2',
        filename: 'a.pdf'
      });
      await flushMicrotasks();

      const req = httpMock.expectOne('https://asset.example.com/meshtest/v1/largeBinaries?largeBinaryId=b2');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
      req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
      await done;

      expect(saveSpy.mock.calls[0][1]).toBe('a.pdf');
    });

    it('prefers the Content-Disposition file name over the stored one', async () => {
      const done = service.downloadBinary({ binaryId: 'b3', filename: 'largeBinary' });
      await flushMicrotasks();

      httpMock.expectOne(r => r.url.endsWith('largeBinaryId=b3')).flush(new Blob(['x']), {
        headers: { 'Content-Disposition': 'attachment; filename="Beleg 42.pdf"' }
      });
      await done;

      expect(saveSpy.mock.calls[0][1]).toBe('Beleg 42.pdf');
    });

    it('uses the fallback name when nothing names the file', async () => {
      const done = service.downloadBinary({ binaryId: 'b4' }, { fallbackFileName: 'attachment.bin' });
      await flushMicrotasks();
      httpMock.expectOne(r => r.url.endsWith('largeBinaryId=b4')).flush(new Blob(['x']));
      await done;

      expect(saveSpy.mock.calls[0][1]).toBe('attachment.bin');
    });

    it('throws BinaryDownloadUnavailableError for a reference without binaryId or downloadUri', async () => {
      await expect(service.downloadBinary({ filename: 'x.pdf' })).rejects.toBeInstanceOf(BinaryDownloadUnavailableError);
    });

    it('throws BinaryDownloadUnavailableError when no tenant is known', async () => {
      tenantId = null;
      await expect(service.downloadBinary({ binaryId: 'b5' })).rejects.toBeInstanceOf(BinaryDownloadUnavailableError);
    });

    it('surfaces an HTTP failure and saves nothing', async () => {
      const done = service.downloadBinary({ binaryId: 'b6' });
      const assertion = expect(done).rejects.toBeInstanceOf(HttpErrorResponse);
      await flushMicrotasks();
      httpMock.expectOne(r => r.url.endsWith('largeBinaryId=b6'))
        .flush(new Blob(['nope']), { status: 404, statusText: 'Not Found' });
      await assertion;

      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe('fetchBlob / downloadUrl context', () => {
    it('passes the caller\'s HttpContext to the request', async () => {
      const context = new HttpContext().set(MM_CALLER_HANDLED_STATUSES, [403, 404]);
      const done = service.downloadUrl('https://asset.example.com/meshtest/v1/files/Files/a.pdf', 'a.pdf', null, context);
      const req = httpMock.expectOne('https://asset.example.com/meshtest/v1/files/Files/a.pdf');
      expect(req.request.context.get(MM_CALLER_HANDLED_STATUSES)).toEqual([403, 404]);
      req.flush(new Blob(['%PDF']));
      await done;
      expect(saveSpy.mock.calls[0][1]).toBe('a.pdf');
    });
  });

  describe('saveBlob', () => {
    it('clicks a temporary anchor with the file name and revokes the object URL', async () => {
      saveSpy.mockRestore();
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
      const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

      service.saveBlob(new Blob(['x']), 'file.txt');

      expect(createSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalledTimes(1);
      const anchor = clickSpy.mock.contexts[0] as HTMLAnchorElement;
      expect(anchor.download).toBe('file.txt');
      expect(anchor.href).toBe('blob:mock');
      expect(document.body.contains(anchor)).toBe(false);

      await flushMicrotasks();
      expect(revokeSpy).toHaveBeenCalledWith('blob:mock');
    });
  });
});
