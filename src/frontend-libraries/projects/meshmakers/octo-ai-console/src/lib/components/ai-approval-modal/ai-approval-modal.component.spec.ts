import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiApprovalModalComponent } from './ai-approval-modal.component';
import {
  AiApprovalDecisionDto,
  AiApprovalRequestedDto,
} from '../../models/ai-approval';

describe('AiApprovalModalComponent', () => {
  let fixture: ComponentFixture<AiApprovalModalComponent>;

  const request: AiApprovalRequestedDto = {
    requestId: 'req-1',
    sessionId: 'sess-1',
    toolName: 'delete_entity',
    payload: '{"foo":"bar"}',
    reason: 'HighRiskTool',
    at: '2026-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiApprovalModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AiApprovalModalComponent);
    fixture.componentRef.setInput('request', request);
    fixture.detectChanges();
  });

  it('pretty-prints the payload as JSON', () => {
    const pre = fixture.nativeElement.querySelector('.mm-ai-approval__code');
    expect(pre.textContent.trim()).toBe('{\n  "foo": "bar"\n}');
  });

  it('emits Approved on the Approve button click', (done) => {
    fixture.componentInstance.decide.subscribe((decision: AiApprovalDecisionDto) => {
      expect(decision.outcome).toBe('Approved');
      done();
    });

    const buttons = fixture.nativeElement.querySelectorAll(
      '.mm-ai-approval__btn',
    );
    // [0] reject, [1] approve in the template order.
    buttons[1].click();
  });

  it('emits Rejected on the Reject button click', (done) => {
    fixture.componentInstance.decide.subscribe((decision: AiApprovalDecisionDto) => {
      expect(decision.outcome).toBe('Rejected');
      done();
    });

    const buttons = fixture.nativeElement.querySelectorAll(
      '.mm-ai-approval__btn',
    );
    buttons[0].click();
  });
});
