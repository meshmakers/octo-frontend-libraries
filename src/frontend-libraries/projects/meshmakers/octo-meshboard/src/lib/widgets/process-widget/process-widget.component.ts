import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
  computed,
  ElementRef,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DashboardWidget } from '../widget.interface';
import { ProcessWidgetConfig } from './process-widget-config.model';
import { ProcessDataService, BoundDataResult } from './services/process-data.service';
import type {
  ProcessDiagramConfig,
  ProcessDiagramRuntimeState,
  ProcessElement,
  ProcessConnection,
  ElementRuntimeData,
  TankElementConfig,
  SiloElementConfig,
  VesselElementConfig,
  ValveElementConfig,
  PumpElementConfig,
  MotorElementConfig,
  LabelElementConfig,
  ImageElementConfig,
  ShapeElementConfig,
  CustomSvgElementConfig,
  StatusLightElementConfig,
  DigitalDisplayElementConfig,
  ProcessGaugeElementConfig,
  PrimitiveBase,
  SymbolInstance,
  SymbolDefinition,
  PropertyBinding,
  TransformProperty,
  StyleClass,
  PrimitiveStyle,
  AttributeAnimation
} from '@meshmakers/octo-process-diagrams';
import {
  SymbolLibraryService,
  ExpressionEvaluatorService,
  renderAnimations,
  AnimationRenderContext,
  renderFlowParticles,
  getFlowParticlesAnimation
} from '@meshmakers/octo-process-diagrams';
import { DiagramPropertyMapping } from './process-widget-config.model';
import { RuntimeEntityData } from '../../models/meshboard.models';
import { QueryResultData } from './services/process-data.service';

/**
 * Process Widget Component
 *
 * Renders industrial process visualizations (HMI-style diagrams) with:
 * - SVG-based rendering for scalability
 * - Real-time data binding to OctoMesh entities
 * - Flow animations on connections
 * - Threshold-based color changes
 * - Support for custom SVG elements
 *
 * Phase 1 Implementation:
 * - Basic element rendering (Tank, Valve, Pump, Label, CustomSvg)
 * - Static data loading (one-time fetch)
 * - Simple flow animations
 *
 * Future phases will add:
 * - Real-time updates via GraphQL subscriptions
 * - Interactive elements
 * - Process Designer integration
 *
 * @example
 * ```html
 * <mm-process-widget [config]="widgetConfig"></mm-process-widget>
 * ```
 */
@Component({
  selector: 'mm-process-widget',
  standalone: true,
  imports: [CommonModule],
  providers: [ProcessDataService, ExpressionEvaluatorService],
  template: `
    <div class="process-widget"
         [class.loading]="isLoading()"
         [class.error]="error()"
         #containerRef>
      @if (isLoading()) {
        <div class="loading-overlay">
          <div class="loading-spinner"></div>
          <span>Loading process diagram...</span>
        </div>
      } @else if (error()) {
        <div class="error-container">
          <span class="error-icon">⚠</span>
          <span class="error-message">{{ error() }}</span>
        </div>
      } @else if (diagramConfig()) {
        <div class="diagram-container"
             [style.width.px]="diagramConfig()!.canvas.width"
             [style.height.px]="diagramConfig()!.canvas.height"
             [class.fit-to-bounds]="config.fitToBounds !== false">
          <svg
            [attr.viewBox]="viewBox()"
            [attr.width]="svgWidth()"
            [attr.height]="svgHeight()"
            preserveAspectRatio="xMidYMid meet"
            class="process-svg">

            <!-- Definitions (gradients, patterns, filters) -->
            <defs>
              <!-- Tank gradient -->
              <linearGradient id="tankGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#e0e0e0;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#f5f5f5;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#e0e0e0;stop-opacity:1" />
              </linearGradient>

              <!-- Liquid gradient -->
              <linearGradient id="liquidGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#1976d2;stop-opacity:0.9" />
                <stop offset="50%" style="stop-color:#42a5f5;stop-opacity:0.9" />
                <stop offset="100%" style="stop-color:#1976d2;stop-opacity:0.9" />
              </linearGradient>

              <!-- Flow animation pattern -->
              <pattern id="flowPattern" x="0" y="0" width="20" height="10" patternUnits="userSpaceOnUse">
                <circle cx="5" cy="5" r="3" fill="#42a5f5">
                  <animate attributeName="cx" from="-5" to="25" dur="1s" repeatCount="indefinite"/>
                </circle>
              </pattern>

              <!-- Glow filter for status lights -->
              <filter id="glowFilter" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <!-- Background - uses CSS class for theming support -->
            <rect
              class="canvas-background"
              x="0" y="0"
              [attr.width]="diagramConfig()!.canvas.width"
              [attr.height]="diagramConfig()!.canvas.height"/>

            <!-- Connections (rendered first, below elements) -->
            @for (connection of diagramConfig()!.connections; track connection.id) {
              <g class="connection" [attr.data-id]="connection.id">
                @if (getConnectionPath(connection); as pathData) {
                  <!-- Connection line -->
                  <path
                    [attr.d]="pathData"
                    [attr.stroke]="connection.style.strokeColor"
                    [attr.stroke-width]="connection.style.strokeWidth"
                    [attr.stroke-dasharray]="connection.style.strokeDash?.join(',') ?? 'none'"
                    [attr.stroke-linecap]="connection.style.lineCap ?? 'round'"
                    fill="none"
                    class="connection-line"/>

                  <!-- Flow animation overlay -->
                  @if (connection.animation?.enabled && isConnectionFlowActive(connection)) {
                    <path
                      [attr.d]="pathData"
                      stroke="url(#flowPattern)"
                      [attr.stroke-width]="connection.style.strokeWidth + 2"
                      fill="none"
                      class="connection-flow"
                      [style.animation-duration]="getFlowAnimationDuration(connection)"/>
                  }
                }
              </g>
            }

            <!-- Elements -->
            @for (element of diagramConfig()!.elements; track element.id) {
              <g class="element"
                 [attr.data-id]="element.id"
                 [attr.data-type]="element.type"
                 [attr.transform]="getElementTransform(element)"
                 [class.interactive]="element.interactive">

                @switch (element.type) {
                  @case ('tank') {
                    <g class="tank-element">
                      @if (asTank(element); as tank) {
                        <!-- Tank body -->
                        <rect
                          x="0" y="0"
                          [attr.width]="tank.size.width"
                          [attr.height]="tank.size.height"
                          [attr.rx]="tank.config.shape === 'cylindrical' ? 10 : 0"
                          fill="url(#tankGradient)"
                          [attr.stroke]="tank.style?.strokeColor ?? '#666'"
                          [attr.stroke-width]="tank.style?.strokeWidth ?? 2"/>

                        <!-- Fill level -->
                        @if (tank.config.showLevel) {
                          <rect
                            x="2"
                            [attr.y]="getTankFillY(tank)"
                            [attr.width]="tank.size.width - 4"
                            [attr.height]="getTankFillHeight(tank)"
                            [attr.rx]="tank.config.shape === 'cylindrical' ? 8 : 0"
                            [attr.fill]="getElementColor(tank)"
                            class="tank-fill"/>
                        }

                        <!-- Percentage label -->
                        @if (tank.config.showPercentage) {
                          <text
                            [attr.x]="tank.size.width / 2"
                            [attr.y]="tank.size.height / 2"
                            text-anchor="middle"
                            dominant-baseline="middle"
                            class="tank-label"
                            fill="#333"
                            font-size="14"
                            font-weight="bold">
                            {{ getElementDisplayValue(tank) }}
                          </text>
                        }
                      }
                    </g>
                  }

                  @case ('valve') {
                    <g class="valve-element">
                      @if (asValve(element); as valve) {
                        <!-- Valve body (bowtie shape) -->
                        <polygon
                          [attr.points]="getValvePoints(valve)"
                          [attr.fill]="getElementColor(valve)"
                          [attr.stroke]="valve.style?.strokeColor ?? '#333'"
                          [attr.stroke-width]="valve.style?.strokeWidth ?? 2"/>

                        <!-- Valve state label -->
                        @if (valve.config.showState) {
                          <text
                            [attr.x]="valve.size.width / 2"
                            [attr.y]="valve.size.height + 15"
                            text-anchor="middle"
                            class="valve-label"
                            fill="#333"
                            font-size="10">
                            {{ getElementDisplayValue(valve) }}
                          </text>
                        }
                      }
                    </g>
                  }

                  @case ('pump') {
                    <g class="pump-element">
                      @if (asPump(element); as pump) {
                        <!-- Pump circle -->
                        <circle
                          [attr.cx]="pump.size.width / 2"
                          [attr.cy]="pump.size.height / 2"
                          [attr.r]="Math.min(pump.size.width, pump.size.height) / 2 - 2"
                          [attr.fill]="getElementColor(pump)"
                          [attr.stroke]="pump.style?.strokeColor ?? '#333'"
                          [attr.stroke-width]="pump.style?.strokeWidth ?? 2"/>

                        <!-- Pump impeller (rotating) -->
                        <g [attr.transform]="'translate(' + pump.size.width/2 + ',' + pump.size.height/2 + ')'"
                           [class.rotating]="isPumpRunning(pump)">
                          <line x1="-15" y1="0" x2="15" y2="0" stroke="#333" stroke-width="3"/>
                          <line x1="0" y1="-15" x2="0" y2="15" stroke="#333" stroke-width="3"/>
                          <line x1="-10" y1="-10" x2="10" y2="10" stroke="#333" stroke-width="2"/>
                          <line x1="10" y1="-10" x2="-10" y2="10" stroke="#333" stroke-width="2"/>
                        </g>

                        <!-- State label -->
                        @if (pump.config.showState) {
                          <text
                            [attr.x]="pump.size.width / 2"
                            [attr.y]="pump.size.height + 15"
                            text-anchor="middle"
                            class="pump-label"
                            fill="#333"
                            font-size="10">
                            {{ getElementDisplayValue(pump) }}
                          </text>
                        }
                      }
                    </g>
                  }

                  @case ('statusLight') {
                    <g class="status-light-element">
                      @if (asStatusLight(element); as light) {
                        @if (light.config.shape === 'circle') {
                          <circle
                            [attr.cx]="light.size.width / 2"
                            [attr.cy]="light.size.height / 2"
                            [attr.r]="Math.min(light.size.width, light.size.height) / 2 - 2"
                            [attr.fill]="getElementColor(light)"
                            [attr.stroke]="light.style?.strokeColor ?? '#333'"
                            [attr.stroke-width]="light.style?.strokeWidth ?? 1"
                            [attr.filter]="isStatusLightOn(light) && light.config.showGlow ? 'url(#glowFilter)' : 'none'"
                            [class.blinking]="isStatusLightOn(light) && light.config.blinkWhenOn"/>
                        } @else {
                          <rect
                            x="2" y="2"
                            [attr.width]="light.size.width - 4"
                            [attr.height]="light.size.height - 4"
                            [attr.rx]="light.config.shape === 'square' ? 2 : 0"
                            [attr.fill]="getElementColor(light)"
                            [attr.stroke]="light.style?.strokeColor ?? '#333'"
                            [attr.stroke-width]="light.style?.strokeWidth ?? 1"
                            [attr.filter]="isStatusLightOn(light) && light.config.showGlow ? 'url(#glowFilter)' : 'none'"
                            [class.blinking]="isStatusLightOn(light) && light.config.blinkWhenOn"/>
                        }
                      }
                    </g>
                  }

                  @case ('digitalDisplay') {
                    <g class="digital-display-element">
                      @if (asDigitalDisplay(element); as display) {
                        <!-- Display background -->
                        <rect
                          x="0" y="0"
                          [attr.width]="display.size.width"
                          [attr.height]="display.size.height"
                          [attr.fill]="display.config.backgroundColor ?? '#1a1a1a'"
                          [attr.stroke]="display.style?.strokeColor ?? '#333'"
                          [attr.stroke-width]="display.style?.strokeWidth ?? 1"
                          rx="3"/>

                        <!-- Display value -->
                        <text
                          [attr.x]="display.size.width / 2"
                          [attr.y]="display.size.height / 2"
                          text-anchor="middle"
                          dominant-baseline="middle"
                          class="digital-display-value"
                          [attr.fill]="display.config.textStyle?.color ?? '#00ff00'"
                          [attr.font-size]="display.config.textStyle?.fontSize ?? 16"
                          font-family="monospace">
                          {{ getElementDisplayValue(display) }}
                        </text>
                      }
                    </g>
                  }

                  @case ('label') {
                    <g class="label-element">
                      @if (asLabel(element); as label) {
                        @if (label.config.backgroundColor || label.config.showBorder) {
                          <rect
                            x="0" y="0"
                            [attr.width]="label.size.width"
                            [attr.height]="label.size.height"
                            [attr.fill]="label.config.backgroundColor ?? 'transparent'"
                            [attr.stroke]="label.config.showBorder ? (label.style?.strokeColor ?? '#999') : 'none'"
                            [attr.stroke-width]="label.style?.strokeWidth ?? 1"
                            rx="2"/>
                        }
                        <text
                          [attr.x]="getLabelX(label)"
                          [attr.y]="label.size.height / 2"
                          [attr.text-anchor]="label.config.textStyle?.textAlign ?? 'left'"
                          dominant-baseline="middle"
                          [attr.fill]="label.config.textStyle?.color ?? '#333'"
                          [attr.font-size]="label.config.textStyle?.fontSize ?? 14"
                          [attr.font-weight]="label.config.textStyle?.fontWeight ?? 'normal'">
                          {{ getElementDisplayValue(label) || label.config.text }}
                        </text>
                      }
                    </g>
                  }

                  @case ('customSvg') {
                    <g class="custom-svg-element"
                       [innerHTML]="getCustomSvgContent(element)">
                    </g>
                  }

                  @case ('silo') {
                    <g class="silo-element">
                      @if (asSilo(element); as silo) {
                        <!-- Silo body (cylindrical with conical bottom) -->
                        <path
                          [attr.d]="getSiloPath(silo)"
                          fill="url(#tankGradient)"
                          [attr.stroke]="silo.style?.strokeColor ?? '#666'"
                          [attr.stroke-width]="silo.style?.strokeWidth ?? 2"/>

                        <!-- Fill level -->
                        @if (silo.config.showLevel) {
                          <clipPath [attr.id]="'silo-clip-' + silo.id">
                            <path [attr.d]="getSiloPath(silo)"/>
                          </clipPath>
                          <rect
                            x="2"
                            [attr.y]="getSiloFillY(silo)"
                            [attr.width]="silo.size.width - 4"
                            [attr.height]="getSiloFillHeight(silo)"
                            [attr.fill]="getElementColor(silo)"
                            [attr.clip-path]="'url(#silo-clip-' + silo.id + ')'"
                            class="silo-fill"/>
                        }

                        <!-- Percentage label -->
                        @if (silo.config.showPercentage) {
                          <text
                            [attr.x]="silo.size.width / 2"
                            [attr.y]="silo.size.height * 0.4"
                            text-anchor="middle"
                            dominant-baseline="middle"
                            class="silo-label"
                            fill="#333"
                            font-size="14"
                            font-weight="bold">
                            {{ getElementDisplayValue(silo) }}
                          </text>
                        }
                      }
                    </g>
                  }

                  @case ('vessel') {
                    <g class="vessel-element">
                      @if (asVessel(element); as vessel) {
                        <!-- Vessel body with rounded top -->
                        <path
                          [attr.d]="getVesselPath(vessel)"
                          fill="url(#tankGradient)"
                          [attr.stroke]="vessel.style?.strokeColor ?? '#666'"
                          [attr.stroke-width]="vessel.style?.strokeWidth ?? 2"/>

                        <!-- Fill level -->
                        @if (vessel.config.showLevel) {
                          <clipPath [attr.id]="'vessel-clip-' + vessel.id">
                            <path [attr.d]="getVesselPath(vessel)"/>
                          </clipPath>
                          <rect
                            x="2"
                            [attr.y]="getVesselFillY(vessel)"
                            [attr.width]="vessel.size.width - 4"
                            [attr.height]="getVesselFillHeight(vessel)"
                            [attr.fill]="getElementColor(vessel)"
                            [attr.clip-path]="'url(#vessel-clip-' + vessel.id + ')'"
                            class="vessel-fill"/>
                        }

                        <!-- Percentage label -->
                        @if (vessel.config.showPercentage) {
                          <text
                            [attr.x]="vessel.size.width / 2"
                            [attr.y]="vessel.size.height / 2"
                            text-anchor="middle"
                            dominant-baseline="middle"
                            fill="#333"
                            font-size="14"
                            font-weight="bold">
                            {{ getElementDisplayValue(vessel) }}
                          </text>
                        }
                      }
                    </g>
                  }

                  @case ('motor') {
                    <g class="motor-element">
                      @if (asMotor(element); as motor) {
                        <!-- Motor body (rectangle with rounded corners) -->
                        <rect
                          x="0" y="0"
                          [attr.width]="motor.size.width"
                          [attr.height]="motor.size.height"
                          rx="4"
                          [attr.fill]="getElementColor(motor)"
                          [attr.stroke]="motor.style?.strokeColor ?? '#333'"
                          [attr.stroke-width]="motor.style?.strokeWidth ?? 2"/>

                        <!-- Motor shaft indicator -->
                        <circle
                          [attr.cx]="motor.size.width / 2"
                          [attr.cy]="motor.size.height / 2"
                          [attr.r]="Math.min(motor.size.width, motor.size.height) / 4"
                          fill="#fff"
                          stroke="#333"
                          stroke-width="1"/>

                        <!-- Rotating element -->
                        <g [attr.transform]="'translate(' + motor.size.width/2 + ',' + motor.size.height/2 + ')'"
                           [class.rotating]="isMotorRunning(motor)">
                          <line x1="-10" y1="0" x2="10" y2="0" stroke="#333" stroke-width="2"/>
                          <line x1="0" y1="-10" x2="0" y2="10" stroke="#333" stroke-width="2"/>
                        </g>

                        <!-- M label -->
                        <text
                          [attr.x]="motor.size.width - 12"
                          [attr.y]="12"
                          text-anchor="middle"
                          font-size="10"
                          font-weight="bold"
                          fill="#333">M</text>

                        <!-- State label -->
                        @if (motor.config.showState) {
                          <text
                            [attr.x]="motor.size.width / 2"
                            [attr.y]="motor.size.height + 15"
                            text-anchor="middle"
                            fill="#333"
                            font-size="10">
                            {{ getElementDisplayValue(motor) }}
                          </text>
                        }
                      }
                    </g>
                  }

                  @case ('image') {
                    <g class="image-element">
                      @if (asImage(element); as img) {
                        <image
                          x="0" y="0"
                          [attr.width]="img.size.width"
                          [attr.height]="img.size.height"
                          [attr.href]="img.config.src"
                          [attr.preserveAspectRatio]="getImagePreserveAspectRatio(img)"/>
                      }
                    </g>
                  }

                  @case ('shape') {
                    <g class="shape-element">
                      @if (asShape(element); as shape) {
                        @switch (shape.config.shapeType) {
                          @case ('rectangle') {
                            <rect
                              x="0" y="0"
                              [attr.width]="shape.size.width"
                              [attr.height]="shape.size.height"
                              [attr.rx]="shape.config.borderRadius ?? 0"
                              [attr.fill]="shape.style?.fillColor ?? '#e0e0e0'"
                              [attr.stroke]="shape.style?.strokeColor ?? '#666'"
                              [attr.stroke-width]="shape.style?.strokeWidth ?? 1"/>
                          }
                          @case ('circle') {
                            <circle
                              [attr.cx]="shape.size.width / 2"
                              [attr.cy]="shape.size.height / 2"
                              [attr.r]="Math.min(shape.size.width, shape.size.height) / 2"
                              [attr.fill]="shape.style?.fillColor ?? '#e0e0e0'"
                              [attr.stroke]="shape.style?.strokeColor ?? '#666'"
                              [attr.stroke-width]="shape.style?.strokeWidth ?? 1"/>
                          }
                          @case ('ellipse') {
                            <ellipse
                              [attr.cx]="shape.size.width / 2"
                              [attr.cy]="shape.size.height / 2"
                              [attr.rx]="shape.size.width / 2"
                              [attr.ry]="shape.size.height / 2"
                              [attr.fill]="shape.style?.fillColor ?? '#e0e0e0'"
                              [attr.stroke]="shape.style?.strokeColor ?? '#666'"
                              [attr.stroke-width]="shape.style?.strokeWidth ?? 1"/>
                          }
                          @case ('polygon') {
                            <polygon
                              [attr.points]="shape.config.points"
                              [attr.fill]="shape.style?.fillColor ?? '#e0e0e0'"
                              [attr.stroke]="shape.style?.strokeColor ?? '#666'"
                              [attr.stroke-width]="shape.style?.strokeWidth ?? 1"/>
                          }
                          @case ('line') {
                            <line
                              [attr.x1]="shape.config.lineStart?.x ?? 0"
                              [attr.y1]="shape.config.lineStart?.y ?? 0"
                              [attr.x2]="shape.config.lineEnd?.x ?? shape.size.width"
                              [attr.y2]="shape.config.lineEnd?.y ?? shape.size.height"
                              [attr.stroke]="shape.style?.strokeColor ?? '#666'"
                              [attr.stroke-width]="shape.style?.strokeWidth ?? 2"/>
                          }
                        }
                      }
                    </g>
                  }

                  @case ('gauge') {
                    <g class="gauge-element">
                      @if (asGauge(element); as gauge) {
                        @if (gauge.config.gaugeType === 'arc' || gauge.config.gaugeType === 'semicircle') {
                          <!-- Arc/Semicircle gauge background -->
                          <path
                            [attr.d]="getGaugeArcPath(gauge, false)"
                            fill="none"
                            [attr.stroke]="gauge.style?.strokeColor ?? '#e0e0e0'"
                            [attr.stroke-width]="8"
                            stroke-linecap="round"/>

                          <!-- Arc/Semicircle gauge value -->
                          <path
                            [attr.d]="getGaugeArcPath(gauge, true)"
                            fill="none"
                            [attr.stroke]="getElementColor(gauge)"
                            [attr.stroke-width]="8"
                            stroke-linecap="round"/>

                          <!-- Value text -->
                          @if (gauge.config.showValue) {
                            <text
                              [attr.x]="gauge.size.width / 2"
                              [attr.y]="gauge.config.gaugeType === 'semicircle' ? gauge.size.height - 10 : gauge.size.height / 2"
                              text-anchor="middle"
                              dominant-baseline="middle"
                              font-size="14"
                              font-weight="bold"
                              fill="#333">
                              {{ getElementDisplayValue(gauge) }}
                            </text>
                          }
                        } @else {
                          <!-- Linear gauge background -->
                          <rect
                            x="0" y="0"
                            [attr.width]="gauge.size.width"
                            [attr.height]="gauge.size.height"
                            rx="4"
                            [attr.fill]="gauge.style?.fillColor ?? '#e0e0e0'"
                            [attr.stroke]="gauge.style?.strokeColor ?? '#999'"
                            stroke-width="1"/>

                          <!-- Linear gauge fill -->
                          <rect
                            x="2" y="2"
                            [attr.width]="getLinearGaugeFillWidth(gauge)"
                            [attr.height]="gauge.size.height - 4"
                            rx="2"
                            [attr.fill]="getElementColor(gauge)"/>

                          <!-- Value text -->
                          @if (gauge.config.showValue) {
                            <text
                              [attr.x]="gauge.size.width / 2"
                              [attr.y]="gauge.size.height / 2"
                              text-anchor="middle"
                              dominant-baseline="middle"
                              font-size="12"
                              font-weight="bold"
                              fill="#333">
                              {{ getElementDisplayValue(gauge) }}
                            </text>
                          }
                        }
                      }
                    </g>
                  }

                  @default {
                    <!-- Placeholder for unsupported element types -->
                    <rect
                      x="0" y="0"
                      [attr.width]="$any(element).size.width"
                      [attr.height]="$any(element).size.height"
                      fill="#f0f0f0"
                      stroke="#ccc"
                      stroke-width="1"
                      stroke-dasharray="5,5"/>
                    <text
                      [attr.x]="$any(element).size.width / 2"
                      [attr.y]="$any(element).size.height / 2"
                      text-anchor="middle"
                      dominant-baseline="middle"
                      fill="#999"
                      font-size="10">
                      {{ $any(element).type }}
                    </text>
                  }
                }
              </g>
            }

            <!-- Primitives (from Process Designer, with bindings applied) -->
            @for (primitive of boundPrimitives(); track primitive.id) {
              @if (primitive.visible !== false) {
                <g class="primitive"
                   [attr.data-id]="primitive.id"
                   [attr.data-type]="primitive.type"
                   [attr.transform]="getPrimitiveTransform(primitive)">
                  <!-- Animation elements (injected via innerHTML) -->
                  <g class="animations" [innerHTML]="getPrimitiveAnimationHtml(primitive)"></g>
                  <!-- Shape content -->
                  @switch (primitive.type) {
                    @case ('rectangle') {
                      <rect
                        x="0" y="0"
                        [attr.width]="$any(primitive).config.width"
                        [attr.height]="$any(primitive).config.height"
                        [attr.rx]="$any(primitive).config.cornerRadius ?? 0"
                        [attr.fill]="primitive.style?.fill?.color ?? 'none'"
                        [attr.fill-opacity]="primitive.style?.fill?.opacity ?? 1"
                        [attr.stroke]="primitive.style?.stroke?.color ?? 'none'"
                        [attr.stroke-width]="primitive.style?.stroke?.width ?? 0"
                        [attr.stroke-opacity]="primitive.style?.stroke?.opacity ?? 1"
                        [attr.stroke-dasharray]="getStrokeDashArray(primitive.style?.stroke?.dashArray)"/>
                    }
                    @case ('ellipse') {
                      <ellipse
                        cx="0" cy="0"
                        [attr.rx]="$any(primitive).config.radiusX ?? $any(primitive).config.rx ?? 50"
                        [attr.ry]="$any(primitive).config.radiusY ?? $any(primitive).config.ry ?? 50"
                        [attr.fill]="primitive.style?.fill?.color ?? 'none'"
                        [attr.fill-opacity]="primitive.style?.fill?.opacity ?? 1"
                        [attr.stroke]="primitive.style?.stroke?.color ?? 'none'"
                        [attr.stroke-width]="primitive.style?.stroke?.width ?? 0"
                        [attr.stroke-opacity]="primitive.style?.stroke?.opacity ?? 1"
                        [attr.stroke-dasharray]="getStrokeDashArray(primitive.style?.stroke?.dashArray)"/>
                    }
                    @case ('line') {
                      <line
                        [attr.x1]="$any(primitive).config.start.x"
                        [attr.y1]="$any(primitive).config.start.y"
                        [attr.x2]="$any(primitive).config.end.x"
                        [attr.y2]="$any(primitive).config.end.y"
                        [attr.stroke]="primitive.style?.stroke?.color ?? 'none'"
                        [attr.stroke-width]="primitive.style?.stroke?.width ?? 1"
                        [attr.stroke-opacity]="primitive.style?.stroke?.opacity ?? 1"
                        [attr.stroke-dasharray]="getEffectiveStrokeDashArray(primitive)"
                        [attr.marker-start]="$any(primitive).config.startMarker ? 'url(#' + $any(primitive).config.startMarker + ')' : null"
                        [attr.marker-end]="$any(primitive).config.endMarker ? 'url(#' + $any(primitive).config.endMarker + ')' : null"/>
                    }
                    @case ('polyline') {
                      <polyline
                        [attr.points]="getPolylinePoints($any(primitive))"
                        [attr.fill]="primitive.style?.fill?.color ?? 'none'"
                        [attr.fill-opacity]="primitive.style?.fill?.opacity ?? 1"
                        [attr.stroke]="primitive.style?.stroke?.color ?? 'none'"
                        [attr.stroke-width]="primitive.style?.stroke?.width ?? 1"
                        [attr.stroke-opacity]="primitive.style?.stroke?.opacity ?? 1"
                        [attr.stroke-dasharray]="getEffectiveStrokeDashArray(primitive)"/>
                    }
                    @case ('polygon') {
                      <polygon
                        [attr.points]="getPolygonPoints($any(primitive))"
                        [attr.fill]="primitive.style?.fill?.color ?? 'none'"
                        [attr.fill-opacity]="primitive.style?.fill?.opacity ?? 1"
                        [attr.stroke]="primitive.style?.stroke?.color ?? 'none'"
                        [attr.stroke-width]="primitive.style?.stroke?.width ?? 1"
                        [attr.stroke-opacity]="primitive.style?.stroke?.opacity ?? 1"
                        [attr.stroke-dasharray]="getStrokeDashArray(primitive.style?.stroke?.dashArray)"/>
                    }
                    @case ('path') {
                      <path
                        [attr.d]="$any(primitive).config.d"
                        [attr.fill]="primitive.style?.fill?.color ?? 'none'"
                        [attr.fill-opacity]="primitive.style?.fill?.opacity ?? 1"
                        [attr.stroke]="primitive.style?.stroke?.color ?? 'none'"
                        [attr.stroke-width]="primitive.style?.stroke?.width ?? 1"
                        [attr.stroke-opacity]="primitive.style?.stroke?.opacity ?? 1"
                        [attr.stroke-dasharray]="getEffectiveStrokeDashArray(primitive)"/>
                    }
                    @case ('text') {
                      <text
                        [attr.x]="0"
                        [attr.y]="0"
                        [attr.font-family]="$any(primitive).config.textStyle?.fontFamily ?? 'sans-serif'"
                        [attr.font-size]="$any(primitive).config.textStyle?.fontSize ?? 14"
                        [attr.font-weight]="$any(primitive).config.textStyle?.fontWeight ?? 'normal'"
                        [attr.fill]="$any(primitive).config.textStyle?.color ?? primitive.style?.fill?.color ?? '#000'"
                        [attr.fill-opacity]="primitive.style?.fill?.opacity ?? 1"
                        [attr.text-anchor]="$any(primitive).config.textStyle?.textAnchor ?? 'start'"
                        [attr.dominant-baseline]="$any(primitive).config.textStyle?.dominantBaseline ?? 'hanging'">
                        {{ $any(primitive).config.content }}
                      </text>
                    }
                    @case ('group') {
                      <!-- Group just renders children, no visual itself unless styled -->
                      @if (primitive.style?.fill?.color || primitive.style?.stroke?.color) {
                        @let groupBounds = getGroupBounds(primitive);
                        <rect
                          [attr.x]="groupBounds.x - primitive.position.x"
                          [attr.y]="groupBounds.y - primitive.position.y"
                          [attr.width]="groupBounds.width"
                          [attr.height]="groupBounds.height"
                          [attr.fill]="primitive.style?.fill?.color ?? 'none'"
                          [attr.fill-opacity]="primitive.style?.fill?.opacity ?? 1"
                          [attr.stroke]="primitive.style?.stroke?.color ?? 'none'"
                          [attr.stroke-width]="primitive.style?.stroke?.width ?? 0"
                          [attr.stroke-opacity]="primitive.style?.stroke?.opacity ?? 1"/>
                      }
                    }
                    @case ('image') {
                      <image
                        x="0" y="0"
                        [attr.width]="$any(primitive).config.width"
                        [attr.height]="$any(primitive).config.height"
                        [attr.href]="$any(primitive).config.src"
                        preserveAspectRatio="xMidYMid meet"/>
                    }
                  }
                </g>
              }
            }

            <!-- Symbol Instances (from Process Designer) -->
            @for (symbolInstance of diagramConfig()!.symbolInstances ?? []; track symbolInstance.id) {
              @let styleClasses = getSymbolDefinition(symbolInstance)?.styleClasses;
              <g class="symbol-instance"
                 [attr.data-id]="symbolInstance.id"
                 [attr.transform]="getSymbolTransform(symbolInstance)">
                <!-- Render symbol primitives with bindings applied (top-level only) -->
                @for (primitive of getTopLevelSymbolPrimitives(symbolInstance); track primitive.id) {
                  @if (primitive.visible !== false) {
                    @if (isGroup(primitive)) {
                      <!-- Group: wrapper with ID for animation targeting, contains children -->
                      <g [attr.id]="getSymbolShapeId(symbolInstance, primitive)"
                         [attr.transform]="getPrimitiveTransform(primitive)">
                        <!-- Animation elements for the group -->
                        <g class="animations" [innerHTML]="getSymbolPrimitiveAnimationHtml(primitive, symbolInstance)"></g>
                        <!-- Group children (coordinates adjusted relative to group position) -->
                        @for (child of getGroupChildPrimitives(symbolInstance, primitive); track child.id) {
                          @if (child.visible !== false) {
                            <g [attr.transform]="getGroupChildTransform(child, primitive)">
                              <g class="animations" [innerHTML]="getSymbolPrimitiveAnimationHtml(child, symbolInstance)"></g>
                              @switch (child.type) {
                                @case ('rectangle') {
                                  @if (hasFillLevel(child)) {
                                    <!-- Rectangle with fillLevel in group -->
                                    <g [innerHTML]="getRectangleWithFillLevelHtml(child, symbolInstance, styleClasses)"></g>
                                  } @else {
                                    <rect
                                      [attr.id]="getSymbolShapeId(symbolInstance, child)"
                                      x="0" y="0"
                                      [attr.width]="$any(child).config.width"
                                      [attr.height]="$any(child).config.height"
                                      [attr.rx]="$any(child).config.cornerRadius ?? 0"
                                      [attr.fill]="getFillColor(child, styleClasses)"
                                      [attr.fill-opacity]="getFillOpacity(child, styleClasses)"
                                      [attr.stroke]="getStrokeColor(child, styleClasses)"
                                      [attr.stroke-width]="getStrokeWidth(child, styleClasses, 0)"
                                      [attr.stroke-opacity]="getStrokeOpacity(child, styleClasses)"
                                      [attr.stroke-dasharray]="getStrokeDashArray(child.style?.stroke?.dashArray)"/>
                                  }
                                }
                                @case ('ellipse') {
                                  <ellipse
                                    [attr.id]="getSymbolShapeId(symbolInstance, child)"
                                    cx="0" cy="0"
                                    [attr.rx]="$any(child).config.radiusX ?? $any(child).config.rx ?? 50"
                                    [attr.ry]="$any(child).config.radiusY ?? $any(child).config.ry ?? 50"
                                    [attr.fill]="getFillColor(child, styleClasses)"
                                    [attr.fill-opacity]="getFillOpacity(child, styleClasses)"
                                    [attr.stroke]="getStrokeColor(child, styleClasses)"
                                    [attr.stroke-width]="getStrokeWidth(child, styleClasses, 0)"
                                    [attr.stroke-opacity]="getStrokeOpacity(child, styleClasses)"
                                    [attr.stroke-dasharray]="getStrokeDashArray(child.style?.stroke?.dashArray)"/>
                                }
                                @case ('line') {
                                  @let lineCoords = getGroupChildLineCoords(child, primitive);
                                  <line
                                    [attr.id]="getSymbolShapeId(symbolInstance, child)"
                                    [attr.x1]="lineCoords.x1"
                                    [attr.y1]="lineCoords.y1"
                                    [attr.x2]="lineCoords.x2"
                                    [attr.y2]="lineCoords.y2"
                                    [attr.stroke]="getStrokeColor(child, styleClasses)"
                                    [attr.stroke-width]="getStrokeWidth(child, styleClasses)"
                                    [attr.stroke-opacity]="getStrokeOpacity(child, styleClasses)"
                                    [attr.stroke-dasharray]="getEffectiveStrokeDashArray(child)"/>
                                  <!-- Flow particles for line in group -->
                                  @if (hasFlowParticles(child)) {
                                    <g class="flow-particles" [innerHTML]="getFlowParticlesHtml(child, symbolInstance)"></g>
                                  }
                                }
                                @case ('polyline') {
                                  <polyline
                                    [attr.id]="getSymbolShapeId(symbolInstance, child)"
                                    [attr.points]="getGroupChildPoints(child, primitive)"
                                    [attr.fill]="getFillColor(child, styleClasses)"
                                    [attr.fill-opacity]="getFillOpacity(child, styleClasses)"
                                    [attr.stroke]="getStrokeColor(child, styleClasses)"
                                    [attr.stroke-width]="getStrokeWidth(child, styleClasses)"
                                    [attr.stroke-opacity]="getStrokeOpacity(child, styleClasses)"
                                    [attr.stroke-dasharray]="getEffectiveStrokeDashArray(child)"/>
                                  <!-- Flow particles for polyline in group -->
                                  @if (hasFlowParticles(child)) {
                                    <g class="flow-particles" [innerHTML]="getFlowParticlesHtml(child, symbolInstance)"></g>
                                  }
                                }
                                @case ('polygon') {
                                  <polygon
                                    [attr.id]="getSymbolShapeId(symbolInstance, child)"
                                    [attr.points]="getGroupChildPoints(child, primitive)"
                                    [attr.fill]="getFillColor(child, styleClasses)"
                                    [attr.fill-opacity]="getFillOpacity(child, styleClasses)"
                                    [attr.stroke]="getStrokeColor(child, styleClasses)"
                                    [attr.stroke-width]="getStrokeWidth(child, styleClasses)"
                                    [attr.stroke-opacity]="getStrokeOpacity(child, styleClasses)"
                                    [attr.stroke-dasharray]="getStrokeDashArray(child.style?.stroke?.dashArray)"/>
                                }
                                @case ('path') {
                                  <path
                                    [attr.id]="getSymbolShapeId(symbolInstance, child)"
                                    [attr.d]="$any(child).config.d"
                                    [attr.fill]="getFillColor(child, styleClasses)"
                                    [attr.fill-opacity]="getFillOpacity(child, styleClasses)"
                                    [attr.stroke]="getStrokeColor(child, styleClasses)"
                                    [attr.stroke-width]="getStrokeWidth(child, styleClasses)"
                                    [attr.stroke-opacity]="getStrokeOpacity(child, styleClasses)"
                                    [attr.stroke-dasharray]="getEffectiveStrokeDashArray(child)"/>
                                  <!-- Flow particles for path in group -->
                                  @if (hasFlowParticles(child)) {
                                    <g class="flow-particles" [innerHTML]="getFlowParticlesHtml(child, symbolInstance)"></g>
                                  }
                                }
                                @case ('text') {
                                  <text
                                    [attr.id]="getSymbolShapeId(symbolInstance, child)"
                                    [attr.x]="0"
                                    [attr.y]="0"
                                    [attr.font-family]="$any(child).config.textStyle?.fontFamily ?? 'sans-serif'"
                                    [attr.font-size]="$any(child).config.textStyle?.fontSize ?? 14"
                                    [attr.font-weight]="$any(child).config.textStyle?.fontWeight ?? 'normal'"
                                    [attr.fill]="$any(child).config.textStyle?.color ?? getFillColor(child, styleClasses, '#000')"
                                    [attr.fill-opacity]="getFillOpacity(child, styleClasses)"
                                    [attr.text-anchor]="$any(child).config.textStyle?.textAnchor ?? 'start'"
                                    [attr.dominant-baseline]="$any(child).config.textStyle?.dominantBaseline ?? 'hanging'">
                                    {{ $any(child).config.content }}
                                  </text>
                                }
                                @case ('image') {
                                  <image
                                    [attr.id]="getSymbolShapeId(symbolInstance, child)"
                                    x="0" y="0"
                                    [attr.width]="$any(child).config.width"
                                    [attr.height]="$any(child).config.height"
                                    [attr.href]="$any(child).config.src"
                                    preserveAspectRatio="xMidYMid meet"/>
                                }
                              }
                            </g>
                          }
                        }
                      </g>
                    } @else {
                      <!-- Non-group primitive -->
                      <g [attr.transform]="getPrimitiveTransform(primitive)">
                        <!-- Animation elements -->
                        <g class="animations" [innerHTML]="getSymbolPrimitiveAnimationHtml(primitive, symbolInstance)"></g>
                        <!-- Shape content (with ID for animation targeting via href) -->
                        @switch (primitive.type) {
                          @case ('rectangle') {
                            @if (hasFillLevel(primitive)) {
                              <!-- Rectangle with fillLevel - use clip-path for tank visualization -->
                              <g [innerHTML]="getRectangleWithFillLevelHtml(primitive, symbolInstance, styleClasses)"></g>
                            } @else {
                              <rect
                                [attr.id]="getSymbolShapeId(symbolInstance, primitive)"
                                x="0" y="0"
                                [attr.width]="$any(primitive).config.width"
                                [attr.height]="$any(primitive).config.height"
                                [attr.rx]="$any(primitive).config.cornerRadius ?? 0"
                                [attr.fill]="getFillColor(primitive, styleClasses)"
                                [attr.fill-opacity]="getFillOpacity(primitive, styleClasses)"
                                [attr.stroke]="getStrokeColor(primitive, styleClasses)"
                                [attr.stroke-width]="getStrokeWidth(primitive, styleClasses, 0)"
                                [attr.stroke-opacity]="getStrokeOpacity(primitive, styleClasses)"
                                [attr.stroke-dasharray]="getStrokeDashArray(primitive.style?.stroke?.dashArray)"/>
                            }
                          }
                          @case ('ellipse') {
                            <ellipse
                              [attr.id]="getSymbolShapeId(symbolInstance, primitive)"
                              cx="0" cy="0"
                              [attr.rx]="$any(primitive).config.radiusX ?? $any(primitive).config.rx ?? 50"
                              [attr.ry]="$any(primitive).config.radiusY ?? $any(primitive).config.ry ?? 50"
                              [attr.fill]="getFillColor(primitive, styleClasses)"
                              [attr.fill-opacity]="getFillOpacity(primitive, styleClasses)"
                              [attr.stroke]="getStrokeColor(primitive, styleClasses)"
                              [attr.stroke-width]="getStrokeWidth(primitive, styleClasses, 0)"
                              [attr.stroke-opacity]="getStrokeOpacity(primitive, styleClasses)"
                              [attr.stroke-dasharray]="getStrokeDashArray(primitive.style?.stroke?.dashArray)"/>
                          }
                          @case ('line') {
                            <line
                              [attr.id]="getSymbolShapeId(symbolInstance, primitive)"
                              [attr.x1]="$any(primitive).config.start.x"
                              [attr.y1]="$any(primitive).config.start.y"
                              [attr.x2]="$any(primitive).config.end.x"
                              [attr.y2]="$any(primitive).config.end.y"
                              [attr.stroke]="getStrokeColor(primitive, styleClasses)"
                              [attr.stroke-width]="getStrokeWidth(primitive, styleClasses)"
                              [attr.stroke-opacity]="getStrokeOpacity(primitive, styleClasses)"
                              [attr.stroke-dasharray]="getEffectiveStrokeDashArray(primitive)"/>
                            <!-- Flow particles for line -->
                            @if (hasFlowParticles(primitive)) {
                              <g class="flow-particles" [innerHTML]="getFlowParticlesHtml(primitive, symbolInstance)"></g>
                            }
                          }
                          @case ('polyline') {
                            <polyline
                              [attr.id]="getSymbolShapeId(symbolInstance, primitive)"
                              [attr.points]="getPolylinePoints($any(primitive))"
                              [attr.fill]="getFillColor(primitive, styleClasses)"
                              [attr.fill-opacity]="getFillOpacity(primitive, styleClasses)"
                              [attr.stroke]="getStrokeColor(primitive, styleClasses)"
                              [attr.stroke-width]="getStrokeWidth(primitive, styleClasses)"
                              [attr.stroke-opacity]="getStrokeOpacity(primitive, styleClasses)"
                              [attr.stroke-dasharray]="getEffectiveStrokeDashArray(primitive)"/>
                            <!-- Flow particles for polyline -->
                            @if (hasFlowParticles(primitive)) {
                              <g class="flow-particles" [innerHTML]="getFlowParticlesHtml(primitive, symbolInstance)"></g>
                            }
                          }
                          @case ('polygon') {
                            <polygon
                              [attr.id]="getSymbolShapeId(symbolInstance, primitive)"
                              [attr.points]="getPolygonPoints($any(primitive))"
                              [attr.fill]="getFillColor(primitive, styleClasses)"
                              [attr.fill-opacity]="getFillOpacity(primitive, styleClasses)"
                              [attr.stroke]="getStrokeColor(primitive, styleClasses)"
                              [attr.stroke-width]="getStrokeWidth(primitive, styleClasses)"
                              [attr.stroke-opacity]="getStrokeOpacity(primitive, styleClasses)"
                              [attr.stroke-dasharray]="getStrokeDashArray(primitive.style?.stroke?.dashArray)"/>
                          }
                          @case ('path') {
                            <path
                              [attr.id]="getSymbolShapeId(symbolInstance, primitive)"
                              [attr.d]="$any(primitive).config.d"
                              [attr.fill]="getFillColor(primitive, styleClasses)"
                              [attr.fill-opacity]="getFillOpacity(primitive, styleClasses)"
                              [attr.stroke]="getStrokeColor(primitive, styleClasses)"
                              [attr.stroke-width]="getStrokeWidth(primitive, styleClasses)"
                              [attr.stroke-opacity]="getStrokeOpacity(primitive, styleClasses)"
                              [attr.stroke-dasharray]="getEffectiveStrokeDashArray(primitive)"/>
                            <!-- Flow particles for path -->
                            @if (hasFlowParticles(primitive)) {
                              <g class="flow-particles" [innerHTML]="getFlowParticlesHtml(primitive, symbolInstance)"></g>
                            }
                          }
                          @case ('text') {
                            <text
                              [attr.id]="getSymbolShapeId(symbolInstance, primitive)"
                              [attr.x]="0"
                              [attr.y]="0"
                              [attr.font-family]="$any(primitive).config.textStyle?.fontFamily ?? 'sans-serif'"
                              [attr.font-size]="$any(primitive).config.textStyle?.fontSize ?? 14"
                              [attr.font-weight]="$any(primitive).config.textStyle?.fontWeight ?? 'normal'"
                              [attr.fill]="$any(primitive).config.textStyle?.color ?? getFillColor(primitive, styleClasses, '#000')"
                              [attr.fill-opacity]="getFillOpacity(primitive, styleClasses)"
                              [attr.text-anchor]="$any(primitive).config.textStyle?.textAnchor ?? 'start'"
                              [attr.dominant-baseline]="$any(primitive).config.textStyle?.dominantBaseline ?? 'hanging'">
                              {{ $any(primitive).config.content }}
                            </text>
                          }
                          @case ('image') {
                            <image
                              [attr.id]="getSymbolShapeId(symbolInstance, primitive)"
                              x="0" y="0"
                              [attr.width]="$any(primitive).config.width"
                              [attr.height]="$any(primitive).config.height"
                              [attr.href]="$any(primitive).config.src"
                              preserveAspectRatio="xMidYMid meet"/>
                          }
                        }
                      </g>
                    }
                  }
                }
              </g>
            }
          </svg>
        </div>
      } @else {
        <div class="no-config">
          <span>No process diagram configured</span>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .process-widget {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: var(--process-bg, #fafafa);
    }

    .loading-overlay {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      color: var(--kendo-color-subtle, #666);
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e0e0e0;
      border-top-color: var(--kendo-color-primary, #1976d2);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem;
      color: var(--kendo-color-error, #d32f2f);
    }

    .error-icon {
      font-size: 2rem;
    }

    .error-message {
      font-size: 0.875rem;
      text-align: center;
    }

    .no-config {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--kendo-color-subtle, #999);
      font-style: italic;
    }

    .diagram-container {
      position: relative;
      overflow: hidden;
    }

    .diagram-container.fit-to-bounds {
      width: 100% !important;
      height: 100% !important;
    }

    .process-svg {
      display: block;
    }

    .diagram-container.fit-to-bounds .process-svg {
      width: 100%;
      height: 100%;
    }

    /* Canvas background - themeable via CSS variable */
    .canvas-background {
      fill: var(--process-canvas-bg, #fafafa);
    }

    /* Element styles */
    .element {
      cursor: default;
    }

    .element.interactive {
      cursor: pointer;
    }

    .element.interactive:hover {
      filter: brightness(1.1);
    }

    .tank-fill {
      transition: height 0.5s ease-out, y 0.5s ease-out;
    }

    .tank-label {
      pointer-events: none;
      user-select: none;
    }

    /* Pump rotation animation */
    .pump-element .rotating {
      animation: rotate 1s linear infinite;
      transform-origin: center;
    }

    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Status light blinking */
    .blinking {
      animation: blink 1s ease-in-out infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    /* Connection flow animation */
    .connection-flow {
      animation: flow 2s linear infinite;
    }

    @keyframes flow {
      from { stroke-dashoffset: 0; }
      to { stroke-dashoffset: -40; }
    }

    /* Digital display */
    .digital-display-value {
      font-family: 'Courier New', monospace;
      letter-spacing: 2px;
    }
  `]
})
export class ProcessWidgetComponent implements DashboardWidget<ProcessWidgetConfig>, OnInit, OnChanges {

  @Input() config!: ProcessWidgetConfig;

  @ViewChild('containerRef') containerRef!: ElementRef<HTMLDivElement>;

  private readonly dataService = inject(ProcessDataService);
  private readonly symbolLibraryService = inject(SymbolLibraryService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly expressionEvaluator = inject(ExpressionEvaluatorService);

  // Math reference for template
  protected readonly Math = Math;

  // State signals
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _diagramConfig = signal<ProcessDiagramConfig | null>(null);
  private readonly _runtimeState = signal<ProcessDiagramRuntimeState | null>(null);
  private readonly _symbolDefinitions = signal<Map<string, SymbolDefinition>>(new Map());
  private readonly _boundData = signal<BoundDataResult | null>(null);

  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly diagramConfig = this._diagramConfig.asReadonly();
  readonly data = computed(() => this._runtimeState());

  /**
   * Bound data from widget data binding configuration.
   * Contains entity or query data that can be used for dynamic values in the diagram.
   */
  readonly boundData = this._boundData.asReadonly();

  // Computed SVG properties
  readonly viewBox = computed(() => {
    const diagram = this._diagramConfig();
    if (!diagram) return '0 0 800 600';
    return `0 0 ${diagram.canvas.width} ${diagram.canvas.height}`;
  });

  readonly svgWidth = computed(() => {
    if (this.config.fitToBounds !== false) return '100%';
    return this._diagramConfig()?.canvas.width ?? 800;
  });

  readonly svgHeight = computed(() => {
    if (this.config.fitToBounds !== false) return '100%';
    return this._diagramConfig()?.canvas.height ?? 600;
  });

  /**
   * Computed animation enabled states.
   * Evaluates animation bindings to determine which animations should be active.
   */
  readonly animationEnabledStates = computed<Record<string, boolean>>(() => {
    const states: Record<string, boolean> = {};
    const diagram = this._diagramConfig();
    const boundData = this._boundData();

    if (!diagram?.propertyBindings || diagram.propertyBindings.length === 0) {
      return states;
    }

    // Filter bindings that control animations
    const animationBindings = diagram.propertyBindings.filter(
      b => b.effectType === 'animation.enabled' && b.animationId
    );

    if (animationBindings.length === 0) {
      return states;
    }

    // Build property values from bound data
    const propertyValues = boundData
      ? this.buildPropertyValuesFromBoundData(
          diagram.transformProperties ?? [],
          this.config.propertyMappings ?? [],
          boundData
        )
      : {};

    // Evaluate each animation binding
    for (const binding of animationBindings) {
      const propertyValue = propertyValues[binding.propertyId];

      // Build expression context
      const context: Record<string, number | string | boolean> = {};
      if (typeof propertyValue === 'number' || typeof propertyValue === 'string' || typeof propertyValue === 'boolean') {
        context['value'] = propertyValue;
      } else {
        context['value'] = 0;
      }

      // Evaluate expression to determine if animation is enabled
      const result = this.expressionEvaluator.evaluate(binding.expression, context);
      const key = binding.targetId ? `${binding.targetId}:${binding.animationId}` : binding.animationId!;
      states[key] = result.success && Boolean(result.value);
    }

    return states;
  });

  /**
   * Primitives with runtime bindings applied.
   * Uses property values built from bound data and the diagram's propertyBindings.
   */
  readonly boundPrimitives = computed<PrimitiveBase[]>(() => {
    const diagram = this._diagramConfig();
    const boundData = this._boundData();

    if (!diagram?.primitives) {
      return [];
    }

    // If no bindings or no bound data, return original primitives
    if (!diagram.propertyBindings || diagram.propertyBindings.length === 0 || !boundData) {
      return diagram.primitives;
    }

    // Build property values from bound data using mappings
    const propertyValues = this.buildPropertyValuesFromBoundData(
      diagram.transformProperties ?? [],
      this.config.propertyMappings ?? [],
      boundData
    );

    // Apply bindings to primitives
    return this.applyBindingsToPrimitives(
      diagram.primitives,
      diagram.propertyBindings,
      propertyValues
    );
  });

  ngOnInit(): void {
    this.loadDiagram();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      this.loadDiagram();
    }
  }

  refresh(): void {
    this.loadDiagram();
  }

  /**
   * Loads the process diagram configuration and data
   */
  private async loadDiagram(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);
    this._boundData.set(null);

    try {
      // Check for inline config first
      if (this.config.inlineConfig) {
        this._diagramConfig.set(this.config.inlineConfig);
        await this.loadSymbolDefinitions(this.config.inlineConfig);
        await this.loadRuntimeData();
        await this.loadBoundData();
        return;
      }

      // Load from backend by rtId
      if (this.config.processDiagramRtId) {
        const diagram = await this.dataService.loadDiagram(this.config.processDiagramRtId);
        this._diagramConfig.set(diagram);
        await this.loadSymbolDefinitions(diagram);
        await this.loadRuntimeData();
        await this.loadBoundData();
        return;
      }

      // No configuration
      this._error.set('No process diagram configured');
    } catch (err) {
      console.error('Error loading process diagram:', err);
      this._error.set('Failed to load process diagram');
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Loads bound data based on widget data binding configuration
   */
  private async loadBoundData(): Promise<void> {
    // Only load if data binding is configured
    if (!this.config.dataBindingMode || this.config.dataBindingMode === 'none') {
      return;
    }

    try {
      const boundData = await this.dataService.loadBoundData(this.config);
      this._boundData.set(boundData);
    } catch (err) {
      console.error('Error loading bound data:', err);
      // Don't set error - diagram still displays, just without bound data
    }
  }

  /**
   * Loads symbol definitions for all symbol instances in the diagram
   */
  private async loadSymbolDefinitions(diagram: ProcessDiagramConfig): Promise<void> {
    const symbolInstances = diagram.symbolInstances ?? [];
    if (symbolInstances.length === 0) {
      return;
    }

    // Collect unique symbol rtIds
    const symbolRtIds = new Set<string>();
    for (const instance of symbolInstances) {
      if (instance.symbolRtId) {
        symbolRtIds.add(instance.symbolRtId);
      }
    }

    if (symbolRtIds.size === 0) {
      return;
    }

    // Load each symbol definition
    const definitions = new Map<string, SymbolDefinition>();
    for (const rtId of symbolRtIds) {
      try {
        const definition = await this.symbolLibraryService.loadSymbol(rtId);
        definitions.set(rtId, definition);

        // Also load nested symbol definitions recursively
        await this.loadNestedSymbolDefinitions(definition, definitions);
      } catch (error) {
        console.warn(`Failed to load symbol definition ${rtId}:`, error);
      }
    }

    this._symbolDefinitions.set(definitions);
  }

  /**
   * Recursively load symbol definitions for nested symbol instances.
   */
  private async loadNestedSymbolDefinitions(
    symbolDef: SymbolDefinition,
    cache: Map<string, SymbolDefinition>
  ): Promise<void> {
    const nestedInstances = symbolDef.symbolInstances ?? [];

    for (const nestedInst of nestedInstances) {
      // Skip if already loaded
      if (cache.has(nestedInst.symbolRtId)) {
        continue;
      }

      try {
        const nestedDef = await this.symbolLibraryService.loadSymbol(nestedInst.symbolRtId);
        cache.set(nestedInst.symbolRtId, nestedDef);

        // Recursively load nested symbols
        await this.loadNestedSymbolDefinitions(nestedDef, cache);
      } catch (error) {
        console.warn(`Failed to load nested symbol ${nestedInst.symbolRtId}:`, error);
      }
    }
  }

  /**
   * Loads runtime data for all elements
   */
  private async loadRuntimeData(): Promise<void> {
    const diagram = this._diagramConfig();
    if (!diagram) return;

    try {
      const state = await this.dataService.loadRuntimeData(diagram);
      this._runtimeState.set(state);
    } catch (err) {
      console.error('Error loading runtime data:', err);
      // Don't set error - diagram still displays, just without data
    }
  }

  // ============================================================================
  // Type Guards
  // ============================================================================

  protected asTank(element: ProcessElement): TankElementConfig | null {
    return element.type === 'tank' ? element as TankElementConfig : null;
  }

  protected asValve(element: ProcessElement): ValveElementConfig | null {
    return element.type === 'valve' ? element as ValveElementConfig : null;
  }

  protected asPump(element: ProcessElement): PumpElementConfig | null {
    return element.type === 'pump' ? element as PumpElementConfig : null;
  }

  protected asStatusLight(element: ProcessElement): StatusLightElementConfig | null {
    return element.type === 'statusLight' ? element as StatusLightElementConfig : null;
  }

  protected asDigitalDisplay(element: ProcessElement): DigitalDisplayElementConfig | null {
    return element.type === 'digitalDisplay' ? element as DigitalDisplayElementConfig : null;
  }

  protected asLabel(element: ProcessElement): LabelElementConfig | null {
    return element.type === 'label' ? element as LabelElementConfig : null;
  }

  protected asCustomSvg(element: ProcessElement): CustomSvgElementConfig | null {
    return element.type === 'customSvg' ? element as CustomSvgElementConfig : null;
  }

  protected asSilo(element: ProcessElement): SiloElementConfig | null {
    return element.type === 'silo' ? element as SiloElementConfig : null;
  }

  protected asVessel(element: ProcessElement): VesselElementConfig | null {
    return element.type === 'vessel' ? element as VesselElementConfig : null;
  }

  protected asMotor(element: ProcessElement): MotorElementConfig | null {
    return element.type === 'motor' ? element as MotorElementConfig : null;
  }

  protected asImage(element: ProcessElement): ImageElementConfig | null {
    return element.type === 'image' ? element as ImageElementConfig : null;
  }

  protected asShape(element: ProcessElement): ShapeElementConfig | null {
    return element.type === 'shape' ? element as ShapeElementConfig : null;
  }

  protected asGauge(element: ProcessElement): ProcessGaugeElementConfig | null {
    return element.type === 'gauge' ? element as ProcessGaugeElementConfig : null;
  }

  // ============================================================================
  // Element Rendering Helpers
  // ============================================================================

  protected getElementTransform(element: ProcessElement): string {
    let transform = `translate(${element.position.x}, ${element.position.y})`;
    if (element.rotation) {
      const cx = element.size.width / 2;
      const cy = element.size.height / 2;
      transform += ` rotate(${element.rotation}, ${cx}, ${cy})`;
    }
    return transform;
  }

  protected getElementColor(element: ProcessElement): string {
    const runtimeData = this.getElementRuntimeData(element.id);

    // Check for computed color from thresholds
    if (runtimeData?.computedColor) {
      return runtimeData.computedColor;
    }

    // Default colors based on element type and state
    switch (element.type) {
      case 'tank': {
        const tank = element as TankElementConfig;
        return tank.config.fillColor ?? '#42a5f5';
      }
      case 'silo': {
        const silo = element as SiloElementConfig;
        return silo.config.fillColor ?? '#42a5f5';
      }
      case 'vessel': {
        const vessel = element as VesselElementConfig;
        return vessel.config.fillColor ?? '#42a5f5';
      }
      case 'valve': {
        const valve = element as ValveElementConfig;
        const isOpen = this.getElementValue(element);
        if (isOpen === true || isOpen === 'open' || isOpen === 'OPEN') {
          return valve.config.openColor ?? '#4caf50';
        }
        return valve.config.closedColor ?? '#f44336';
      }
      case 'pump': {
        const pump = element as PumpElementConfig;
        const isRunning = this.isPumpRunning(pump);
        if (isRunning) {
          return pump.config.runningColor ?? '#4caf50';
        }
        return pump.config.stoppedColor ?? '#9e9e9e';
      }
      case 'motor': {
        const motor = element as MotorElementConfig;
        const isRunning = this.isMotorRunning(motor);
        if (isRunning) {
          return motor.config.runningColor ?? '#4caf50';
        }
        return motor.config.stoppedColor ?? '#9e9e9e';
      }
      case 'statusLight': {
        const light = element as StatusLightElementConfig;
        const isOn = this.isStatusLightOn(light);
        if (isOn) {
          return light.config.onColor ?? '#4caf50';
        }
        return light.config.offColor ?? '#9e9e9e';
      }
      case 'gauge': {
        const gauge = element as ProcessGaugeElementConfig;
        return gauge.config.valueColor ?? '#1976d2';
      }
      default:
        return element.style?.fillColor ?? '#e0e0e0';
    }
  }

  protected getElementDisplayValue(element: ProcessElement): string {
    const runtimeData = this.getElementRuntimeData(element.id);
    if (runtimeData?.displayValue) {
      return runtimeData.displayValue;
    }

    // Format based on element type
    const value = this.getElementValue(element);
    if (value === undefined || value === null) {
      return '--';
    }

    const transform = element.dataBinding?.transform;
    if (transform) {
      const prefix = transform.prefix ?? '';
      const suffix = transform.suffix ?? '';
      const decimals = transform.decimals ?? 0;

      if (typeof value === 'number') {
        return `${prefix}${value.toFixed(decimals)}${suffix}`;
      }
      return `${prefix}${value}${suffix}`;
    }

    return String(value);
  }

  protected getElementValue(element: ProcessElement): unknown {
    const runtimeData = this.getElementRuntimeData(element.id);
    return runtimeData?.value;
  }

  protected getElementRuntimeData(elementId: string): ElementRuntimeData | undefined {
    return this._runtimeState()?.elements.get(elementId);
  }

  // ============================================================================
  // Tank Helpers
  // ============================================================================

  protected getTankFillHeight(tank: TankElementConfig): number {
    const value = this.getElementValue(tank);
    if (typeof value !== 'number') return 0;

    const transform = tank.dataBinding?.transform;
    const max = transform?.max ?? 100;
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return ((tank.size.height - 4) * percentage) / 100;
  }

  protected getTankFillY(tank: TankElementConfig): number {
    const fillHeight = this.getTankFillHeight(tank);
    return tank.size.height - fillHeight - 2;
  }

  // ============================================================================
  // Valve Helpers
  // ============================================================================

  protected getValvePoints(valve: ValveElementConfig): string {
    const w = valve.size.width;
    const h = valve.size.height;
    // Bowtie shape
    return `0,0 ${w/2},${h/2} 0,${h} ${w},${h} ${w/2},${h/2} ${w},0`;
  }

  // ============================================================================
  // Pump Helpers
  // ============================================================================

  protected isPumpRunning(pump: PumpElementConfig): boolean {
    const value = this.getElementValue(pump);
    return value === true || value === 'running' || value === 'RUNNING' || value === 'on' || value === 'ON' || (typeof value === 'number' && value > 0);
  }

  // ============================================================================
  // Status Light Helpers
  // ============================================================================

  protected isStatusLightOn(light: StatusLightElementConfig): boolean {
    const value = this.getElementValue(light);
    return value === true || value === 1 || value === 'on' || value === 'ON' || value === 'true';
  }

  // ============================================================================
  // Label Helpers
  // ============================================================================

  protected getLabelX(label: LabelElementConfig): number {
    const align = label.config.textStyle?.textAlign ?? 'left';
    const padding = label.config.padding ?? 4;

    switch (align) {
      case 'center': return label.size.width / 2;
      case 'right': return label.size.width - padding;
      default: return padding;
    }
  }

  // ============================================================================
  // Custom SVG Helpers
  // ============================================================================

  protected getCustomSvgContent(element: ProcessElement): string {
    const customSvg = this.asCustomSvg(element);
    if (!customSvg) return '';

    // Return the SVG content (sanitization should be handled by Angular)
    return customSvg.config.svgContent;
  }

  // ============================================================================
  // Silo Helpers
  // ============================================================================

  /**
   * Creates SVG path for a silo (cylindrical body with conical bottom)
   */
  protected getSiloPath(silo: SiloElementConfig): string {
    const w = silo.size.width;
    const h = silo.size.height;
    const coneHeight = h * (silo.config.coneAngle ?? 30) / 90;
    const bodyHeight = h - coneHeight;
    const cornerRadius = 5;

    // Path: rounded top rectangle + cone bottom
    return `
      M ${cornerRadius},0
      L ${w - cornerRadius},0
      Q ${w},0 ${w},${cornerRadius}
      L ${w},${bodyHeight}
      L ${w / 2},${h}
      L 0,${bodyHeight}
      L 0,${cornerRadius}
      Q 0,0 ${cornerRadius},0
      Z
    `;
  }

  protected getSiloFillHeight(silo: SiloElementConfig): number {
    const value = this.getElementValue(silo);
    if (typeof value !== 'number') return 0;

    const transform = silo.dataBinding?.transform;
    const max = transform?.max ?? 100;
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return ((silo.size.height - 4) * percentage) / 100;
  }

  protected getSiloFillY(silo: SiloElementConfig): number {
    const fillHeight = this.getSiloFillHeight(silo);
    return silo.size.height - fillHeight - 2;
  }

  // ============================================================================
  // Vessel Helpers
  // ============================================================================

  /**
   * Creates SVG path for a vessel (rounded top options: dome, elliptical, flat)
   */
  protected getVesselPath(vessel: VesselElementConfig): string {
    const w = vessel.size.width;
    const h = vessel.size.height;
    const shape = vessel.config.shape ?? 'round';

    if (shape === 'flat') {
      // Simple rounded rectangle
      return `
        M 5,0
        L ${w - 5},0
        Q ${w},0 ${w},5
        L ${w},${h - 5}
        Q ${w},${h} ${w - 5},${h}
        L 5,${h}
        Q 0,${h} 0,${h - 5}
        L 0,5
        Q 0,0 5,0
        Z
      `;
    }

    // round or dished - both have curved top
    const domeHeight = shape === 'round' ? h * 0.2 : h * 0.15;

    // Path with dome/elliptical top
    return `
      M 0,${domeHeight}
      Q 0,0 ${w / 2},0
      Q ${w},0 ${w},${domeHeight}
      L ${w},${h - 5}
      Q ${w},${h} ${w - 5},${h}
      L 5,${h}
      Q 0,${h} 0,${h - 5}
      Z
    `;
  }

  protected getVesselFillHeight(vessel: VesselElementConfig): number {
    const value = this.getElementValue(vessel);
    if (typeof value !== 'number') return 0;

    const transform = vessel.dataBinding?.transform;
    const max = transform?.max ?? 100;
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return ((vessel.size.height - 4) * percentage) / 100;
  }

  protected getVesselFillY(vessel: VesselElementConfig): number {
    const fillHeight = this.getVesselFillHeight(vessel);
    return vessel.size.height - fillHeight - 2;
  }

  // ============================================================================
  // Motor Helpers
  // ============================================================================

  protected isMotorRunning(motor: MotorElementConfig): boolean {
    const value = this.getElementValue(motor);
    return value === true || value === 'running' || value === 'RUNNING' || value === 'on' || value === 'ON' || (typeof value === 'number' && value > 0);
  }

  // ============================================================================
  // Image Helpers
  // ============================================================================

  protected getImagePreserveAspectRatio(img: ImageElementConfig): string {
    const objectFit = img.config.objectFit ?? 'contain';
    const preserveAspectRatio = img.config.preserveAspectRatio ?? true;

    // Default alignment is center
    const align = 'xMidYMid';

    if (!preserveAspectRatio) {
      return 'none';
    }

    switch (objectFit) {
      case 'contain': return `${align} meet`;
      case 'cover': return `${align} slice`;
      case 'fill': return 'none';
      case 'none': return align;
      default: return `${align} meet`;
    }
  }

  // ============================================================================
  // Gauge Helpers
  // ============================================================================

  /**
   * Creates SVG arc path for arc/semicircle gauge
   */
  protected getGaugeArcPath(gauge: ProcessGaugeElementConfig, isValuePath: boolean): string {
    const w = gauge.size.width;
    const h = gauge.size.height;
    const cx = w / 2;
    const cy = gauge.config.gaugeType === 'semicircle' ? h : h / 2;
    const radius = Math.min(w, h) / 2 - 8;

    const startAngle = gauge.config.gaugeType === 'semicircle' ? 180 : 135;
    const totalAngle = gauge.config.gaugeType === 'semicircle' ? 180 : 270;

    let sweepAngle = totalAngle;

    if (isValuePath) {
      const value = this.getElementValue(gauge);
      if (typeof value !== 'number') return '';

      const transform = gauge.dataBinding?.transform;
      const min = transform?.min ?? gauge.config.min ?? 0;
      const max = transform?.max ?? gauge.config.max ?? 100;
      const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
      sweepAngle = (totalAngle * percentage) / 100;
    }

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = ((startAngle - sweepAngle) * Math.PI) / 180;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy - radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy - radius * Math.sin(endRad);

    const largeArc = sweepAngle > 180 ? 1 : 0;

    return `M ${x1},${y1} A ${radius},${radius} 0 ${largeArc} 1 ${x2},${y2}`;
  }

  /**
   * Calculates fill width for linear gauge
   */
  protected getLinearGaugeFillWidth(gauge: ProcessGaugeElementConfig): number {
    const value = this.getElementValue(gauge);
    if (typeof value !== 'number') return 0;

    const transform = gauge.dataBinding?.transform;
    const min = transform?.min ?? gauge.config.min ?? 0;
    const max = transform?.max ?? gauge.config.max ?? 100;
    const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

    return ((gauge.size.width - 4) * percentage) / 100;
  }

  // ============================================================================
  // Connection Helpers
  // ============================================================================

  protected getConnectionPath(connection: ProcessConnection): string {
    const diagram = this._diagramConfig();
    if (!diagram) return '';

    const fromElement = diagram.elements.find(e => e.id === connection.from.elementId);
    const toElement = diagram.elements.find(e => e.id === connection.to.elementId);

    if (!fromElement || !toElement) return '';

    const fromPoint = this.getPortPosition(fromElement, connection.from.port);
    const toPoint = this.getPortPosition(toElement, connection.to.port);

    // Simple line or path through intermediate points
    if (connection.pathPoints && connection.pathPoints.length > 0) {
      const points = [fromPoint, ...connection.pathPoints, toPoint];
      return `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
    }

    // Direct line
    return `M ${fromPoint.x},${fromPoint.y} L ${toPoint.x},${toPoint.y}`;
  }

  protected getPortPosition(element: ProcessElement, port: string): { x: number; y: number } {
    const x = element.position.x;
    const y = element.position.y;
    const w = element.size.width;
    const h = element.size.height;

    switch (port) {
      case 'top': return { x: x + w/2, y: y };
      case 'bottom': return { x: x + w/2, y: y + h };
      case 'left': return { x: x, y: y + h/2 };
      case 'right': return { x: x + w, y: y + h/2 };
      case 'center':
      default: return { x: x + w/2, y: y + h/2 };
    }
  }

  protected isConnectionFlowActive(connection: ProcessConnection): boolean {
    if (!connection.animation?.enabled) return false;

    const activeWhen = connection.animation.activeWhen ?? 'always';
    if (activeWhen === 'always') return true;

    const runtimeData = this._runtimeState()?.connections.get(connection.id);
    return runtimeData?.flowActive ?? false;
  }

  protected getFlowAnimationDuration(connection: ProcessConnection): string {
    const speed = connection.animation?.speed ?? 1;
    const duration = 2 / speed;
    return `${duration}s`;
  }

  // ============================================================================
  // Primitive Helpers (for Process Designer diagrams)
  // ============================================================================

  /**
   * Gets the transform string for a primitive
   */
  protected getPrimitiveTransform(primitive: PrimitiveBase): string {
    let transform = `translate(${primitive.position.x}, ${primitive.position.y})`;
    if ((primitive as any).rotation) {
      transform += ` rotate(${(primitive as any).rotation})`;
    }
    return transform;
  }

  /**
   * Gets the transform string for a symbol instance
   */
  protected getSymbolTransform(symbolInstance: SymbolInstance): string {
    const pos = symbolInstance.position;
    let transform = `translate(${pos.x}, ${pos.y})`;
    const scale = symbolInstance.scale as { x?: number; y?: number } | number | undefined;
    if (scale) {
      if (typeof scale === 'number') {
        if (scale !== 1) {
          transform += ` scale(${scale})`;
        }
      } else if (scale.x !== undefined || scale.y !== undefined) {
        const sx = scale.x ?? 1;
        const sy = scale.y ?? 1;
        if (sx !== 1 || sy !== 1) {
          transform += ` scale(${sx}, ${sy})`;
        }
      }
    }
    return transform;
  }

  /**
   * Gets primitives for a symbol instance from its definition,
   * with bindings applied if available.
   */
  protected getSymbolPrimitives(symbolInstance: SymbolInstance): PrimitiveBase[] {
    // Look up the definition in the cache using symbolRtId
    const definitions = this._symbolDefinitions();
    const definition = definitions.get(symbolInstance.symbolRtId);

    if (!definition?.primitives) {
      return [];
    }

    // Get property values for this symbol instance
    const propertyValues = this.getSymbolInstancePropertyValues(symbolInstance, definition);

    // If there are bindings, apply them
    let primitives: PrimitiveBase[];
    if (definition.propertyBindings && definition.propertyBindings.length > 0) {
      primitives = this.applyBindingsToPrimitives(
        definition.primitives,
        definition.propertyBindings,
        propertyValues
      );
    } else {
      primitives = [...definition.primitives];
    }

    // Add primitives from nested symbol instances (recursively)
    const nestedInstances = definition.symbolInstances ?? [];
    for (const nestedInst of nestedInstances) {
      const nestedPrimitives = this.getNestedSymbolPrimitives(nestedInst, definition, propertyValues);
      primitives.push(...nestedPrimitives);
    }

    return primitives;
  }

  /**
   * Gets primitives for a nested symbol instance, with position offset applied.
   */
  private getNestedSymbolPrimitives(
    nestedInst: SymbolInstance,
    parentDef: SymbolDefinition,
    parentPropertyValues: Record<string, unknown>
  ): PrimitiveBase[] {
    const definitions = this._symbolDefinitions();
    const nestedDef = definitions.get(nestedInst.symbolRtId);

    if (!nestedDef?.primitives) {
      return [];
    }

    // Calculate property values for the nested instance using "Pass to child property" bindings
    const nestedPropertyValues = this.calculateNestedPropertyValues(
      parentDef,
      nestedInst,
      parentPropertyValues
    );

    // Apply bindings to nested primitives
    let nestedPrimitives: PrimitiveBase[];
    if (nestedDef.propertyBindings && nestedDef.propertyBindings.length > 0) {
      nestedPrimitives = this.applyBindingsToPrimitives(
        nestedDef.primitives,
        nestedDef.propertyBindings,
        nestedPropertyValues
      );
    } else {
      nestedPrimitives = [...nestedDef.primitives];
    }

    // Offset positions by nested instance position
    const offsetX = nestedInst.position?.x ?? 0;
    const offsetY = nestedInst.position?.y ?? 0;

    const offsetPrimitives = nestedPrimitives.map(prim => ({
      ...prim,
      position: {
        x: (prim.position?.x ?? 0) + offsetX,
        y: (prim.position?.y ?? 0) + offsetY
      }
    }));

    // Recursively handle nested instances within the nested symbol
    const deepNestedInstances = nestedDef.symbolInstances ?? [];
    for (const deepNestedInst of deepNestedInstances) {
      const deepPrimitives = this.getNestedSymbolPrimitives(deepNestedInst, nestedDef, nestedPropertyValues);
      // Apply the parent offset to deep nested primitives
      const deepOffsetPrimitives = deepPrimitives.map(prim => ({
        ...prim,
        position: {
          x: (prim.position?.x ?? 0) + offsetX,
          y: (prim.position?.y ?? 0) + offsetY
        }
      }));
      offsetPrimitives.push(...deepOffsetPrimitives);
    }

    return offsetPrimitives;
  }

  /**
   * Calculate property values for a nested symbol instance based on "Pass to child property" bindings.
   */
  private calculateNestedPropertyValues(
    parentDef: SymbolDefinition,
    nestedInst: SymbolInstance,
    parentPropertyValues: Record<string, unknown>
  ): Record<string, unknown> {
    const nestedPropertyValues: Record<string, unknown> = {};

    // Get default values from nested symbol definition
    const definitions = this._symbolDefinitions();
    const nestedDef = definitions.get(nestedInst.symbolRtId);
    if (nestedDef?.transformProperties) {
      for (const prop of nestedDef.transformProperties) {
        nestedPropertyValues[prop.id] = prop.defaultValue;
      }
    }

    // Apply property values from nested instance
    if (nestedInst.propertyValues) {
      Object.assign(nestedPropertyValues, nestedInst.propertyValues);
    }

    // Apply "Pass to child property" bindings from parent
    const passThroughBindings = parentDef.propertyBindings?.filter(
      b => b.effectType === 'property' &&
           b.targetType === 'symbolInstance' &&
           b.targetId === nestedInst.id
    ) ?? [];

    for (const binding of passThroughBindings) {
      const sourceValue = parentPropertyValues[binding.propertyId];
      if (sourceValue !== undefined && binding.targetPropertyId) {
        // Evaluate expression if present
        if (binding.expression) {
          const context: Record<string, number | string | boolean> = {};
          if (typeof sourceValue === 'number' || typeof sourceValue === 'string' || typeof sourceValue === 'boolean') {
            context['value'] = sourceValue;
          }
          const result = this.expressionEvaluator.evaluate(binding.expression, context);
          nestedPropertyValues[binding.targetPropertyId] = result.success ? result.value : sourceValue;
        } else {
          nestedPropertyValues[binding.targetPropertyId] = sourceValue;
        }
      }
    }

    return nestedPropertyValues;
  }

  /**
   * Gets the symbol definition for a symbol instance.
   */
  protected getSymbolDefinition(symbolInstance: SymbolInstance): SymbolDefinition | undefined {
    const definitions = this._symbolDefinitions();
    return definitions.get(symbolInstance.symbolRtId);
  }

  /**
   * Resolves the effective style for a primitive, checking styleClassId first,
   * then falling back to inline style.
   */
  protected resolveStyle(primitive: PrimitiveBase, styleClasses?: StyleClass[]): PrimitiveStyle {
    let classStyle: PrimitiveStyle = {};

    // Check for style class reference
    if ((primitive as any).styleClassId && styleClasses) {
      const styleClass = styleClasses.find(c => c.id === (primitive as any).styleClassId);
      if (styleClass) {
        classStyle = styleClass.style;
      }
    }

    // Merge with inline style (inline overrides class)
    return {
      fill: { ...classStyle.fill, ...primitive.style?.fill },
      stroke: { ...classStyle.stroke, ...primitive.style?.stroke },
      opacity: primitive.style?.opacity ?? classStyle.opacity
    };
  }

  /**
   * Gets fill color for a primitive, resolving style class if needed.
   */
  protected getFillColor(primitive: PrimitiveBase, styleClasses?: StyleClass[], defaultColor = 'none'): string {
    const style = this.resolveStyle(primitive, styleClasses);
    return style.fill?.color || defaultColor;
  }

  /**
   * Gets fill opacity for a primitive, resolving style class if needed.
   */
  protected getFillOpacity(primitive: PrimitiveBase, styleClasses?: StyleClass[], defaultOpacity = 1): number {
    const style = this.resolveStyle(primitive, styleClasses);
    return style.fill?.opacity ?? defaultOpacity;
  }

  /**
   * Gets stroke color for a primitive, resolving style class if needed.
   */
  protected getStrokeColor(primitive: PrimitiveBase, styleClasses?: StyleClass[], defaultColor = 'none'): string {
    const style = this.resolveStyle(primitive, styleClasses);
    return style.stroke?.color || defaultColor;
  }

  /**
   * Gets stroke width for a primitive, resolving style class if needed.
   */
  protected getStrokeWidth(primitive: PrimitiveBase, styleClasses?: StyleClass[], defaultWidth = 1): number {
    const style = this.resolveStyle(primitive, styleClasses);
    return style.stroke?.width ?? defaultWidth;
  }

  /**
   * Gets stroke opacity for a primitive, resolving style class if needed.
   */
  protected getStrokeOpacity(primitive: PrimitiveBase, styleClasses?: StyleClass[], defaultOpacity = 1): number {
    const style = this.resolveStyle(primitive, styleClasses);
    return style.stroke?.opacity ?? defaultOpacity;
  }

  /**
   * Gets property values for a symbol instance.
   * Combines default values with any values passed from parent bindings.
   */
  private getSymbolInstancePropertyValues(
    symbolInstance: SymbolInstance,
    definition: SymbolDefinition
  ): Record<string, unknown> {
    const values: Record<string, unknown> = {};

    // Initialize with default values from transform properties
    for (const prop of definition.transformProperties ?? []) {
      values[prop.id] = prop.defaultValue;
    }

    // Override with values from parent diagram bindings (via 'property' effect type)
    const diagram = this._diagramConfig();
    const boundData = this._boundData();

    if (diagram?.propertyBindings && boundData) {
      // Get parent property values
      const parentPropertyValues = this.buildPropertyValuesFromBoundData(
        diagram.transformProperties ?? [],
        this.config.propertyMappings ?? [],
        boundData
      );

      // Find bindings that pass values to this symbol instance
      const propertyBindings = diagram.propertyBindings.filter(
        b => b.targetType === 'symbolInstance' &&
             b.targetId === symbolInstance.id &&
             b.effectType === 'property' &&
             b.targetPropertyId
      );

      for (const binding of propertyBindings) {
        const parentValue = parentPropertyValues[binding.propertyId];
        if (parentValue === undefined) {
          continue;
        }

        // Build context and evaluate expression
        const context: Record<string, number | string | boolean> = {};
        if (typeof parentValue === 'number' || typeof parentValue === 'string' || typeof parentValue === 'boolean') {
          context['value'] = parentValue;
        }

        const result = this.expressionEvaluator.evaluate(binding.expression, context);
        if (result.success && binding.targetPropertyId) {
          values[binding.targetPropertyId] = result.value;
        }
      }
    }

    return values;
  }

  /**
   * Renders animation SVG content for a primitive.
   * Returns SafeHtml for use with innerHTML binding.
   */
  protected getPrimitiveAnimationHtml(primitive: PrimitiveBase): SafeHtml {
    if (!primitive.animations || primitive.animations.length === 0) {
      return '';
    }

    const bounds = this.getPrimitiveBounds(primitive);
    const animationStates = this.animationEnabledStates();
    const hasBindings = Object.keys(animationStates).length > 0;

    const context: AnimationRenderContext = {
      bounds: {
        x: 0, // Animations are relative to primitive's local coordinate system
        y: 0,
        width: bounds.width,
        height: bounds.height
      },
      animationsEnabled: true,
      propertyValues: {},
      // Use preview mode only if there are NO animation bindings
      previewMode: !hasBindings,
      primitiveId: primitive.id,
      animationEnabledStates: hasBindings ? animationStates : undefined
    };

    const svg = renderAnimations(primitive.animations, context);
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  /**
   * Gets animation enabled states for a symbol instance.
   */
  private getSymbolAnimationStates(symbolInstance: SymbolInstance): Record<string, boolean> {
    const states: Record<string, boolean> = {};
    const definitions = this._symbolDefinitions();
    const definition = definitions.get(symbolInstance.symbolRtId);

    if (!definition?.propertyBindings) {
      return states;
    }

    // Get property values for this symbol
    const propertyValues = this.getSymbolInstancePropertyValues(symbolInstance, definition);

    // Filter animation bindings
    const animationBindings = definition.propertyBindings.filter(
      b => b.effectType === 'animation.enabled' && b.animationId
    );

    for (const binding of animationBindings) {
      const propertyValue = propertyValues[binding.propertyId];

      const context: Record<string, number | string | boolean> = {};
      if (typeof propertyValue === 'number' || typeof propertyValue === 'string' || typeof propertyValue === 'boolean') {
        context['value'] = propertyValue;
      } else {
        context['value'] = 0;
      }

      const result = this.expressionEvaluator.evaluate(binding.expression, context);
      const key = binding.targetId ? `${binding.targetId}:${binding.animationId}` : binding.animationId!;
      states[key] = result.success && Boolean(result.value);
    }

    return states;
  }

  /**
   * Renders animation SVG content for a symbol instance primitive.
   * Returns SafeHtml for use with innerHTML binding.
   */
  protected getSymbolPrimitiveAnimationHtml(primitive: PrimitiveBase, symbolInstance: SymbolInstance): SafeHtml {
    if (!primitive.animations || primitive.animations.length === 0) {
      return '';
    }

    const bounds = this.getPrimitiveBounds(primitive);
    const animationStates = this.getSymbolAnimationStates(symbolInstance);
    const hasBindings = Object.keys(animationStates).length > 0;

    // Generate unique target ID for shape element (used by animations to target via href)
    const targetElementId = `shape-${symbolInstance.id}-${primitive.id}`;

    const context: AnimationRenderContext = {
      bounds: {
        x: 0,
        y: 0,
        width: bounds.width,
        height: bounds.height
      },
      animationsEnabled: true,
      propertyValues: {},
      previewMode: !hasBindings,
      primitiveId: primitive.id,
      animationEnabledStates: hasBindings ? animationStates : undefined,
      targetElementId
    };

    const svg = renderAnimations(primitive.animations, context);
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  /**
   * Renders flow particles animation for line-based primitives.
   * Returns SafeHtml for use with innerHTML binding.
   */
  protected getFlowParticlesHtml(primitive: PrimitiveBase, symbolInstance: SymbolInstance): SafeHtml {
    if (!primitive.animations || primitive.animations.length === 0) {
      return '';
    }

    const flowParticles = getFlowParticlesAnimation(primitive.animations);
    if (!flowParticles) {
      return '';
    }

    // Check if animation is enabled
    const animationStates = this.getSymbolAnimationStates(symbolInstance);
    const hasBindings = Object.keys(animationStates).length > 0;
    const key = `${primitive.id}:${flowParticles.definition.id}`;
    const isEnabled = hasBindings ? (animationStates[key] ?? animationStates[flowParticles.definition.id] ?? true) : true;

    // Build path data based on primitive type
    let pathData = '';
    const config = (primitive as any).config;

    switch (primitive.type) {
      case 'line':
        pathData = `M ${config.start.x},${config.start.y} L ${config.end.x},${config.end.y}`;
        break;

      case 'polyline':
        if (config.points && config.points.length > 0) {
          const points = config.points as { x: number; y: number }[];
          pathData = 'M ' + points.map((p: { x: number; y: number }) =>
            `${p.x + (primitive.position?.x ?? 0)},${p.y + (primitive.position?.y ?? 0)}`
          ).join(' L ');
        }
        break;

      case 'path':
        pathData = config.d || '';
        break;

      default:
        return '';
    }

    if (!pathData) {
      return '';
    }

    // Get stroke color for particles
    const stroke = primitive.style?.stroke?.color || '#00ff00';

    const svg = renderFlowParticles(flowParticles.animation, pathData, stroke, isEnabled);
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  /**
   * Checks if a primitive has a flow particles animation.
   */
  protected hasFlowParticles(primitive: PrimitiveBase): boolean {
    if (!primitive.animations || primitive.animations.length === 0) {
      return false;
    }
    return getFlowParticlesAnimation(primitive.animations) !== null;
  }

  /**
   * Checks if a primitive has a fillLevel set (for tank/battery visualization).
   */
  protected hasFillLevel(primitive: PrimitiveBase): boolean {
    const config = (primitive as any).config;
    return config?.fillLevel !== undefined && config.fillLevel >= 0 && config.fillLevel <= 1;
  }

  /**
   * Renders a rectangle with fillLevel clip-path for tank/battery visualization.
   */
  protected getRectangleWithFillLevelHtml(
    primitive: PrimitiveBase,
    symbolInstance: SymbolInstance,
    styleClasses?: StyleClass[]
  ): SafeHtml {
    const config = (primitive as any).config;
    const fillLevel = config.fillLevel ?? 0;
    const width = config.width ?? 100;
    const height = config.height ?? 100;
    const cornerRadius = config.cornerRadius ?? 0;

    const clipId = `fill-clip-${symbolInstance.id}-${primitive.id}`;
    const shapeId = this.getSymbolShapeId(symbolInstance, primitive);

    // Calculate clip rect (fillLevel 0 = empty, 1 = full)
    // Clip from bottom, so clipY starts from (1 - fillLevel) * height
    const clipY = height * (1 - fillLevel);
    const clipHeight = height * fillLevel;

    const fill = this.getFillColor(primitive, styleClasses);
    const fillOpacity = this.getFillOpacity(primitive, styleClasses);
    const stroke = this.getStrokeColor(primitive, styleClasses);
    const strokeWidth = this.getStrokeWidth(primitive, styleClasses, 0);
    const strokeOpacity = this.getStrokeOpacity(primitive, styleClasses);
    const strokeDashArray = this.getStrokeDashArray(primitive.style?.stroke?.dashArray);

    const svg = `
      <defs>
        <clipPath id="${clipId}">
          <rect x="0" y="${clipY}" width="${width}" height="${clipHeight}"/>
        </clipPath>
      </defs>
      <rect
        id="${shapeId}"
        x="0" y="0"
        width="${width}" height="${height}"
        rx="${cornerRadius}"
        fill="${fill}"
        fill-opacity="${fillOpacity}"
        stroke="${stroke}"
        stroke-width="${strokeWidth}"
        stroke-opacity="${strokeOpacity}"
        ${strokeDashArray ? `stroke-dasharray="${strokeDashArray}"` : ''}
        clip-path="url(#${clipId})"/>
    `;

    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  /**
   * Gets the unique ID for a shape element within a symbol instance.
   * Used to target the shape via href in animations.
   */
  protected getSymbolShapeId(symbolInstance: SymbolInstance, primitive: PrimitiveBase): string {
    return `shape-${symbolInstance.id}-${primitive.id}`;
  }

  /**
   * Gets top-level primitives for a symbol (excludes children of groups).
   */
  protected getTopLevelSymbolPrimitives(symbolInstance: SymbolInstance): PrimitiveBase[] {
    const allPrimitives = this.getSymbolPrimitives(symbolInstance);

    // Collect all child IDs from groups
    const childIds = new Set<string>();
    for (const prim of allPrimitives) {
      if (prim.type === 'group') {
        const groupConfig = (prim as any).config;
        if (groupConfig?.childIds) {
          for (const childId of groupConfig.childIds) {
            childIds.add(childId);
          }
        }
      }
    }

    // Return only primitives that are not children of a group
    return allPrimitives.filter(p => !childIds.has(p.id));
  }

  /**
   * Gets children of a group primitive from the symbol's primitives.
   */
  protected getGroupChildPrimitives(symbolInstance: SymbolInstance, groupPrimitive: PrimitiveBase): PrimitiveBase[] {
    const allPrimitives = this.getSymbolPrimitives(symbolInstance);
    const groupConfig = (groupPrimitive as any).config;
    const childIds = groupConfig?.childIds ?? [];

    // Return primitives that match the childIds, preserving order
    const childMap = new Map<string, PrimitiveBase>();
    for (const prim of allPrimitives) {
      if (childIds.includes(prim.id)) {
        childMap.set(prim.id, prim);
      }
    }

    // Return in the order specified by childIds
    return childIds
      .map((id: string) => childMap.get(id))
      .filter((p: PrimitiveBase | undefined): p is PrimitiveBase => p !== undefined);
  }

  /**
   * Checks if a primitive is a group.
   */
  protected isGroup(primitive: PrimitiveBase): boolean {
    return primitive.type === 'group';
  }

  /**
   * Gets line coordinates adjusted for group offset.
   * When a line is inside a group, its absolute coordinates need to be
   * converted to coordinates relative to the group's position.
   */
  protected getGroupChildLineCoords(child: PrimitiveBase, groupPrimitive: PrimitiveBase): { x1: number; y1: number; x2: number; y2: number } {
    const config = (child as any).config;
    const groupPos = groupPrimitive.position;
    return {
      x1: config.start.x - groupPos.x,
      y1: config.start.y - groupPos.y,
      x2: config.end.x - groupPos.x,
      y2: config.end.y - groupPos.y
    };
  }

  /**
   * Gets polygon/polyline points adjusted for group offset.
   */
  protected getGroupChildPoints(child: PrimitiveBase, groupPrimitive: PrimitiveBase): string {
    const config = (child as any).config;
    const groupPos = groupPrimitive.position;
    const childPos = child.position;
    const points = config?.points ?? [];
    return points.map((p: { x: number; y: number }) =>
      `${p.x + childPos.x - groupPos.x},${p.y + childPos.y - groupPos.y}`
    ).join(' ');
  }

  /**
   * Gets the transform for a child element inside a group.
   * Adjusts the position relative to the group's position.
   *
   * For coordinate-based primitives (line, polyline, polygon), coordinates
   * are adjusted directly via getGroupChildLineCoords/getGroupChildPoints,
   * so no additional wrapper transform is needed.
   */
  protected getGroupChildTransform(child: PrimitiveBase, groupPrimitive: PrimitiveBase): string {
    // For primitives that use config coordinates (line, polyline, polygon),
    // we adjust the coordinates directly, so no wrapper transform needed
    if (child.type === 'line' || child.type === 'polyline' || child.type === 'polygon') {
      return '';
    }

    // For position-based primitives (rectangle, ellipse, text, image, path, group)
    const groupPos = groupPrimitive.position;
    const childPos = child.position;
    const relX = childPos.x - groupPos.x;
    const relY = childPos.y - groupPos.y;
    return `translate(${relX}, ${relY})`;
  }

  /**
   * Converts polyline points array to SVG points string
   */
  protected getPolylinePoints(primitive: { config: { points: { x: number; y: number }[] } }): string {
    const points = primitive.config?.points ?? [];
    return points.map(p => `${p.x},${p.y}`).join(' ');
  }

  /**
   * Converts polygon points array to SVG points string
   */
  protected getPolygonPoints(primitive: { config: { points: { x: number; y: number }[] } }): string {
    const points = primitive.config?.points ?? [];
    return points.map(p => `${p.x},${p.y}`).join(' ');
  }

  /**
   * Gets stroke dash array string for SVG
   */
  protected getStrokeDashArray(dashArray: number[] | undefined): string {
    if (!dashArray || dashArray.length === 0) {
      return '';
    }
    return dashArray.join(' ');
  }

  /**
   * Check if a primitive has a stroke-dashoffset animation (flow animation)
   */
  protected hasStrokeDashOffsetAnimation(primitive: PrimitiveBase): boolean {
    if (!primitive.animations || primitive.animations.length === 0) {
      return false;
    }
    return primitive.animations.some(def =>
      def.animation.type === 'animate' &&
      (def.animation as AttributeAnimation).attributeName === 'stroke-dashoffset'
    );
  }

  /**
   * Gets effective stroke dash array for primitives, considering flow animations.
   * For stroke-dashoffset animations to work, the element needs a stroke-dasharray.
   * If none is configured but a flow animation exists, use a default pattern.
   */
  protected getEffectiveStrokeDashArray(primitive: PrimitiveBase): string {
    const configuredDashArray = this.getStrokeDashArray(primitive.style?.stroke?.dashArray);

    // If dashArray is already configured, use it
    if (configuredDashArray) {
      return configuredDashArray;
    }

    // If no dashArray but has stroke-dashoffset animation, use default pattern
    if (this.hasStrokeDashOffsetAnimation(primitive)) {
      return '10 5';
    }

    return '';
  }

  /**
   * Calculate bounding box for a group primitive based on its children
   */
  protected getGroupBounds(prim: PrimitiveBase): { x: number; y: number; width: number; height: number } {
    const children = (prim as any).config?.children as PrimitiveBase[] | undefined;
    if (!children || children.length === 0) {
      return { x: prim.position.x, y: prim.position.y, width: 100, height: 100 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const child of children) {
      const childBounds = this.getPrimitiveBounds(child);
      minX = Math.min(minX, childBounds.x);
      minY = Math.min(minY, childBounds.y);
      maxX = Math.max(maxX, childBounds.x + childBounds.width);
      maxY = Math.max(maxY, childBounds.y + childBounds.height);
    }

    if (minX === Infinity) {
      return { x: prim.position.x, y: prim.position.y, width: 100, height: 100 };
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Get bounds for a primitive
   */
  protected getPrimitiveBounds(prim: PrimitiveBase): { x: number; y: number; width: number; height: number } {
    const pos = prim.position;
    const config = (prim as any).config;

    switch (prim.type) {
      case 'rectangle':
        return { x: pos.x, y: pos.y, width: config.width ?? 100, height: config.height ?? 100 };
      case 'ellipse':
        return { x: pos.x, y: pos.y, width: (config.rx ?? 50) * 2, height: (config.ry ?? 50) * 2 };
      case 'line': {
        const lineMinX = Math.min(config.start?.x ?? 0, config.end?.x ?? 0);
        const lineMaxX = Math.max(config.start?.x ?? 0, config.end?.x ?? 0);
        const lineMinY = Math.min(config.start?.y ?? 0, config.end?.y ?? 0);
        const lineMaxY = Math.max(config.start?.y ?? 0, config.end?.y ?? 0);
        return { x: pos.x + lineMinX, y: pos.y + lineMinY, width: lineMaxX - lineMinX || 1, height: lineMaxY - lineMinY || 1 };
      }
      case 'text':
        return { x: pos.x, y: pos.y, width: config.width ?? 100, height: config.fontSize ?? 14 };
      case 'group':
        return this.getGroupBounds(prim);
      default:
        return { x: pos.x, y: pos.y, width: 50, height: 50 };
    }
  }

  // ============================================================================
  // Runtime Binding Helpers
  // ============================================================================

  /**
   * Builds property values from bound data using the configured mappings.
   * Maps diagram exposed properties to values from entity attributes or query columns.
   * Applies optional expressions for value transformation/normalization.
   */
  private buildPropertyValuesFromBoundData(
    transformProperties: TransformProperty[],
    mappings: DiagramPropertyMapping[],
    boundData: BoundDataResult
  ): Record<string, unknown> {
    const values: Record<string, unknown> = {};

    // Initialize with default values from transform properties
    for (const prop of transformProperties) {
      values[prop.id] = prop.defaultValue;
    }

    // Apply mappings
    for (const mapping of mappings) {
      const prop = transformProperties.find(p => p.id === mapping.propertyId);
      if (!prop) continue;

      let rawValue: unknown = undefined;

      if (mapping.sourceType === 'attribute' && boundData.type === 'entity' && boundData.entity) {
        // Extract value from entity attribute
        rawValue = this.extractAttributeValue(boundData.entity, mapping.sourcePath);
      } else if (mapping.sourceType === 'column' && boundData.type === 'query' && boundData.queryResult) {
        // Extract value from query result (first row)
        rawValue = this.extractQueryColumnValue(boundData.queryResult, mapping.sourcePath);
      }

      if (rawValue !== undefined) {
        let finalValue: unknown = rawValue;

        // Apply expression transformation if defined
        if (mapping.expression && mapping.expression.trim()) {
          try {
            // Build expression context with 'value' as the input
            const context: Record<string, number | string | boolean> = {
              value: this.toPrimitiveValue(rawValue)
            };

            // Evaluate expression
            const result = this.expressionEvaluator.evaluate(mapping.expression, context);
            if (result.success) {
              finalValue = result.value;
            } else {
              console.warn(`[ProcessWidget] Expression evaluation failed for ${mapping.propertyId}:`, result.error);
            }
          } catch (err) {
            console.warn(`[ProcessWidget] Expression error for ${mapping.propertyId}:`, err);
          }
        }

        // Convert to expected type
        values[mapping.propertyId] = this.coerceToType(finalValue, prop.type);
      }
    }

    return values;
  }

  /**
   * Converts an unknown value to a primitive type for expression evaluation.
   */
  private toPrimitiveValue(value: unknown): number | string | boolean {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Try to parse as number if it looks numeric
      const parsed = parseFloat(value);
      return isNaN(parsed) ? value : parsed;
    }
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined) return 0;
    return String(value);
  }

  /**
   * Extracts a value from an entity's attributes by path.
   * Supports nested paths like "properties.temperature"
   */
  private extractAttributeValue(entity: RuntimeEntityData, path: string): unknown {
    if (!entity.attributes) return undefined;

    // First try direct match
    const directMatch = entity.attributes.find(a => a.attributeName === path);
    if (directMatch) return directMatch.value;

    // Try nested path
    const parts = path.split('.');
    const rootAttr = entity.attributes.find(a => a.attributeName === parts[0]);
    if (!rootAttr) return undefined;

    let value: unknown = rootAttr.value;
    for (let i = 1; i < parts.length; i++) {
      if (typeof value === 'object' && value !== null && parts[i] in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[parts[i]];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Extracts a column value from query results (first row).
   */
  private extractQueryColumnValue(queryResult: QueryResultData, columnName: string): unknown {
    if (!queryResult.rows || queryResult.rows.length === 0) return undefined;

    const firstRow = queryResult.rows[0];
    // Try both the column name and sanitized version (dots -> underscores)
    const value = firstRow.cells.get(columnName) ?? firstRow.cells.get(columnName.replace(/\./g, '_'));
    return value;
  }

  /**
   * Coerces a value to the expected type.
   */
  private coerceToType(value: unknown, type: string): unknown {
    switch (type) {
      case 'number':
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;

      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value.toLowerCase() === 'true';
        if (typeof value === 'number') return value !== 0;
        return false;

      case 'string':
        return String(value ?? '');

      default:
        return value;
    }
  }

  /**
   * Applies property bindings to primitives.
   * Creates clones of primitives with binding effects applied.
   */
  private applyBindingsToPrimitives(
    primitives: PrimitiveBase[],
    bindings: PropertyBinding[],
    propertyValues: Record<string, unknown>
  ): PrimitiveBase[] {
    return primitives.map(primitive => {
      // Find bindings for this primitive
      const primitiveBindings = bindings.filter(
        b => b.targetType === 'primitive' && b.targetId === primitive.id
      );

      if (primitiveBindings.length === 0) {
        return primitive;
      }

      // Clone the primitive to apply bindings
      let modified = this.clonePrimitive(primitive);

      for (const binding of primitiveBindings) {
        const propertyValue = propertyValues[binding.propertyId];
        if (propertyValue === undefined) continue;

        // Build expression context
        const context: Record<string, number | string | boolean> = {};
        if (typeof propertyValue === 'number' || typeof propertyValue === 'string' || typeof propertyValue === 'boolean') {
          context['value'] = propertyValue;
        }

        // Evaluate expression
        const result = this.expressionEvaluator.evaluate(
          binding.expression,
          context
        );

        // Apply the effect if evaluation succeeded
        if (result.success && result.value !== undefined) {
          modified = this.applyBindingEffect(modified, binding.effectType, result.value);
        }
      }

      return modified;
    });
  }

  /**
   * Creates a deep clone of a primitive.
   */
  private clonePrimitive(primitive: PrimitiveBase): PrimitiveBase {
    return JSON.parse(JSON.stringify(primitive));
  }

  /**
   * Applies a binding effect to a primitive.
   */
  private applyBindingEffect(
    primitive: PrimitiveBase,
    effectType: string,
    value: unknown
  ): PrimitiveBase {
    const p = primitive as any;

    switch (effectType) {
      case 'transform.rotation':
        p.rotation = typeof value === 'number' ? value : 0;
        break;

      case 'transform.offsetX':
        if (typeof value === 'number') {
          p.position = { ...p.position, x: p.position.x + value };
        }
        break;

      case 'transform.offsetY':
        if (typeof value === 'number') {
          p.position = { ...p.position, y: p.position.y + value };
        }
        break;

      case 'transform.scale':
        if (typeof value === 'number') {
          p.scale = value;
        }
        break;

      case 'style.fill.color':
        if (!p.style) p.style = {};
        if (!p.style.fill) p.style.fill = {};
        p.style.fill.color = String(value);
        break;

      case 'style.fill.opacity':
        if (!p.style) p.style = {};
        if (!p.style.fill) p.style.fill = {};
        p.style.fill.opacity = typeof value === 'number' ? value : 1;
        break;

      case 'style.stroke.color':
        if (!p.style) p.style = {};
        if (!p.style.stroke) p.style.stroke = {};
        p.style.stroke.color = String(value);
        break;

      case 'style.stroke.opacity':
        if (!p.style) p.style = {};
        if (!p.style.stroke) p.style.stroke = {};
        p.style.stroke.opacity = typeof value === 'number' ? value : 1;
        break;

      case 'style.opacity':
        if (!p.style) p.style = {};
        p.style.opacity = typeof value === 'number' ? value : 1;
        break;

      case 'visible':
        p.visible = Boolean(value);
        break;

      case 'fillLevel':
        // fillLevel is stored in config for rendering
        if (!p.config) p.config = {};
        p.config.fillLevel = typeof value === 'number' ? Math.max(0, Math.min(1, value)) : 0;
        break;

      case 'dimension.width':
        if (!p.config) p.config = {};
        if (typeof value === 'number') {
          p.config.width = value;
        }
        break;

      case 'dimension.height':
        if (!p.config) p.config = {};
        if (typeof value === 'number') {
          p.config.height = value;
        }
        break;
    }

    return primitive;
  }
}
