import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideOctoAiConsole } from '../../services/ai-adapter-options';
import { AiCredentialTicketIssueComponent } from './ai-credential-ticket-issue.component';

describe('AiCredentialTicketIssueComponent', () => {
  let fixture: ComponentFixture<AiCredentialTicketIssueComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiCredentialTicketIssueComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideOctoAiConsole({
          baseUrl: 'https://ai.test',
          tenantId: 'acme',
          hubPath: '/hubs/ai',
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AiCredentialTicketIssueComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('renders the issue form initially', () => {
    const submitButton = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submitButton).toBeTruthy();
    expect(submitButton.textContent?.trim()).toContain('Issue ticket');
  });

  it('POSTs to the tenant credentials/tickets endpoint on submit and reveals the code', () => {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const req = httpMock.expectOne(
      'https://ai.test/acme/v1/credentials/tickets',
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      scope: 'CredentialRegister',
      ttlMinutes: 5,
    });
    req.flush({
      rtId: '507f1f77bcf86cd799439011',
      code: 'ABCDEFGHJKLM',
      expiresAt: '2026-06-07T16:05:00Z',
      scope: 'CredentialRegister',
    });
    fixture.detectChanges();

    const code = fixture.nativeElement.querySelector(
      '.mm-ai-ticket__code',
    ) as HTMLElement;
    expect(code).toBeTruthy();
    expect(code.textContent?.trim()).toBe('ABCDEFGHJKLM');
  });

  it('surfaces a 401 response as an actionable not-authorised message', () => {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const req = httpMock.expectOne(
      'https://ai.test/acme/v1/credentials/tickets',
    );
    req.flush('forbidden', { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector(
      '.mm-ai-ticket__error',
    ) as HTMLElement;
    expect(error).toBeTruthy();
    expect(error.textContent).toContain('Not authorised');
  });
});
