import { TestBed } from '@angular/core/testing';
import { HttpRequest, HttpHandler, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { MmHttpErrorInterceptor } from './mm-http-error-interceptor.service';
import { MessageService } from '../services/message.service';
import { ApiErrorDto } from '../models/apiErrorDto';

describe('MmHttpErrorInterceptor', () => {
  let interceptor: MmHttpErrorInterceptor;
  let messageServiceMock: jasmine.SpyObj<MessageService>;
  let httpHandlerMock: jasmine.SpyObj<HttpHandler>;

  beforeEach(() => {
    messageServiceMock = jasmine.createSpyObj('MessageService', ['showError', 'showErrorWithDetails']);

    httpHandlerMock = jasmine.createSpyObj('HttpHandler', ['handle']);

    TestBed.configureTestingModule({
      providers: [
        MmHttpErrorInterceptor,
        { provide: MessageService, useValue: messageServiceMock }
      ]
    });

    interceptor = TestBed.inject(MmHttpErrorInterceptor);
  });

  it('should be created', () => {
    expect(interceptor).toBeTruthy();
  });

  describe('successful requests', () => {
    it('should pass through successful responses', (done) => {
      const req = new HttpRequest('GET', '/api/data');
      const response = new HttpResponse({ status: 200, body: { data: 'test' } });
      httpHandlerMock.handle.and.returnValue(of(response));

      interceptor.intercept(req, httpHandlerMock).subscribe(event => {
        expect(event).toBe(response);
        expect(messageServiceMock.showError).not.toHaveBeenCalled();
        expect(messageServiceMock.showErrorWithDetails).not.toHaveBeenCalled();
        done();
      });
    });
  });

  describe('network errors (status 0)', () => {
    it('should show error message for network connection failure', (done) => {
      const req = new HttpRequest('GET', '/api/data');
      const error = new HttpErrorResponse({
        status: 0,
        statusText: 'Unknown Error',
        url: '/api/data'
      });
      httpHandlerMock.handle.and.returnValue(throwError(() => error));

      interceptor.intercept(req, httpHandlerMock).subscribe({
        error: (err) => {
          expect(messageServiceMock.showError).toHaveBeenCalledWith(
            'Cannot connect to server. Please check your network connection or if the server is down.'
          );
          expect(err).toBe(error);
          done();
        }
      });
    });

    it('should rethrow the error after showing message', (done) => {
      const req = new HttpRequest('GET', '/api/data');
      const error = new HttpErrorResponse({ status: 0 });
      httpHandlerMock.handle.and.returnValue(throwError(() => error));

      interceptor.intercept(req, httpHandlerMock).subscribe({
        next: () => fail('should not emit next'),
        error: (err) => {
          expect(err).toBe(error);
          done();
        }
      });
    });
  });

  describe('API errors (status 400 with statusCode)', () => {
    it('should show error with details for API error', (done) => {
      const req = new HttpRequest('GET', '/api/data');
      const apiError: ApiErrorDto = {
        statusCode: 400,
        statusDescription: 'Bad Request',
        message: 'Validation failed',
        details: [
          { code: 'ERR001', description: 'Field is required' }
        ]
      };
      const error = new HttpErrorResponse({
        status: 400,
        error: apiError
      });
      httpHandlerMock.handle.and.returnValue(throwError(() => error));

      interceptor.intercept(req, httpHandlerMock).subscribe({
        error: () => {
          expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledWith(
            '\n✗ Field is required',
            'Validation failed'
          );
          done();
        }
      });
    });

    it('should handle multiple error details', (done) => {
      const req = new HttpRequest('GET', '/api/data');
      const apiError: ApiErrorDto = {
        statusCode: 400,
        statusDescription: 'Bad Request',
        message: 'Multiple errors',
        details: [
          { code: 'ERR001', description: 'First error' },
          { code: 'ERR002', description: 'Second error' },
          { code: 'ERR003', description: 'Third error' }
        ]
      };
      const error = new HttpErrorResponse({
        status: 400,
        error: apiError
      });
      httpHandlerMock.handle.and.returnValue(throwError(() => error));

      interceptor.intercept(req, httpHandlerMock).subscribe({
        error: () => {
          expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledWith(
            '\n✗ First error\n✗ Second error\n✗ Third error',
            'Multiple errors'
          );
          done();
        }
      });
    });

    it('should handle API error without details', (done) => {
      const req = new HttpRequest('GET', '/api/data');
      const apiError: ApiErrorDto = {
        statusCode: 400,
        statusDescription: 'Bad Request',
        message: 'Error without details'
      };
      const error = new HttpErrorResponse({
        status: 400,
        error: apiError
      });
      httpHandlerMock.handle.and.returnValue(throwError(() => error));

      interceptor.intercept(req, httpHandlerMock).subscribe({
        error: () => {
          expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledWith(
            '',
            'Error without details'
          );
          done();
        }
      });
    });

    it('should handle empty details array', (done) => {
      const req = new HttpRequest('GET', '/api/data');
      const apiError: ApiErrorDto = {
        statusCode: 400,
        statusDescription: 'Bad Request',
        message: 'Empty details',
        details: []
      };
      const error = new HttpErrorResponse({
        status: 400,
        error: apiError
      });
      httpHandlerMock.handle.and.returnValue(throwError(() => error));

      interceptor.intercept(req, httpHandlerMock).subscribe({
        error: () => {
          expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledWith(
            '',
            'Empty details'
          );
          done();
        }
      });
    });

    it('should skip details without description', (done) => {
      const req = new HttpRequest('GET', '/api/data');
      const apiError: ApiErrorDto = {
        statusCode: 400,
        statusDescription: 'Bad Request',
        message: 'Mixed details',
        details: [
          { code: 'ERR001', description: 'Has description' },
          { code: 'ERR002', description: '' },
          { code: 'ERR003', description: 'Another description' }
        ]
      };
      const error = new HttpErrorResponse({
        status: 400,
        error: apiError
      });
      httpHandlerMock.handle.and.returnValue(throwError(() => error));

      interceptor.intercept(req, httpHandlerMock).subscribe({
        error: () => {
          expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledWith(
            '\n✗ Has description\n✗ Another description',
            'Mixed details'
          );
          done();
        }
      });
    });

    it('should rethrow error after showing API error message', (done) => {
      const req = new HttpRequest('GET', '/api/data');
      const apiError: ApiErrorDto = {
        statusCode: 400,
        statusDescription: 'Bad Request',
        message: 'Test error'
      };
      const error = new HttpErrorResponse({
        status: 400,
        error: apiError
      });
      httpHandlerMock.handle.and.returnValue(throwError(() => error));

      interceptor.intercept(req, httpHandlerMock).subscribe({
        error: (err) => {
          expect(err).toBe(error);
          done();
        }
      });
    });
  });

  describe('other HTTP errors', () => {
    it('should not show message for 400 without statusCode in error body', (done) => {
      const req = new HttpRequest('GET', '/api/data');
      const error = new HttpErrorResponse({
        status: 400,
        error: { message: 'Simple error' }
      });
      httpHandlerMock.handle.and.returnValue(throwError(() => error));

      interceptor.intercept(req, httpHandlerMock).subscribe({
        error: () => {
          expect(messageServiceMock.showError).not.toHaveBeenCalled();
          expect(messageServiceMock.showErrorWithDetails).not.toHaveBeenCalled();
          done();
        }
      });
    });

    it('should not show message for 401 Unauthorized', (done) => {
      const req = new HttpRequest('GET', '/api/data');
      const error = new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized'
      });
      httpHandlerMock.handle.and.returnValue(throwError(() => error));

      interceptor.intercept(req, httpHandlerMock).subscribe({
        error: () => {
          expect(messageServiceMock.showError).not.toHaveBeenCalled();
          expect(messageServiceMock.showErrorWithDetails).not.toHaveBeenCalled();
          done();
        }
      });
    });

    it('should show access denied message for 403 Forbidden', (done) => {
      const req = new HttpRequest('GET', '/api/data');
      const error = new HttpErrorResponse({
        status: 403,
        statusText: 'Forbidden'
      });
      httpHandlerMock.handle.and.returnValue(throwError(() => error));

      interceptor.intercept(req, httpHandlerMock).subscribe({
        error: () => {
          expect(messageServiceMock.showError).toHaveBeenCalledWith(
            'Access denied. You do not have permission to access this tenant or resource.'
          );
          done();
        }
      });
    });

    it('should not show message for 404 Not Found', (done) => {
      const req = new HttpRequest('GET', '/api/data');
      const error = new HttpErrorResponse({
        status: 404,
        statusText: 'Not Found'
      });
      httpHandlerMock.handle.and.returnValue(throwError(() => error));

      interceptor.intercept(req, httpHandlerMock).subscribe({
        error: () => {
          expect(messageServiceMock.showError).not.toHaveBeenCalled();
          expect(messageServiceMock.showErrorWithDetails).not.toHaveBeenCalled();
          done();
        }
      });
    });

    it('should not show message for 500 Internal Server Error', (done) => {
      const req = new HttpRequest('GET', '/api/data');
      const error = new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Server Error'
      });
      httpHandlerMock.handle.and.returnValue(throwError(() => error));

      interceptor.intercept(req, httpHandlerMock).subscribe({
        error: () => {
          expect(messageServiceMock.showError).not.toHaveBeenCalled();
          expect(messageServiceMock.showErrorWithDetails).not.toHaveBeenCalled();
          done();
        }
      });
    });

    it('should rethrow all errors regardless of status', (done) => {
      const req = new HttpRequest('GET', '/api/data');
      const error = new HttpErrorResponse({
        status: 503,
        statusText: 'Service Unavailable'
      });
      httpHandlerMock.handle.and.returnValue(throwError(() => error));

      interceptor.intercept(req, httpHandlerMock).subscribe({
        error: (err) => {
          expect(err).toBe(error);
          done();
        }
      });
    });
  });

  describe('request handling', () => {
    it('should pass the request to the handler unchanged', (done) => {
      const req = new HttpRequest('POST', '/api/data', { body: 'test' });
      const response = new HttpResponse({ status: 200 });
      httpHandlerMock.handle.and.returnValue(of(response));

      interceptor.intercept(req, httpHandlerMock).subscribe(() => {
        expect(httpHandlerMock.handle).toHaveBeenCalledWith(req);
        done();
      });
    });

    it('should handle requests with different HTTP methods', (done) => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      let completedCount = 0;

      methods.forEach(method => {
        const req = new HttpRequest(method as any, '/api/data');
        const response = new HttpResponse({ status: 200 });
        httpHandlerMock.handle.and.returnValue(of(response));

        interceptor.intercept(req, httpHandlerMock).subscribe(() => {
          completedCount++;
          if (completedCount === methods.length) {
            expect(httpHandlerMock.handle).toHaveBeenCalledTimes(methods.length);
            done();
          }
        });
      });
    });
  });
});
