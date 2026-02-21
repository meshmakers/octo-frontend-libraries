import { Observable } from 'rxjs';

/**
 * Result from checking if a name is available
 */
export interface NameAvailabilityResult {
  /** Whether the name is available */
  isAvailable: boolean;

  /** Optional message to display (e.g., "Name already exists") */
  message?: string;
}

/**
 * Interface for Save As dialog data sources.
 * Provides name validation functionality.
 */
export interface SaveAsDialogDataSource {
  /**
   * Check if a name is available (not already taken)
   * @param name The name to check
   * @returns Observable of availability result
   */
  checkNameAvailability(name: string): Observable<NameAvailabilityResult>;
}

/**
 * Options for opening the Save As dialog
 */
export interface SaveAsDialogOptions {
  /** Dialog title */
  title: string;

  /** Label for the name input field */
  nameLabel?: string;

  /** Placeholder text for the name input */
  placeholder?: string;

  /** Suggested/default name */
  suggestedName?: string;

  /** Text for the save button */
  saveButtonText?: string;

  /** Text for the cancel button */
  cancelButtonText?: string;

  /** Minimum name length (default: 1) */
  minLength?: number;

  /** Maximum name length (default: 255) */
  maxLength?: number;

  /** Regex pattern for name validation */
  pattern?: RegExp;

  /** Error message when pattern doesn't match */
  patternErrorMessage?: string;

  /** Dialog width (default: 450) */
  width?: number;

  /** Data source for checking name availability (optional) */
  dataSource?: SaveAsDialogDataSource;

  /** Debounce time in ms for name availability check (default: 300) */
  debounceTime?: number;
}

/**
 * Result returned from the Save As dialog
 */
export interface SaveAsDialogResult {
  /** Whether the user confirmed (clicked Save) */
  confirmed: boolean;

  /** The entered name (only set if confirmed) */
  name?: string;
}
