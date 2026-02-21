/*
 * Public API Surface of @meshmakers/octo-process-diagrams
 */

// Core Models
export * from './lib/process-widget.models';

// Primitives (models, renderers, registry)
export * from './lib/primitives';

// Services
export { SymbolLibraryService } from './lib/services/symbol-library.service';
export type { SymbolLibrarySummary, SymbolDefinitionSummary } from './lib/services/symbol-library.service';
export { SvgImportService } from './lib/services/svg-import.service';
export type { SvgImportOptions, SvgImportResult } from './lib/services/svg-import.service';
export { ProcessDiagramDataService } from './lib/services/process-diagram-data.service';
export type { ProcessDiagramSummary } from './lib/services/process-diagram-data.service';
export { ExpressionEvaluatorService } from './lib/services/expression-evaluator.service';
export type { ExpressionContext, ExpressionResult, ValidationResult } from './lib/services/expression-evaluator.service';

// Designer Components
export { ProcessDesignerComponent } from './lib/designer/process-designer.component';
export type { DesignerMode } from './lib/designer/process-designer.component';
export { ElementPaletteComponent } from './lib/designer/element-palette.component';
export { PropertyInspectorComponent } from './lib/designer/property-inspector.component';
export type { PropertyChangeEvent } from './lib/designer/property-inspector.component';
export { SymbolLibraryPanelComponent } from './lib/designer/symbol-library-panel.component';
export type { SymbolPaletteItem } from './lib/designer/symbol-library-panel.component';
export { ContextMenuComponent } from './lib/designer/context-menu.component';
export { PathEditorComponent } from './lib/designer/path-editor.component';
export { TransformPropertyEditorComponent } from './lib/designer/transform-property-editor.component';
export type { TransformPropertyChangeEvent } from './lib/designer/transform-property-editor.component';
export { BindingEditorDialogComponent } from './lib/designer/binding-editor-dialog.component';
export { SimulationPanelComponent } from './lib/designer/simulation-panel.component';
export type { SimulationValueChange } from './lib/designer/simulation-panel.component';

// Path Editor Service
export { PathEditorService } from './lib/designer/services/path-editor.service';
export type {
  PathPoint,
  PathCommandType,
  PathSegment,
  PathNode,
  ParsedPath,
  MoveToSegment,
  LineToSegment,
  CubicBezierSegment,
  QuadraticBezierSegment,
  ArcSegment
} from './lib/designer/services/path-editor.service';

// Designer Services
export { DesignerSelectionService } from './lib/designer/services/designer-selection.service';
export type { SelectionState, SelectionRect } from './lib/designer/services/designer-selection.service';
export { DesignerHistoryService } from './lib/designer/services/designer-history.service';
export { DesignerClipboardService } from './lib/designer/services/designer-clipboard.service';
export type { ClipboardData, PasteResult } from './lib/designer/services/designer-clipboard.service';

// Dockview Component and Types
export { DockviewComponent } from './lib/designer/dockview/dockview.component';
export type { DockviewReadyEvent, DockviewPanelApi, IDockviewPanelProps } from './lib/designer/dockview/dockview.component';

// Dockview Panel Components
export * from './lib/designer/panels';

// Layout Service
export { DesignerLayoutService } from './lib/designer/services/designer-layout.service';
export type { DesignerPanelConfig, DesignerPanelType } from './lib/designer/services/designer-layout.service';

// Admin Components
export { SymbolLibraryAdminComponent } from './lib/admin/symbol-library-admin.component';
export { SymbolEditorComponent } from './lib/admin/symbol-editor.component';

// Page Components (for routing in consuming apps)
export { SymbolLibraryListComponent } from './lib/pages/symbol-library-list/symbol-library-list.component';
export { SymbolLibraryDetailComponent } from './lib/pages/symbol-library-detail/symbol-library-detail.component';
export { SymbolEditorPageComponent } from './lib/pages/symbol-editor-page/symbol-editor-page.component';
export { SymbolLibraryDataSourceDirective } from './lib/pages/data-sources/symbol-library-data-source.directive';
export { ProcessDiagramListComponent } from './lib/pages/process-diagram-list/process-diagram-list.component';
export { ProcessDiagramDataSourceDirective } from './lib/pages/data-sources/process-diagram-data-source.directive';

// GraphQL Services - Process Diagrams
export { GetProcessDiagramsDtoGQL } from './lib/graphQL/getProcessDiagrams';
export type { GetProcessDiagramsQueryDto, GetProcessDiagramsQueryVariablesDto } from './lib/graphQL/getProcessDiagrams';
export { GetProcessDiagramDtoGQL } from './lib/graphQL/getProcessDiagram';
export type { GetProcessDiagramQueryDto, GetProcessDiagramQueryVariablesDto } from './lib/graphQL/getProcessDiagram';
export { CreateProcessDiagramDtoGQL } from './lib/graphQL/createProcessDiagram';
export type { CreateProcessDiagramMutationDto, CreateProcessDiagramMutationVariablesDto } from './lib/graphQL/createProcessDiagram';
export { UpdateProcessDiagramDtoGQL } from './lib/graphQL/updateProcessDiagram';
export type { UpdateProcessDiagramMutationDto, UpdateProcessDiagramMutationVariablesDto } from './lib/graphQL/updateProcessDiagram';
export { DeleteProcessDiagramDtoGQL } from './lib/graphQL/deleteProcessDiagram';
export type { DeleteProcessDiagramMutationDto, DeleteProcessDiagramMutationVariablesDto } from './lib/graphQL/deleteProcessDiagram';

// GraphQL Services - Symbol Libraries
export { GetSymbolLibrariesDtoGQL } from './lib/graphQL/getSymbolLibraries';
export type { GetSymbolLibrariesQueryDto, GetSymbolLibrariesQueryVariablesDto } from './lib/graphQL/getSymbolLibraries';
export { GetSymbolLibraryDtoGQL } from './lib/graphQL/getSymbolLibrary';
export type { GetSymbolLibraryQueryDto, GetSymbolLibraryQueryVariablesDto } from './lib/graphQL/getSymbolLibrary';
export { CreateSymbolLibraryDtoGQL } from './lib/graphQL/createSymbolLibrary';
export type { CreateSymbolLibraryMutationDto, CreateSymbolLibraryMutationVariablesDto } from './lib/graphQL/createSymbolLibrary';
export { UpdateSymbolLibraryDtoGQL } from './lib/graphQL/updateSymbolLibrary';
export type { UpdateSymbolLibraryMutationDto, UpdateSymbolLibraryMutationVariablesDto } from './lib/graphQL/updateSymbolLibrary';

// GraphQL Services - Symbol Definitions
export { GetSymbolDefinitionsDtoGQL } from './lib/graphQL/getSymbolDefinitions';
export type { GetSymbolDefinitionsQueryDto, GetSymbolDefinitionsQueryVariablesDto } from './lib/graphQL/getSymbolDefinitions';
export { GetSymbolDefinitionDtoGQL } from './lib/graphQL/getSymbolDefinition';
export type { GetSymbolDefinitionQueryDto, GetSymbolDefinitionQueryVariablesDto } from './lib/graphQL/getSymbolDefinition';
export { CreateSymbolDefinitionDtoGQL } from './lib/graphQL/createSymbolDefinition';
export type { CreateSymbolDefinitionMutationDto, CreateSymbolDefinitionMutationVariablesDto } from './lib/graphQL/createSymbolDefinition';
export { UpdateSymbolDefinitionDtoGQL } from './lib/graphQL/updateSymbolDefinition';
export type { UpdateSymbolDefinitionMutationDto, UpdateSymbolDefinitionMutationVariablesDto } from './lib/graphQL/updateSymbolDefinition';
