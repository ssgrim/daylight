/**
 * Accessibility Components
 * Provides accessible UI components for enhanced user experience
 */

import React, { forwardRef, HTMLProps, ReactNode } from 'react'
import { useFocusManagement, useScreenReaderAnnouncements, useFocusVisible } from '../utils/accessibility'

interface AccessibleButtonProps extends Omit<HTMLProps<HTMLButtonElement>, 'type' | 'ref' | 'size'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  loadingText?: string
  children: ReactNode
  type?: 'button' | 'submit' | 'reset'
}

/**
 * Accessible button with proper ARIA attributes and keyboard navigation
 */
export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({ 
    variant = 'primary', 
    size = 'md', 
    isLoading = false, 
    loadingText = 'Loading...', 
    children, 
    disabled, 
    type = 'button',
    className = '',
    ...props 
  }, ref) => {
    const isFocusVisible = useFocusVisible()

    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none'
    
    const variantClasses = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 disabled:bg-gray-100',
      danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
      ghost: 'text-blue-600 hover:bg-blue-50 disabled:text-blue-300'
    }

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base'
    }

    const focusClasses = isFocusVisible 
      ? 'focus:ring-2 focus:ring-blue-500 focus:ring-offset-2' 
      : ''

    const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${focusClasses} ${className}`

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-disabled={disabled || isLoading}
        aria-describedby={isLoading ? `${props.id}-loading` : undefined}
        className={classes}
        {...props}
      >
        {isLoading ? (
          <>
            <svg 
              className="animate-spin -ml-1 mr-2 h-4 w-4" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                className="opacity-75" 
              />
            </svg>
            <span id={`${props.id}-loading`} className="sr-only">
              {loadingText}
            </span>
            {loadingText}
          </>
        ) : (
          children
        )}
      </button>
    )
  }
)

AccessibleButton.displayName = 'AccessibleButton'

interface SkipLinkProps {
  href: string
  children: ReactNode
}

/**
 * Skip link for keyboard navigation
 */
export function SkipLink({ href, children }: SkipLinkProps) {
  return (
    <a
      href={href}
      className="
        sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4
        bg-blue-600 text-white px-4 py-2 rounded-md z-50
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
      "
    >
      {children}
    </a>
  )
}

interface AccessibleHeadingProps {
  level: 1 | 2 | 3 | 4 | 5 | 6
  children: ReactNode
  className?: string
  id?: string
}

/**
 * Semantic heading component with proper hierarchy
 */
export function AccessibleHeading({ level, children, className = '', id }: AccessibleHeadingProps) {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements

  const defaultClasses = {
    1: 'text-3xl font-bold',
    2: 'text-2xl font-semibold',
    3: 'text-xl font-semibold',
    4: 'text-lg font-medium',
    5: 'text-base font-medium',
    6: 'text-sm font-medium'
  }

  return (
    <Tag
      id={id}
      className={`${defaultClasses[level]} ${className}`}
    >
      {children}
    </Tag>
  )
}

interface AccessibleModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

/**
 * Accessible modal with proper focus management and ARIA attributes
 */
export function AccessibleModal({ isOpen, onClose, title, children, size = 'md' }: AccessibleModalProps) {
  const { trapFocus, saveFocus, restoreFocus } = useFocusManagement()
  const { announce } = useScreenReaderAnnouncements()
  const modalRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (isOpen) {
      saveFocus()
      announce(`${title} dialog opened`)
      
      // Trap focus when modal opens
      const cleanup = trapFocus(modalRef)
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
      
      return () => {
        cleanup?.()
        document.body.style.overflow = 'unset'
      }
    } else {
      restoreFocus()
      announce(`${title} dialog closed`)
    }
  }, [isOpen, saveFocus, restoreFocus, trapFocus, announce, title])

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  }

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto" 
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          ref={modalRef}
          className={`
            relative bg-white rounded-lg shadow-xl transform transition-all
            w-full ${sizeClasses[size]} mx-auto
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="
                p-1 text-gray-400 hover:text-gray-600 rounded-md
                focus:outline-none focus:ring-2 focus:ring-blue-500
              "
              aria-label="Close dialog"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ScreenReaderOnlyProps {
  children: ReactNode
  as?: keyof JSX.IntrinsicElements
}

/**
 * Screen reader only content
 */
export function ScreenReaderOnly({ children, as: Component = 'span' }: ScreenReaderOnlyProps) {
  return (
    <Component className="sr-only">
      {children}
    </Component>
  )
}

interface AriaLiveRegionProps {
  message: string
  priority?: 'polite' | 'assertive'
}

/**
 * ARIA live region for screen reader announcements
 */
export function AriaLiveRegion({ message, priority = 'polite' }: AriaLiveRegionProps) {
  return (
    <div
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  )
}

interface FocusIndicatorProps {
  children: ReactNode
  className?: string
}

/**
 * Custom focus indicator wrapper
 */
export function FocusIndicator({ children, className = '' }: FocusIndicatorProps) {
  const isFocusVisible = useFocusVisible()
  
  return (
    <div
      className={`
        ${isFocusVisible ? 'focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
