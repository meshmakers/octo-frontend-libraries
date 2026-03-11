import {
  Component,
  ElementRef,
  EventEmitter,
  Injector,
  Input,
  Output,
  Type,
  ViewChild,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  EnvironmentInjector,
  inject,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ApplicationRef,
  createComponent,
  ComponentRef,
  NgZone
} from '@angular/core';
import {
  createDockview,
  DockviewApi,
  DockviewDidDropEvent,
  DockviewWillDropEvent,
  IContentRenderer,
  GroupPanelPartInitParameters,
  DockviewComponentOptions,
  CreateComponentOptions,
  PROPERTY_KEYS_DOCKVIEW
} from 'dockview-core';

/**
 * Ready event emitted when dockview is initialized
 */
export interface DockviewReadyEvent {
  api: DockviewApi;
}

/**
 * Panel component that will be dynamically created
 */
export interface DockviewPanelApi {
  readonly id: string;
  readonly title: string | undefined;
  readonly params: Record<string, unknown>;
}

/**
 * Interface for dockview panel components
 */
export interface IDockviewPanelProps {
  api: DockviewPanelApi;
  containerApi: DockviewApi;
  params: Record<string, unknown>;
}

/**
 * Native Angular wrapper for dockview-core
 * Provides the same functionality as dockview-angular but with proper Ivy compatibility
 */
@Component({
  selector: 'mm-dockview',
  standalone: true,
  template: '<div #dockviewContainer class="dv-dockview-container"></div>',
  styleUrls: ['./dockview.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DockviewComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('dockviewContainer', { static: true })
  private containerRef!: ElementRef<HTMLElement>;

  @Input() components!: Record<string, Type<IDockviewPanelProps>>;
  @Input() tabComponents?: Record<string, Type<unknown>>;
  @Input() watermarkComponent?: Type<unknown>;
  @Input() defaultTabComponent?: Type<unknown>;
  @Input() leftHeaderActionsComponent?: Type<unknown>;
  @Input() rightHeaderActionsComponent?: Type<unknown>;
  @Input() prefixHeaderActionsComponent?: Type<unknown>;

  // Dockview core options (from DockviewOptions)
  @Input() className?: string;
  @Input() hideBorders?: boolean;
  @Input() locked?: boolean;
  @Input() disableAutoResizing?: boolean;
  @Input() disableFloatingGroups?: boolean;

  @Output() ready = new EventEmitter<DockviewReadyEvent>();
  @Output() didDrop = new EventEmitter<DockviewDidDropEvent>();
  @Output() willDrop = new EventEmitter<DockviewWillDropEvent>();

  private dockviewApi?: DockviewApi;
  private componentRefs = new Map<string, ComponentRef<IDockviewPanelProps>>();
  private disposables: (() => void)[] = [];

  private readonly injector = inject(Injector);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly appRef = inject(ApplicationRef);
  private readonly ngZone = inject(NgZone);

  ngOnInit(): void {
    // Initialize dockview outside Angular zone to prevent zone.js from
    // interfering with dockview's native event handling
    this.ngZone.runOutsideAngular(() => {
      this.initializeDockview();
    });
  }

  ngOnDestroy(): void {
    this.disposables.forEach(d => d());
    this.disposables = [];

    this.componentRefs.forEach(ref => ref.destroy());
    this.componentRefs.clear();

    if (this.dockviewApi) {
      this.dockviewApi.dispose();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.dockviewApi) {
      const updateOptions: Record<string, unknown> = {};
      let hasChanges = false;

      // Only update properties that are valid dockview options
      PROPERTY_KEYS_DOCKVIEW.forEach(key => {
        if (changes[key] && !changes[key].isFirstChange()) {
          updateOptions[key] = changes[key].currentValue;
          hasChanges = true;
        }
      });

      if (hasChanges) {
        this.dockviewApi.updateOptions(updateOptions);
      }
    }
  }

  getDockviewApi(): DockviewApi | undefined {
    return this.dockviewApi;
  }

  private initializeDockview(): void {
    if (!this.components) {
      throw new Error('DockviewComponent: components input is required');
    }

    const options: DockviewComponentOptions = {
      hideBorders: this.hideBorders,
      locked: this.locked,
      disableAutoResizing: this.disableAutoResizing,
      disableFloatingGroups: this.disableFloatingGroups,
      className: this.className,
      createComponent: (opts: CreateComponentOptions) => this.createPanelComponent(opts)
    };

    this.dockviewApi = createDockview(this.containerRef.nativeElement, options);
    this.setupEventListeners();

    // Emit ready event inside Angular zone
    this.ngZone.run(() => {
      this.ready.emit({ api: this.dockviewApi! });
    });
  }

  private createPanelComponent(options: CreateComponentOptions): IContentRenderer {
    const componentType = this.components[options.name];

    if (!componentType) {
      console.warn(`DockviewComponent: No component found for "${options.name}"`);
      return this.createEmptyRenderer();
    }

    const element = document.createElement('div');
    element.style.width = '100%';
    element.style.height = '100%';
    element.style.overflow = 'auto';

    let componentRef: ComponentRef<IDockviewPanelProps> | null = null;

    return {
      element,
      init: (params: GroupPanelPartInitParameters) => {
        // Create component inside Angular zone for proper change detection
        this.ngZone.run(() => {
          componentRef = createComponent(componentType, {
            environmentInjector: this.environmentInjector,
            elementInjector: this.injector,
            hostElement: element
          });

          // Set inputs for the panel component
          const instance = componentRef.instance as IDockviewPanelProps;
          if (instance) {
            instance.params = params.params ?? {};
            instance.api = {
              id: params.api.id,
              title: params.api.title,
              params: params.params ?? {}
            };
            instance.containerApi = this.dockviewApi!;
          }

          this.appRef.attachView(componentRef.hostView);
          this.componentRefs.set(options.id, componentRef);
        });
      },
      update: (params: GroupPanelPartInitParameters) => {
        // Update params if component exists
        if (componentRef) {
          this.ngZone.run(() => {
            const instance = componentRef!.instance as IDockviewPanelProps;
            if (instance) {
              instance.params = params.params ?? {};
            }
          });
        }
      },
      focus: () => {
        // Focus the element when panel becomes active
        element.focus();
      },
      dispose: () => {
        const ref = this.componentRefs.get(options.id);
        if (ref) {
          this.ngZone.run(() => {
            this.appRef.detachView(ref.hostView);
            ref.destroy();
            this.componentRefs.delete(options.id);
          });
        }
      }
    };
  }

  private createEmptyRenderer(): IContentRenderer {
    const element = document.createElement('div');
    element.textContent = 'Component not found';
    element.style.padding = '16px';
    element.style.color = '#666';
    return {
      element,
      init: () => { /* no-op */ },
      dispose: () => { /* no-op */ }
    };
  }

  private setupEventListeners(): void {
    if (!this.dockviewApi) return;

    const api = this.dockviewApi;

    // Always set up drop event listeners
    const didDropDisposable = api.onDidDrop(event => {
      this.ngZone.run(() => {
        this.didDrop.emit(event);
      });
    });
    this.disposables.push(() => didDropDisposable.dispose());

    const willDropDisposable = api.onWillDrop(event => {
      this.ngZone.run(() => {
        this.willDrop.emit(event);
      });
    });
    this.disposables.push(() => willDropDisposable.dispose());
  }
}
