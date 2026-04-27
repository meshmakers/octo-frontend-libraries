import {Component, Input} from '@angular/core';

/**
 * Animated OctoMesh logo loader component.
 * Displays the OctoMesh octopus SVG with wiggling tentacles
 * and orbiting data blocks representing data loading.
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
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="-22 -8 112 118" class="octo-loader__svg" overflow="visible">
        <!-- Orbit track -->
        <circle class="octo-orbit" cx="34" cy="48" r="52" fill="none" stroke-width="2.5" stroke-dasharray="5 9" opacity="0.5">
          <animateTransform attributeName="transform" type="rotate"
            from="0 34 48" to="360 34 48" dur="12s" repeatCount="indefinite"/>
        </circle>

        <!-- Orbiting data blocks -->
        <g>
          <animateTransform attributeName="transform" type="rotate"
            from="0 34 48" to="360 34 48" dur="3s" repeatCount="indefinite"/>
          <rect class="octo-data" x="28" y="-9" width="12" height="8" rx="1.5" opacity="0.95"/>
        </g>
        <g>
          <animateTransform attributeName="transform" type="rotate"
            from="120 34 48" to="480 34 48" dur="3s" repeatCount="indefinite"/>
          <rect class="octo-data" x="28" y="-9" width="12" height="8" rx="1.5" opacity="0.75"/>
        </g>
        <g>
          <animateTransform attributeName="transform" type="rotate"
            from="240 34 48" to="600 34 48" dur="3s" repeatCount="indefinite"/>
          <rect class="octo-data" x="28" y="-9" width="12" height="8" rx="1.5" opacity="0.5"/>
        </g>

        <!-- Octo character -->
        <g>
          <!-- Body -->
          <polygon fill="currentColor"
            points="63.04 52.74 63.04 43.04 63.04 38.19 63.04 28.49 67.89 0 43.64 4.24 34.01 4.24 14.61 4.24 0 4.24 0 18.79 0 28.49 0 40.61 0 52.74 14.55 52.74 14.55 52.13 14.55 47.89 4.85 47.89 4.85 43.04 4.85 36.37 4.85 23.64 4.85 17.58 4.85 9.09 19.4 9.09 33.94 9.09 43.64 9.09 62.01 6.02 58.19 28.49 58.19 33.34 58.19 38.19 58.19 43.04 58.19 47.89 48.49 47.89 48.49 52.13 48.49 52.74"/>
          <!-- Eyes -->
          <rect fill="currentColor" x="18.79" y="19.4" width="4.85" height="13.94"/>
          <rect fill="currentColor" x="38.79" y="19.4" width="4.85" height="13.94"/>
          <!-- Left outer arm -->
          <g class="octo-arm octo-arm--ol">
            <polygon fill="currentColor"
              points="0 52.74 9.7 52.74 9.7 72.13 4.85 72.13 4.85 67.28 0 67.28 0 72.13 0 76.98 4.85 76.98 14.55 76.98 14.55 72.13 14.55 52.74"/>
          </g>
          <!-- Left inner leg -->
          <g class="octo-leg octo-leg--left">
            <polygon fill="currentColor"
              points="19.4 91.53 14.55 91.53 14.55 81.83 9.7 81.83 9.7 91.53 9.7 96.38 14.55 96.38 19.4 96.38 24.25 96.38 24.25 91.53 24.25 52.74 19.4 52.74 19.4 91.53"/>
          </g>
          <!-- Center leg -->
          <g class="octo-leg octo-leg--center">
            <rect fill="currentColor" x="29.1" y="52.74" width="4.85" height="33.94"/>
          </g>
          <!-- Right inner leg -->
          <g class="octo-leg octo-leg--right">
            <polygon fill="currentColor"
              points="48.49 91.53 43.64 91.53 43.64 52.74 38.79 52.74 38.79 91.53 38.79 96.38 43.64 96.38 48.49 96.38 53.34 96.38 53.34 91.53 53.34 81.83 48.49 81.83 48.49 91.53"/>
          </g>
          <!-- Right outer arm -->
          <g class="octo-arm octo-arm--or">
            <polygon fill="currentColor"
              points="48.49 52.74 48.49 72.13 48.49 76.98 58.19 76.98 63.04 76.98 63.04 67.28 58.19 67.28 58.19 72.13 53.34 72.13 53.34 52.74 63.04 52.74"/>
          </g>
        </g>

        <!-- Data flow: orbit → left arm → body → left arm → orbit -->
        <rect class="octo-data" x="-7" y="-4" width="14" height="8" rx="1.5" opacity="0">
          <animateMotion path="M -10,88 L 7,76 L 7,54 L 7,76 L -10,88" dur="3s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.3;0.8;0.9;0.8;0.3" keyTimes="0;0.25;0.5;0.75;1" dur="3s" repeatCount="indefinite"/>
        </rect>
        <rect class="octo-data" x="-7" y="-4" width="14" height="8" rx="1.5" opacity="0">
          <animateMotion path="M -10,88 L 7,76 L 7,54 L 7,76 L -10,88" dur="3s" begin="-1s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.3;0.8;0.9;0.8;0.3" keyTimes="0;0.25;0.5;0.75;1" dur="3s" begin="-1s" repeatCount="indefinite"/>
        </rect>
        <rect class="octo-data" x="-7" y="-4" width="14" height="8" rx="1.5" opacity="0">
          <animateMotion path="M -10,88 L 7,76 L 7,54 L 7,76 L -10,88" dur="3s" begin="-2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.3;0.8;0.9;0.8;0.3" keyTimes="0;0.25;0.5;0.75;1" dur="3s" begin="-2s" repeatCount="indefinite"/>
        </rect>

        <!-- Data flow: orbit → right arm → body → right arm → orbit -->
        <rect class="octo-data" x="-7" y="-4" width="14" height="8" rx="1.5" opacity="0">
          <animateMotion path="M 73,88 L 56,76 L 56,54 L 56,76 L 73,88" dur="3s" begin="-0.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.3;0.8;0.9;0.8;0.3" keyTimes="0;0.25;0.5;0.75;1" dur="3s" begin="-0.5s" repeatCount="indefinite"/>
        </rect>
        <rect class="octo-data" x="-7" y="-4" width="14" height="8" rx="1.5" opacity="0">
          <animateMotion path="M 73,88 L 56,76 L 56,54 L 56,76 L 73,88" dur="3s" begin="-1.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.3;0.8;0.9;0.8;0.3" keyTimes="0;0.25;0.5;0.75;1" dur="3s" begin="-1.5s" repeatCount="indefinite"/>
        </rect>
        <rect class="octo-data" x="-7" y="-4" width="14" height="8" rx="1.5" opacity="0">
          <animateMotion path="M 73,88 L 56,76 L 56,54 L 56,76 L 73,88" dur="3s" begin="-2.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.3;0.8;0.9;0.8;0.3" keyTimes="0;0.25;0.5;0.75;1" dur="3s" begin="-2.5s" repeatCount="indefinite"/>
        </rect>
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
    }

    .octo-loader--small .octo-loader__svg {
      width: 24px;
      height: 24px;
    }

    .octo-loader--medium .octo-loader__svg {
      width: 48px;
      height: 48px;
    }

    /* Outer arms wiggle */
    .octo-arm--ol {
      transform-origin: 7px 52.74px;
      animation: octo-wiggle-outer 1.2s ease-in-out infinite;
    }

    .octo-arm--or {
      transform-origin: 56px 52.74px;
      animation: octo-wiggle-outer 1.2s ease-in-out infinite;
      animation-delay: -0.6s;
    }

    /* Inner legs wiggle */
    .octo-leg--left {
      transform-origin: 21.8px 52.74px;
      animation: octo-wiggle-inner 1s ease-in-out infinite;
    }

    .octo-leg--center {
      transform-origin: 31.5px 52.74px;
      animation: octo-wiggle-inner 1s ease-in-out infinite reverse;
      animation-delay: -0.33s;
    }

    .octo-leg--right {
      transform-origin: 46px 52.74px;
      animation: octo-wiggle-inner 1s ease-in-out infinite;
      animation-delay: -0.66s;
    }

    @keyframes octo-wiggle-inner {
      0%, 100% { transform: rotate(-5deg); }
      50% { transform: rotate(5deg); }
    }

    @keyframes octo-wiggle-outer {
      0%, 100% { transform: rotate(-4deg); }
      50% { transform: rotate(4deg); }
    }

    .octo-orbit {
      stroke: var(--theme-secondary);
    }

    .octo-data {
      fill: var(--theme-secondary);
    }
  `]
})
export class OctoLoaderComponent {
  @Input() size: 'small' | 'medium' = 'medium';
}
