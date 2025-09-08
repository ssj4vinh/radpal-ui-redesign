import React from 'react'

interface BlurCardProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
  onMouseEnter?: (e: React.MouseEvent) => void
  onMouseLeave?: (e: React.MouseEvent) => void
  active?: boolean
}

export default React.memo(function BlurCard({ 
  children, 
  className = '', 
  style = {}, 
  onClick,
  onMouseEnter,
  onMouseLeave,
  active = false
}: BlurCardProps) {
  return (
    <div
      className={`blur-card ${active ? 'active' : ''} ${className}`}
      style={style}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  )
})