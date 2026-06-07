import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiAdapterClientService } from '../../services/ai-adapter-client.service';
import {
  AiCredentialTicketScope,
  IssueAiCredentialTicketResponseDto,
} from '../../models/ai-credential-ticket';

/**
 * Self-service credential-ticket issuer (#4133, concept §10). Admin picks a
 * scope + TTL, hits **Issue ticket**, copies the displayed code, hands it to
 * a developer / operator out-of-band. The plaintext code is shown exactly
 * once — refreshing the panel after issue clears it so a careless screenshot
 * doesn't leak.
 *
 * Theme-neutral by design: visuals use CSS custom properties with neutral
 * defaults so the host (Refinery Studio LCARS, demo-app, etc.) can override
 * them via `--mm-ai-ticket-*` variables without touching the component.
 */
@Component({
  selector: 'mm-ai-credential-ticket-issue',
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-credential-ticket-issue.component.html',
  styleUrl: './ai-credential-ticket-issue.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiCredentialTicketIssueComponent {
  private readonly client = inject(AiAdapterClientService);

  protected readonly scope = signal<AiCredentialTicketScope>(
    'CredentialRegister',
  );
  protected readonly ttlMinutes = signal<number>(5);

  protected readonly issuing = signal<boolean>(false);
  protected readonly issued = signal<IssueAiCredentialTicketResponseDto | null>(
    null,
  );
  protected readonly error = signal<string | null>(null);
  protected readonly copied = signal<boolean>(false);

  /** Available scope choices — kept in sync with `AiCredentialTicketScope`. */
  protected readonly scopes: readonly {
    value: AiCredentialTicketScope;
    label: string;
    hint: string;
  }[] = [
    {
      value: 'CredentialRegister',
      label: 'Subscription token',
      hint: 'For the bastion CLI to register an Anthropic OAuth pair on this tenant.',
    },
    {
      value: 'DevSshKeyRegister',
      label: 'Developer SSH key',
      hint: 'For a developer to register their own SSH public key on this tenant.',
    },
  ];

  protected onIssue(): void {
    if (this.issuing()) {
      return;
    }
    const ttl = this.normalizedTtl();
    this.issuing.set(true);
    this.error.set(null);
    this.copied.set(false);
    this.issued.set(null);

    this.client
      .issueCredentialTicket({
        scope: this.scope(),
        ttlMinutes: ttl,
      })
      .subscribe({
        next: (response) => {
          this.issued.set(response);
          this.issuing.set(false);
        },
        error: (err: unknown) => {
          this.error.set(this.formatError(err));
          this.issuing.set(false);
        },
      });
  }

  protected onCopy(): void {
    const code = this.issued()?.code;
    if (!code) {
      return;
    }
    // navigator.clipboard requires a secure context; if it's unavailable the
    // operator can still select + copy by hand. Falling back silently keeps
    // the panel usable on http://localhost dev origins.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(
        () => this.copied.set(true),
        () => this.copied.set(false),
      );
    }
  }

  protected onClear(): void {
    this.issued.set(null);
    this.copied.set(false);
  }

  private normalizedTtl(): number {
    const v = Math.trunc(this.ttlMinutes());
    // Server clamps to 60 anyway; clamp here too so the slider can't push a
    // value the request would silently truncate.
    if (Number.isNaN(v) || v < 1) {
      return 1;
    }
    if (v > 60) {
      return 60;
    }
    return v;
  }

  private formatError(err: unknown): string {
    if (
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      typeof (err as { status: number }).status === 'number'
    ) {
      const status = (err as { status: number }).status;
      if (status === 401 || status === 403) {
        return 'Not authorised — only tenant admins can issue tickets.';
      }
      if (status === 400) {
        return 'Invalid request — check the scope value.';
      }
      return `Server returned HTTP ${status}.`;
    }
    return 'Failed to reach the AI Adapter — check the network.';
  }
}
