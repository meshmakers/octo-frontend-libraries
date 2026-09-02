import type { Mock, MockedObject } from "vitest";
import { TestBed } from '@angular/core/testing';
import { HttpRequest, HttpHandler, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { MmHttpErrorInterceptor, ON_CONNECTION_LOST } from './mm-http-error-interceptor.service';
import { MessageService } from '../services/message.service';
import { ApiErrorDto } from '../models/apiErrorDto';

describe('MmHttpErrorInterceptor', () => {
    let interceptor: MmHttpErrorInterceptor;
    let messageServiceMock: MockedObject<MessageService>;
    let httpHandlerMock: MockedObject<HttpHandler>;

    function createInterceptor(onConnectionLost?: () => void): void {
        const providers: unknown[] = [
            MmHttpErrorInterceptor,
            { provide: MessageService, useValue: messageServiceMock }
        ];
        if (onConnectionLost) {
            providers.push({ provide: ON_CONNECTION_LOST, useValue: onConnectionLost });
        }

        TestBed.configureTestingModule({ providers });
        interceptor = TestBed.inject(MmHttpErrorInterceptor);
    }

    beforeEach(() => {
        messageServiceMock = {
            showError: vi.fn().mockName("MessageService.showError"),
            showErrorWithDetails: vi.fn().mockName("MessageService.showErrorWithDetails")
        } as unknown as MockedObject<MessageService>;
        httpHandlerMock = {
            handle: vi.fn().mockName("HttpHandler.handle")
        } as unknown as MockedObject<HttpHandler>;
    });

    describe('without ON_CONNECTION_LOST', () => {
        beforeEach(() => createInterceptor());

        it('should be created', () => {
            expect(interceptor).toBeTruthy();
        });

        describe('successful requests', () => {
            it('should pass through successful responses', () => new Promise<void>((done) => {
                const req = new HttpRequest('GET', '/api/data');
                const response = new HttpResponse({ status: 200, body: { data: 'test' } });
                httpHandlerMock.handle.mockReturnValue(of(response));

                interceptor.intercept(req, httpHandlerMock).subscribe(event => {
                    expect(event).toBe(response);
                    expect(messageServiceMock.showError).not.toHaveBeenCalled();
                    expect(messageServiceMock.showErrorWithDetails).not.toHaveBeenCalled();
                    done();
                });
            }));
        });

        describe('network errors (status 0)', () => {
            it('should show error message for network connection failure', () => new Promise<void>((done) => {
                const req = new HttpRequest('GET', '/api/data');
                const error = new HttpErrorResponse({
                    status: 0,
                    statusText: 'Unknown Error',
                    url: '/api/data'
                });
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    error: (err) => {
                        expect(messageServiceMock.showError).toHaveBeenCalledWith('OctoMesh backend is not reachable. Please check if your network connection is working or contact your Administrator.');
                        expect(err).toBe(error);
                        done();
                    }
                });
            }));

            it('should rethrow the error after showing message', () => new Promise<void>((done) => {
                const req = new HttpRequest('GET', '/api/data');
                const error = new HttpErrorResponse({ status: 0 });
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    next: () => { throw new Error('should not emit next'); },
                    error: (err) => {
                        expect(err).toBe(error);
                        done();
                    }
                });
            }));

            it('should not show error message for health check requests', () => new Promise<void>((done) => {
                const req = new HttpRequest('GET', 'https://localhost:5009/health');
                const error = new HttpErrorResponse({ status: 0, url: 'https://localhost:5009/health' });
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    error: (err) => {
                        expect(messageServiceMock.showError).not.toHaveBeenCalled();
                        expect(err).toBe(error);
                        done();
                    }
                });
            }));
        });

        describe('API errors (status 400 with statusCode)', () => {
            it('should show error with details for API error', () => new Promise<void>((done) => {
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
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    error: () => {
                        expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledWith('Validation failed', '\n✗ Field is required');
                        done();
                    }
                });
            }));

            it('should fall back to a generic headline when the API error carries no message', () => new Promise<void>((done) => {
                // A 400 body is classified on its statusCode alone; without a message the toast must not
                // render "undefined" as its headline.
                const req = new HttpRequest('GET', '/api/data');
                const error = new HttpErrorResponse({
                    status: 400,
                    error: { statusCode: 400, statusDescription: 'Bad Request', details: [{ code: 'ERR001', description: 'Field is required' }] }
                });
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    error: () => {
                        expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledWith('The request was rejected by the server.', '\n✗ Field is required');
                        done();
                    }
                });
            }));

            it('should handle multiple error details', () => new Promise<void>((done) => {
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
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    error: () => {
                        expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledWith('Multiple errors', '\n✗ First error\n✗ Second error\n✗ Third error');
                        done();
                    }
                });
            }));

            it('should handle API error without details', () => new Promise<void>((done) => {
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
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    error: () => {
                        expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledWith('Error without details', '');
                        done();
                    }
                });
            }));

            it('should handle empty details array', () => new Promise<void>((done) => {
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
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    error: () => {
                        expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledWith('Empty details', '');
                        done();
                    }
                });
            }));

            it('should skip details without description', () => new Promise<void>((done) => {
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
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    error: () => {
                        expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledWith('Mixed details', '\n✗ Has description\n✗ Another description');
                        done();
                    }
                });
            }));

            it('should rethrow error after showing API error message', () => new Promise<void>((done) => {
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
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    error: (err) => {
                        expect(err).toBe(error);
                        done();
                    }
                });
            }));
        });

        describe('conflicts (status 409)', () => {
            it('should show the server message for a 409 conflict', () => new Promise<void>((done) => {
                // OperationFailedErrorDto hardcodes statusCode 400 into the body even on a 409 response, so
                // the 400 branch can never match one. Without a dedicated branch the user sees nothing at
                // all — which is what made a rejected tenant create look like a silent failure (AB#4762).
                // The server message must land in the FIRST argument (the toast headline) — swapped
                // arguments rendered a blank headline for every body without a details list.
                const req = new HttpRequest('POST', '/octosystem/v1/tenants', null);
                const error = new HttpErrorResponse({
                    status: 409,
                    error: { statusCode: 400, statusDescription: 'BadRequest', message: "Tenant ID 'abc' is already in use." }
                });
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    error: () => {
                        expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledWith("Tenant ID 'abc' is already in use.", '');
                        done();
                    }
                });
            }));

            it('should not show a message for a 409 without a message body', () => new Promise<void>((done) => {
                const req = new HttpRequest('POST', '/octosystem/v1/tenants', null);
                const error = new HttpErrorResponse({ status: 409, error: null });
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    error: (err) => {
                        expect(messageServiceMock.showErrorWithDetails).not.toHaveBeenCalled();
                        expect(err).toBe(error);
                        done();
                    }
                });
            }));
        });

        describe('other HTTP errors', () => {
            it('should not show message for 400 without statusCode in error body', () => new Promise<void>((done) => {
                const req = new HttpRequest('GET', '/api/data');
                const error = new HttpErrorResponse({
                    status: 400,
                    error: { message: 'Simple error' }
                });
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    error: () => {
                        expect(messageServiceMock.showError).not.toHaveBeenCalled();
                        expect(messageServiceMock.showErrorWithDetails).not.toHaveBeenCalled();
                        done();
                    }
                });
            }));

            it('should not show message for 401 Unauthorized', () => new Promise<void>((done) => {
                const req = new HttpRequest('GET', '/api/data');
                const error = new HttpErrorResponse({
                    status: 401,
                    statusText: 'Unauthorized'
                });
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    error: () => {
                        expect(messageServiceMock.showError).not.toHaveBeenCalled();
                        expect(messageServiceMock.showErrorWithDetails).not.toHaveBeenCalled();
                        done();
                    }
                });
            }));

            it('should show access denied message for 403 Forbidden', () => new Promise<void>((done) => {
                const req = new HttpRequest('GET', '/api/data');
                const error = new HttpErrorResponse({
                    status: 403,
                    statusText: 'Forbidden'
                });
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    error: () => {
                        expect(messageServiceMock.showError).toHaveBeenCalledWith('Access denied. You do not have permission to access this tenant or resource.');
                        done();
                    }
                });
            }));

            it('should not show message for 404 Not Found', () => new Promise<void>((done) => {
                const req = new HttpRequest('GET', '/api/data');
                const error = new HttpErrorResponse({
                    status: 404,
                    statusText: 'Not Found'
                });
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    error: () => {
                        expect(messageServiceMock.showError).not.toHaveBeenCalled();
                        expect(messageServiceMock.showErrorWithDetails).not.toHaveBeenCalled();
                        done();
                    }
                });
            }));

            it('should not show message for 500 Internal Server Error', () => new Promise<void>((done) => {
                const req = new HttpRequest('GET', '/api/data');
                const error = new HttpErrorResponse({
                    status: 500,
                    statusText: 'Internal Server Error'
                });
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    error: () => {
                        expect(messageServiceMock.showError).not.toHaveBeenCalled();
                        expect(messageServiceMock.showErrorWithDetails).not.toHaveBeenCalled();
                        done();
                    }
                });
            }));

            it('should rethrow all errors regardless of status', () => new Promise<void>((done) => {
                const req = new HttpRequest('GET', '/api/data');
                const error = new HttpErrorResponse({
                    status: 503,
                    statusText: 'Service Unavailable'
                });
                httpHandlerMock.handle.mockReturnValue(throwError(() => error));

                interceptor.intercept(req, httpHandlerMock).subscribe({
                    error: (err) => {
                        expect(err).toBe(error);
                        done();
                    }
                });
            }));
        });

        describe('request handling', () => {
            it('should pass the request to the handler unchanged', () => new Promise<void>((done) => {
                const req = new HttpRequest('POST', '/api/data', { body: 'test' });
                const response = new HttpResponse({ status: 200 });
                httpHandlerMock.handle.mockReturnValue(of(response));

                interceptor.intercept(req, httpHandlerMock).subscribe(() => {
                    expect(httpHandlerMock.handle).toHaveBeenCalledWith(req);
                    done();
                });
            }));

            it('should handle requests with different HTTP methods', () => new Promise<void>((done) => {
                const requests = [
                    new HttpRequest('GET', '/api/data'),
                    new HttpRequest('POST', '/api/data', null),
                    new HttpRequest('PUT', '/api/data', null),
                    new HttpRequest('DELETE', '/api/data'),
                    new HttpRequest('PATCH', '/api/data', null)
                ];
                let completedCount = 0;

                requests.forEach(req => {
                    const response = new HttpResponse({ status: 200 });
                    httpHandlerMock.handle.mockReturnValue(of(response));

                    interceptor.intercept(req, httpHandlerMock).subscribe(() => {
                        completedCount++;
                        if (completedCount === requests.length) {
                            expect(httpHandlerMock.handle).toHaveBeenCalledTimes(requests.length);
                            done();
                        }
                    });
                });
            }));
        });
    });

    /**
     * The predicate callers use to avoid a second toast for an error the interceptor already showed
     * (AB#4255). It must say "true" for exactly the responses the intercept branches act on.
     */
    describe('reportsToUser', () => {
        it('reports a connection loss (status 0) on a regular request', () => {
            expect(MmHttpErrorInterceptor.reportsToUser(new HttpErrorResponse({ status: 0, url: '/api/data' }))).toBe(true);
        });

        it('does not report a connection loss on a health check', () => {
            const error = new HttpErrorResponse({ status: 0, url: 'https://localhost:5009/health' });
            expect(MmHttpErrorInterceptor.reportsToUser(error)).toBe(false);
        });

        it('reports 403 Forbidden', () => {
            expect(MmHttpErrorInterceptor.reportsToUser(new HttpErrorResponse({ status: 403 }))).toBe(true);
        });

        it('reports a 400 carrying an ApiErrorDto body', () => {
            const error = new HttpErrorResponse({
                status: 400,
                error: { statusCode: 400, statusDescription: 'Bad Request', message: 'Validation failed' }
            });
            expect(MmHttpErrorInterceptor.reportsToUser(error)).toBe(true);
        });

        it('reports a 409 carrying a message body (the capability disable guards, AB#4255)', () => {
            const error = new HttpErrorResponse({
                status: 409,
                error: { statusCode: 400, message: "Stream data cannot be disabled for tenant 'a' while the following archives are still activated: RawArchive 'x' (Activated)." }
            });
            expect(MmHttpErrorInterceptor.reportsToUser(error)).toBe(true);
        });

        it('does not report a 400 without statusCode, a 409 without a message body, or other statuses', () => {
            expect(MmHttpErrorInterceptor.reportsToUser(new HttpErrorResponse({ status: 400, error: { message: 'plain' } }))).toBe(false);
            expect(MmHttpErrorInterceptor.reportsToUser(new HttpErrorResponse({ status: 400, error: 'already disabled' }))).toBe(false);
            expect(MmHttpErrorInterceptor.reportsToUser(new HttpErrorResponse({ status: 409, error: null }))).toBe(false);
            expect(MmHttpErrorInterceptor.reportsToUser(new HttpErrorResponse({ status: 401 }))).toBe(false);
            expect(MmHttpErrorInterceptor.reportsToUser(new HttpErrorResponse({ status: 404 }))).toBe(false);
            expect(MmHttpErrorInterceptor.reportsToUser(new HttpErrorResponse({ status: 500 }))).toBe(false);
        });

        it('never reports anything that is not an HttpErrorResponse', () => {
            expect(MmHttpErrorInterceptor.reportsToUser(new Error('boom'))).toBe(false);
            expect(MmHttpErrorInterceptor.reportsToUser('boom')).toBe(false);
            expect(MmHttpErrorInterceptor.reportsToUser(undefined)).toBe(false);
            expect(MmHttpErrorInterceptor.reportsToUser(null)).toBe(false);
            // A numeric status alone is not enough - only Angular's HttpErrorResponse shape counts.
            expect(MmHttpErrorInterceptor.reportsToUser({ status: 403 })).toBe(false);
        });

        it('recognises an HttpErrorResponse structurally, not by class identity', () => {
            // The Studio's Karma run compiles this library from source with a second @angular/common
            // instance; instanceof would be false there while the object is a real HttpErrorResponse.
            const foreignInstance = Object.assign(Object.create(null), {
                name: 'HttpErrorResponse', status: 409, error: { message: 'refused' }, url: '/api/data'
            });
            expect(MmHttpErrorInterceptor.reportsToUser(foreignInstance)).toBe(true);
        });
    });

    describe('with ON_CONNECTION_LOST handler', () => {
        let connectionLostHandler: Mock;

        beforeEach(() => {
            connectionLostHandler = vi.fn().mockName('onConnectionLost');
            createInterceptor(connectionLostHandler);
        });

        it('should call ON_CONNECTION_LOST handler instead of showing toast on status 0', () => new Promise<void>((done) => {
            const req = new HttpRequest('GET', '/api/data');
            const error = new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });
            httpHandlerMock.handle.mockReturnValue(throwError(() => error));

            interceptor.intercept(req, httpHandlerMock).subscribe({
                error: (err) => {
                    expect(connectionLostHandler).toHaveBeenCalled();
                    expect(messageServiceMock.showError).not.toHaveBeenCalled();
                    expect(err).toBe(error);
                    done();
                }
            });
        }));

        it('should not call ON_CONNECTION_LOST handler for health check requests', () => new Promise<void>((done) => {
            const req = new HttpRequest('GET', 'https://localhost:5009/health');
            const error = new HttpErrorResponse({ status: 0, url: 'https://localhost:5009/health' });
            httpHandlerMock.handle.mockReturnValue(throwError(() => error));

            interceptor.intercept(req, httpHandlerMock).subscribe({
                error: (err) => {
                    expect(connectionLostHandler).not.toHaveBeenCalled();
                    expect(messageServiceMock.showError).not.toHaveBeenCalled();
                    expect(err).toBe(error);
                    done();
                }
            });
        }));

        it('should still show toast for non-network errors', () => new Promise<void>((done) => {
            const req = new HttpRequest('GET', '/api/data');
            const error = new HttpErrorResponse({ status: 403, statusText: 'Forbidden' });
            httpHandlerMock.handle.mockReturnValue(throwError(() => error));

            interceptor.intercept(req, httpHandlerMock).subscribe({
                error: () => {
                    expect(connectionLostHandler).not.toHaveBeenCalled();
                    expect(messageServiceMock.showError).toHaveBeenCalled();
                    done();
                }
            });
        }));
    });
});
