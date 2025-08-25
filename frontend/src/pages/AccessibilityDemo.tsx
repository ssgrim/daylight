/**
 * Accessibility Demo Page
 * Demonstrates accessibility features and provides testing scenarios
 */

import React, { useState } from 'react'
import { AccessibilityProvider, useAccessibility } from '../providers/AccessibilityProvider'
import { AccessibleButton, AccessibleHeading, AccessibleModal, ScreenReaderOnly } from '../components/AccessibilityComponents'
import { FormField, FormSelect, FormTextarea, Form, SubmitButton } from '../components/FormComponents'

function AccessibilityDemoContent() {
  const { 
    announceToScreenReader, 
    isHighContrastMode, 
    toggleHighContrast,
    fontSize,
    setFontSize,
    openDashboard
  } = useAccessibility()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: '',
    message: ''
  })

  const handleAnnouncementTest = () => {
    announceToScreenReader('This is a test announcement for screen readers!', 'polite')
  }

  const handleFormSubmit = async (data: FormData) => {
    announceToScreenReader('Form submitted successfully!', 'polite')
    console.log('Form data:', Object.fromEntries(data))
  }

  const demoOptions = [
    { value: '', label: 'Select a category...' },
    { value: 'feedback', label: 'Feedback' },
    { value: 'support', label: 'Support' },
    { value: 'bug', label: 'Bug Report' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Skip to main content target */}
      <div id="main-content" tabIndex={-1}>
        <div className="max-w-4xl mx-auto p-6 space-y-8">
          {/* Header */}
          <header>
            <AccessibleHeading level={1} className="text-gray-900 mb-4">
              Accessibility Demo & Testing Page
            </AccessibleHeading>
            <p className="text-gray-600 text-lg">
              This page demonstrates comprehensive accessibility features and provides testing scenarios 
              for keyboard navigation, screen readers, and various accessibility tools.
            </p>
          </header>

          {/* Accessibility Controls */}
          <section aria-labelledby="controls-heading" className="bg-white rounded-lg shadow p-6">
            <AccessibleHeading level={2} id="controls-heading" className="text-gray-900 mb-4">
              Accessibility Controls
            </AccessibleHeading>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <AccessibleButton
                variant="primary"
                onClick={openDashboard}
                className="w-full"
              >
                Open A11y Dashboard
              </AccessibleButton>

              <AccessibleButton
                variant="secondary"
                onClick={toggleHighContrast}
                className="w-full"
              >
                {isHighContrastMode ? 'Disable' : 'Enable'} High Contrast
              </AccessibleButton>

              <AccessibleButton
                variant="secondary"
                onClick={handleAnnouncementTest}
                className="w-full"
              >
                Test Screen Reader
              </AccessibleButton>

              <div className="space-y-2">
                <label htmlFor="font-size-select" className="block text-sm font-medium text-gray-700">
                  Font Size
                </label>
                <select
                  id="font-size-select"
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value as 'normal' | 'large' | 'extra-large')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="normal">Normal</option>
                  <option value="large">Large</option>
                  <option value="extra-large">Extra Large</option>
                </select>
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-md">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Keyboard Shortcuts:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li><kbd className="px-2 py-1 bg-blue-200 rounded">Alt + A</kbd> - Open accessibility dashboard</li>
                <li><kbd className="px-2 py-1 bg-blue-200 rounded">Alt + C</kbd> - Toggle high contrast mode</li>
                <li><kbd className="px-2 py-1 bg-blue-200 rounded">Alt + +</kbd> - Increase font size</li>
                <li><kbd className="px-2 py-1 bg-blue-200 rounded">Alt + -</kbd> - Decrease font size</li>
                <li><kbd className="px-2 py-1 bg-blue-200 rounded">Escape</kbd> - Close modals</li>
              </ul>
            </div>
          </section>

          {/* Form Accessibility Demo */}
          <section aria-labelledby="form-heading" className="bg-white rounded-lg shadow p-6">
            <AccessibleHeading level={2} id="form-heading" className="text-gray-900 mb-4">
              Form Accessibility Demo
            </AccessibleHeading>
            
            <Form onSubmit={handleFormSubmit} className="space-y-4">
              <FormField
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
                required
                description="Enter your first and last name"
              />

              <FormField
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={(value) => setFormData(prev => ({ ...prev, email: value }))}
                required
                description="We'll use this to contact you"
              />

              <FormSelect
                label="Category"
                name="category"
                options={demoOptions}
                value={formData.category}
                onChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                required
                description="Select the type of inquiry"
              />

              <FormTextarea
                label="Message"
                name="message"
                value={formData.message}
                onChange={(value) => setFormData(prev => ({ ...prev, message: value }))}
                required
                rows={4}
                description="Please provide details about your inquiry"
              />

              <SubmitButton variant="primary">
                Submit Form
              </SubmitButton>
            </Form>
          </section>

          {/* Interactive Elements Demo */}
          <section aria-labelledby="interactive-heading" className="bg-white rounded-lg shadow p-6">
            <AccessibleHeading level={2} id="interactive-heading" className="text-gray-900 mb-4">
              Interactive Elements
            </AccessibleHeading>
            
            <div className="space-y-4">
              <div>
                <AccessibleButton
                  variant="primary"
                  onClick={() => setIsModalOpen(true)}
                >
                  Open Modal Dialog
                </AccessibleButton>
                <ScreenReaderOnly>
                  This button opens a modal dialog that demonstrates focus management
                </ScreenReaderOnly>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <AccessibleButton variant="primary">Primary Action</AccessibleButton>
                <AccessibleButton variant="secondary">Secondary Action</AccessibleButton>
                <AccessibleButton variant="danger">Danger Action</AccessibleButton>
              </div>

              <div>
                <AccessibleButton 
                  variant="primary" 
                  isLoading={false}
                  onClick={() => {
                    announceToScreenReader('Button clicked!', 'polite')
                  }}
                >
                  Click for Announcement
                </AccessibleButton>
              </div>
            </div>
          </section>

          {/* Heading Structure Demo */}
          <section aria-labelledby="headings-demo" className="bg-white rounded-lg shadow p-6">
            <AccessibleHeading level={2} id="headings-demo" className="text-gray-900 mb-4">
              Proper Heading Structure
            </AccessibleHeading>
            
            <div className="space-y-4">
              <div>
                <AccessibleHeading level={3} className="text-gray-800">
                  Level 3 Heading
                </AccessibleHeading>
                <p className="text-gray-600">This demonstrates proper heading hierarchy.</p>
              </div>

              <div>
                <AccessibleHeading level={4} className="text-gray-700">
                  Level 4 Heading
                </AccessibleHeading>
                <p className="text-gray-600">Screen readers use headings to navigate content.</p>
              </div>

              <div>
                <AccessibleHeading level={5} className="text-gray-700">
                  Level 5 Heading
                </AccessibleHeading>
                <p className="text-gray-600">Always use headings in sequential order.</p>
              </div>
            </div>
          </section>

          {/* List and Table Demo */}
          <section aria-labelledby="content-demo" className="bg-white rounded-lg shadow p-6">
            <AccessibleHeading level={2} id="content-demo" className="text-gray-900 mb-4">
              Accessible Content Examples
            </AccessibleHeading>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <AccessibleHeading level={3} className="text-gray-800 mb-3">
                  Accessible List
                </AccessibleHeading>
                <ul className="space-y-2 text-gray-600">
                  <li>• Proper list semantics</li>
                  <li>• Screen reader friendly</li>
                  <li>• Clear visual hierarchy</li>
                  <li>• Keyboard navigable</li>
                </ul>
              </div>

              <div>
                <AccessibleHeading level={3} className="text-gray-800 mb-3">
                  Accessible Table
                </AccessibleHeading>
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th scope="col" className="border border-gray-300 px-4 py-2 text-left">Feature</th>
                      <th scope="col" className="border border-gray-300 px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row" className="border border-gray-300 px-4 py-2 font-medium">Focus Management</th>
                      <td className="border border-gray-300 px-4 py-2 text-green-600">✓ Implemented</td>
                    </tr>
                    <tr>
                      <th scope="row" className="border border-gray-300 px-4 py-2 font-medium">Screen Reader Support</th>
                      <td className="border border-gray-300 px-4 py-2 text-green-600">✓ Implemented</td>
                    </tr>
                    <tr>
                      <th scope="row" className="border border-gray-300 px-4 py-2 font-medium">Keyboard Navigation</th>
                      <td className="border border-gray-300 px-4 py-2 text-green-600">✓ Implemented</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Modal Demo */}
      <AccessibleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Accessibility Demo Modal"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            This modal demonstrates proper focus management, keyboard navigation, 
            and ARIA attributes for screen reader compatibility.
          </p>
          
          <div className="space-y-2">
            <AccessibleButton
              variant="primary"
              onClick={() => {
                announceToScreenReader('First button clicked in modal', 'polite')
              }}
            >
              First Button
            </AccessibleButton>
            
            <AccessibleButton
              variant="secondary"
              onClick={() => {
                announceToScreenReader('Second button clicked in modal', 'polite')
              }}
            >
              Second Button
            </AccessibleButton>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <AccessibleButton
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </AccessibleButton>
            <AccessibleButton
              variant="primary"
              onClick={() => {
                announceToScreenReader('Modal action confirmed', 'polite')
                setIsModalOpen(false)
              }}
            >
              Confirm
            </AccessibleButton>
          </div>
        </div>
      </AccessibleModal>
    </div>
  )
}

export default function AccessibilityDemo() {
  return (
    <AccessibilityProvider>
      <AccessibilityDemoContent />
    </AccessibilityProvider>
  )
}
