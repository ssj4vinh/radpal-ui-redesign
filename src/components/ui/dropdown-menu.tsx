import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Content
    ref={ref}
    className={`rounded-md border-none bg-[#1c1e23] text-white z-50 ${className}`}
    style={{ fontFamily: 'SF Pro, system-ui, sans-serif', fontWeight: 400, ...props.style }}
    {...props}
  />
))
DropdownMenuContent.displayName = 'DropdownMenuContent'

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={`px-3 py-1.5 text-sm hover:bg-[#2a2d33] focus:outline-none ${className}`}
    style={{ fontFamily: 'SF Pro, system-ui, sans-serif', fontWeight: 400, ...props.style }}
    {...props}
  />
))
DropdownMenuItem.displayName = 'DropdownMenuItem'
