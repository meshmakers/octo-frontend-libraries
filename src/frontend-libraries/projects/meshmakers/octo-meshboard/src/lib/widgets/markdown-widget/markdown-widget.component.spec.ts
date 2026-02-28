import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { MarkdownWidgetComponent } from './markdown-widget.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { MarkdownWidgetConfig, MeshBoardVariable } from '../../models/meshboard.models';

// Mock the markdown component to avoid ngx-markdown dependency in tests
@Component({
  selector: 'mm-mock-markdown',
  template: '<div class="mock-markdown">{{ data }}</div>',
  standalone: true
})
class MockMarkdownComponent {
  data = '';
}

// Mock the widget-not-configured component
@Component({
  selector: 'mm-mock-widget-not-configured',
  template: '<div class="mock-not-configured">{{ message }}</div>',
  standalone: true
})
class MockWidgetNotConfiguredComponent {
  message = '';
}

describe('MarkdownWidgetComponent', () => {
  let component: MarkdownWidgetComponent;
  let fixture: ComponentFixture<MarkdownWidgetComponent>;
  let stateServiceSpy: jasmine.SpyObj<MeshBoardStateService>;
  let variableServiceSpy: jasmine.SpyObj<MeshBoardVariableService>;

  const createMockConfig = (overrides: Partial<MarkdownWidgetConfig> = {}): MarkdownWidgetConfig => ({
    id: 'markdown-1',
    type: 'markdown',
    title: 'Test Markdown',
    col: 1,
    row: 1,
    colSpan: 2,
    rowSpan: 2,
    dataSource: { type: 'static', data: null },
    content: '# Hello World\n\nThis is **markdown** content.',
    resolveVariables: false,
    padding: '16px',
    textAlign: 'left',
    ...overrides
  });

  beforeEach(async () => {
    stateServiceSpy = jasmine.createSpyObj('MeshBoardStateService', ['getVariables']);
    variableServiceSpy = jasmine.createSpyObj('MeshBoardVariableService', ['resolveVariables']);

    stateServiceSpy.getVariables.and.returnValue([]);
    variableServiceSpy.resolveVariables.and.callFake((text: string) => text);

    await TestBed.configureTestingModule({
      imports: [MarkdownWidgetComponent],
      providers: [
        { provide: MeshBoardStateService, useValue: stateServiceSpy },
        { provide: MeshBoardVariableService, useValue: variableServiceSpy }
      ]
    })
      .overrideComponent(MarkdownWidgetComponent, {
        remove: { imports: [] },
        add: { imports: [MockMarkdownComponent, MockWidgetNotConfiguredComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(MarkdownWidgetComponent);
    component = fixture.componentInstance;
  });

  // ========================================================================
  // Basic Component Tests
  // ========================================================================

  describe('initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should have initial loading state as false', () => {
      expect(component.isLoading()).toBeFalse();
    });

    it('should have initial data as null', () => {
      expect(component.data()).toBeNull();
    });

    it('should have initial error as null', () => {
      expect(component.error()).toBeNull();
    });
  });

  // ========================================================================
  // Configuration Tests
  // ========================================================================

  describe('configuration', () => {
    it('should detect when widget is not configured (no content)', () => {
      component.config = createMockConfig({ content: '' });
      expect(component.isNotConfigured()).toBeTrue();
    });

    it('should detect when widget is not configured (whitespace only)', () => {
      component.config = createMockConfig({ content: '   ' });
      expect(component.isNotConfigured()).toBeTrue();
    });

    it('should detect when widget is not configured (undefined content)', () => {
      component.config = createMockConfig({ content: undefined as unknown as string });
      expect(component.isNotConfigured()).toBeTrue();
    });

    it('should detect when widget is configured', () => {
      component.config = createMockConfig({ content: '# Title' });
      expect(component.isNotConfigured()).toBeFalse();
    });

    it('should set data on init', () => {
      component.config = createMockConfig({ content: 'Test content' });
      component.ngOnInit();
      expect(component.data()).toBe('Test content');
    });

    it('should update data on config change', () => {
      component.config = createMockConfig({ content: 'Initial content' });
      component.ngOnInit();
      expect(component.data()).toBe('Initial content');

      component.config = createMockConfig({ content: 'Updated content' });
      component.ngOnChanges({
        config: {
          currentValue: component.config,
          previousValue: createMockConfig({ content: 'Initial content' }),
          firstChange: false,
          isFirstChange: () => false
        }
      });
      expect(component.data()).toBe('Updated content');
    });

    it('should not update data on first change (handled by ngOnInit)', () => {
      component.config = createMockConfig({ content: 'Test content' });
      component.ngOnChanges({
        config: {
          currentValue: component.config,
          previousValue: undefined,
          firstChange: true,
          isFirstChange: () => true
        }
      });
      // Data should still be null because ngOnInit wasn't called
      expect(component.data()).toBeNull();
    });
  });

  // ========================================================================
  // Container Style Tests
  // ========================================================================

  describe('containerStyle', () => {
    it('should return default padding and alignment', () => {
      component.config = createMockConfig({
        padding: undefined,
        textAlign: undefined
      });

      const style = component.containerStyle();
      expect(style.padding).toBe('16px');
      expect(style.textAlign).toBe('left');
    });

    it('should return custom padding', () => {
      component.config = createMockConfig({ padding: '24px' });
      const style = component.containerStyle();
      expect(style.padding).toBe('24px');
    });

    it('should return custom text alignment', () => {
      component.config = createMockConfig({ textAlign: 'center' });
      const style = component.containerStyle();
      expect(style.textAlign).toBe('center');
    });

    it('should return right alignment', () => {
      component.config = createMockConfig({ textAlign: 'right' });
      const style = component.containerStyle();
      expect(style.textAlign).toBe('right');
    });
  });

  // ========================================================================
  // Variable Resolution Tests
  // ========================================================================

  describe('variable resolution', () => {
    it('should not resolve variables when resolveVariables is false', () => {
      component.config = createMockConfig({
        content: 'Hello $name',
        resolveVariables: false
      });

      const resolved = component.resolvedContent();
      expect(resolved).toBe('Hello $name');
      expect(variableServiceSpy.resolveVariables).not.toHaveBeenCalled();
    });

    it('should resolve variables when resolveVariables is true', () => {
      const variables: MeshBoardVariable[] = [
        { name: 'name', type: 'string', source: 'static', value: 'World' }
      ];
      stateServiceSpy.getVariables.and.returnValue(variables);
      variableServiceSpy.resolveVariables.and.returnValue('Hello World');

      component.config = createMockConfig({
        content: 'Hello $name',
        resolveVariables: true
      });

      const resolved = component.resolvedContent();
      expect(resolved).toBe('Hello World');
      expect(variableServiceSpy.resolveVariables).toHaveBeenCalledWith('Hello $name', variables);
    });

    it('should return empty string when content is empty', () => {
      component.config = createMockConfig({
        content: '',
        resolveVariables: true
      });

      const resolved = component.resolvedContent();
      expect(resolved).toBe('');
      expect(variableServiceSpy.resolveVariables).not.toHaveBeenCalled();
    });

    it('should handle undefined content gracefully', () => {
      component.config = createMockConfig({
        content: undefined as unknown as string,
        resolveVariables: true
      });

      const resolved = component.resolvedContent();
      expect(resolved).toBe('');
    });
  });

  // ========================================================================
  // Refresh Tests
  // ========================================================================

  describe('refresh', () => {
    it('should update data on refresh', () => {
      component.config = createMockConfig({ content: 'Initial' });
      component.ngOnInit();
      expect(component.data()).toBe('Initial');

      component.config = createMockConfig({ content: 'Refreshed' });
      component.refresh();
      expect(component.data()).toBe('Refreshed');
    });

    it('should handle empty content on refresh', () => {
      component.config = createMockConfig({ content: '' });
      component.refresh();
      expect(component.data()).toBe('');
    });
  });

  // ========================================================================
  // DashboardWidget Interface Tests
  // ========================================================================

  describe('DashboardWidget interface', () => {
    it('should implement isLoading signal', () => {
      expect(component.isLoading).toBeDefined();
      expect(typeof component.isLoading()).toBe('boolean');
    });

    it('should implement data signal', () => {
      expect(component.data).toBeDefined();
    });

    it('should implement error signal', () => {
      expect(component.error).toBeDefined();
    });

    it('should implement refresh method', () => {
      expect(component.refresh).toBeDefined();
      expect(typeof component.refresh).toBe('function');
    });
  });
});
