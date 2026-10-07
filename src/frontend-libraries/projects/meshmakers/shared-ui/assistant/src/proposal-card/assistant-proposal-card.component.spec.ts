import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssistantProposal } from '../assistant.models';
import { AssistantProposalCardComponent } from './assistant-proposal-card.component';

const PROPOSAL: AssistantProposal = {
  id: 'p1', title: 'Update finapi-adapter to r1.0.11 and redeploy', toolName: 'deploy_adapter', writes: true,
  description: 'Recorded in the audit log', parameters: [{ name: 'adapter', value: 'finapi-adapter' }, { name: 'version', value: 'r1.0.11' }]
};

describe('AssistantProposalCardComponent', () => {
  let fixture: ComponentFixture<AssistantProposalCardComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(AssistantProposalCardComponent);
    fixture.componentRef.setInput('proposal', PROPOSAL);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  const buttons = (): HTMLButtonElement[] => Array.from(element.querySelectorAll('button'));

  it('renders title, write marker, parameter table and tool', () => {
    expect(element.querySelector('.proposal-head')?.textContent).toContain('writes to the tenant');
    expect(element.querySelector('.proposal-title')?.textContent).toContain('r1.0.11');
    expect(Array.from(element.querySelectorAll('dt')).map(dt => dt.textContent)).toEqual(['adapter', 'version']);
    expect(element.querySelector('.proposal-meta')?.textContent).toContain('deploy_adapter');
    expect(buttons().map(b => b.textContent?.trim())).toEqual(['Run', 'Edit', 'Discard']);
  });

  it('only emits Run / Edit / Discard', () => {
    const emitted: string[] = [];
    fixture.componentInstance.run.subscribe(p => emitted.push(`run:${p.id}`));
    fixture.componentInstance.edit.subscribe(p => emitted.push(`edit:${p.id}`));
    fixture.componentInstance.discard.subscribe(p => emitted.push(`discard:${p.id}`));
    buttons().forEach(button => button.click());
    expect(emitted).toEqual(['run:p1', 'edit:p1', 'discard:p1']);
  });

  it('replaces the buttons with the decision once settled', () => {
    fixture.componentRef.setInput('decision', 'discard');
    fixture.detectChanges();
    expect(buttons()).toEqual([]);
    expect(element.querySelector('[role="status"]')?.textContent).toBe('Discarded');
  });
});
