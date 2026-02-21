/**
 * Dockview Panel Components
 *
 * Wrapper components for the Process Designer panels,
 * designed to work with dockview-angular layout manager.
 */

// Panel Components
export { ElementsPanelComponent } from './elements-panel.component';
export type { ElementsPanelParams } from './elements-panel.component';

export { SymbolsPanelComponent } from './symbols-panel.component';
export type { SymbolsPanelParams } from './symbols-panel.component';

export { PropertiesPanelComponent } from './properties-panel.component';
export type { PropertiesPanelParams } from './properties-panel.component';

export { TransformPanelComponent } from './transform-panel.component';
export type { TransformPanelParams } from './transform-panel.component';

export { AnimationsPanelComponent } from './animations-panel.component';
export type { AnimationsPanelParams } from './animations-panel.component';

export { SimulationPanelWrapperComponent } from './simulation-panel.component';
export type { SimulationPanelParams } from './simulation-panel.component';

export { SettingsPanelComponent } from './settings-panel.component';

export { StylesPanelComponent } from './styles-panel.component';

// Re-export types from wrapped components for convenience
export type { PaletteItem } from '../element-palette.component';
export type { SymbolPaletteItem } from '../symbol-library-panel.component';
export type { PropertyChangeEvent } from '../property-inspector.component';
export type { AnimationChangeEvent } from '../animation-editor.component';
export type { TransformPropertyChangeEvent } from '../transform-property-editor.component';
export type { SimulationValueChange } from '../simulation-panel.component';
