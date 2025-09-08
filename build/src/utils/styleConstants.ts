export const buttonStyles = {
  primary: {
    padding: '10px 20px',
    backgroundColor: '#3ABC96',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: 'none',
    borderRadius: 16,
    fontSize: 14,
    fontWeight: 300,
    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
    color: '#FFFFFF',
    boxShadow: 'none',
    width: 120,
    transition: 'all 0.3s ease',
    transform: 'scale(1)'
  },
  
  primaryHover: {
    backgroundColor: '#2a9b7a',
    transform: 'scale(1.05)'
  },
  
  mini: {
    padding: '2px 6px',
    fontSize: 11,
    lineHeight: 1.1,
    color: '#fff',
    fontFamily: 'SF Pro, system-ui, sans-serif',
    fontWeight: 400
  },
  
  windowControl: {
    background: 'transparent',
    border: 'none',
    borderRadius: 16,
    padding: '4px 10px',
    color: '#ccc'
  },
  
  closeButton: {
    background: '#E36756',
    border: 'none',
    borderRadius: 16,
    padding: '4px 10px',
    color: '#fff'
  }
} as const

export const layoutStyles = {
  draggableArea: {
    position: 'absolute' as const,
    top: 5,
    left: 60,
    right: 100,
    height: 30,
    WebkitAppRegion: 'drag' as const,
    zIndex: 999
  },
  
  settingsButton: {
    position: 'absolute' as const,
    top: 20,
    left: 16,
    background: 'rgba(42, 45, 49, 0.8)',
    border: 'none',
    borderRadius: 12,
    padding: '8px 12px',
    color: '#fff',
    userSelect: 'none' as const,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    WebkitAppRegion: 'no-drag' as const,
    zIndex: 1002,
    fontSize: 14,
    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif'
  }
} as const