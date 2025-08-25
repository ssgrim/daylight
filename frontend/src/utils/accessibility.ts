/**
 * Accessibility Utilities
 * Helper functions for accessibility features and screen reader support
 */

// Global store for screen reader announcements
let announcementRegion: HTMLElement | null = null

/**
 * Initialize the screen reader announcement region
 */
function initAnnouncementRegion(): HTMLElement {
  if (!announcementRegion) {
    // Create a live region for screen reader announcements
    announcementRegion = document.createElement('div')
    announcementRegion.setAttribute('aria-live', 'polite')
    announcementRegion.setAttribute('aria-atomic', 'true')
    announcementRegion.className = 'sr-only'
    announcementRegion.style.cssText = `
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
    document.body.appendChild(announcementRegion)
  }
  return announcementRegion
}

/**
 * Announce a message to screen readers
 * @param message - The message to announce
 * @param priority - 'polite' (default) or 'assertive'
 */
export function announceToScreenReader(
  message: string, 
  priority: 'polite' | 'assertive' = 'polite'
): void {
  if (typeof window === 'undefined') return // SSR safety
  
  const region = initAnnouncementRegion()
  
  // Set the priority
  region.setAttribute('aria-live', priority)
  
  // Clear existing content and add new message
  region.textContent = ''
  
  // Use timeout to ensure screen readers pick up the change
  setTimeout(() => {
    region.textContent = message
  }, 100)
  
  // Clear the message after a delay to avoid it being read multiple times
  setTimeout(() => {
    region.textContent = ''
  }, 1000)
}

/**
 * Focus management utilities
 */
export const focusUtils = {
  /**
   * Set focus to an element and announce it to screen readers
   */
  focusElement(element: HTMLElement | null, announceText?: string): void {
    if (!element) return
    
    element.focus()
    
    if (announceText) {
      announceToScreenReader(announceText)
    }
  },

  /**
   * Focus the first focusable element within a container
   */
  focusFirstElement(container: HTMLElement): boolean {
    const focusableElements = this.getFocusableElements(container)
    if (focusableElements.length > 0) {
      focusableElements[0].focus()
      return true
    }
    return false
  },

  /**
   * Focus the last focusable element within a container
   */
  focusLastElement(container: HTMLElement): boolean {
    const focusableElements = this.getFocusableElements(container)
    if (focusableElements.length > 0) {
      focusableElements[focusableElements.length - 1].focus()
      return true
    }
    return false
  },

  /**
   * Get all focusable elements within a container
   */
  getFocusableElements(container: HTMLElement): HTMLElement[] {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ')

    return Array.from(container.querySelectorAll(focusableSelectors))
      .filter((element): element is HTMLElement => {
        return element instanceof HTMLElement && 
               element.offsetWidth > 0 && 
               element.offsetHeight > 0 &&
               !element.hasAttribute('hidden')
      })
  },

  /**
   * Trap focus within a container (useful for modals)
   */
  trapFocus(container: HTMLElement): () => void {
    const focusableElements = this.getFocusableElements(container)
    
    if (focusableElements.length === 0) return () => {}
    
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    
    // Focus the first element initially
    firstElement.focus()
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          // Shift + Tab - focus previous element
          if (document.activeElement === firstElement) {
            event.preventDefault()
            lastElement.focus()
          }
        } else {
          // Tab - focus next element
          if (document.activeElement === lastElement) {
            event.preventDefault()
            firstElement.focus()
          }
        }
      }
    }
    
    container.addEventListener('keydown', handleKeyDown)
    
    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  }
}

/**
 * Keyboard navigation utilities
 */
export const keyboardUtils = {
  /**
   * Check if a key event matches a specific key
   */
  isKey(event: KeyboardEvent, key: string): boolean {
    return event.key === key || event.code === key
  },

  /**
   * Handle arrow key navigation in a list
   */
  handleArrowNavigation(
    event: KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    options: {
      vertical?: boolean
      horizontal?: boolean
      loop?: boolean
    } = {}
  ): number {
    const { vertical = true, horizontal = false, loop = true } = options
    
    let newIndex = currentIndex
    
    if (vertical && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      
      if (event.key === 'ArrowUp') {
        newIndex = currentIndex > 0 ? currentIndex - 1 : (loop ? items.length - 1 : currentIndex)
      } else {
        newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : (loop ? 0 : currentIndex)
      }
    }
    
    if (horizontal && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault()
      
      if (event.key === 'ArrowLeft') {
        newIndex = currentIndex > 0 ? currentIndex - 1 : (loop ? items.length - 1 : currentIndex)
      } else {
        newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : (loop ? 0 : currentIndex)
      }
    }
    
    if (newIndex !== currentIndex && items[newIndex]) {
      items[newIndex].focus()
    }
    
    return newIndex
  }
}

/**
 * ARIA utilities
 */
export const ariaUtils = {
  /**
   * Generate a unique ID for ARIA relationships
   */
  generateId(prefix: string = 'aria'): string {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
  },

  /**
   * Set up ARIA labelling relationship
   */
  labelledBy(element: HTMLElement, labelElement: HTMLElement): string {
    const labelId = labelElement.id || this.generateId('label')
    labelElement.id = labelId
    element.setAttribute('aria-labelledby', labelId)
    return labelId
  },

  /**
   * Set up ARIA description relationship
   */
  describedBy(element: HTMLElement, descriptionElement: HTMLElement): string {
    const descId = descriptionElement.id || this.generateId('desc')
    descriptionElement.id = descId
    element.setAttribute('aria-describedby', descId)
    return descId
  },

  /**
   * Update ARIA live region with new content
   */
  updateLiveRegion(content: string, priority: 'polite' | 'assertive' = 'polite'): void {
    announceToScreenReader(content, priority)
  }
}

/**
 * Color contrast utilities
 */
export const contrastUtils = {
  /**
   * Calculate relative luminance of a color
   */
  getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  },

  /**
   * Calculate contrast ratio between two colors
   */
  getContrastRatio(color1: [number, number, number], color2: [number, number, number]): number {
    const lum1 = this.getLuminance(...color1)
    const lum2 = this.getLuminance(...color2)
    
    const brightest = Math.max(lum1, lum2)
    const darkest = Math.min(lum1, lum2)
    
    return (brightest + 0.05) / (darkest + 0.05)
  },

  /**
   * Check if contrast ratio meets WCAG guidelines
   */
  meetsWCAG(
    contrastRatio: number, 
    level: 'AA' | 'AAA' = 'AA', 
    textSize: 'normal' | 'large' = 'normal'
  ): boolean {
    const requirements = {
      'AA': { normal: 4.5, large: 3 },
      'AAA': { normal: 7, large: 4.5 }
    }
    
    return contrastRatio >= requirements[level][textSize]
  }
}

/**
 * Motion and animation utilities for accessibility
 */
export const motionUtils = {
  /**
   * Check if user prefers reduced motion
   */
  prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  },

  /**
   * Conditionally apply animation based on user preference
   */
  respectMotionPreference<T>(normalValue: T, reducedValue: T): T {
    return this.prefersReducedMotion() ? reducedValue : normalValue
  },

  /**
   * Get safe animation duration based on user preference
   */
  getSafeDuration(normalDuration: number): number {
    return this.prefersReducedMotion() ? 0 : normalDuration
  }
}

/**
 * Form accessibility utilities
 */
export const formUtils = {
  /**
   * Associate form field with its label and description
   */
  setupField(
    field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    options: {
      label?: HTMLElement
      description?: HTMLElement
      errorElement?: HTMLElement
      required?: boolean
    }
  ): void {
    const { label, description, errorElement, required } = options
    
    // Set up labelling
    if (label) {
      ariaUtils.labelledBy(field, label)
    }
    
    // Set up description
    const describedByIds: string[] = []
    
    if (description) {
      const descId = ariaUtils.describedBy(field, description)
      describedByIds.push(descId)
    }
    
    if (errorElement) {
      const errorId = errorElement.id || ariaUtils.generateId('error')
      errorElement.id = errorId
      describedByIds.push(errorId)
    }
    
    if (describedByIds.length > 0) {
      field.setAttribute('aria-describedby', describedByIds.join(' '))
    }
    
    // Set required state
    if (required !== undefined) {
      field.setAttribute('aria-required', required.toString())
      if (required) {
        field.setAttribute('required', '')
      }
    }
  },

  /**
   * Update field validation state
   */
  updateValidationState(
    field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    isValid: boolean,
    errorMessage?: string
  ): void {
    field.setAttribute('aria-invalid', (!isValid).toString())
    
    if (!isValid && errorMessage) {
      announceToScreenReader(`Error: ${errorMessage}`, 'assertive')
    }
  },

  /**
   * Validate an entire form and show error messages
   */
  validateForm(form: HTMLFormElement): boolean {
    const fields = form.querySelectorAll('input, textarea, select')
    let isValid = true

    fields.forEach((field) => {
      const input = field as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      
      // Check HTML5 validity
      if (!input.checkValidity()) {
        isValid = false
        formUtils.updateValidationState(input, false, input.validationMessage)
      } else {
        formUtils.updateValidationState(input, true)
      }
    })

    // Focus first invalid field
    if (!isValid) {
      const firstInvalid = form.querySelector('[aria-invalid="true"]') as HTMLElement
      if (firstInvalid) {
        firstInvalid.focus()
      }
    }

    return isValid
  }
}

/**
 * Focus management class for complex focus scenarios
 */
export class FocusManager {
  private focusHistory: HTMLElement[] = []
  private trapCleanup: (() => void) | null = null

  /**
   * Store the currently focused element
   */
  storeFocus(): void {
    const activeElement = document.activeElement as HTMLElement
    if (activeElement && activeElement !== document.body) {
      this.focusHistory.push(activeElement)
    }
  }

  /**
   * Restore focus to the last stored element
   */
  restoreFocus(): boolean {
    const lastFocus = this.focusHistory.pop()
    if (lastFocus && document.body.contains(lastFocus)) {
      lastFocus.focus()
      return true
    }
    return false
  }

  /**
   * Clear focus history
   */
  clearHistory(): void {
    this.focusHistory = []
  }

  /**
   * Set up focus trap in a container
   */
  trapFocus(container: HTMLElement): void {
    this.clearTrap()
    this.storeFocus()
    this.trapCleanup = focusUtils.trapFocus(container)
  }

  /**
   * Clear current focus trap
   */
  clearTrap(): void {
    if (this.trapCleanup) {
      this.trapCleanup()
      this.trapCleanup = null
    }
  }

  /**
   * Clean up and restore focus
   */
  cleanup(): void {
    this.clearTrap()
    this.restoreFocus()
    this.clearHistory()
  }
}

export default {
  announceToScreenReader,
  focusUtils,
  keyboardUtils,
  ariaUtils,
  contrastUtils,
  motionUtils,
  formUtils,
  FocusManager
}
