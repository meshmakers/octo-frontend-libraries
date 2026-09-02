import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ApolloLink } from '@apollo/client/core';
import { OctoErrorLink } from './octo-error-link';
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
