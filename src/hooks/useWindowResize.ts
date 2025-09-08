import { useState, useEffect, useCallback } from 'react'

export function useWindowResize() {
  // Load saved dimensions from localStorage or use current window size
  const getSavedDimensions = () => {
    try {
      const saved = localStorage.getItem('radpal_window_dimensions')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Validate the saved dimensions are reasonable
        if (parsed.width > 200 && parsed.height > 100) {
          return {
            width: parsed.width,
            height: parsed.height,
            isContracted: parsed.height <= 110
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load saved window dimensions:', error)
    }
    
    // Fallback to current window size
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      isContracted: window.innerHeight <= 110
    }
  }

  const [dimensions, setDimensions] = useState(getSavedDimensions())

  const saveDimensions = useCallback((width: number, height: number) => {
    try {
      localStorage.setItem('radpal_window_dimensions', JSON.stringify({
        width,
        height,
        timestamp: Date.now()
      }))
    } catch (error) {
      console.warn('Failed to save window dimensions:', error)
    }
  }, [])

  const updateDimensions = useCallback(() => {
    const newDimensions = {
      width: window.innerWidth,
      height: window.innerHeight,
      isContracted: window.innerHeight <= 110
    }
    
    setDimensions(newDimensions)
    saveDimensions(newDimensions.width, newDimensions.height)
  }, [saveDimensions])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const debouncedResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(updateDimensions, 150)
    }

    // Set initial dimensions and save them
    updateDimensions()
    window.addEventListener('resize', debouncedResize)
    
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', debouncedResize)
    }
  }, [updateDimensions])

  // Window size is now restored in the main process on startup
  // No need to send resize command from here anymore

  return dimensions
}