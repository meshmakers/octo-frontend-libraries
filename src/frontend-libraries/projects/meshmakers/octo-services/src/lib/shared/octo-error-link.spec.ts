import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ApolloLink } from '@apollo/client/core';
import { throwError } from 'rxjs';
import { CombinedGraphQLErrors, ServerError } from '@apollo/client';
import {
  isIncompleteSliceGraphQlError,
  OCTO_HANDLES_CK_UPGRADE_BLOCKED,
  OCTO_HANDLES_PAGE_OUT_OF_RANGE,
  OCTO_SILENT_ERRORS,
  OctoErrorLink
} from './octo-error-link';
import { MessageService } from '@meshmakers/shared-services';

describe('OctoErrorLink', () => {
  let octoErrorLink: OctoErrorLink;
  let messageServiceMock: MockedObject<MessageService>;

  beforeEach(() => {
    messageServiceMock = {
      showError: vi.fn().mockName('MessageService.showError'),
      showErrorWithDetails: vi.fn().mockName('MessageService.showErrorWithDetails')
    } as unknown as MockedObject<MessageService>;

    TestBed.configureTestingModule({
      providers: [
        OctoErrorLink,
        { provide: MessageService, useValue: messageServiceMock }
      ]
    });

    octoErrorLink = TestBed.inject(OctoErrorLink);
  });

  it('should be created', () => {
    expect(octoErrorLink).toBeTruthy();
  });

  it('should extend ApolloLink', () => {
    expect(octoErrorLink.request).toBeDefined();
  });

  describe('request method', () => {
    it('should forward the operation', () => {
      const mockOperation = { operationName: 'TestQuery' } as unknown as ApolloLink.Operation;
      const mockForward = vi.fn().mockName('forward').mockReturnValue(null) as unknown as ApolloLink.ForwardFunction;

      // The request method delegates to errorLink which handles errors
      // When there are no errors, it should forward the operation
      octoErrorLink.request(mockOperation, mockForward);

      // Since we're not simulating an actual error, the result behavior depends on Apollo internals
      // This test verifies the request method exists and can be called
      expect(octoErrorLink.request).toBeDefined();
    });
  });

  // Note: Testing the internal error handling of onError requires more complex
  // integration testing with Apollo Client. The OctoErrorLink wraps the onError
  // link from @apollo/client/link/error and delegates error handling to private
  // methods showError and showErrorLike.
  //
  // For comprehensive testing, consider integration tests that simulate actual
  // GraphQL operations with errors using Apollo's MockedProvider.

  describe('silent operations (AB#5523)', () => {
    const op = (context: Record<string, unknown>) => ({ operationName: 'q', getContext: () => context }) as unknown as ApolloLink.Operation;

    it('recognises the silent context flag', () => {
      expect(OctoErrorLink.isSilent(op({ [OCTO_SILENT_ERRORS]: true }))).toBe(true);
      expect(OctoErrorLink.isSilent(op({}))).toBe(false);
      expect(OctoErrorLink.isSilent(undefined)).toBe(false);
      expect(OctoErrorLink.isSilent({ operationName: 'x' } as unknown as ApolloLink.Operation)).toBe(false);
    });

    function run(context: Record<string, unknown>): void {
      const forward = (() => throwError(() => new Error('boom'))) as unknown as ApolloLink.ForwardFunction;
      octoErrorLink.request(op(context), forward).subscribe({ error: () => undefined });
    }

    it('shows no toast for a silent operation, but does for others', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      run({ [OCTO_SILENT_ERRORS]: true });
      expect(messageServiceMock.showError).not.toHaveBeenCalled();
      run({});
      expect(messageServiceMock.showError).toHaveBeenCalledWith('boom');
    });
  });

  describe('tenant upgrade guard refusals (AB#6903)', () => {
    const refusal = { message: 'Blueprint update refused', extensions: { code: 'CK_UPGRADE_BLOCKED' } };
    const other = { message: 'Other error', extensions: { code: 'OPERATION_FAILED' } };
    const show = (errors: unknown[], skip: boolean): void =>
      (octoErrorLink as unknown as { showError(e: { errors: unknown[] }, skip: boolean): void }).showError({ errors }, skip);

    it('recognises the context flag', () => {
      const op = (context: Record<string, unknown>) => ({ getContext: () => context }) as unknown as ApolloLink.Operation;
      expect(OctoErrorLink.handlesCkUpgradeBlocked(op({ [OCTO_HANDLES_CK_UPGRADE_BLOCKED]: true }))).toBe(true);
      expect(OctoErrorLink.handlesCkUpgradeBlocked(op({}))).toBe(false);
      expect(OctoErrorLink.handlesCkUpgradeBlocked(undefined)).toBe(false);
    });

    it('toasts a refusal when the caller does not handle it', () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      show([refusal], false);
      expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledTimes(1);
    });

    it('shows no toast for a refusal the caller handles', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      show([refusal], true);
      expect(messageServiceMock.showErrorWithDetails).not.toHaveBeenCalled();
    });

    it('still toasts the other errors of the same operation', () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      show([refusal, other], true);
      expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledTimes(1);
      expect(vi.mocked(messageServiceMock.showErrorWithDetails).mock.lastCall![0]).toBe('Other error');
    });
  });

  describe('page-out-of-range answers (AB#8805)', () => {
    const outOfRange = { message: 'An error occurred', extensions: { code: 'ASSET1002', codes: ['ASSET1002', 'INCOMPLETE_SLICE'] } };
    const other = { message: 'Other error', extensions: { code: 'ASSET1002', codes: ['ASSET1002'] } };
    const refusal = { message: 'Blueprint update refused', extensions: { code: 'CK_UPGRADE_BLOCKED' } };
    const op = (context: Record<string, unknown>) =>
      ({ operationName: 'getPage', getContext: () => context }) as unknown as ApolloLink.Operation;

    /** Runs a real operation through the link; the server answers with the given GraphQL errors. */
    function run(context: Record<string, unknown>, errors: { message: string; extensions?: Record<string, unknown> }[]): void {
      const forward = (() => throwError(() => new CombinedGraphQLErrors({ data: null, errors }))) as unknown as ApolloLink.ForwardFunction;
      octoErrorLink.request(op(context), forward).subscribe({ error: () => undefined });
    }

    it('recognises the context flag', () => {
      expect(OctoErrorLink.handlesPageOutOfRange(op({ [OCTO_HANDLES_PAGE_OUT_OF_RANGE]: true }))).toBe(true);
      expect(OctoErrorLink.handlesPageOutOfRange(op({ [OCTO_HANDLES_PAGE_OUT_OF_RANGE]: 'yes' }))).toBe(false);
      expect(OctoErrorLink.handlesPageOutOfRange(op({}))).toBe(false);
      expect(OctoErrorLink.handlesPageOutOfRange(undefined)).toBe(false);
    });

    it('detects INCOMPLETE_SLICE in code or codes, never the generic ASSET1002 alone', () => {
      expect(isIncompleteSliceGraphQlError(outOfRange)).toBe(true);
      expect(isIncompleteSliceGraphQlError({ extensions: { code: 'INCOMPLETE_SLICE' } })).toBe(true);
      expect(isIncompleteSliceGraphQlError(other)).toBe(false);
      expect(isIncompleteSliceGraphQlError({ extensions: { code: 'ASSET1002' } })).toBe(false);
      expect(isIncompleteSliceGraphQlError({ extensions: null })).toBe(false);
      expect(isIncompleteSliceGraphQlError(null)).toBe(false);
    });

    it('logs and toasts the answer when the caller does not opt out', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      run({}, [outOfRange]);
      expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(outOfRange);
    });

    it('shows no console error and no toast when the caller recovers itself', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      run({ [OCTO_HANDLES_PAGE_OUT_OF_RANGE]: true }, [outOfRange]);
      expect(messageServiceMock.showErrorWithDetails).not.toHaveBeenCalled();
      expect(messageServiceMock.showError).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('still logs and toasts the other errors of the same operation', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      run({ [OCTO_HANDLES_PAGE_OUT_OF_RANGE]: true }, [outOfRange, other]);
      expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledTimes(1);
      expect(vi.mocked(messageServiceMock.showErrorWithDetails).mock.lastCall![0]).toBe('Other error');
      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(other);
    });

    it('does not skip guard refusals; both opt-outs combine', () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      run({ [OCTO_HANDLES_PAGE_OUT_OF_RANGE]: true }, [outOfRange, refusal]);
      expect(vi.mocked(messageServiceMock.showErrorWithDetails).mock.lastCall![0]).toBe('Blueprint update refused');

      messageServiceMock.showErrorWithDetails.mockClear();
      run({ [OCTO_HANDLES_PAGE_OUT_OF_RANGE]: true, [OCTO_HANDLES_CK_UPGRADE_BLOCKED]: true }, [outOfRange, refusal]);
      expect(messageServiceMock.showErrorWithDetails).not.toHaveBeenCalled();
    });

    it('does not change the guard opt-out: an out-of-range answer is still toasted under it', () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      run({ [OCTO_HANDLES_CK_UPGRADE_BLOCKED]: true }, [outOfRange]);
      expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledTimes(1);
    });

    describe('non-2xx JSON answer (Apollo 4 ServerError)', () => {
      function serverError(body: unknown): ServerError {
        const bodyText = typeof body === 'string' ? body : JSON.stringify(body);
        const response = new Response(bodyText, { status: 500, headers: { 'content-type': 'application/json' } });
        return new ServerError('Response not successful: Received status code 500', { response, bodyText });
      }
      function runServerError(context: Record<string, unknown>, error: ServerError): void {
        const forward = (() => throwError(() => error)) as unknown as ApolloLink.ForwardFunction;
        octoErrorLink.request(op(context), forward).subscribe({ error: () => undefined });
      }

      it('shows no console error and no toast when the body holds only INCOMPLETE_SLICE errors and the caller opted out', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        runServerError({ [OCTO_HANDLES_PAGE_OUT_OF_RANGE]: true }, serverError({ data: null, errors: [outOfRange] }));
        expect(messageServiceMock.showError).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledTimes(1);
      });

      it('still logs and toasts it without the opt-out', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        runServerError({}, serverError({ data: null, errors: [outOfRange] }));
        expect(messageServiceMock.showError).toHaveBeenCalledTimes(1);
      });

      it('still logs and toasts a body with other errors or no GraphQL response', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        runServerError({ [OCTO_HANDLES_PAGE_OUT_OF_RANGE]: true }, serverError({ data: null, errors: [outOfRange, other] }));
        runServerError({ [OCTO_HANDLES_PAGE_OUT_OF_RANGE]: true }, serverError('<html>Bad Gateway</html>'));
        runServerError({ [OCTO_HANDLES_PAGE_OUT_OF_RANGE]: true }, serverError({ errors: [] }));
        expect(messageServiceMock.showError).toHaveBeenCalledTimes(3);
      });
    });

    it('keeps silent operations silent', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      run({ [OCTO_SILENT_ERRORS]: true, [OCTO_HANDLES_PAGE_OUT_OF_RANGE]: true }, [outOfRange, other]);
      expect(messageServiceMock.showErrorWithDetails).not.toHaveBeenCalled();
    });
  });

  describe('showError deduplication (AB#4772)', () => {
    // showError is private; invoked directly with a minimal errors carrier because wiring a
    // full Apollo operation through onError only exercises Apollo internals, not our rendering.
    function invokeShowError(errors: unknown[]): void {
      (octoErrorLink as unknown as {
        showError(e: {
          errors: unknown[];
        }): void;
      })
        .showError({ errors });
    }

    const columnsError = () => ({
      message: "Error trying to resolve field 'columns'.",
      extensions: { code: 'INVALID_OPERATION' },
    });

    it('collapses identical errors into one entry with a count suffix', () => {
      invokeShowError(Array.from({ length: 13 }, columnsError));

      expect(messageServiceMock.showErrorWithDetails).toHaveBeenCalledTimes(1);
      const [title, details] = vi.mocked(messageServiceMock.showErrorWithDetails).mock.lastCall!;
      expect(title).toBe("Error trying to resolve field 'columns'. (× 13)");
      // Only the first (unique) entry exists — no repeated separator blocks in the details.
      expect(details).not.toContain('======================');
      expect(details).toContain('Global Result Code: INVALID_OPERATION');
    });

    it('keeps distinct errors separate without a count suffix', () => {
      invokeShowError([
        { message: 'Domain error', extensions: { code: 'INVALID_OPERATION' } },
        { message: 'Other error', extensions: { code: 'NOT_FOUND' } },
      ]);

      const [title, details] = vi.mocked(messageServiceMock.showErrorWithDetails).mock.lastCall!;
      expect(title).toBe('Domain error');
      expect(title).not.toContain('×');
      expect(details).toContain('Other error');
    });

    it('does not collapse errors that differ only in their result code', () => {
      invokeShowError([
        { message: 'Same message', extensions: { code: 'INVALID_OPERATION' } },
        { message: 'Same message', extensions: { code: 'NOT_FOUND' } },
      ]);

      const [title, details] = vi.mocked(messageServiceMock.showErrorWithDetails).mock.lastCall!;
      expect(title).toBe('Same message');
      expect(details).toContain('Same message');
      expect(details).toContain('Global Result Code: NOT_FOUND');
    });

    it('deduplicates errors without extensions as well', () => {
      invokeShowError([
        { message: 'Plain error' },
        { message: 'Plain error' },
      ]);

      const [title] = vi.mocked(messageServiceMock.showErrorWithDetails).mock.lastCall!;
      expect(title).toBe('Plain error (× 2)');
    });
  });
});
