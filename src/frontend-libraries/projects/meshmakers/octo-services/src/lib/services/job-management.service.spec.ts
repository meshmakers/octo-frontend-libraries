import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { JobManagementService } from './job-management.service';
import { BotService } from './bot-service';
import { MessageService } from '@meshmakers/shared-services';
import { ProgressWindowService } from '../shared/progress-window.service';
import { JobDto } from '../shared/jobDto';

describe('JobManagementService', () => {
  let service: JobManagementService;
  let botServiceMock: jasmine.SpyObj<BotService>;
  let messageServiceMock: jasmine.SpyObj<MessageService>;
  let progressWindowServiceMock: jasmine.SpyObj<ProgressWindowService>;
  let mockProgressDialog: any;

  const mockSucceededJobDto: JobDto = {
    id: 'job-123',
    createdAt: new Date(),
    stateChangedAt: new Date(),
    status: 'Succeeded',
    reason: null,
    errorMessage: null
  };

  const mockRunningJobDto: JobDto = {
    id: 'job-123',
    createdAt: new Date(),
    stateChangedAt: new Date(),
    status: 'Running',
    reason: null,
    errorMessage: null
  };

  const mockFailedJobDto: JobDto = {
    id: 'job-123',
    createdAt: new Date(),
    stateChangedAt: new Date(),
    status: 'Failed',
    reason: 'Operation failed',
    errorMessage: 'Duplicate key error: entity already exists'
  };

  beforeEach(() => {
    botServiceMock = jasmine.createSpyObj('BotService', ['downloadJobResultBinary', 'getJobStatus']);
    messageServiceMock = jasmine.createSpyObj('MessageService', ['showInformation', 'showError', 'showErrorWithDetails']);
    mockProgressDialog = { close: jasmine.createSpy('close') };
    progressWindowServiceMock = jasmine.createSpyObj('ProgressWindowService', ['showIndeterminateProgress']);
    progressWindowServiceMock.showIndeterminateProgress.and.returnValue(mockProgressDialog);

    TestBed.configureTestingModule({
      providers: [
        JobManagementService,
        { provide: BotService, useValue: botServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: ProgressWindowService, useValue: progressWindowServiceMock }
      ]
    });

    service = TestBed.inject(JobManagementService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('downloadJobResult', () => {
    it('should show information message and download blob', async () => {
      const mockBlob = new Blob(['test data'], { type: 'application/octet-stream' });
      botServiceMock.downloadJobResultBinary.and.returnValue(Promise.resolve(mockBlob));

      // Mock URL.createObjectURL and document.createElement
      const mockUrl = 'blob:test-url';
      spyOn(URL, 'createObjectURL').and.returnValue(mockUrl);
      const mockLink = {
        href: '',
        download: '',
        click: jasmine.createSpy('click')
      };
      spyOn(document, 'createElement').and.returnValue(mockLink as any);

      await service.downloadJobResult('tenant-1', 'job-123', 'export.zip');

      expect(messageServiceMock.showInformation).toHaveBeenCalledWith(
        'Operation completed. Download has been initialized.'
      );
      expect(botServiceMock.downloadJobResultBinary).toHaveBeenCalledWith('tenant-1', 'job-123');
      expect(mockLink.href).toBe(mockUrl);
      expect(mockLink.download).toBe('export.zip');
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('should not create download link when blob is null', async () => {
      botServiceMock.downloadJobResultBinary.and.returnValue(Promise.resolve(null));

      spyOn(document, 'createElement');

      await service.downloadJobResult('tenant-1', 'job-123', 'export.zip');

      expect(messageServiceMock.showInformation).toHaveBeenCalled();
      expect(botServiceMock.downloadJobResultBinary).toHaveBeenCalled();
      expect(document.createElement).not.toHaveBeenCalled();
    });
  });

  describe('waitForJob', () => {
    it('should return true when job succeeds', async () => {
      botServiceMock.getJobStatus.and.returnValue(Promise.resolve(mockSucceededJobDto));

      const result = await service.waitForJob('job-123', 'Test Operation', 'Export');

      expect(result).toBeTrue();
      expect(progressWindowServiceMock.showIndeterminateProgress).toHaveBeenCalled();
      expect(mockProgressDialog.close).toHaveBeenCalled();
    });

    it('should return false and show error with details when job fails', async () => {
      botServiceMock.getJobStatus.and.returnValue(Promise.resolve(mockFailedJobDto));

      const result = await service.waitForJob('job-123', 'Test Operation', 'Export');

      expect(result).toBeFalse();
      expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledWith(
        'Duplicate key error: entity already exists',
        'Export'
      );
    });

    it('should show reason when errorMessage is null', async () => {
      const failedWithReasonOnly: JobDto = { ...mockFailedJobDto, errorMessage: null };
      botServiceMock.getJobStatus.and.returnValue(Promise.resolve(failedWithReasonOnly));

      const result = await service.waitForJob('job-123', 'Test Operation', 'Export');

      expect(result).toBeFalse();
      expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledWith(
        'Operation failed',
        'Export'
      );
    });

    it('should return false and show error when job is deleted', async () => {
      const deletedJobDto: JobDto = { ...mockSucceededJobDto, status: 'Deleted' };
      botServiceMock.getJobStatus.and.returnValue(Promise.resolve(deletedJobDto));

      const result = await service.waitForJob('job-123', 'Test Operation', 'Export');

      expect(result).toBeFalse();
      expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledWith(
        'Unknown error',
        'Export'
      );
    });

    it('should return false and show error when job is not found', async () => {
      botServiceMock.getJobStatus.and.returnValue(Promise.resolve(null));

      const result = await service.waitForJob('job-123', 'Test Operation', 'Export');

      expect(result).toBeFalse();
      expect(messageServiceMock.showError).toHaveBeenCalledWith('Export: Job not found');
    });

    it('should poll until job completes', fakeAsync(() => {
      let callCount = 0;
      botServiceMock.getJobStatus.and.callFake(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve(mockRunningJobDto);
        }
        return Promise.resolve(mockSucceededJobDto);
      });

      let result: boolean | undefined;
      service.waitForJob('job-123', 'Test Operation', 'Export').then(r => result = r);

      tick(0); // First call
      tick(1000); // Second call after 1 second delay
      tick(1000); // Third call after another 1 second delay

      expect(result).toBeTrue();
      expect(botServiceMock.getJobStatus).toHaveBeenCalledTimes(3);
    }));

    it('should set up progress dialog with cancel operation', async () => {
      botServiceMock.getJobStatus.and.returnValue(Promise.resolve(mockSucceededJobDto));

      await service.waitForJob('job-123', 'Test Title', 'Export');

      const progressCallArgs = progressWindowServiceMock.showIndeterminateProgress.calls.mostRecent().args;
      expect(progressCallArgs[0]).toBe('Test Title');
      const options = progressCallArgs[2] as any;
      expect(options.isCancelOperationAvailable).toBeTrue();
      expect(options.width).toBe(500);
    });
  });
});
