import {Component, Input} from '@angular/core';

/**
 * Animated OctoMesh logo loader component.
 * Displays the OctoMesh octopus SVG with a tentacle wave animation,
 * gentle bob, and pulsing glow effect.
 *
 * Uses `--kendo-color-primary` for theme-independent coloring.
 * Override the color via CSS `color` property on the host element.
 *
 * @example
 * ```html
 * <mm-octo-loader [size]="'medium'"></mm-octo-loader>
 * <mm-octo-loader [size]="'small'"></mm-octo-loader>
 * ```
 */
@Component({
  selector: 'mm-octo-loader',
  standalone: true,
  template: `
    <div class="octo-loader" [class.octo-loader--small]="size === 'small'" [class.octo-loader--medium]="size === 'medium'">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 97" class="octo-loader__svg" overflow="visible">
        <!-- Body + head + outer arms -->
        <polygon fill="currentColor"
          points="58.19 72.13 53.34 72.13 53.34 52.74 63.04 52.74 63.04 43.04 63.04 38.19 63.04 28.49 67.89 0 43.64 4.24 34.01 4.24 14.61 4.24 0 4.24 0 18.79 0 28.49 0 40.61 0 52.74 9.7 52.74 9.7 72.13 4.85 72.13 4.85 67.28 0 67.28 0 72.13 0 76.98 4.85 76.98 14.55 76.98 14.55 72.13 14.55 52.74 14.55 52.13 14.55 47.89 4.85 47.89 4.85 43.04 4.85 36.37 4.85 23.64 4.85 17.58 4.85 9.09 19.4 9.09 33.94 9.09 43.64 9.09 62.01 6.02 58.19 28.49 58.19 33.34 58.19 38.19 58.19 43.04 58.19 47.89 48.49 47.89 48.49 52.13 48.49 52.74 48.49 72.13 48.49 76.98 58.19 76.98 63.04 76.98 63.04 76.98 63.04 67.28 58.19 67.28 58.19 72.13"/>
        <!-- Eyes -->
        <rect fill="currentColor" x="18.79" y="19.4" width="4.85" height="13.94"/>
        <rect fill="currentColor" x="38.79" y="19.4" width="4.85" height="13.94"/>
        <!-- Left tentacle pair -->
        <polygon class="octo-leg octo-leg--left" fill="currentColor"
          points="19.4 91.53 14.55 91.53 14.55 81.83 9.7 81.83 9.7 91.53 9.7 96.38 14.55 96.38 19.4 96.38 24.25 96.38 24.25 91.53 24.25 52.74 19.4 52.74 19.4 91.53"/>
        <!-- Center tentacle -->
        <rect class="octo-leg octo-leg--center" fill="currentColor"
          x="29.1" y="52.74" width="4.85" height="33.94"/>
        <!-- Right tentacle pair -->
        <polygon class="octo-leg octo-leg--right" fill="currentColor"
          points="48.49 91.53 43.64 91.53 43.64 52.74 38.79 52.74 38.79 91.53 38.79 96.38 43.64 96.38 48.49 96.38 53.34 96.38 53.34 91.53 53.34 81.83 48.49 81.83 48.49 91.53"/>
      </svg>
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--kendo-color-primary, #64ceb9);
    }

    .octo-loader {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      animation: octo-spin 6s ease-in-out infinite;
    }

    .octo-loader--small .octo-loader__svg {
      width: 24px;
      height: 24px;
    }

    .octo-loader--medium .octo-loader__svg {
      width: 48px;
      height: 48px;
    }

    .octo-loader__svg {
      animation: octo-glow 6s ease-in-out infinite;
    }

    .octo-leg {
      transform-box: fill-box;
      transform-origin: 50% 0%;
    }

    .octo-leg--left {
      animation: octo-wiggle-left 6s ease-in-out infinite;
    }

    .octo-leg--center {
      animation: octo-wiggle-center 6s ease-in-out infinite;
    }

    .octo-leg--right {
      animation: octo-wiggle-right 6s ease-in-out infinite;
    }

    /* Spin in (0-30%), spin out (30-55%), wiggle feet (55-75%), idle (75-100%) */

    @keyframes octo-spin {
      0% { transform: rotate(0deg) scale(1); }
      5% { transform: rotate(0deg) scale(1); }
      15% { transform: rotate(360deg) scale(0.85); }
      20% { transform: rotate(360deg) scale(1); }
      25% { transform: rotate(360deg) scale(1); }
      40% { transform: rotate(0deg) scale(0.85); }
      45% { transform: rotate(0deg) scale(1); }
      100% { transform: rotate(0deg) scale(1); }
    }

    @keyframes octo-glow {
      0%, 5% { filter: drop-shadow(0 0 2px currentColor); }
      15% { filter: drop-shadow(0 0 14px currentColor); }
      20%, 25% { filter: drop-shadow(0 0 6px currentColor); }
      40% { filter: drop-shadow(0 0 14px currentColor); }
      50%, 100% { filter: drop-shadow(0 0 2px currentColor); }
    }

    /* Legs stay still during spin (0-45%), then wiggle rapidly (50-75%), then idle */

    @keyframes octo-wiggle-left {
      0%, 47% { transform: rotate(0deg); }
      50% { transform: rotate(12deg); }
      53% { transform: rotate(-10deg); }
      56% { transform: rotate(10deg); }
      59% { transform: rotate(-8deg); }
      62% { transform: rotate(6deg); }
      65% { transform: rotate(-3deg); }
      68% { transform: rotate(0deg); }
      100% { transform: rotate(0deg); }
    }

    @keyframes octo-wiggle-center {
      0%, 48% { transform: rotate(0deg); }
      51% { transform: rotate(-10deg); }
      54% { transform: rotate(9deg); }
      57% { transform: rotate(-8deg); }
      60% { transform: rotate(7deg); }
      63% { transform: rotate(-4deg); }
      66% { transform: rotate(2deg); }
      69% { transform: rotate(0deg); }
      100% { transform: rotate(0deg); }
    }

    @keyframes octo-wiggle-right {
      0%, 49% { transform: rotate(0deg); }
      52% { transform: rotate(-12deg); }
      55% { transform: rotate(10deg); }
      58% { transform: rotate(-10deg); }
      61% { transform: rotate(8deg); }
      64% { transform: rotate(-6deg); }
      67% { transform: rotate(3deg); }
      70% { transform: rotate(0deg); }
      100% { transform: rotate(0deg); }
    }
  `]
})
export class OctoLoaderComponent {
  @Input() size: 'small' | 'medium' = 'medium';
}
