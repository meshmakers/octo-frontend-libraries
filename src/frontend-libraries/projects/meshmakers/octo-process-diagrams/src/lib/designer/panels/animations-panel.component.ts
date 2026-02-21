/**
 * Animations Panel Component (Dockview Wrapper)
 *
 * Wraps the AnimationEditorComponent for use in dockview panels.
 * Provides UI for creating and editing SVG animations on primitives.
 */

import { Component, Input, computed, Signal, signal, effect, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnimationEditorComponent, AnimationChangeEvent } from '../animation-editor.component';
import { AnimationDefinition } from '../../primitives/models/animation.models';
import { TransformProperty } from '../../primitives/models/transform-property.models';

/**
 * Path primitive data for motion animations
 */
export interface PathPrimitiveData {
  id: string;
  name: string;
  pathData: string;
}

/**
 * Parameters passed from dockview to this panel
 */
export interface AnimationsPanelParams {
  primitiveId?: Signal<string>;
  animations?: Signal<AnimationDefinition[]>;
  availableProperties?: Signal<TransformProperty[]>;
  availablePaths?: Signal<PathPrimitiveData[]>;
  /** Whether the selected primitive type supports animations */
  supportsAnimations?: Signal<boolean>;
  onAnimationsChange?: (event: AnimationChangeEvent) => void;
}

@Component({
  selector: 'mm-animations-panel',
  standalone: true,
  imports: [CommonModule, AnimationEditorComponent],
  template: `
    <div class="panel-container">
      @if (primitiveId()) {
        @if (supportsAnimations()) {
          <mm-animation-editor
            [primitiveId]="primitiveId()"
            [animations]="animations()"
            [availableProperties]="availableProperties()"
            [availablePaths]="availablePaths()"
            (animationsChange)="onAnimationsChange($event)">
          </mm-animation-editor>
        } @else {
          <div class="not-supported">
            <p>Animations not supported</p>
            <p class="hint">This primitive type (image, text) does not support animations</p>
          </div>
        }
      } @else {
        <div class="no-selection">
          <p>No primitive selected</p>
          <p class="hint">Select a primitive to edit its animations</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .panel-container {
      height: 100%;
      overflow: hidden;
      background: var(--dv-pane-background-color, #1f2e40);
    }

    .no-selection,
    .not-supported {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 1rem;
      text-align: center;
      color: var(--text-secondary, #9292a6);
    }

    .no-selection p,
    .not-supported p {
      margin: 0;
    }

    .no-selection .hint,
    .not-supported .hint {
      margin-top: 0.5rem;
      font-size: 0.85rem;
      opacity: 0.7;
    }

    .not-supported {
      color: var(--text-muted, #6c757d);
    }
  `]
})
export class AnimationsPanelComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  // Use signal-based params to ensure reactivity when dockview sets params after init
  private readonly _params = signal<AnimationsPanelParams>({});

  @Input()
  set params(value: AnimationsPanelParams) {
    this._params.set(value);
  }

  readonly primitiveId = computed(() =>
    this._params().primitiveId?.() ?? ''
  );

  readonly animations = computed(() =>
    this._params().animations?.() ?? []
  );

  readonly availableProperties = computed(() =>
    this._params().availableProperties?.() ?? []
  );

  readonly availablePaths = computed(() =>
    this._params().availablePaths?.() ?? []
  );

  readonly supportsAnimations = computed(() =>
    this._params().supportsAnimations?.() ?? true
  );

  // Effect to trigger change detection when signals update
  private readonly selectionEffect = effect(() => {
    this.primitiveId();
    this.animations();
    this.availableProperties();
    this.availablePaths();
    this.supportsAnimations();
    this.cdr.markForCheck();
  });

  onAnimationsChange(event: AnimationChangeEvent): void {
    this._params().onAnimationsChange?.(event);
  }
}
