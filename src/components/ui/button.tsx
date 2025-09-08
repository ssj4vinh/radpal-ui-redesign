import * as React from 'react'

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className = '', ...props }, ref) => (
  <button
    ref={ref}
    className={`rounded border-none bg-[#1c1e23] px-3 py-1 text-sm text-white hover:bg-[#2a2d33] ${className}`}
    style={{ fontFamily: 'SF Pro, system-ui, sans-serif', fontWeight: 400, ...props.style }}
    {...props}
  />
))
Button.displayName = 'Button'
