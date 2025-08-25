/**
 * Accessibility Provider
 * Global context for managing accessibility settings and features
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { announceToScreenReader, FocusManager } from '../utils/accessibility'

interface AccessibilitySettings {
  isHighContrastMode: boolean
  fontSize: 'normal' | 'large' | 'extra-large'
  reducedMotion: boolean
  announceChanges: boolean
}

interface AccessibilityContextType {
  // Settings
  settings: AccessibilitySettings
  isHighContrastMode: boolean
  fontSize: 'normal' | 'large' | 'extra-large'
  reducedMotion: boolean
  announceChanges: boolean

  // Actions
  toggleHighContrast: () => void
  setFontSize: (size: 'normal' | 'large' | 'extra-large') => void
  toggleReducedMotion: () => void
  toggleAnnounceChanges: () => void
  updateSettings: (settings: Partial<AccessibilitySettings>) => void

  // Utilities
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void
  focusManager: FocusManager
  openDashboard: () => void
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined)

const defaultSettings: AccessibilitySettings = {
  isHighContrastMode: false,
  fontSize: 'normal',
  reducedMotion: false,
  announceChanges: true,
}

interface AccessibilityProviderProps {
  children: ReactNode
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    // Load settings from localStorage
    try {
      const saved = localStorage.getItem('accessibility-settings')
      if (saved) {
        return { ...defaultSettings, ...JSON.parse(saved) }
      }
    } catch (error) {
      console.warn('Failed to load accessibility settings:', error)
    }
    return defaultSettings
  })

  const [focusManager] = useState(() => new FocusManager())

  // Save settings to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('accessibility-settings', JSON.stringify(settings))
    } catch (error) {
      console.warn('Failed to save accessibility settings:', error)
    }
  }, [settings])

  // Apply high contrast mode to document
  useEffect(() => {
    if (settings.isHighContrastMode) {
      document.body.classList.add('high-contrast')
    } else {
      document.body.classList.remove('high-contrast')
    }
  }, [settings.isHighContrastMode])

  // Apply font size to document
  useEffect(() => {
    document.body.classList.remove('font-large', 'font-extra-large')
    if (settings.fontSize === 'large') {
      document.body.classList.add('font-large')
    } else if (settings.fontSize === 'extra-large') {
      document.body.classList.add('font-extra-large')
    }
  }, [settings.fontSize])

  // Apply reduced motion preference
  useEffect(() => {
    if (settings.reducedMotion) {
      document.body.classList.add('reduced-motion')
    } else {
      document.body.classList.remove('reduced-motion')
    }
  }, [settings.reducedMotion])

  // Detect system preferences
  useEffect(() => {
    // Detect prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches && !settings.reducedMotion) {
        setSettings(prev => ({ ...prev, reducedMotion: true }))
        if (settings.announceChanges) {
          announceToScreenReader('Reduced motion enabled based on system preference', 'polite')
        }
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    
    // Check initial state
    if (mediaQuery.matches && !settings.reducedMotion) {
      setSettings(prev => ({ ...prev, reducedMotion: true }))
    }

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [settings.reducedMotion, settings.announceChanges])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey) {
        switch (event.key) {
          case 'a':
          case 'A':
            event.preventDefault()
            openDashboard()
            break
          case 'c':
          case 'C':
            event.preventDefault()
            toggleHighContrast()
            break
          case '+':
          case '=':
            event.preventDefault()
            increaseFontSize()
            break
          case '-':
          case '_':
            event.preventDefault()
            decreaseFontSize()
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [settings.fontSize])

  const updateSettings = useCallback((newSettings: Partial<AccessibilitySettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }, [])

  const toggleHighContrast = useCallback(() => {
    const newValue = !settings.isHighContrastMode
    updateSettings({ isHighContrastMode: newValue })
    
    if (settings.announceChanges) {
      announceToScreenReader(
        `High contrast mode ${newValue ? 'enabled' : 'disabled'}`,
        'polite'
      )
    }
  }, [settings.isHighContrastMode, settings.announceChanges])

  const setFontSize = useCallback((size: 'normal' | 'large' | 'extra-large') => {
    updateSettings({ fontSize: size })
    
    if (settings.announceChanges) {
      announceToScreenReader(`Font size changed to ${size}`, 'polite')
    }
  }, [settings.announceChanges])

  const increaseFontSize = useCallback(() => {
    const sizes: Array<'normal' | 'large' | 'extra-large'> = ['normal', 'large', 'extra-large']
    const currentIndex = sizes.indexOf(settings.fontSize)
    if (currentIndex < sizes.length - 1) {
      setFontSize(sizes[currentIndex + 1])
    }
  }, [settings.fontSize, setFontSize])

  const decreaseFontSize = useCallback(() => {
    const sizes: Array<'normal' | 'large' | 'extra-large'> = ['normal', 'large', 'extra-large']
    const currentIndex = sizes.indexOf(settings.fontSize)
    if (currentIndex > 0) {
      setFontSize(sizes[currentIndex - 1])
    }
  }, [settings.fontSize, setFontSize])

  const toggleReducedMotion = useCallback(() => {
    const newValue = !settings.reducedMotion
    updateSettings({ reducedMotion: newValue })
    
    if (settings.announceChanges) {
      announceToScreenReader(
        `Reduced motion ${newValue ? 'enabled' : 'disabled'}`,
        'polite'
      )
    }
  }, [settings.reducedMotion, settings.announceChanges])

  const toggleAnnounceChanges = useCallback(() => {
    const newValue = !settings.announceChanges
    updateSettings({ announceChanges: newValue })
    
    // Use the new value for this announcement
    if (newValue) {
      announceToScreenReader('Screen reader announcements enabled', 'polite')
    }
  }, [settings.announceChanges])

  const openDashboard = useCallback(() => {
    // This would open an accessibility dashboard/panel
    // For now, we'll announce what would happen
    if (settings.announceChanges) {
      announceToScreenReader('Opening accessibility dashboard', 'polite')
    }
    
    // In a real implementation, this might:
    // - Open a modal with accessibility settings
    // - Navigate to an accessibility page
    // - Toggle a sidebar with accessibility controls
    console.log('Accessibility dashboard would open here')
  }, [settings.announceChanges])

  const contextValue: AccessibilityContextType = {
    // Settings
    settings,
    isHighContrastMode: settings.isHighContrastMode,
    fontSize: settings.fontSize,
    reducedMotion: settings.reducedMotion,
    announceChanges: settings.announceChanges,

    // Actions
    toggleHighContrast,
    setFontSize,
    toggleReducedMotion,
    toggleAnnounceChanges,
    updateSettings,

    // Utilities
    announceToScreenReader,
    focusManager,
    openDashboard,
  }

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility(): AccessibilityContextType {
  const context = useContext(AccessibilityContext)
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider')
  }
  return context
}

// Export types for external use
export type { AccessibilitySettings, AccessibilityContextType }
