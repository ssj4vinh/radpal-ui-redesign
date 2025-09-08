import { useMemo } from 'react'

export function useStyles() {
  const dynamicStyles = useMemo(() => ({
    textareaStyle: {
      width: '100%',
      height: '40vh',
      minHeight: 200,
      maxHeight: '50vh',
      padding: '16px 40px 16px 16px',
      backgroundColor: 'transparent',
      color: '#fff',
      border: 'none',
      borderRadius: 16,
      resize: 'none' as const,
      fontSize: 14,
      outline: 'none',
      fontFamily: 'DM Sans, sans-serif'
    },
    
    modalButtonStyle: {
      padding: '6px 12px',
      border: 'none',
      borderRadius: 16,
      fontSize: 14,
      fontWeight: 300,
      transition: 'all 0.2s ease'
    },
    
    tokenBarStyle: (width: number) => ({
      width: '100%',
      height: width < 600 ? 8 : width < 800 ? 10 : 12,
      backgroundColor: 'rgba(42, 45, 49, 0.6)',
      borderRadius: (width < 600 ? 8 : width < 800 ? 10 : 12) / 2,
      border: 'none',
      overflow: 'hidden' as const,
      position: 'relative' as const
    }),
    
    tokenFillStyle: (width: number, percentage: number) => ({
      width: `${Math.min(percentage || 0, 100)}%`,
      height: '100%',
      backgroundColor: (percentage || 0) > 90 ? '#E36756' : 
                     (percentage || 0) > 75 ? '#E1865D' : '#3ABC96',
      transition: 'all 0.3s ease',
      borderRadius: `${(width < 600 ? 8 : width < 800 ? 10 : 12) / 2}px 0 0 ${(width < 600 ? 8 : width < 800 ? 10 : 12) / 2}px`
    })
  }), [])
  
  return dynamicStyles
}