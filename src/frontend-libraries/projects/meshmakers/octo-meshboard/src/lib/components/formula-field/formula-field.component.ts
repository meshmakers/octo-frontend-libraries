import { ChangeDetectionStrategy, Component, computed, Directive, inject, input, model, OnChanges } from '@angular/core';
import { AbstractControl, FormsModule, NG_VALIDATORS, ValidationErrors, Validator } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { ExpressionEvaluatorService } from '@meshmakers/octo-process-diagrams';
import { MeshBoardVariable } from '../../models/meshboard.models';
import {
  evaluateFormula,
  FormulaEvaluationResult,
  formulaPreviewText,
  FormulaValidationResult,
  requireNumericFormulaResult,
  validateFormulaField
} from '../../utils/meshboard-formula';

let nextFormulaFieldId = 0;

/**
 * Puts the formula validation onto the textbox's `ngModel`, so Kendo marks the input invalid
 * (`aria-invalid`, `k-invalid`) once it was touched. Kendo derives `aria-invalid` from the
 * control state and ignores it in `inputAttributes`.
 */
@Directive({
  selector: '[mmFormulaValidity]',
  standalone: true,
  providers: [{ provide: NG_VALIDATORS, useExisting: FormulaValidityDirective, multi: true }]
})
export class FormulaValidityDirective implements Validator, OnChanges {
  readonly mmFormulaValidity = input<FormulaValidationResult | null>(null);
  private onValidatorChange?: () => void;

  validate(_control: AbstractControl): ValidationErrors | null {
    const result = this.mmFormulaValidity();
    return result && !result.valid ? { formula: result.error ?? 'Invalid formula' } : null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  ngOnChanges(): void {
    this.onValidatorChange?.();
  }
}

/**
 * Formula field shared by the widget config dialogs (KPI, gauge; AB#7950): the formula input,
 * the syntax hint, the validation message, the live preview and the list of insertable variables.
 *
 * Validation is `validateFormulaField` of `utils/meshboard-formula.ts` — the dialogs call the same
 * function to decide whether Save is enabled, so there is exactly one validation rule.
 *
 * Usage:
 * ```html
 * <mm-meshboard-formula-field
 *   [(formula)]="form.formula"
 *   [variables]="formulaVariables"
 *   [declaredNames]="declaredVariableNames">
 * </mm-meshboard-formula-field>
 * ```
 */
@Component({
  selector: 'mm-meshboard-formula-field',
  standalone: true,
  imports: [FormsModule, ButtonsModule, InputsModule, FormulaValidityDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="form-field">
      <label [attr.for]="inputId">{{ label() }} <span class="required" aria-hidden="true">*</span></label>
      <kendo-textbox
        [ngModel]="formula()"
        (ngModelChange)="formula.set($event ?? '')"
        [mmFormulaValidity]="validation()"
        [placeholder]="placeholder()"
        [focusableId]="inputId"
        [inputAttributes]="inputAttributes()">
      </kendo-textbox>
      <p class="field-hint" [id]="hintId">
        Reference variables with <code>{{ variableSyntaxHint }}</code>. Supported: <code>+ - * / % ^</code>, parentheses,
        <code>min</code>, <code>max</code>, <code>abs</code>, <code>round</code>, <code>clamp</code>, <code>? :</code>.
        Numbers use a dot as decimal separator.
        @if (clampHint()) {
          Keep the value on the scale with <code>{{ clampExample }}</code>.
        }
      </p>
      @if (formula().trim() && validation().error) {
        <p class="field-error" [id]="messageId" role="alert">{{ validation().error }}</p>
      } @else if (formula().trim()) {
        <p class="field-hint" [id]="messageId" aria-live="polite">Preview: <strong>{{ preview() }}</strong></p>
      }
    </div>
    <div class="form-field">
      <span class="field-label" [id]="variablesLabelId">Available Variables</span>
      @if (variables().length > 0) {
        <div class="variable-list" role="group" [attr.aria-labelledby]="variablesLabelId">
          @for (variable of variables(); track variable.name) {
            <button kendoButton fillMode="flat" size="small" type="button"
                    [title]="'Insert ' + variable.name + ' (current value: ' + (variable.value || '-') + ')'"
                    (click)="insertVariable(variable.name)">
              {{ variable.name }}@if (variable.source === 'widget') { <span class="variable-source">(widget)</span> }
            </button>
          }
        </div>
      } @else {
        <p class="field-hint">No variables defined. Add variables in the MeshBoard settings or publish a widget value as output variable.</p>
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-field label,
    .field-label {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--kendo-color-on-app-surface);
    }

    .required,
    .field-error {
      color: var(--kendo-color-error);
    }

    .field-hint,
    .field-error {
      margin: 0;
      font-size: 0.8rem;
    }

    .field-hint,
    .variable-source {
      color: var(--kendo-color-subtle);
    }

    .variable-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  `]
})
export class FormulaFieldComponent {
  private readonly evaluator = inject(ExpressionEvaluatorService);

  /** The formula text (two-way: `[(formula)]`) */
  readonly formula = model('');
  /** Variables the formula can reference; their current values drive the preview */
  readonly variables = input<readonly MeshBoardVariable[]>([]);
  /** Names that exist by configuration but carry no value yet (count as known, preview pending) */
  readonly declaredNames = input<readonly string[]>([]);
  /** The result must be a number (gauge): a string/boolean preview shows "Result is not a number" */
  readonly numericOnly = input(false);
  /** Show the clamp pattern in the hint (widgets with a scale) */
  readonly clampHint = input(false);
  readonly label = input('Formula');
  readonly placeholder = input('e.g., (${a} - ${b}) / 1000');

  readonly variableSyntaxHint = '${variableName}';
  readonly clampExample = 'max(0, min(100, …))';

  private readonly id = nextFormulaFieldId++;
  readonly inputId = `mm-formula-field-${this.id}`;
  readonly hintId = `${this.inputId}-hint`;
  readonly messageId = `${this.inputId}-message`;
  readonly variablesLabelId = `${this.inputId}-variables`;

  /** Validation of the current formula (the same rule the dialogs use for Save) */
  readonly validation = computed<FormulaValidationResult>(() =>
    validateFormulaField(this.formula(), this.variables(), this.declaredNames(), this.evaluator));

  /** Evaluation of the current formula over the current variable values */
  readonly evaluation = computed<FormulaEvaluationResult>(() => {
    const result = evaluateFormula(this.formula(), this.variables(), this.evaluator);
    return this.numericOnly() ? requireNumericFormulaResult(result) : result;
  });

  readonly preview = computed(() => formulaPreviewText(this.evaluation()));

  readonly inputAttributes = computed<Record<string, string>>(() => {
    const describedBy = this.formula().trim() ? `${this.hintId} ${this.messageId}` : this.hintId;
    return {
      'aria-required': 'true',
      'aria-describedby': describedBy
    };
  });

  /** Appends a `${name}` reference to the formula */
  insertVariable(name: string): void {
    const formula = this.formula();
    const separator = formula && !formula.endsWith(' ') ? ' ' : '';
    this.formula.set(`${formula}${separator}\${${name}}`);
  }
}
