/**
 * Accessibility Dashboard
 * UI component for displaying accessibility audit results and controls
 */

import React, { useState } from 'react'
import { useAccessibilityAudit, AccessibilityIssue } from '../hooks/useAccessibilityAudit'
import { AccessibleButton, AccessibleHeading, ScreenReaderOnly } from './AccessibilityComponents'

interface AccessibilityDashboardProps {
  isOpen: boolean
  onClose: () => void
}

export function AccessibilityDashboard({ isOpen, onClose }: AccessibilityDashboardProps) {
  const [isAuditEnabled, setIsAuditEnabled] = useState(false)
  const { issues, isAuditing, runFullAudit, highlightIssue, getIssueCount, generateReport } = useAccessibilityAudit(isAuditEnabled)

  const handleToggleAudit = () => {
    setIsAuditEnabled(!isAuditEnabled)
  }

  const handleDownloadReport = () => {
    const report = generateReport()
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'accessibility-audit-report.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getSeverityColor = (severity: AccessibilityIssue['severity']) => {
    switch (severity) {
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getSeverityIcon = (severity: AccessibilityIssue['severity']) => {
    switch (severity) {
      case 'error':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'info':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        )
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black bg-opacity-50">
      <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 p-4">
            <AccessibleHeading level={2} className="text-lg font-semibold text-gray-900">
              Accessibility Audit
            </AccessibleHeading>
            <AccessibleButton
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close accessibility dashboard"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </AccessibleButton>
          </div>

          {/* Controls */}
          <div className="border-b border-gray-200 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="audit-toggle" className="text-sm font-medium text-gray-700">
                Real-time Audit
              </label>
              <button
                id="audit-toggle"
                type="button"
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  ${isAuditEnabled ? 'bg-blue-600' : 'bg-gray-200'}
                `}
                onClick={handleToggleAudit}
                aria-pressed={isAuditEnabled}
                aria-describedby="audit-toggle-description"
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${isAuditEnabled ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
            
            <div id="audit-toggle-description" className="text-xs text-gray-500">
              {isAuditEnabled ? 'Automatically audit page changes' : 'Manual audit only'}
            </div>

            <div className="flex gap-2">
              <AccessibleButton
                variant="primary"
                size="sm"
                onClick={runFullAudit}
                isLoading={isAuditing}
                loadingText="Auditing..."
                className="flex-1"
              >
                Run Audit
              </AccessibleButton>
              
              <AccessibleButton
                variant="secondary"
                size="sm"
                onClick={handleDownloadReport}
                disabled={issues.length === 0}
                className="flex-1"
              >
                Export Report
              </AccessibleButton>
            </div>
          </div>

          {/* Summary */}
          <div className="border-b border-gray-200 p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-red-600">{getIssueCount('error')}</div>
                <div className="text-xs text-gray-500">Errors</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{getIssueCount('warning')}</div>
                <div className="text-xs text-gray-500">Warnings</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{getIssueCount('info')}</div>
                <div className="text-xs text-gray-500">Info</div>
              </div>
            </div>
            
            {issues.length > 0 && (
              <div className="mt-4 text-center">
                <span className={`
                  inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${getIssueCount('error') === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                `}>
                  {getIssueCount('error') === 0 ? 'WCAG AA Compliant' : 'Non-compliant'}
                </span>
              </div>
            )}
          </div>

          {/* Issues List */}
          <div className="flex-1 overflow-y-auto">
            {issues.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {isAuditing ? (
                  <div className="space-y-2">
                    <div className="animate-spin mx-auto h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    <div>Running accessibility audit...</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>No accessibility issues found</div>
                    <div className="text-sm">Run an audit to check for issues</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {issues.map((issue, index) => (
                  <div
                    key={index}
                    className={`
                      border rounded-lg p-3 ${getSeverityColor(issue.severity)}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getSeverityIcon(issue.severity)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">
                          {issue.message}
                        </div>
                        
                        <div className="mt-1 text-xs">
                          <div className="text-gray-600">
                            {issue.suggestion}
                          </div>
                          <div className="mt-1 font-mono text-gray-500">
                            {issue.wcagRule}
                          </div>
                        </div>
                        
                        {issue.element && (
                          <AccessibleButton
                            variant="ghost"
                            size="sm"
                            onClick={() => highlightIssue(issue)}
                            className="mt-2 text-xs"
                          >
                            Highlight Element
                          </AccessibleButton>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <ScreenReaderOnly>
        <div aria-live="polite" aria-atomic="true">
          {isAuditing && 'Accessibility audit in progress'}
          {!isAuditing && issues.length > 0 && 
            `Accessibility audit complete. Found ${getIssueCount('error')} errors, ${getIssueCount('warning')} warnings, and ${getIssueCount('info')} informational items.`
          }
        </div>
      </ScreenReaderOnly>
    </div>
  )
}
