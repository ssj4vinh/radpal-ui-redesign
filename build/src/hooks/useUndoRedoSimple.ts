/**
 * Simplified undo/redo hook that actually works
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
  const [value, setValueState] = useState<T>(initialValue);
  const [history, setHistory] = useState<T[]>([initialValue]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [, forceUpdate] = useState({});

  // Set value with optional history tracking - SIMPLIFIED
  const setValue = useCallback((
    newValue: T | ((prev: T) => T), 
    saveToHistory: boolean = true
  ) => {
    console.log('🔧 SIMPLIFIED setValue called with:', {
      type: typeof newValue,
      valueIfString: typeof newValue === 'string' ? newValue.substring(0, 100) : 'not-string'
    });
    
    // Just set the value directly - no complications
    setValueState(newValue as any);
    
    // Update history later if needed
    if (saveToHistory) {
      setTimeout(() => {
        setHistory(prev => {
          const currentVal = typeof newValue === 'function' ? value : newValue;
          return [...prev.slice(0, currentIndex + 1), currentVal];
        });
        setCurrentIndex(prev => prev + 1);
      }, 10);
    }
  }, [currentIndex, value]);

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

  // Clear all history
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
    console.log('🔧 Simple useUndoRedo: value changed:', {
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