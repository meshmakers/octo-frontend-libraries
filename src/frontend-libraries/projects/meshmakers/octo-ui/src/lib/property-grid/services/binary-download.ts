import { EventEmitter, Injector } from '@angular/core';
import { FileDownloadService } from '@meshmakers/octo-services';
import { BinaryDownloadEvent } from '../models/property-grid.models';

/**
 * Hands a binary download request to the host when one listens on `emitter`, otherwise downloads
 * the clicked value itself with the user's bearer through `FileDownloadService` (AB#6179).
 *
 * The service is resolved lazily at click time so that merely rendering a property grid never
 * requires `HttpClient` / `CONFIGURATION_SERVICE` to be provided.
 */
export function emitOrDownloadBinary(
  emitter: EventEmitter<BinaryDownloadEvent>,
  event: BinaryDownloadEvent,
  injector: Injector
): void {
  if (emitter.observed) {
    emitter.emit(event);
    return;
  }

  let downloads: FileDownloadService;
  try {
    downloads = injector.get(FileDownloadService);
  } catch (error) {
    console.error('Cannot download binary: FileDownloadService is not available', error);
    return;
  }

  downloads.downloadBinary(event).catch(error => {
    console.error('Binary download failed:', error);
  });
}
