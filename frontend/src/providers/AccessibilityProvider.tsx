/**
 * Accessibility Integration Provider
 * Provides global accessibility features and keyboard shortcuts
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { AccessibilityDashboard } from '../components/AccessibilityDashboard'
import { SkipLink, AriaLiveRegion } from '../components/AccessibilityComponents'
import { useAriaLiveRegion } from '../utils/accessibility'

interface AccessibilityContextType {
  isDashboardOpen: boolean
  openDashboard: () => void
  closeDashboard: () => void
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void
  isHighContrastMode: boolean
  toggleHighContrast: () => void
  isReducedMotion: boolean
  fontSize: 'normal' | 'large' | 'extra-large'
  setFontSize: (size: 'normal' | 'large' | 'extra-large') => void
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined)

export function useAccessibility() {
  const context = useContext(AccessibilityContext)
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider')
  }
  return context
}

interface AccessibilityProviderProps {
  children: ReactNode
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  const [isDashboardOpen, setIsDashboardOpen] = useState(false)
  const [isHighContrastMode, setIsHighContrastMode] = useState(false)
  const [isReducedMotion, setIsReducedMotion] = useState(false)
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'extra-large'>('normal')
  
  const { announce, message, priority } = useAriaLiveRegion()

  // Check for user preferences
  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setIsReducedMotion(mediaQuery.matches)
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches)
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Load saved preferences
  useEffect(() => {
    const savedHighContrast = localStorage.getItem('accessibility-high-contrast') === 'true'
    const savedFontSize = localStorage.getItem('accessibility-font-size') as 'normal' | 'large' | 'extra-large' || 'normal'
    
    setIsHighContrastMode(savedHighContrast)
    setFontSize(savedFontSize)
  }, [])

  // Apply accessibility settings to document
  useEffect(() => {
    const root = document.documentElement
    
    // High contrast mode
    if (isHighContrastMode) {
      root.classList.add('accessibility-high-contrast')
    } else {
      root.classList.remove('accessibility-high-contrast')
    }
    
    // Font size
    root.classList.remove('accessibility-font-normal', 'accessibility-font-large', 'accessibility-font-extra-large')
    root.classList.add(`accessibility-font-${fontSize}`)
    
    // Reduced motion
    if (isReducedMotion) {
      root.classList.add('accessibility-reduced-motion')
    } else {
      root.classList.remove('accessibility-reduced-motion')
    }
  }, [isHighContrastMode, fontSize, isReducedMotion])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + A: Open accessibility dashboard
      if (e.altKey && e.key === 'a') {
        e.preventDefault()
        setIsDashboardOpen(true)
        announce('Accessibility dashboard opened', 'polite')
      }
      
      // Alt + C: Toggle high contrast
      if (e.altKey && e.key === 'c') {
        e.preventDefault()
        const newMode = !isHighContrastMode
        setIsHighContrastMode(newMode)
        localStorage.setItem('accessibility-high-contrast', newMode.toString())
        announce(newMode ? 'High contrast mode enabled' : 'High contrast mode disabled', 'polite')
      }
      
      // Alt + Plus: Increase font size
      if (e.altKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        const newSize = fontSize === 'normal' ? 'large' : fontSize === 'large' ? 'extra-large' : 'extra-large'
        setFontSize(newSize)
        localStorage.setItem('accessibility-font-size', newSize)
        announce(`Font size set to ${newSize}`, 'polite')
      }
      
      // Alt + Minus: Decrease font size
      if (e.altKey && e.key === '-') {
        e.preventDefault()
        const newSize = fontSize === 'extra-large' ? 'large' : fontSize === 'large' ? 'normal' : 'normal'
        setFontSize(newSize)
        localStorage.setItem('accessibility-font-size', newSize)
        announce(`Font size set to ${newSize}`, 'polite')
      }
      
      // Escape: Close accessibility dashboard
      if (e.key === 'Escape' && isDashboardOpen) {
        setIsDashboardOpen(false)
        announce('Accessibility dashboard closed', 'polite')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isHighContrastMode, fontSize, isDashboardOpen, announce])

  const openDashboard = useCallback(() => {
    setIsDashboardOpen(true)
  }, [])

  const closeDashboard = useCallback(() => {
    setIsDashboardOpen(false)
  }, [])

  const toggleHighContrast = useCallback(() => {
    const newMode = !isHighContrastMode
    setIsHighContrastMode(newMode)
    localStorage.setItem('accessibility-high-contrast', newMode.toString())
  }, [isHighContrastMode])

  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announce(message, priority)
  }, [announce])

  const contextValue: AccessibilityContextType = {
    isDashboardOpen,
    openDashboard,
    closeDashboard,
    announceToScreenReader,
    isHighContrastMode,
    toggleHighContrast,
    isReducedMotion,
    fontSize,
    setFontSize
  }

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {/* Skip Links */}
      <div className="sr-only focus:not-sr-only">
        <SkipLink href="#main-content">Skip to main content</SkipLink>
        <SkipLink href="#navigation">Skip to navigation</SkipLink>
      </div>

      {/* Main Content */}
      {children}

      {/* Accessibility Dashboard */}
      <AccessibilityDashboard 
        isOpen={isDashboardOpen} 
        onClose={closeDashboard} 
      />

      {/* Screen Reader Announcements */}
      <AriaLiveRegion message={message} priority={priority} />

      {/* Accessibility Menu Button - Fixed Position */}
      <button
        onClick={openDashboard}
        className="
          fixed bottom-4 right-4 z-40 p-3 bg-blue-600 text-white rounded-full shadow-lg
          hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          transition-colors
        "
        aria-label="Open accessibility options (Alt+A)"
        title="Accessibility Options"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </button>

      {/* Keyboard Shortcuts Help */}
      <div className="sr-only">
        <div>
          Keyboard shortcuts: Alt+A to open accessibility dashboard, 
          Alt+C to toggle high contrast, Alt+Plus to increase font size, 
          Alt+Minus to decrease font size, Escape to close modals
        </div>
      </div>
    </AccessibilityContext.Provider>
  )
}

// CSS classes to be added to your global styles
export const accessibilityStyles = `
/* High contrast mode */
.accessibility-high-contrast {
  filter: contrast(150%) brightness(110%);
}

.accessibility-high-contrast * {
  text-shadow: none !important;
  box-shadow: none !important;
}

.accessibility-high-contrast button,
.accessibility-high-contrast input,
.accessibility-high-contrast select,
.accessibility-high-contrast textarea {
  border: 2px solid #000 !important;
}

/* Font size adjustments */
.accessibility-font-large {
  font-size: 1.2em;
}

.accessibility-font-extra-large {
  font-size: 1.4em;
}

/* Reduced motion */
.accessibility-reduced-motion *,
.accessibility-reduced-motion *::before,
.accessibility-reduced-motion *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}

/* Focus indicators */
.accessibility-focus-visible *:focus-visible {
  outline: 3px solid #005fcc !important;
  outline-offset: 2px !important;
}
`
