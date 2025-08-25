/**
 * Enhanced Form Components with Error Handling
 * Provides user-friendly form components with built-in error display
 */

import React, { useState, useCallback } from 'react'
import { useFormError } from './ErrorProvider'

interface FormFieldProps {
  label: string
  name: string
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url'
  placeholder?: string
  required?: boolean
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  description?: string
}

interface FormSelectProps {
  label: string
  name: string
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  description?: string
}

interface FormTextareaProps {
  label: string
  name: string
  placeholder?: string
  required?: boolean
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  rows?: number
  className?: string
  description?: string
}

/**
 * Enhanced form field with error display
 */
export function FormField({ 
  label, 
  name, 
  type = 'text', 
  placeholder, 
  required = false,
  value, 
  onChange, 
  disabled = false,
  className = '',
  description
}: FormFieldProps) {
  const { fieldErrors, clearFieldError } = useFormError()
  const hasError = name in fieldErrors
  const errorMessage = fieldErrors[name]

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    
    // Clear error when user starts typing
    if (hasError) {
      clearFieldError(name)
    }
  }, [onChange, hasError, clearFieldError, name])

  const fieldId = `field-${name}`
  const errorId = `error-${name}`
  const descriptionId = `description-${name}`

  return (
    <div className={`space-y-1 ${className}`}>
      <label 
        htmlFor={fieldId}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {description && (
        <p id={descriptionId} className="text-sm text-gray-600">
          {description}
        </p>
      )}
      
      <input
        id={fieldId}
        name={name}
        type={type}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`
          block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 sm:text-sm
          ${hasError 
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          }
          ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'}
        `}
        aria-invalid={hasError}
        aria-describedby={`${hasError ? errorId : ''} ${description ? descriptionId : ''}`.trim()}
      />
      
      {hasError && (
        <div id={errorId} className="flex items-center space-x-1 text-red-600">
          <span className="text-sm">⚠️</span>
          <span className="text-sm">{errorMessage}</span>
        </div>
      )}
    </div>
  )
}

/**
 * Enhanced select field with error display
 */
export function FormSelect({
  label,
  name,
  options,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  className = '',
  description
}: FormSelectProps) {
  const { fieldErrors, clearFieldError } = useFormError()
  const hasError = name in fieldErrors
  const errorMessage = fieldErrors[name]

  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    
    // Clear error when user makes selection
    if (hasError) {
      clearFieldError(name)
    }
  }, [onChange, hasError, clearFieldError, name])

  const fieldId = `field-${name}`
  const errorId = `error-${name}`
  const descriptionId = `description-${name}`

  return (
    <div className={`space-y-1 ${className}`}>
      <label 
        htmlFor={fieldId}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {description && (
        <p id={descriptionId} className="text-sm text-gray-600">
          {description}
        </p>
      )}
      
      <select
        id={fieldId}
        name={name}
        value={value}
        onChange={handleChange}
        required={required}
        disabled={disabled}
        className={`
          block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 sm:text-sm
          ${hasError 
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          }
          ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'}
        `}
        aria-invalid={hasError}
        aria-describedby={`${hasError ? errorId : ''} ${description ? descriptionId : ''}`.trim()}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      {hasError && (
        <div id={errorId} className="flex items-center space-x-1 text-red-600">
          <span className="text-sm">⚠️</span>
          <span className="text-sm">{errorMessage}</span>
        </div>
      )}
    </div>
  )
}

/**
 * Enhanced textarea field with error display
 */
export function FormTextarea({
  label,
  name,
  placeholder,
  required = false,
  value,
  onChange,
  disabled = false,
  rows = 3,
  className = '',
  description
}: FormTextareaProps) {
  const { fieldErrors, clearFieldError } = useFormError()
  const hasError = name in fieldErrors
  const errorMessage = fieldErrors[name]

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    
    // Clear error when user starts typing
    if (hasError) {
      clearFieldError(name)
    }
  }, [onChange, hasError, clearFieldError, name])

  const fieldId = `field-${name}`
  const errorId = `error-${name}`
  const descriptionId = `description-${name}`

  return (
    <div className={`space-y-1 ${className}`}>
      <label 
        htmlFor={fieldId}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {description && (
        <p id={descriptionId} className="text-sm text-gray-600">
          {description}
        </p>
      )}
      
      <textarea
        id={fieldId}
        name={name}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        rows={rows}
        className={`
          block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 sm:text-sm resize-vertical
          ${hasError 
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          }
          ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'}
        `}
        aria-invalid={hasError}
        aria-describedby={`${hasError ? errorId : ''} ${description ? descriptionId : ''}`.trim()}
      />
      
      {hasError && (
        <div id={errorId} className="flex items-center space-x-1 text-red-600">
          <span className="text-sm">⚠️</span>
          <span className="text-sm">{errorMessage}</span>
        </div>
      )}
    </div>
  )
}

/**
 * Enhanced form wrapper with submission error handling
 */
interface FormProps {
  onSubmit: (data: FormData) => Promise<void> | void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

export function Form({ onSubmit, children, className = '', disabled = false }: FormProps) {
  const { handleValidationError, clearAllFieldErrors } = useFormError()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (disabled || isSubmitting) return

    setIsSubmitting(true)
    clearAllFieldErrors()

    try {
      const formData = new FormData(e.currentTarget)
      await onSubmit(formData)
    } catch (error) {
      handleValidationError(error)
    } finally {
      setIsSubmitting(false)
    }
  }, [onSubmit, disabled, isSubmitting, clearAllFieldErrors, handleValidationError])

  return (
    <form 
      onSubmit={handleSubmit}
      className={className}
      noValidate
    >
      <fieldset disabled={disabled || isSubmitting} className="space-y-4">
        {children}
      </fieldset>
    </form>
  )
}

/**
 * Submit button with loading state
 */
interface SubmitButtonProps {
  children: React.ReactNode
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
  className?: string
}

export function SubmitButton({ 
  children, 
  loading = false, 
  disabled = false,
  variant = 'primary',
  className = ''
}: SubmitButtonProps) {
  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white',
    secondary: 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500 text-white',
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white'
  }

  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={`
        w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium
        focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors
        ${variantStyles[variant]}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {loading ? (
        <div className="flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing...
        </div>
      ) : (
        children
      )}
    </button>
  )
}
