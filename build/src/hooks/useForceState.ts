/**
 * A hook that forces state updates to work correctly
 * Uses a combination of state and ref to ensure updates always persist
 */

import { useState, useCallback, useRef } from 'react';

export function useForceState<T>(initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [trigger, setTrigger] = useState(0);
  const valueRef = useRef<T>(initialValue);
  
  const setValue = useCallback((newValue: T | ((prev: T) => T)) => {
    const actualValue = typeof newValue === 'function' 
      ? (newValue as (prev: T) => T)(valueRef.current)
      : newValue;
    
    console.log('🔥 useForceState: Setting value:', {
      oldValue: typeof valueRef.current === 'string' ? (valueRef.current as any).substring(0, 50) : 'not-string',
      newValue: typeof actualValue === 'string' ? (actualValue as any).substring(0, 50) : 'not-string',
      newLength: typeof actualValue === 'string' ? (actualValue as any).length : 'not-string'
    });
    
    valueRef.current = actualValue;
    
    // Force a re-render
    setTrigger(prev => {
      console.log('🔥 useForceState: Forcing re-render, old trigger:', prev, 'new trigger:', prev + 1);
      return prev + 1;
    });
  }, []);
  
  console.log('🔥 useForceState: Returning value:', {
    valueLength: typeof valueRef.current === 'string' ? (valueRef.current as any).length : 'not-string',
    trigger
  });
  
  return [valueRef.current, setValue];
}