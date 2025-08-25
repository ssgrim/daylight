/**
 * Error Handling Demo Page
 * Demonstrates various error scenarios and user-friendly handling
 */

import React, { useState } from 'react'
import { useError } from '../components/ErrorProvider'
import { api, handleApiError } from '../utils/api-client'
import { Form, FormField, FormSelect, FormTextarea, SubmitButton } from '../components/FormComponents'

export default function ErrorDemo() {
  const { showError } = useError()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    priority: '',
    message: ''
  })

  // Demo error scenarios
  const demoErrors = [
    {
      title: 'Network Error',
      description: 'Simulate a network connection issue',
      action: () => {
        showError(new Error('Failed to fetch'), {
          type: 'network',
          source: 'demo'
        })
      }
    },
    {
      title: 'Authentication Error',
      description: 'Simulate session expiration',
      action: () => {
        const error = new Error('Unauthorized')
        Object.assign(error, { status: 401 })
        showError(error, { source: 'demo' })
      }
    },
    {
      title: 'Validation Error',
      description: 'Simulate form validation failure',
      action: () => {
        const error = new Error('Validation failed')
        Object.assign(error, { 
          status: 400,
          details: [
            { field: 'email', message: 'Please enter a valid email address' },
            { field: 'name', message: 'Name is required' }
          ]
        })
        showError(error, { source: 'demo' })
      }
    },
    {
      title: 'Server Error',
      description: 'Simulate internal server error',
      action: () => {
        const error = new Error('Internal Server Error')
        Object.assign(error, { status: 500 })
        showError(error, { source: 'demo' })
      }
    },
    {
      title: 'Not Found Error',
      description: 'Simulate resource not found',
      action: () => {
        const error = new Error('Not Found')
        Object.assign(error, { status: 404 })
        showError(error, { source: 'demo' })
      }
    },
    {
      title: 'Custom Warning',
      description: 'Show a custom warning message',
      action: () => {
        showError({
          id: 'custom-warning-' + Date.now(),
          type: 'validation',
          severity: 'low',
          title: 'Data Saved as Draft',
          message: 'Your changes have been saved as a draft. Remember to publish when ready.',
          details: 'Drafts are automatically saved every 30 seconds.',
          actions: [
            {
              label: 'Publish Now',
              handler: () => alert('Published!'),
              variant: 'primary',
              icon: '🚀'
            },
            {
              label: 'Keep as Draft',
              handler: () => console.log('Keeping as draft'),
              variant: 'secondary',
              icon: '📝'
            }
          ],
          timestamp: new Date(),
          canRetry: false,
          isDismissible: true
        })
      }
    }
  ]

  // Simulate API call with error
  const testApiError = async () => {
    try {
      // This will fail and demonstrate API error handling
      await api.trips.get('non-existent-id')
    } catch (error) {
      handleApiError(error)
    }
  }

  // Handle form submission
  const handleSubmit = async (formData: FormData) => {
    const data = Object.fromEntries(formData.entries())
    
    // Simulate validation
    if (!data.name) {
      throw new Error('Name is required')
    }
    
    if (!data.email || !data.email.toString().includes('@')) {
      throw new Error('Valid email is required')
    }

    // Simulate success
    showError({
      id: 'form-success-' + Date.now(),
      type: 'validation',
      severity: 'low',
      title: 'Form Submitted Successfully',
      message: 'Thank you for your feedback! We\'ll get back to you soon.',
      details: 'You should receive a confirmation email within the next few minutes.',
      actions: [],
      timestamp: new Date(),
      canRetry: false,
      isDismissible: true
    })

    // Reset form
    setFormData({ name: '', email: '', priority: '', message: '' })
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Error Handling Demo
          </h1>
          <p className="text-gray-600 mb-6">
            This page demonstrates the enhanced error handling system with user-friendly messages and actionable options.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Error Scenarios */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Error Scenarios
              </h2>
              <div className="space-y-3">
                {demoErrors.map((demo, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-1">
                      {demo.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      {demo.description}
                    </p>
                    <button
                      onClick={demo.action}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Trigger Error
                    </button>
                  </div>
                ))}
              </div>

              {/* API Error Test */}
              <div className="mt-6 border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-1">
                  API Error Test
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Test the API client error handling with a real API call
                </p>
                <button
                  onClick={testApiError}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Test API Error
                </button>
              </div>
            </div>

            {/* Form with Error Handling */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Form Error Handling
              </h2>
              <div className="border border-gray-200 rounded-lg p-4">
                <Form onSubmit={handleSubmit}>
                  <FormField
                    label="Full Name"
                    name="name"
                    value={formData.name}
                    onChange={(value: string) => setFormData(prev => ({ ...prev, name: value }))}
                    placeholder="Enter your full name"
                    required
                    description="This field is required for form submission"
                  />

                  <FormField
                    label="Email Address"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={(value: string) => setFormData(prev => ({ ...prev, email: value }))}
                    placeholder="Enter your email address"
                    required
                  />

                  <FormSelect
                    label="Priority"
                    name="priority"
                    value={formData.priority}
                    onChange={(value: string) => setFormData(prev => ({ ...prev, priority: value }))}
                    placeholder="Select priority level"
                    options={[
                      { value: 'low', label: 'Low Priority' },
                      { value: 'medium', label: 'Medium Priority' },
                      { value: 'high', label: 'High Priority' },
                      { value: 'urgent', label: 'Urgent' }
                    ]}
                  />

                  <FormTextarea
                    label="Message"
                    name="message"
                    value={formData.message}
                    onChange={(value: string) => setFormData(prev => ({ ...prev, message: value }))}
                    placeholder="Enter your message or feedback"
                    rows={4}
                    description="Optional: Provide additional details or feedback"
                  />

                  <SubmitButton variant="primary">
                    Submit Form
                  </SubmitButton>
                </Form>

                <div className="mt-4 p-3 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Try this:</strong> Submit the form without filling required fields to see validation errors, 
                    or fill it correctly to see a success message.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="mt-8 grid md:grid-cols-3 gap-6">
            <div className="text-center p-4">
              <div className="text-3xl mb-2">🎯</div>
              <h3 className="font-semibold text-gray-800 mb-2">User-Friendly Messages</h3>
              <p className="text-sm text-gray-600">
                Clear, actionable error messages that help users understand and resolve issues
              </p>
            </div>
            
            <div className="text-center p-4">
              <div className="text-3xl mb-2">🔄</div>
              <h3 className="font-semibold text-gray-800 mb-2">Automatic Retry</h3>
              <p className="text-sm text-gray-600">
                Built-in retry logic for transient errors with exponential backoff
              </p>
            </div>
            
            <div className="text-center p-4">
              <div className="text-3xl mb-2">🛡️</div>
              <h3 className="font-semibold text-gray-800 mb-2">Error Boundaries</h3>
              <p className="text-sm text-gray-600">
                Graceful error recovery that prevents application crashes
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
