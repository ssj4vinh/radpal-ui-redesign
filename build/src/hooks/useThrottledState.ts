import { useState, useCallback, useRef } from 'react'

export function useThrottledState<T>(initialValue: T, delay: number = 16) {
  const [value, setValue] = useState(initialValue)
  const lastRun = useRef(Date.now())
  
  const setThrottledValue = useCallback((newValue: T) => {
    const now = Date.now()
    if (now - lastRun.current >= delay) {
      setValue(newValue)
      lastRun.current = now
    }
  }, [delay])
  
  return [value, setThrottledValue] as const
}