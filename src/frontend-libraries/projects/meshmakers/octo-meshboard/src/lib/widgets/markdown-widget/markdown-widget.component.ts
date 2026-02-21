import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { MarkdownWidgetConfig } from '../../models/meshboard.models';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';

@Component({
  selector: 'mm-markdown-widget',
  standalone: true,
  imports: [CommonModule, MarkdownModule, WidgetNotConfiguredComponent],
  templateUrl: './markdown-widget.component.html',
  styleUrl: './markdown-widget.component.scss'
})
export class MarkdownWidgetComponent implements DashboardWidget<MarkdownWidgetConfig, string>, OnInit, OnChanges {
  private readonly stateService = inject(MeshBoardStateService);
  private readonly variableService = inject(MeshBoardVariableService);

  @Input() config!: MarkdownWidgetConfig;

  // Widget state signals
  private readonly _isLoading = signal(false);
  private readonly _data = signal<string | null>(null);
  private readonly _error = signal<string | null>(null);

  readonly isLoading = this._isLoading.asReadonly();
  readonly data = this._data.asReadonly();
  readonly error = this._error.asReadonly();

  /**
   * Check if widget has content configured.
   * This is a method (not computed) to ensure it re-evaluates when config changes via @Input.
   */
  isNotConfigured(): boolean {
    return !this.config?.content || this.config.content.trim() === '';
  }

  /**
   * Resolved markdown content with variables interpolated.
   */
  readonly resolvedContent = computed(() => {
    const content = this.config?.content ?? '';
    if (!content || !this.config?.resolveVariables) {
      return content;
    }
    const variables = this.stateService.getVariables();
    return this.variableService.resolveVariables(content, variables);
  });

  /**
   * Style object for custom padding and alignment.
   */
  readonly containerStyle = computed(() => ({
    padding: this.config?.padding ?? '16px',
    textAlign: this.config?.textAlign ?? 'left'
  }));

  ngOnInit(): void {
    this._data.set(this.config?.content ?? '');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      this._data.set(this.config?.content ?? '');
    }
  }

  refresh(): void {
    // Markdown is static content, just re-resolve variables
    this._data.set(this.config?.content ?? '');
  }
}
