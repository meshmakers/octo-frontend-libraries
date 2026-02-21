import { TestBed } from '@angular/core/testing';
import { DesignerHistoryService } from './designer-history.service';

interface TestState {
  id: string;
  value: number;
}

describe('DesignerHistoryService', () => {
  let service: DesignerHistoryService<TestState>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesignerHistoryService]
    });
    service = TestBed.inject(DesignerHistoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initialization', () => {
    it('should initialize with empty history', () => {
      expect(service.historyLength()).toBe(0);
      expect(service.currentIndex()).toBe(-1);
      expect(service.canUndo()).toBeFalse();
      expect(service.canRedo()).toBeFalse();
    });

    it('should initialize with provided state', () => {
      const initialState: TestState = { id: 'test', value: 1 };
      service.initialize(initialState);

      expect(service.historyLength()).toBe(1);
      expect(service.currentIndex()).toBe(0);
      expect(service.canUndo()).toBeFalse();
      expect(service.canRedo()).toBeFalse();
    });

    it('should deep clone state on initialize', () => {
      const initialState: TestState = { id: 'test', value: 1 };
      service.initialize(initialState);

      // Modify original
      initialState.value = 999;

      // History should have the original value
      const current = service.getCurrentState();
      expect(current?.value).toBe(1);
    });
  });

  describe('push', () => {
    beforeEach(() => {
      service.initialize({ id: 'initial', value: 0 });
    });

    it('should push state to history', () => {
      service.push({ id: 'second', value: 1 });

      expect(service.historyLength()).toBe(2);
      expect(service.currentIndex()).toBe(1);
    });

    it('should deep clone state on push', () => {
      const state: TestState = { id: 'test', value: 42 };
      service.push(state);

      // Modify original
      state.value = 999;

      // History should have the original value
      const current = service.getCurrentState();
      expect(current?.value).toBe(42);
    });

    it('should clear redo stack on new push', () => {
      service.push({ id: 'second', value: 1 });
      service.push({ id: 'third', value: 2 });

      // Undo twice
      service.undo();
      service.undo();
      expect(service.canRedo()).toBeTrue();

      // Push new state - should clear redo
      service.push({ id: 'new', value: 99 });

      expect(service.canRedo()).toBeFalse();
      expect(service.historyLength()).toBe(2); // initial + new
    });

    it('should limit history to maxSize (50)', () => {
      // Push 60 states (1 initial + 59 pushes = 60 total, should be limited to 50)
      for (let i = 1; i <= 59; i++) {
        service.push({ id: `state-${i}`, value: i });
      }

      expect(service.historyLength()).toBe(50);
    });
  });

  describe('undo', () => {
    beforeEach(() => {
      service.initialize({ id: 'state-0', value: 0 });
      service.push({ id: 'state-1', value: 1 });
      service.push({ id: 'state-2', value: 2 });
    });

    it('should undo to previous state', () => {
      const previousState = service.undo();

      expect(previousState).toEqual({ id: 'state-1', value: 1 });
      expect(service.currentIndex()).toBe(1);
    });

    it('should return null when cannot undo', () => {
      service.undo(); // to state-1
      service.undo(); // to state-0

      const result = service.undo(); // cannot undo further

      expect(result).toBeNull();
      expect(service.currentIndex()).toBe(0);
    });

    it('should enable redo after undo', () => {
      expect(service.canRedo()).toBeFalse();

      service.undo();

      expect(service.canRedo()).toBeTrue();
    });

    it('should return deep cloned state', () => {
      const undoneState = service.undo();

      if (undoneState) {
        undoneState.value = 999;
      }

      // Original history should be unchanged
      const current = service.getCurrentState();
      expect(current?.value).toBe(1);
    });
  });

  describe('redo', () => {
    beforeEach(() => {
      service.initialize({ id: 'state-0', value: 0 });
      service.push({ id: 'state-1', value: 1 });
      service.push({ id: 'state-2', value: 2 });
      service.undo(); // Now at state-1
    });

    it('should redo to next state', () => {
      const nextState = service.redo();

      expect(nextState).toEqual({ id: 'state-2', value: 2 });
      expect(service.currentIndex()).toBe(2);
    });

    it('should return null when cannot redo', () => {
      service.redo(); // to state-2

      const result = service.redo(); // cannot redo further

      expect(result).toBeNull();
      expect(service.currentIndex()).toBe(2);
    });

    it('should return deep cloned state', () => {
      const redoneState = service.redo();

      if (redoneState) {
        redoneState.value = 999;
      }

      // Original history should be unchanged
      const current = service.getCurrentState();
      expect(current?.value).toBe(2);
    });
  });

  describe('canUndo/canRedo signals', () => {
    it('should report canUndo correctly', () => {
      expect(service.canUndo()).toBeFalse();

      service.initialize({ id: 'initial', value: 0 });
      expect(service.canUndo()).toBeFalse(); // Only one state

      service.push({ id: 'second', value: 1 });
      expect(service.canUndo()).toBeTrue(); // Two states, can undo

      service.undo();
      expect(service.canUndo()).toBeFalse(); // At first state
    });

    it('should report canRedo correctly', () => {
      service.initialize({ id: 'initial', value: 0 });
      service.push({ id: 'second', value: 1 });

      expect(service.canRedo()).toBeFalse(); // At latest state

      service.undo();
      expect(service.canRedo()).toBeTrue(); // After undo

      service.redo();
      expect(service.canRedo()).toBeFalse(); // Back at latest
    });
  });

  describe('getCurrentState', () => {
    it('should return null for empty history', () => {
      expect(service.getCurrentState()).toBeNull();
    });

    it('should return current state', () => {
      service.initialize({ id: 'test', value: 42 });

      const current = service.getCurrentState();

      expect(current).toEqual({ id: 'test', value: 42 });
    });

    it('should return deep cloned state', () => {
      service.initialize({ id: 'test', value: 42 });

      const current = service.getCurrentState();
      if (current) {
        current.value = 999;
      }

      // Original should be unchanged
      expect(service.getCurrentState()?.value).toBe(42);
    });
  });

  describe('clear', () => {
    it('should clear all history', () => {
      service.initialize({ id: 'initial', value: 0 });
      service.push({ id: 'second', value: 1 });

      service.clear();

      expect(service.historyLength()).toBe(0);
      expect(service.currentIndex()).toBe(-1);
      expect(service.canUndo()).toBeFalse();
      expect(service.canRedo()).toBeFalse();
    });
  });

  describe('reset', () => {
    it('should reset with new initial state', () => {
      service.initialize({ id: 'old', value: 0 });
      service.push({ id: 'older', value: 1 });

      service.reset({ id: 'new', value: 99 });

      expect(service.historyLength()).toBe(1);
      expect(service.currentIndex()).toBe(0);
      expect(service.getCurrentState()).toEqual({ id: 'new', value: 99 });
    });
  });

  describe('complex scenarios', () => {
    it('should handle undo-push-redo scenario correctly', () => {
      service.initialize({ id: 'state-0', value: 0 });
      service.push({ id: 'state-1', value: 1 });
      service.push({ id: 'state-2', value: 2 });

      // Undo to state-1
      service.undo();
      expect(service.getCurrentState()?.id).toBe('state-1');

      // Push new state (should clear state-2)
      service.push({ id: 'state-new', value: 99 });
      expect(service.historyLength()).toBe(3);

      // Cannot redo anymore
      expect(service.canRedo()).toBeFalse();

      // Current state should be the new one
      expect(service.getCurrentState()?.id).toBe('state-new');
    });

    it('should handle multiple undo/redo cycles', () => {
      service.initialize({ id: 'state-0', value: 0 });
      service.push({ id: 'state-1', value: 1 });
      service.push({ id: 'state-2', value: 2 });

      // Cycle 1: undo to start, redo to end
      service.undo();
      service.undo();
      expect(service.getCurrentState()?.id).toBe('state-0');

      service.redo();
      service.redo();
      expect(service.getCurrentState()?.id).toBe('state-2');

      // Cycle 2: partial undo/redo
      service.undo();
      expect(service.getCurrentState()?.id).toBe('state-1');

      service.redo();
      expect(service.getCurrentState()?.id).toBe('state-2');
    });
  });
});
