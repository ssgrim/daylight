/**
 * Accessibility Audit Hook
 * Provides utilities for auditing and improving accessibility compliance
 */

import { useEffect, useState, useCallback } from 'react'
import { getContrastRatio, meetsContrastRequirements } from '../utils/accessibility'

export interface AccessibilityIssue {
  type: 'contrast' | 'heading-structure' | 'missing-alt' | 'form-labels' | 'focus-management' | 'aria-labels'
  severity: 'error' | 'warning' | 'info'
  element?: HTMLElement
  message: string
  suggestion: string
  wcagRule: string
}

/**
 * Hook for auditing accessibility issues on the current page
 */
export function useAccessibilityAudit(isEnabled = false) {
  const [issues, setIssues] = useState<AccessibilityIssue[]>([])
  const [isAuditing, setIsAuditing] = useState(false)

  const auditContrastRatios = useCallback(() => {
    const issues: AccessibilityIssue[] = []
    const elements = document.querySelectorAll('*')

    elements.forEach(element => {
      const computedStyle = window.getComputedStyle(element)
      const color = computedStyle.color
      const backgroundColor = computedStyle.backgroundColor

      // Skip elements with transparent backgrounds
      if (backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
        return
      }

      // Convert colors to hex for contrast checking
      // This is simplified - in production, use a proper color conversion library
      const hasText = element.textContent && element.textContent.trim().length > 0

      if (hasText && color && backgroundColor) {
        try {
          // Simplified color conversion - implement proper conversion in production
          const isSmallText = parseFloat(computedStyle.fontSize) < 18
          const passes = meetsContrastRequirements(color, backgroundColor, 'AA', isSmallText ? 'normal' : 'large')

          if (!passes) {
            issues.push({
              type: 'contrast',
              severity: 'error',
              element: element as HTMLElement,
              message: `Insufficient color contrast ratio`,
              suggestion: 'Increase contrast between text and background colors',
              wcagRule: 'WCAG 2.1 AA - 1.4.3 Contrast (Minimum)'
            })
          }
        } catch (error) {
          // Skip elements where color extraction fails
        }
      }
    })

    return issues
  }, [])

  const auditHeadingStructure = useCallback(() => {
    const issues: AccessibilityIssue[] = []
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
    let previousLevel = 0

    headings.forEach(heading => {
      const currentLevel = parseInt(heading.tagName.substring(1))
      
      if (previousLevel === 0 && currentLevel !== 1) {
        issues.push({
          type: 'heading-structure',
          severity: 'warning',
          element: heading as HTMLElement,
          message: 'Page should start with an h1 heading',
          suggestion: 'Use h1 for the main page heading',
          wcagRule: 'WCAG 2.1 AA - 1.3.1 Info and Relationships'
        })
      } else if (currentLevel > previousLevel + 1) {
        issues.push({
          type: 'heading-structure',
          severity: 'warning',
          element: heading as HTMLElement,
          message: `Heading level jumps from h${previousLevel} to h${currentLevel}`,
          suggestion: 'Use heading levels in sequential order',
          wcagRule: 'WCAG 2.1 AA - 1.3.1 Info and Relationships'
        })
      }

      previousLevel = currentLevel
    })

    return issues
  }, [])

  const auditImages = useCallback(() => {
    const issues: AccessibilityIssue[] = []
    const images = document.querySelectorAll('img')

    images.forEach(img => {
      const hasAlt = img.hasAttribute('alt')
      const altText = img.getAttribute('alt') || ''
      const isDecorative = altText === '' || img.getAttribute('role') === 'presentation'

      if (!hasAlt) {
        issues.push({
          type: 'missing-alt',
          severity: 'error',
          element: img,
          message: 'Image missing alt attribute',
          suggestion: 'Add alt attribute to describe the image or use alt="" for decorative images',
          wcagRule: 'WCAG 2.1 AA - 1.1.1 Non-text Content'
        })
      } else if (!isDecorative && altText.length < 3) {
        issues.push({
          type: 'missing-alt',
          severity: 'warning',
          element: img,
          message: 'Alt text may be too short to be meaningful',
          suggestion: 'Provide a more descriptive alt text that explains the image content',
          wcagRule: 'WCAG 2.1 AA - 1.1.1 Non-text Content'
        })
      }
    })

    return issues
  }, [])

  const auditFormLabels = useCallback(() => {
    const issues: AccessibilityIssue[] = []
    const inputs = document.querySelectorAll('input, select, textarea')

    inputs.forEach(input => {
      const hasLabel = input.id && document.querySelector(`label[for="${input.id}"]`)
      const hasAriaLabel = input.hasAttribute('aria-label')
      const hasAriaLabelledBy = input.hasAttribute('aria-labelledby')

      if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
        issues.push({
          type: 'form-labels',
          severity: 'error',
          element: input as HTMLElement,
          message: 'Form input missing accessible label',
          suggestion: 'Add a label element, aria-label, or aria-labelledby attribute',
          wcagRule: 'WCAG 2.1 AA - 1.3.1 Info and Relationships'
        })
      }
    })

    return issues
  }, [])

  const auditFocusManagement = useCallback(() => {
    const issues: AccessibilityIssue[] = []
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    focusableElements.forEach(element => {
      const computedStyle = window.getComputedStyle(element)
      const hasVisibleFocus = computedStyle.outlineStyle !== 'none' || 
                            computedStyle.boxShadow.includes('inset') ||
                            element.classList.contains('focus:ring') ||
                            element.classList.contains('focus:outline')

      if (!hasVisibleFocus) {
        issues.push({
          type: 'focus-management',
          severity: 'warning',
          element: element as HTMLElement,
          message: 'Interactive element may not have visible focus indicator',
          suggestion: 'Add visible focus styles using outline or box-shadow',
          wcagRule: 'WCAG 2.1 AA - 2.4.7 Focus Visible'
        })
      }
    })

    return issues
  }, [])

  const runFullAudit = useCallback(async () => {
    setIsAuditing(true)
    
    const allIssues = [
      ...auditContrastRatios(),
      ...auditHeadingStructure(),
      ...auditImages(),
      ...auditFormLabels(),
      ...auditFocusManagement()
    ]

    // Sort by severity
    const sortedIssues = allIssues.sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, info: 2 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })

    setIssues(sortedIssues)
    setIsAuditing(false)
  }, [auditContrastRatios, auditHeadingStructure, auditImages, auditFormLabels, auditFocusManagement])

  const highlightIssue = useCallback((issue: AccessibilityIssue) => {
    if (issue.element) {
      issue.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      issue.element.style.outline = '3px solid red'
      issue.element.style.outlineOffset = '2px'
      
      setTimeout(() => {
        issue.element!.style.outline = ''
        issue.element!.style.outlineOffset = ''
      }, 3000)
    }
  }, [])

  const getIssueCount = useCallback((severity?: AccessibilityIssue['severity']) => {
    if (!severity) return issues.length
    return issues.filter(issue => issue.severity === severity).length
  }, [issues])

  const generateReport = useCallback(() => {
    const errorCount = getIssueCount('error')
    const warningCount = getIssueCount('warning')
    const infoCount = getIssueCount('info')

    const report = {
      summary: {
        total: issues.length,
        errors: errorCount,
        warnings: warningCount,
        info: infoCount,
        compliance: errorCount === 0 ? 'AA Compliant' : 'Non-compliant'
      },
      issues: issues.map(issue => ({
        type: issue.type,
        severity: issue.severity,
        message: issue.message,
        suggestion: issue.suggestion,
        wcagRule: issue.wcagRule,
        elementInfo: issue.element ? {
          tagName: issue.element.tagName,
          className: issue.element.className,
          id: issue.element.id
        } : null
      }))
    }

    return report
  }, [issues, getIssueCount])

  useEffect(() => {
    if (isEnabled) {
      // Run audit when enabled or when DOM changes
      const observer = new MutationObserver(() => {
        runFullAudit()
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'aria-label', 'aria-labelledby', 'alt']
      })

      // Initial audit
      runFullAudit()

      return () => {
        observer.disconnect()
      }
    }
  }, [isEnabled, runFullAudit])

  return {
    issues,
    isAuditing,
    runFullAudit,
    highlightIssue,
    getIssueCount,
    generateReport
  }
}
