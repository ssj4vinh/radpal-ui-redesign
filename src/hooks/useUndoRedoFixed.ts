/**
 * Fixed undo/redo hook that actually persists state
 */

import { useState, useCallback, useRef, useEffect } from 'react';

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
  // Use regular useState - this is the KEY
  const [value, setValueState] = useState<T>(initialValue);
  const [history, setHistory] = useState<T[]>([initialValue]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Set value with optional history tracking
  const setValue = useCallback((
    newValue: T | ((prev: T) => T), 
    saveToHistory: boolean = true
  ) => {
    console.log('🚀 FIXED setValue called');
    
    // Get the actual new value
    const actualValue = typeof newValue === 'function' 
      ? (newValue as (prev: T) => T)(value)
      : newValue;
    
    console.log('🚀 FIXED: Actual value to set:', {
      oldLength: typeof value === 'string' ? value.length : 0,
      newLength: typeof actualValue === 'string' ? actualValue.length : 0,
      preview: typeof actualValue === 'string' ? actualValue.substring(0, 50) : 'not-string',
      fullActualValue: actualValue
    });
    
    // Update state directly
    setValueState(actualValue);
    console.log('🚀 FIXED: Called setValueState with value length:', typeof actualValue === 'string' ? actualValue.length : 'not-string');
    
    // Update history if needed
    if (saveToHistory) {
      setHistory(prevHistory => {
        const newHistory = [...prevHistory.slice(0, currentIndex + 1), actualValue];
        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
          return newHistory;
        }
        return newHistory;
      });
      setCurrentIndex(prev => {
        const newHistory = [...history.slice(0, prev + 1), actualValue];
        if (newHistory.length > maxHistorySize) {
          return prev; // Index stays same after shift
        }
        return prev + 1;
      });
    }
  }, [value, currentIndex, history, maxHistorySize]);

  // Undo to previous state
  const undo = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      setValueState(history[newIndex]);
    }
  }, [currentIndex, history]);

  // Redo to next state
  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      setValueState(history[newIndex]);
    }
  }, [currentIndex, history]);

  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([value]);
    setCurrentIndex(0);
  }, [value]);

  // Save checkpoint
  const saveCheckpoint = useCallback(() => {
    setHistory(prev => {
      const newHistory = [...prev.slice(0, currentIndex + 1), value];
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
      }
      return newHistory;
    });
    setCurrentIndex(prev => prev + 1);
  }, [value, currentIndex, maxHistorySize]);

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
    console.log('🚀 FIXED: value changed in useEffect:', {
      valueLength: typeof value === 'string' ? value.length : 'not-string',
      preview: typeof value === 'string' ? value.substring(0, 50) : 'not-string'
    });
  }, [value]);

  return {
    value,
    setValue,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    clearHistory,
    saveCheckpoint
  };
}