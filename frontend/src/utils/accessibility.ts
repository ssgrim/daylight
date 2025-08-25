/**
 * Accessibility Utilities
 * Helper functions for improving web accessibility
 */

// Announce message to screen readers
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.setAttribute('class', 'sr-only')
  announcement.style.cssText = `
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    padding: 0 !important;
    margin: -1px !important;
    overflow: hidden !important;
    clip: rect(0, 0, 0, 0) !important;
    white-space: nowrap !important;
    border: 0 !important;
  `
  
  document.body.appendChild(announcement)
  
  // Add the message after a brief delay to ensure screen readers pick it up
  setTimeout(() => {
    announcement.textContent = message
  }, 100)
  
  // Remove the element after the announcement
  setTimeout(() => {
    if (announcement.parentNode) {
      announcement.parentNode.removeChild(announcement)
    }
  }, 2000)
}

// Check if an element is focusable
export function isFocusable(element: HTMLElement): boolean {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'audio[controls]',
    'video[controls]',
    '[contenteditable="true"]'
  ]
  
  return focusableSelectors.some(selector => element.matches(selector))
}

// Get all focusable elements within a container
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'audio[controls]',
    'video[controls]',
    '[contenteditable="true"]'
  ].join(', ')
  
  return Array.from(container.querySelectorAll(focusableSelectors))
}

// Trap focus within a container
export function trapFocus(container: HTMLElement, event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  
  const focusableElements = getFocusableElements(container)
  if (focusableElements.length === 0) return
  
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

// Generate a unique ID for accessibility purposes
export function generateAccessibilityId(prefix: string = 'a11y'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
}

// Check if reduced motion is preferred
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Check if high contrast is preferred
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches
}

// Get the contrast ratio between two colors
export function getContrastRatio(color1: string, color2: string): number {
  // Simplified implementation - would need full color parsing in production
  // This is a placeholder that returns a mock ratio
  return 4.5 // WCAG AA minimum for normal text
}

// Check if a color combination meets WCAG contrast requirements
export function meetsContrastRequirement(
  foreground: string, 
  background: string, 
  level: 'AA' | 'AAA' = 'AA',
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background)
  
  if (level === 'AAA') {
    return isLargeText ? ratio >= 4.5 : ratio >= 7
  } else {
    return isLargeText ? ratio >= 3 : ratio >= 4.5
  }
}

// Manage focus for single page applications
export class FocusManager {
  private focusHistory: HTMLElement[] = []
  
  // Store current focus for later restoration
  storeFocus(): void {
    const currentElement = document.activeElement as HTMLElement
    if (currentElement && currentElement !== document.body) {
      this.focusHistory.push(currentElement)
    }
  }
  
  // Restore the most recently stored focus
  restoreFocus(): void {
    const lastFocused = this.focusHistory.pop()
    if (lastFocused && document.body.contains(lastFocused)) {
      lastFocused.focus()
    }
  }
  
  // Focus the first focusable element in a container
  focusFirst(container: HTMLElement): void {
    const focusableElements = getFocusableElements(container)
    if (focusableElements.length > 0) {
      focusableElements[0].focus()
    }
  }
  
  // Focus by selector with fallback
  focusElement(selector: string, fallback?: HTMLElement): void {
    const element = document.querySelector(selector) as HTMLElement
    if (element) {
      element.focus()
    } else if (fallback) {
      fallback.focus()
    }
  }
}

// Global focus manager instance
export const focusManager = new FocusManager()

// Keyboard navigation helpers
export const KeyCodes = {
  ENTER: 'Enter',
  SPACE: ' ',
  TAB: 'Tab',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown'
} as const

// Handle roving tabindex for keyboard navigation
export function handleRovingTabindex(
  elements: HTMLElement[],
  currentIndex: number,
  direction: 'next' | 'previous' | 'first' | 'last'
): number {
  let newIndex = currentIndex
  
  switch (direction) {
    case 'next':
      newIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : 0
      break
    case 'previous':
      newIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1
      break
    case 'first':
      newIndex = 0
      break
    case 'last':
      newIndex = elements.length - 1
      break
  }
  
  // Update tabindex attributes
  elements.forEach((element, index) => {
    element.tabIndex = index === newIndex ? 0 : -1
  })
  
  // Focus the new element
  elements[newIndex].focus()
  
  return newIndex
}

// ARIA live region manager
export class LiveRegionManager {
  private politeRegion: HTMLElement | null = null
  private assertiveRegion: HTMLElement | null = null
  
  constructor() {
    this.createRegions()
  }
  
  private createRegions(): void {
    // Create polite live region
    this.politeRegion = document.createElement('div')
    this.politeRegion.setAttribute('aria-live', 'polite')
    this.politeRegion.setAttribute('aria-atomic', 'true')
    this.politeRegion.setAttribute('class', 'sr-only')
    this.politeRegion.style.cssText = `
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    `
    
    // Create assertive live region
    this.assertiveRegion = this.politeRegion.cloneNode(false) as HTMLElement
    this.assertiveRegion.setAttribute('aria-live', 'assertive')
    
    document.body.appendChild(this.politeRegion)
    document.body.appendChild(this.assertiveRegion)
  }
  
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const region = priority === 'assertive' ? this.assertiveRegion : this.politeRegion
    if (region) {
      // Clear and set message with delay to ensure announcement
      region.textContent = ''
      setTimeout(() => {
        region.textContent = message
      }, 100)
    }
  }
  
  destroy(): void {
    if (this.politeRegion) {
      document.body.removeChild(this.politeRegion)
      this.politeRegion = null
    }
    if (this.assertiveRegion) {
      document.body.removeChild(this.assertiveRegion)
      this.assertiveRegion = null
    }
  }
}

// Global live region manager
export const liveRegionManager = new LiveRegionManager()

// Helper to check if screen reader is likely being used
export function isScreenReaderActive(): boolean {
  // This is a heuristic - not 100% reliable but useful for progressive enhancement
  return (
    navigator.userAgent.includes('NVDA') ||
    navigator.userAgent.includes('JAWS') ||
    navigator.userAgent.includes('VoiceOver') ||
    window.speechSynthesis?.speaking === false // Another heuristic
  )
}
