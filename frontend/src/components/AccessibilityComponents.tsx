/**
 * Accessibility Components
 * Reusable components with built-in accessibility features
 */

import React, { forwardRef, ButtonHTMLAttributes, HTMLAttributes } from 'react'
import { announceToScreenReader } from '../utils/accessibility'

// Screen Reader Only Component
export function ScreenReaderOnly({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className="sr-only"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0
      }}
      {...props}
    >
      {children}
    </div>
  )
}

// Accessible Button Component
interface AccessibleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  loadingText?: string
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({ 
    children, 
    variant = 'primary', 
    size = 'md', 
    isLoading = false, 
    loadingText = 'Loading...', 
    icon,
    iconPosition = 'left',
    className = '',
    disabled,
    onClick,
    'aria-label': ariaLabel,
    ...props 
  }, ref) => {
    const baseClasses = `
      inline-flex items-center justify-center font-medium rounded-md 
      focus:outline-none focus:ring-2 focus:ring-offset-2 
      transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
    `
    
    const variantClasses = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
      ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
    }
    
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base'
    }

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!isLoading && !disabled && onClick) {
        onClick(event)
        
        // Announce action to screen readers
        if (children && typeof children === 'string') {
          announceToScreenReader(`${children} button activated`)
        }
      }
    }

    const buttonContent = isLoading ? (
      <>
        <svg 
          className="animate-spin -ml-1 mr-2 h-4 w-4" 
          fill="none" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        {loadingText}
      </>
    ) : (
      <>
        {icon && iconPosition === 'left' && (
          <span className="mr-2" aria-hidden="true">{icon}</span>
        )}
        {children}
        {icon && iconPosition === 'right' && (
          <span className="ml-2" aria-hidden="true">{icon}</span>
        )}
      </>
    )

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        disabled={disabled || isLoading}
        onClick={handleClick}
        aria-label={ariaLabel || (isLoading ? loadingText : undefined)}
        aria-busy={isLoading}
        {...props}
      >
        {buttonContent}
      </button>
    )
  }
)

AccessibleButton.displayName = 'AccessibleButton'

// Accessible Heading Component
interface AccessibleHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level: 1 | 2 | 3 | 4 | 5 | 6
  visualLevel?: 1 | 2 | 3 | 4 | 5 | 6
}

export function AccessibleHeading({ 
  level, 
  visualLevel, 
  children, 
  className = '', 
  ...props 
}: AccessibleHeadingProps) {
  const displayLevel = visualLevel || level
  
  const levelClasses = {
    1: 'text-3xl font-bold',
    2: 'text-2xl font-semibold',
    3: 'text-xl font-semibold',
    4: 'text-lg font-medium',
    5: 'text-base font-medium',
    6: 'text-sm font-medium'
  }

  const headingProps = {
    className: `${levelClasses[displayLevel]} ${className}`,
    ...props
  }

  switch (level) {
    case 1:
      return <h1 {...headingProps}>{children}</h1>
    case 2:
      return <h2 {...headingProps}>{children}</h2>
    case 3:
      return <h3 {...headingProps}>{children}</h3>
    case 4:
      return <h4 {...headingProps}>{children}</h4>
    case 5:
      return <h5 {...headingProps}>{children}</h5>
    case 6:
      return <h6 {...headingProps}>{children}</h6>
    default:
      return <h2 {...headingProps}>{children}</h2>
  }
}

// Accessible Input Component
interface AccessibleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  hideLabel?: boolean
}

export const AccessibleInput = forwardRef<HTMLInputElement, AccessibleInputProps>(
  ({ label, error, hint, hideLabel = false, className = '', id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
    const errorId = error ? `${inputId}-error` : undefined
    const hintId = hint ? `${inputId}-hint` : undefined
    
    const describedBy = [errorId, hintId].filter(Boolean).join(' ')

    return (
      <div className="space-y-1">
        <label 
          htmlFor={inputId}
          className={hideLabel ? 'sr-only' : 'block text-sm font-medium text-gray-700'}
        >
          {label}
        </label>
        
        {hint && (
          <div id={hintId} className="text-sm text-gray-500">
            {hint}
          </div>
        )}
        
        <input
          ref={ref}
          id={inputId}
          className={`
            block w-full rounded-md border-gray-300 shadow-sm 
            focus:border-blue-500 focus:ring-blue-500 
            disabled:bg-gray-50 disabled:text-gray-500
            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? 'true' : undefined}
          {...props}
        />
        
        {error && (
          <div 
            id={errorId} 
            className="text-sm text-red-600"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}
      </div>
    )
  }
)

AccessibleInput.displayName = 'AccessibleInput'

// Skip Link Component
interface SkipLinkProps {
  href: string
  children: React.ReactNode
}

export function SkipLink({ href, children }: SkipLinkProps) {
  return (
    <a
      href={href}
      className="
        sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
        bg-blue-600 text-white px-4 py-2 rounded-md z-50
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
      "
      style={{
        position: 'absolute',
        top: '-40px',
        left: '6px',
        background: '#1e40af',
        color: 'white',
        padding: '8px 16px',
        textDecoration: 'none',
        borderRadius: '4px',
        zIndex: 1000,
        transition: 'top 0.3s'
      }}
      onFocus={(e) => {
        e.currentTarget.style.top = '6px'
      }}
      onBlur={(e) => {
        e.currentTarget.style.top = '-40px'
      }}
    >
      {children}
    </a>
  )
}

// Focus Trap Component
interface FocusTrapProps {
  children: React.ReactNode
  isActive: boolean
  restoreFocus?: boolean
}

export function FocusTrap({ children, isActive, restoreFocus = true }: FocusTrapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const previousFocusRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!isActive) return

    // Store the currently focused element
    previousFocusRef.current = document.activeElement as HTMLElement

    const container = containerRef.current
    if (!container) return

    // Get all focusable elements
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>

    if (focusableElements.length === 0) return

    // Focus the first element
    focusableElements[0].focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      
      // Restore focus when trap is deactivated
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus()
      }
    }
  }, [isActive, restoreFocus])

  return (
    <div ref={containerRef}>
      {children}
    </div>
  )
}

// Live Region Component for announcements
interface LiveRegionProps {
  message: string
  priority?: 'polite' | 'assertive'
  className?: string
}

export function LiveRegion({ message, priority = 'polite', className = '' }: LiveRegionProps) {
  return (
    <div
      aria-live={priority}
      aria-atomic="true"
      className={`sr-only ${className}`}
    >
      {message}
    </div>
  )
}

// Accessible Modal Component
interface AccessibleModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  initialFocus?: React.RefObject<HTMLElement>
  className?: string
}

export function AccessibleModal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  initialFocus,
  className = ''
}: AccessibleModalProps) {
  const modalRef = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()

  // Handle escape key
  React.useEffect(() => {
    if (!isOpen || !closeOnEscape) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        announceToScreenReader('Modal closed', 'polite')
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, closeOnEscape, onClose])

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      announceToScreenReader(`Modal opened: ${title}`, 'polite')
      
      // Focus management
      if (initialFocus?.current) {
        initialFocus.current.focus()
      } else {
        // Focus the modal container
        modalRef.current?.focus()
      }
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, title, initialFocus])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  }

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose()
      announceToScreenReader('Modal closed', 'polite')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <FocusTrap isActive={isOpen}>
          <div
            ref={modalRef}
            className={`
              relative w-full ${sizeClasses[size]} bg-white rounded-lg shadow-xl 
              transform transition-all ${className}
            `}
            tabIndex={-1}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2
                id={titleId}
                className="text-lg font-semibold text-gray-900"
              >
                {title}
              </h2>
              
              <AccessibleButton
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label={`Close ${title} modal`}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </AccessibleButton>
            </div>

            {/* Content */}
            <div className="p-6">
              {children}
            </div>
          </div>
        </FocusTrap>
      </div>
    </div>
  )
}
