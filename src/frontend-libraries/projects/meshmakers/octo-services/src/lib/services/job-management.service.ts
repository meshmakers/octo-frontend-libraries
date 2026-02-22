import {Injectable, inject} from '@angular/core';
import {MessageService} from "@meshmakers/shared-services";
import {ProgressValue} from "../shared/progress-value";
import {ProgressWindowService} from "../shared/progress-window.service";
import {Subject} from 'rxjs';
import {BotService} from './bot-service';

@Injectable({
  providedIn: 'root'
})
export class JobManagementService {
  private readonly botService = inject(BotService);
  private readonly messageService = inject(MessageService);
  private readonly progressWindowService = inject(ProgressWindowService);


  public async downloadJobResult(tenantId: string, jobId: string, fileName: string): Promise<void> {
    this.messageService.showInformation('Operation completed. Download has been initialized.');


    const blob = await this.botService.downloadJobResultBinary(tenantId, jobId);
    if (blob) {
      const downloadURL = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadURL;
      link.download = fileName;
      link.click();
    }
  }


  public async waitForJob(jobId: string, title: string, operation: string): Promise<boolean> {
    let cancelled = false;
    const progressSubject = new Subject<ProgressValue>();
    const progressDialog = this.progressWindowService.showIndeterminateProgress(
      title,
      progressSubject.asObservable(),
      {
        isCancelOperationAvailable: true,
        cancelOperation: () => {
          cancelled = true;
          console.log('Wait job task cancelled');
          progressDialog.close();
        },
        width: 500
      });

    while (true) {
      const jobDto = await this.botService.getJobStatus(jobId);

      if (jobDto == null) {
        this.messageService.showError(`${operation}: Job not found`);
        break;
      }

      if (jobDto.status === 'Succeeded' || jobDto.status === 'Failed'
        || jobDto.status === 'Deleted' || cancelled) {
        if (jobDto.status === 'Succeeded') {
          progressDialog.close();
          return true;
        } else {
          const errorDetails = jobDto.errorMessage || jobDto.reason || 'Unknown error';
          this.messageService.showErrorWithDetails(errorDetails, operation);
        }
        break;
      }

      const progressValue = new ProgressValue();
      progressValue.statusText = `Operation '${jobDto.status ?? '<unknown>'}'. Please wait...`;
      progressSubject.next(progressValue);

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return false;
  }
}
