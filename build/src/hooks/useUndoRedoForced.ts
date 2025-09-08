/**
 * Undo/redo hook using forced state updates
 */

import { useCallback, useRef, useEffect } from 'react';
import { useForceState } from './useForceState';

interface UndoRedoState<T> {
  value: T;
  setValue: (value: T | ((prev: T) => T), saveToHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
  saveCheckpoint: () => void;
}

export function useUndoRedo<T>(
  initialValue: T,
  maxHistorySize: number = 50
): UndoRedoState<T> {
  const [value, setValueInternal] = useForceState<T>(initialValue);
  const historyRef = useRef<T[]>([initialValue]);
  const currentIndexRef = useRef(0);

  // Set value with optional history tracking
  const setValue = useCallback((
    newValue: T | ((prev: T) => T), 
    saveToHistory: boolean = true
  ) => {
    console.log('🎯 useUndoRedoForced setValue called');
    
    // Update the value using forced state
    setValueInternal(newValue);
    
    // Update history if needed
    if (saveToHistory) {
      const actualValue = typeof newValue === 'function' 
        ? (newValue as (prev: T) => T)(value)
        : newValue;
      
      const newHistory = [...historyRef.current.slice(0, currentIndexRef.current + 1), actualValue];
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
      }
      historyRef.current = newHistory;
      currentIndexRef.current = newHistory.length - 1;
    }
  }, [value, setValueInternal, maxHistorySize]);

  // Undo to previous state
  const undo = useCallback(() => {
    if (currentIndexRef.current > 0) {
      currentIndexRef.current--;
      setValueInternal(historyRef.current[currentIndexRef.current]);
    }
  }, [setValueInternal]);

  // Redo to next state
  const redo = useCallback(() => {
    if (currentIndexRef.current < historyRef.current.length - 1) {
      currentIndexRef.current++;
      setValueInternal(historyRef.current[currentIndexRef.current]);
    }
  }, [setValueInternal]);

  // Clear all history
  const clearHistory = useCallback(() => {
    historyRef.current = [value];
    currentIndexRef.current = 0;
  }, [value]);

  // Save checkpoint
  const saveCheckpoint = useCallback(() => {
    const newHistory = [...historyRef.current.slice(0, currentIndexRef.current + 1), value];
    if (newHistory.length > maxHistorySize) {
      newHistory.shift();
    }
    historyRef.current = newHistory;
    currentIndexRef.current = newHistory.length - 1;
  }, [value, maxHistorySize]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Debug logging
  useEffect(() => {
    console.log('🎯 useUndoRedoForced: value changed:', {
      valueLength: typeof value === 'string' ? value.length : 'not-string',
      preview: typeof value === 'string' ? value.substring(0, 50) : 'not-string'
    });
  }, [value]);

  return {
    value,
    setValue,
    undo,
    redo,
    canUndo: currentIndexRef.current > 0,
    canRedo: currentIndexRef.current < historyRef.current.length - 1,
    clearHistory,
    saveCheckpoint
  };
}