/**
 * useAccessibilityAudit Hook
 * Provides accessibility auditing capabilities for the application
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export interface AccessibilityIssue {
  id: string
  severity: 'error' | 'warning' | 'info'
  wcagRule: string
  message: string
  suggestion: string
  element?: Element
  selector?: string
  impact: 'critical' | 'serious' | 'moderate' | 'minor'
  tags: string[]
}

export interface AccessibilityReport {
  timestamp: string
  url: string
  issues: AccessibilityIssue[]
  summary: {
    total: number
    errors: number
    warnings: number
    info: number
    wcagLevel: 'A' | 'AA' | 'AAA' | 'Non-compliant'
  }
  metadata: {
    userAgent: string
    viewport: { width: number; height: number }
    auditDuration: number
  }
}

interface UseAccessibilityAuditOptions {
  autoRun?: boolean
  throttleMs?: number
  includeBestPractices?: boolean
}

export function useAccessibilityAudit(enabled: boolean = false, options: UseAccessibilityAuditOptions = {}) {
  const [issues, setIssues] = useState<AccessibilityIssue[]>([])
  const [isAuditing, setIsAuditing] = useState(false)
  const [lastAuditTime, setLastAuditTime] = useState<Date | null>(null)
  
  const auditTimeoutRef = useRef<NodeJS.Timeout>()
  const observerRef = useRef<MutationObserver>()
  const highlightedElementRef = useRef<Element | null>(null)

  // WCAG 2.1 AA compliance rules
  const auditRules = [
    // Color and contrast
    {
      id: 'color-contrast',
      wcagRule: 'WCAG 1.4.3',
      severity: 'error' as const,
      check: (element: Element) => {
        if (element instanceof HTMLElement) {
          const style = window.getComputedStyle(element)
          const color = style.color
          const backgroundColor = style.backgroundColor
          
          // Simple contrast check (would need proper color parsing in production)
          if (color === 'rgb(255, 255, 255)' && backgroundColor === 'rgb(255, 255, 255)') {
            return {
              message: 'Insufficient color contrast',
              suggestion: 'Ensure text has sufficient contrast against background (4.5:1 for normal text)',
              impact: 'serious' as const
            }
          }
        }
        return null
      }
    },
    
    // Images and media
    {
      id: 'img-alt',
      wcagRule: 'WCAG 1.1.1',
      severity: 'error' as const,
      check: (element: Element) => {
        if (element.tagName === 'IMG') {
          const img = element as HTMLImageElement
          if (!img.alt && !img.getAttribute('aria-label') && !img.getAttribute('aria-labelledby')) {
            return {
              message: 'Image missing alt text',
              suggestion: 'Add alt attribute to describe the image content',
              impact: 'critical' as const
            }
          }
        }
        return null
      }
    },

    // Form controls
    {
      id: 'form-labels',
      wcagRule: 'WCAG 1.3.1',
      severity: 'error' as const,
      check: (element: Element) => {
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
          const input = element as HTMLInputElement
          const hasLabel = input.labels && input.labels.length > 0
          const hasAriaLabel = input.getAttribute('aria-label')
          const hasAriaLabelledBy = input.getAttribute('aria-labelledby')
          
          if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
            return {
              message: 'Form control missing accessible label',
              suggestion: 'Add a label element or aria-label attribute',
              impact: 'critical' as const
            }
          }
        }
        return null
      }
    },

    // Headings hierarchy
    {
      id: 'heading-order',
      wcagRule: 'WCAG 1.3.1',
      severity: 'error' as const,
      check: (element: Element) => {
        if (element.tagName.match(/^H[1-6]$/)) {
          const level = parseInt(element.tagName[1])
          const prevHeading = findPreviousHeading(element)
          
          if (prevHeading) {
            const prevLevel = parseInt(prevHeading.tagName[1])
            if (level > prevLevel + 1) {
              return {
                message: `Heading level skipped (${prevLevel} to ${level})`,
                suggestion: 'Use heading levels in sequential order',
                impact: 'moderate' as const
              }
            }
          }
        }
        return null
      }
    },

    // Links and buttons
    {
      id: 'link-purpose',
      wcagRule: 'WCAG 2.4.4',
      severity: 'warning' as const,
      check: (element: Element) => {
        if (element.tagName === 'A') {
          const link = element as HTMLAnchorElement
          const text = link.textContent?.trim()
          const ariaLabel = link.getAttribute('aria-label')
          
          if ((!text || text.length < 3) && !ariaLabel) {
            return {
              message: 'Link purpose unclear',
              suggestion: 'Provide descriptive link text or aria-label',
              impact: 'moderate' as const
            }
          }
        }
        return null
      }
    },

    // Focus management
    {
      id: 'focusable-elements',
      wcagRule: 'WCAG 2.1.1',
      severity: 'warning' as const,
      check: (element: Element) => {
        const focusableElements = ['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT']
        if (focusableElements.includes(element.tagName)) {
          const htmlElement = element as HTMLElement
          if (htmlElement.tabIndex === -1 && !htmlElement.getAttribute('aria-hidden')) {
            return {
              message: 'Interactive element not keyboard accessible',
              suggestion: 'Remove tabindex="-1" or add aria-hidden="true"',
              impact: 'serious' as const
            }
          }
        }
        return null
      }
    },

    // ARIA attributes
    {
      id: 'aria-valid',
      wcagRule: 'WCAG 4.1.2',
      severity: 'error' as const,
      check: (element: Element) => {
        const ariaAttributes = Array.from(element.attributes).filter(attr => attr.name.startsWith('aria-'))
        
        for (const attr of ariaAttributes) {
          // Basic ARIA validation (would need comprehensive list in production)
          const validAriaAttrs = [
            'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-hidden',
            'aria-expanded', 'aria-controls', 'aria-live', 'aria-atomic',
            'aria-relevant', 'aria-busy', 'aria-disabled', 'aria-invalid'
          ]
          
          if (!validAriaAttrs.includes(attr.name)) {
            return {
              message: `Invalid ARIA attribute: ${attr.name}`,
              suggestion: 'Use only valid ARIA attributes',
              impact: 'moderate' as const
            }
          }
        }
        return null
      }
    }
  ]

  // Helper function to find previous heading
  function findPreviousHeading(element: Element): Element | null {
    let current = element.previousElementSibling
    while (current) {
      if (current.tagName.match(/^H[1-6]$/)) {
        return current
      }
      current = current.previousElementSibling
    }
    return null
  }

  // Run accessibility audit
  const runAudit = useCallback(async (): Promise<AccessibilityIssue[]> => {
    setIsAuditing(true)
    const startTime = Date.now()
    
    try {
      const allElements = document.querySelectorAll('*')
      const foundIssues: AccessibilityIssue[] = []
      
      for (const element of allElements) {
        // Skip hidden elements unless checking for aria-hidden
        if (element instanceof HTMLElement && element.offsetParent === null) {
          continue
        }
        
        for (const rule of auditRules) {
          const result = rule.check(element)
          if (result) {
            foundIssues.push({
              id: `${rule.id}-${foundIssues.length}`,
              severity: rule.severity,
              wcagRule: rule.wcagRule,
              message: result.message,
              suggestion: result.suggestion,
              element,
              selector: getElementSelector(element),
              impact: result.impact,
              tags: ['wcag2a', 'wcag2aa']
            })
          }
        }
      }
      
      setIssues(foundIssues)
      setLastAuditTime(new Date())
      
      return foundIssues
    } finally {
      setIsAuditing(false)
    }
  }, [])

  // Get CSS selector for element
  function getElementSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`
    }
    
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.length > 0)
      if (classes.length > 0) {
        return `${element.tagName.toLowerCase()}.${classes.join('.')}`
      }
    }
    
    return element.tagName.toLowerCase()
  }

  // Highlight issue element
  const highlightIssue = useCallback((issue: AccessibilityIssue) => {
    // Remove previous highlight
    if (highlightedElementRef.current) {
      highlightedElementRef.current.classList.remove('accessibility-highlight')
    }
    
    if (issue.element) {
      issue.element.classList.add('accessibility-highlight')
      issue.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      highlightedElementRef.current = issue.element
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        issue.element?.classList.remove('accessibility-highlight')
        if (highlightedElementRef.current === issue.element) {
          highlightedElementRef.current = null
        }
      }, 3000)
    }
  }, [])

  // Get issue count by severity
  const getIssueCount = useCallback((severity: AccessibilityIssue['severity']) => {
    return issues.filter(issue => issue.severity === severity).length
  }, [issues])

  // Generate accessibility report
  const generateReport = useCallback((): AccessibilityReport => {
    const errors = getIssueCount('error')
    const warnings = getIssueCount('warning')
    const info = getIssueCount('info')
    
    let wcagLevel: AccessibilityReport['summary']['wcagLevel'] = 'AAA'
    if (errors > 0) wcagLevel = 'Non-compliant'
    else if (warnings > 0) wcagLevel = 'A'
    else wcagLevel = 'AA'
    
    return {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      issues,
      summary: {
        total: issues.length,
        errors,
        warnings,
        info,
        wcagLevel
      },
      metadata: {
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        auditDuration: lastAuditTime ? Date.now() - lastAuditTime.getTime() : 0
      }
    }
  }, [issues, getIssueCount, lastAuditTime])

  // Run full audit
  const runFullAudit = useCallback(async () => {
    return await runAudit()
  }, [runAudit])

  // Set up mutation observer for automatic auditing
  useEffect(() => {
    if (!enabled) {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      return
    }

    const throttleMs = options.throttleMs || 1000
    
    observerRef.current = new MutationObserver(() => {
      if (auditTimeoutRef.current) {
        clearTimeout(auditTimeoutRef.current)
      }
      
      auditTimeoutRef.current = setTimeout(() => {
        runAudit()
      }, throttleMs)
    })

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id', 'aria-*', 'alt', 'title']
    })

    // Run initial audit
    if (options.autoRun !== false) {
      runAudit()
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      if (auditTimeoutRef.current) {
        clearTimeout(auditTimeoutRef.current)
      }
    }
  }, [enabled, runAudit, options.throttleMs, options.autoRun])

  // Add highlight styles
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      .accessibility-highlight {
        outline: 3px solid #ff6b6b !important;
        outline-offset: 2px !important;
        background-color: rgba(255, 107, 107, 0.1) !important;
        animation: accessibility-pulse 2s infinite;
      }
      
      @keyframes accessibility-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    `
    document.head.appendChild(style)
    
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return {
    issues,
    isAuditing,
    lastAuditTime,
    runAudit,
    runFullAudit,
    highlightIssue,
    getIssueCount,
    generateReport
  }
}
