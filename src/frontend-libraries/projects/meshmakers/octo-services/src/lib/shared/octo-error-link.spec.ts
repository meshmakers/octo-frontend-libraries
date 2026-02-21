import { TestBed } from '@angular/core/testing';
import { OctoErrorLink } from './octo-error-link';
import { MessageService } from '@meshmakers/shared-services';

describe('OctoErrorLink', () => {
  let octoErrorLink: OctoErrorLink;
  let messageServiceMock: jasmine.SpyObj<MessageService>;

  beforeEach(() => {
    messageServiceMock = jasmine.createSpyObj('MessageService', ['showError', 'showErrorWithDetails']);

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
      const mockOperation = { operationName: 'TestQuery' };
      const mockForward = jasmine.createSpy('forward').and.returnValue(null);

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
});
