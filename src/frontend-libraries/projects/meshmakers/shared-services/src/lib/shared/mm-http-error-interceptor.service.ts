import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { inject, Injectable } from "@angular/core";
import { MessageService } from "../services/message.service";
import { ApiErrorDto } from "../models/apiErrorDto";

@Injectable()
export class MmHttpErrorInterceptor implements HttpInterceptor {

  private readonly messageService = inject(MessageService);

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      retry(0),
      catchError((error: HttpErrorResponse) => {

        if (error.status === 0) {
          this.messageService.showError('Cannot connect to server. Please check your network connection or if the server is down.');
        }

        if (error.status === 400 && error.error.statusCode) {
          const apiError = error.error as ApiErrorDto;

          let details = '';
          if (apiError.details && apiError.details.length > 0) {
            for (const detail of apiError.details) {
              if (detail.description) {
                details += `\n✗ ${detail.description}`;
              }
            }
          }

          this.messageService.showErrorWithDetails(details, apiError.message);
        }

        return throwError(() => error);
      })
    );
  }
}
