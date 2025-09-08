/**
 * Custom hook for managing undo/redo history
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';

interface UndoRedoState<T> {
  value: T;
  setValue: (value: T, saveToHistory?: boolean) => void;
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
  const [value, setValueInternal] = useState<T>(initialValue);
  const [history, setHistory] = useState<T[]>([initialValue]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isInternalUpdate = useRef(false);
  const pendingValue = useRef<T | null>(null);
  
  // Debug: Log state changes
  useEffect(() => {
    console.log('🔧 useUndoRedo: value state changed:', {
      valueLength: typeof value === 'string' ? (value as string).length : 'not-string',
      preview: typeof value === 'string' ? (value as string).substring(0, 50) : 'not-string'
    });
  }, [value]);
  
  // Use refs to store values that callbacks need, avoiding recreating them
  const currentIndexRef = useRef(currentIndex);
  const maxHistorySizeRef = useRef(maxHistorySize);
  const valueRef = useRef(value);
  const historyRef = useRef(history);
  
  // Keep refs updated
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);
  
  useEffect(() => {
    maxHistorySizeRef.current = maxHistorySize;
  }, [maxHistorySize]);
  
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Save current value to history (creating a checkpoint)
  const saveCheckpoint = useCallback(() => {
    setHistory(prev => {
      const newHistory = prev.slice(0, currentIndexRef.current + 1);
      newHistory.push(valueRef.current);
      
      // Limit history size
      if (newHistory.length > maxHistorySizeRef.current) {
        newHistory.shift();
        return newHistory;
      }
      
      return newHistory;
    });
    setCurrentIndex(prev => Math.min(prev + 1, maxHistorySizeRef.current - 1));
  }, []);

  // Set value with optional history tracking - now stable
  const setValue = useCallback((newValue: T | ((prev: T) => T), saveToHistory: boolean = true) => {
    console.log('🔧 useUndoRedo setValue called:', { 
      saveToHistory, 
      isInternalUpdate: isInternalUpdate.current,
      isFunction: typeof newValue === 'function',
      valueLength: typeof newValue === 'string' ? (newValue as string).length : 'not-string'
    });
    
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      if (typeof newValue === 'function') {
        setValueInternal(prev => (newValue as (prev: T) => T)(prev));
      } else {
        setValueInternal(newValue);
      }
      return;
    }

    // Handle both function and direct value forms
    if (typeof newValue === 'function') {
      // For function form, we need to resolve the value first
      let resolvedValue: T;
      setValueInternal(prev => {
        resolvedValue = (newValue as (prev: T) => T)(prev);
        
        // Update refs immediately
        valueRef.current = resolvedValue;
        
        if (saveToHistory) {
          // Schedule history update
          Promise.resolve().then(() => {
            setHistory(prevHistory => {
              const currentIdx = currentIndexRef.current;
              const newHistory = prevHistory.slice(0, currentIdx + 1);
              newHistory.push(resolvedValue);
              
              if (newHistory.length > maxHistorySizeRef.current) {
                newHistory.shift();
              }
              return newHistory;
            });
            
            setCurrentIndex(prevIndex => Math.min(prevIndex + 1, maxHistorySizeRef.current - 1));
          });
        }
        
        return resolvedValue;
      });
    } else {
      // For direct value, update state and refs immediately
      console.log('🔧 useUndoRedo: Setting value internally (direct):', {
        valueLength: typeof newValue === 'string' ? newValue.length : 'not-string',
        preview: typeof newValue === 'string' ? (newValue as string).substring(0, 50) : 'not-string'
      });
      
      // Update refs immediately
      valueRef.current = newValue;
      
      // Update state
      setValueInternal(newValue);
      
      console.log('🔧 useUndoRedo: After setValueInternal, will update history');
      
      if (saveToHistory) {
        // Use Promise.resolve to ensure this runs after the current update cycle
        Promise.resolve().then(() => {
          setHistory(prevHistory => {
            const currentIdx = currentIndexRef.current;
            const newHistory = prevHistory.slice(0, currentIdx + 1);
            newHistory.push(newValue);
            
            if (newHistory.length > maxHistorySizeRef.current) {
              newHistory.shift();
            }
            return newHistory;
          });
          
          setCurrentIndex(prevIndex => Math.min(prevIndex + 1, maxHistorySizeRef.current - 1));
        });
      }
    }
  }, []);

  // Undo to previous state - now stable
  const undo = useCallback(() => {
    if (currentIndexRef.current > 0) {
      const newIndex = currentIndexRef.current - 1;
      setCurrentIndex(newIndex);
      isInternalUpdate.current = true;
      setValueInternal(historyRef.current[newIndex]);
    }
  }, []);

  // Redo to next state - now stable
  const redo = useCallback(() => {
    if (currentIndexRef.current < historyRef.current.length - 1) {
      const newIndex = currentIndexRef.current + 1;
      setCurrentIndex(newIndex);
      isInternalUpdate.current = true;
      setValueInternal(historyRef.current[newIndex]);
    }
  }, []);

  // Clear all history - now stable
  const clearHistory = useCallback(() => {
    setHistory([valueRef.current]);
    setCurrentIndex(0);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl+Shift+Z or Cmd+Shift+Z for redo
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      // Ctrl+Y or Cmd+Y for redo
      else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

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