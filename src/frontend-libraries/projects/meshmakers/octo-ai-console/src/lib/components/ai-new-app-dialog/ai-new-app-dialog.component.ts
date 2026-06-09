import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiAppTemplateDto, AiNewAppSubmission } from '../../models/ai-app-template';

/**
 * "New App from Template" wizard (#4145). Presentation-only — the host fetches
 * the template catalogue via {@link AiAdapterClientService.getAppTemplates},
 * feeds it into the `templates` input, and listens for `submit` / `cancel` to
 * call `createSession`.
 *
 * The component is intentionally framework-agnostic (no Kendo, no CDK overlay)
 * so consumers can wrap it in whatever modal shell they already have — same
 * convention as `AiApprovalModalComponent`.
 *
 * The interpolation engine is *deliberately* dumb: a regex substitution over
 * `{{placeholder}}` tokens. The wizard only collects two inputs (project name +
 * primary entity), and a full Handlebars dependency for two tokens would be
 * overkill. If a future template needs richer rendering, switch this to
 * `handlebars.precompile`-at-build-time and re-evaluate.
 */
@Component({
  selector: 'mm-ai-new-app-dialog',
  imports: [FormsModule],
  templateUrl: './ai-new-app-dialog.component.html',
  styleUrl: './ai-new-app-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiNewAppDialogComponent {
  /** Available templates from the adapter — typically 3 in Phase 1. */
  readonly templates = input.required<readonly AiAppTemplateDto[]>();

  /** Tenant name shown in the dialog header so the operator confirms the scope. */
  readonly tenantName = input<string>('');

  /**
   * Emitted on Submit with the fully interpolated Goal + the picked template id.
   * Named `confirmed` (not `submit`) because Angular flags native-event collisions
   * — `submit` is a DOM event and triggers `@angular-eslint/no-output-native`.
   */
  readonly confirmed = output<AiNewAppSubmission>();

  /**
   * Emitted on Cancel / dismiss. The host hides the wizard on this signal.
   * Named `cancelled` for the same reason `confirmed` is not `submit`.
   */
  readonly cancelled = output<void>();

  /** rtId-style id of the picked template, or empty until the operator picks one. */
  protected readonly selectedTemplateId = signal('');
  protected readonly projectName = signal('');
  protected readonly primaryEntity = signal('');

  protected readonly selectedTemplate = computed<AiAppTemplateDto | null>(() => {
    const id = this.selectedTemplateId();
    return this.templates().find((t) => t.id === id) ?? null;
  });

  /**
   * Rendered Goal string the operator sees in the preview block. Stays empty
   * until a template is picked AND every required placeholder has a value, so
   * the operator never sees a half-interpolated string.
   */
  protected readonly renderedGoal = computed(() => {
    const template = this.selectedTemplate();
    if (!template) {
      return '';
    }
    if (!this.allRequiredFilled()) {
      return '';
    }
    return this.interpolate(template.goalTemplate);
  });

  /** True when every placeholder the picked template declares has a non-empty value. */
  protected readonly allRequiredFilled = computed(() => {
    const template = this.selectedTemplate();
    if (!template) {
      return false;
    }
    return template.requiredPlaceholders.every((key) => {
      const value = this.valueFor(key);
      return value !== null && value.trim().length > 0;
    });
  });

  protected onSubmit(): void {
    const template = this.selectedTemplate();
    if (!template || !this.allRequiredFilled()) {
      return;
    }
    this.confirmed.emit({
      templateId: template.id,
      jobKind: template.jobKind,
      projectName: this.projectName().trim(),
      primaryEntity: this.primaryEntity().trim(),
      goal: this.interpolate(template.goalTemplate),
    });
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }

  /** Read the signal that backs the named placeholder, or `null` if unknown. */
  private valueFor(placeholder: string): string | null {
    switch (placeholder) {
      case 'projectName':
        return this.projectName();
      case 'primaryEntity':
        return this.primaryEntity();
      default:
        return null;
    }
  }

  private interpolate(template: string): string {
    return template.replace(/{{\s*(\w+)\s*}}/g, (full, key) => {
      const value = this.valueFor(key);
      // Unknown placeholders survive verbatim so a typo in the catalogue
      // surfaces in the preview rather than silently disappearing.
      return value !== null ? value.trim() : full;
    });
  }
}
